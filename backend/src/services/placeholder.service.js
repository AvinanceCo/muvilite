/**
 * Placeholder service — the configurable fallback images.
 *
 * Purpose: serve the slot -> image map every client reads on start-up, and
 *          maintain it from the admin panel.
 * Inputs:  slot keys, multer files, an audit context
 * Outputs: the map, the admin listing, updated documents
 * Deps:    repositories, services/{media,auditLog}, config/constants, utils/*
 *
 * NEW FUNCTIONALITY — no legacy controller behind it. What it replaces is
 * documented at PLACEHOLDER_SLOTS in config/constants.js: six image files that
 * shipped with the theme and could only be changed over FTP.
 *
 * THE MAP IS CACHED IN PROCESS. `GET /api/placeholders` is on the critical path
 * of the first page load for every passenger on the aircraft, and the answer is
 * at most five rows that change when an operator uploads one — which is roughly
 * never. The cache is dropped on every write below, so the only staleness window
 * is between two Node processes: with more than one, a second process keeps
 * serving its copy until it writes or restarts. That is acceptable for artwork
 * and is called out here so nobody discovers it as a bug. Anything with a real
 * consistency requirement must not copy this pattern.
 */
import { placeholderRepository } from '../repositories/index.js';
import { storeImage, removeStoredFile } from './media.service.js';
import { logUpdate, logDelete } from './auditLog.service.js';
import {
  PLACEHOLDER_SLOTS,
  PLACEHOLDER_SLOT_KEYS,
  PLACEHOLDER_FALLBACK_SLOT,
} from '../config/constants.js';
import ApiError from '../utils/ApiError.js';

/** Audit section; matches the permission identifier the routes require. */
const AUDIT_PAGE = 'placeholders';

/** `{ slot: imagePath }` for configured slots only, or null when not yet read. */
let cachedMap = null;

/** Called by every write, so the next read rebuilds from the database. */
function invalidate() {
  cachedMap = null;
}

function assertKnownSlot(slot) {
  if (!PLACEHOLDER_SLOT_KEYS.includes(slot)) {
    throw ApiError.badRequest(
      `Unknown placeholder slot "${slot}". Known slots: ${PLACEHOLDER_SLOT_KEYS.join(', ')}`,
    );
  }
}

/**
 * The public map: `{ moviePoster: '/uploads/placeholders/…', … }`.
 *
 * Slots with no image are ABSENT rather than present-and-null, so a client can
 * write `map[slot] ?? map.general ?? builtIn` without a null check at each step.
 */
export async function getPlaceholderMap() {
  if (cachedMap) return cachedMap;

  const documents = await placeholderRepository.findAll();

  cachedMap = Object.fromEntries(
    documents
      .filter((document) => document.imagePath)
      .map((document) => [document.slot, document.imagePath]),
  );

  return cachedMap;
}

/**
 * Resolves one slot the way a client would: the slot itself, then the catch-all.
 * Used by anything server-side that needs a concrete image path.
 * @returns {Promise<string|null>}
 */
export async function resolvePlaceholder(slot) {
  const map = await getPlaceholderMap();
  return map[slot] ?? map[PLACEHOLDER_FALLBACK_SLOT] ?? null;
}

/**
 * Every slot the application defines, configured or not, with its metadata —
 * the admin screen's list. Unlike the public map this is exhaustive: the panel
 * must show an empty slot in order to offer an upload for it.
 */
export async function listPlaceholders() {
  const documents = await placeholderRepository.findAll();
  const bySlot = new Map(documents.map((document) => [document.slot, document]));

  return PLACEHOLDER_SLOTS.map((definition) => {
    const document = bySlot.get(definition.key);

    return {
      ...definition,
      imagePath: document?.imagePath ?? null,
      updatedAt: document?.updatedAt ?? null,
      updatedBy: document?.updatedBy ?? null,
    };
  });
}

/**
 * Stores an uploaded image against a slot, replacing whatever was there.
 *
 * @param {string} slot
 * @param {Express.Multer.File} file
 * @param {{userId: string, userIp: string}} context
 */
export async function setPlaceholder(slot, file, context) {
  assertKnownSlot(slot);

  const previous = await placeholderRepository.findBySlot(slot);
  const { imagePath } = await storeImage(file);

  const updated = await placeholderRepository.upsertSlot(slot, {
    imagePath,
    updatedBy: context.userId,
  });

  invalidate();

  // Uploads never overwrite (middleware/upload.js), so the superseded file would
  // otherwise stay on disk forever. Removed only after the new path is stored:
  // a crash in between leaves an orphan file, which is harmless, where the other
  // order leaves a row pointing at a file that is gone.
  await removeStoredFile(previous?.imagePath);

  await logUpdate({
    user: context.userId,
    userIp: context.userIp,
    page: AUDIT_PAGE,
    targetId: updated._id,
    details: { [slot]: { old: previous?.imagePath ?? null, new: imagePath } },
  });

  return updated;
}

/**
 * Clears a slot: the row goes, the file goes, and clients fall back to the next
 * step of the chain. Clearing an already-empty slot is a no-op, not a 404 — the
 * caller asked for a state, and that state already holds.
 */
export async function clearPlaceholder(slot, context) {
  assertKnownSlot(slot);

  const removed = await placeholderRepository.deleteSlot(slot);
  invalidate();

  if (!removed) {
    return { slot, imagePath: null };
  }

  await removeStoredFile(removed.imagePath);

  await logDelete({
    user: context.userId,
    userIp: context.userIp,
    page: AUDIT_PAGE,
    targetId: removed._id,
    details: { [slot]: { old: removed.imagePath, new: null } },
  });

  return { slot, imagePath: null };
}

export default {
  getPlaceholderMap,
  resolvePlaceholder,
  listPlaceholders,
  setPlaceholder,
  clearPlaceholder,
};
