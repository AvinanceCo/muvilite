/**
 * Admin game service — the writes that involve a bundle.
 *
 * Purpose: create a game from an uploaded ZIP, replace an existing game's
 *          bundle, and delete a game together with its files.
 * Inputs:  form fields, a multer file, the acting administrator
 * Outputs: the game document, with its genre populated
 * Deps:    repositories, services/{gameBundle,auditLog}, config/constants
 *
 * NO LEGACY ANCESTOR. The create and delete flows are Playva's
 * (`playva-backend/routes/games.js`, `POST /` and `DELETE /:id`); the checks
 * and their order are kept, because the order is the point:
 *
 *   genre exists  ->  folder name is free  ->  unpack  ->  write the row
 *
 * Everything that can be refused cheaply is refused BEFORE the archive is
 * unpacked, and a row that fails to write takes its freshly unpacked directory
 * with it — so no failure leaves files on disk that no record points at.
 *
 * Listing, reading, editing the text fields and toggling `isActive` are plain
 * CRUD and live in services/admin/registry.js. Only what touches the bundle is
 * here.
 *
 * REPLACING A BUNDLE is the one thing Playva cannot do — there a broken game is
 * deleted and uploaded again, which resets its click count. Here the edit screen
 * can upload a new ZIP into the same record: a new directory is unpacked, the
 * record is pointed at it, and the old one is removed.
 */
import path from 'node:path';
import {
  gameRepository,
  gameGenreRepository,
  GAME_GENRE_POPULATE,
} from '../../repositories/index.js';
import { unpackGameBundle, removeGameBundle } from '../gameBundle.service.js';
import { buildDiff, logCreate, logUpdate, logDelete } from '../auditLog.service.js';
import { GAME_DEFAULTS, GAME_FOLDER_NAME_PATTERN } from '../../config/constants.js';
import ApiError from '../../utils/ApiError.js';

/**
 * The fields an administrator may set on a game.
 *
 * A whitelist, applied to create and update alike. The generic CRUD handlers
 * already cut a body down to the fields its rules declare
 * (controllers/admin/crud.controller.js declaredBody), which covers the edit
 * save; the multipart CREATE route hands over the whole body, so here this is
 * what keeps `clicks`, `gameUrl` and `isDeleted` out of a new document.
 * `folderName` is settable on create only — it names the directory the bundle
 * was unpacked into.
 *
 * Blank presentation fields fall back to Playva's defaults rather than being
 * stored empty: a card with no emoji and no colours is a black rectangle.
 */
export function pickGameFields(payload = {}) {
  const fields = {
    titleFa: payload.titleFa,
    genre: payload.genre,
    emoji: payload.emoji || GAME_DEFAULTS.emoji,
    color1: payload.color1 || GAME_DEFAULTS.color1,
    color2: payload.color2 || GAME_DEFAULTS.color2,
  };

  if (payload.isActive !== undefined) fields.isActive = payload.isActive;
  return fields;
}

/** A game must point at a genre that exists; a deactivated one still counts. */
export async function assertGenreExists(genreId) {
  const genre = await gameGenreRepository.findById(genreId, { scope: 'admin' });
  if (!genre) {
    throw ApiError.badRequest('The selected genre does not exist');
  }
}

/**
 * The folder name for a new game.
 *
 * Playva's rule: use the one supplied, otherwise the archive's own file name
 * without its extension. The fallback is squeezed into the allowed alphabet; a
 * supplied name has already been validated and is used exactly as typed.
 */
function resolveFolderName(supplied, originalName) {
  if (supplied) return supplied;

  const derived = path
    .basename(originalName ?? '', path.extname(originalName ?? ''))
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64);

  if (!GAME_FOLDER_NAME_PATTERN.test(derived)) {
    throw ApiError.badRequest(
      '"folderName" is required: the file name gives nothing to derive one from',
    );
  }
  return derived;
}

const findWithGenre = (id) =>
  gameRepository.findById(id, { scope: 'admin', populate: [GAME_GENRE_POPULATE] });

/**
 * Creates a game from its ZIP.
 *
 * @param {object} payload  the multipart text fields, validated
 * @param {Express.Multer.File} file  the archive, in the temp directory
 */
export async function createGame(payload, file, context) {
  const folderName = resolveFolderName(payload.folderName, file.originalname);

  await assertGenreExists(payload.genre);

  // Playva checked the directory on disk. The record is what is checked here,
  // since directories carry a random suffix and never collide.
  const taken = await gameRepository.exists(gameRepository.adminScope({ folderName }));
  if (taken) {
    throw ApiError.conflict(`Folder "${folderName}" already exists`);
  }

  const { gameUrl } = await unpackGameBundle(file.path, folderName);

  let created;
  try {
    created = await gameRepository.create({ ...pickGameFields(payload), folderName, gameUrl });
  } catch (error) {
    // Two uploads racing for one name both pass the check above; the unique
    // index stops the second, and its files must not outlive the refusal.
    await removeGameBundle(gameUrl);
    throw error;
  }

  await logCreate({
    user: context.userId,
    userIp: context.userIp,
    page: 'games',
    targetId: created._id,
    details: buildDiff({}, created.toObject()),
  });

  return findWithGenre(created._id);
}

/**
 * Swaps a game's files for a new build, keeping the record — and its clicks.
 *
 * The new bundle is unpacked first and the record repointed second, so a refused
 * archive leaves the game exactly as it was, still playable.
 */
export async function replaceGameBundle(gameId, file, context) {
  const game = await gameRepository.findById(gameId, { scope: 'admin' });
  if (!game) throw ApiError.notFound('Game not found');

  const { gameUrl } = await unpackGameBundle(file.path, game.folderName);

  const updated = await gameRepository.updateById(gameId, { gameUrl });
  if (!updated) {
    // Deleted while the archive was unpacking.
    await removeGameBundle(gameUrl);
    throw ApiError.notFound('Game not found');
  }

  await removeGameBundle(game.gameUrl);

  await logUpdate({
    user: context.userId,
    userIp: context.userIp,
    page: 'games',
    targetId: gameId,
    details: { gameUrl: { old: game.gameUrl, new: gameUrl } },
  });

  return findWithGenre(gameId);
}

/**
 * Deletes a game and its files.
 *
 * The ROW is soft-deleted, as everywhere in this application; the FILES are
 * really removed, as in Playva. Every other entity here leaves its media behind
 * on delete, which is tolerable for a poster and not for a directory of several
 * thousand files that nothing will ever serve again.
 */
export async function removeGame(gameId, context) {
  const removed = await gameRepository.softDeleteById(gameId);
  if (!removed) throw ApiError.notFound('Game not found');

  await removeGameBundle(removed.gameUrl);

  await logDelete({
    user: context.userId,
    userIp: context.userIp,
    page: 'games',
    targetId: gameId,
    details: null,
  });

  return { id: gameId, deleted: true };
}

export default {
  pickGameFields,
  assertGenreExists,
  createGame,
  replaceGameBundle,
  removeGame,
};
