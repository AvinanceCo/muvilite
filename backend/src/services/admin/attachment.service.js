/**
 * Media attachment service.
 *
 * Purpose: attach an uploaded file to an entity and clean up whatever it
 *          replaced.
 * Inputs:  entity id, multer file
 * Outputs: the updated document
 * Deps:    repositories, services/{media,auditLog}, utils/ApiError
 *
 * Legacy counterparts: BannerController `?@=upload`, CastController `?@=upload`,
 * MusicController `?@=upload` and views/movies/poster.php — all of which wrote
 * `assets/<entity>/<id>.jpg`, overwriting any previous file.
 *
 * Uploads never overwrite here, so replacing an image leaves an orphan; the old
 * file is deleted explicitly once the new path is stored.
 *
 * TWO ENTITIES HAVE A SIZE REQUIREMENT, and both refuse a mismatch outright
 * instead of stretching it into place the way the legacy CSS did:
 *
 *   landing-page ads — one exact size per slot and variant
 *                      (config/constants.js AD_PLACEMENT_SIZES);
 *   banners          — any one of the banner sizes
 *                      (config/constants.js BANNER_ACCEPTED_SIZES), because a
 *                      banner carries no type of its own.
 */
import {
  movieRepository,
  castRepository,
  bannerRepository,
  musicRepository,
  videoAdRepository,
  placementAdRepository,
} from '../../repositories/index.js';
import { storeImage, readImageSize, removeStoredFile, toPublicPath } from '../media.service.js';
import { logUpdate } from '../auditLog.service.js';
import { AD_PLACEMENT_SIZES, BANNER_ACCEPTED_SIZES } from '../../config/constants.js';
import ApiError from '../../utils/ApiError.js';

/**
 * Movie poster. This is the one that also needs the 216x332 derivative the
 * catalog grids request.
 */
export async function attachMoviePoster(movieId, file, context) {
  const movie = await movieRepository.findById(movieId, { scope: 'admin' });
  if (!movie) throw ApiError.notFound('Movie not found');

  const { imagePath, thumbnailPath } = await storeImage(file, { withThumbnail: true });

  const updated = await movieRepository.updateById(movieId, {
    posterPath: imagePath,
    thumbnailPath,
  });

  await Promise.all([
    removeStoredFile(movie.posterPath),
    removeStoredFile(movie.thumbnailPath),
  ]);

  await logUpdate({
    user: context.userId,
    userIp: context.userIp,
    page: 'movies',
    targetId: movieId,
    details: { posterPath: { old: movie.posterPath, new: imagePath } },
  });

  return updated;
}

/**
 * Rejects an upload that is not exactly one of the accepted sizes, and removes
 * the file multer has already written.
 *
 * A LIST, not one size: an advertisement slot accepts exactly one shape, but a
 * banner accepts any of the banner sizes, because it carries no type of its own.
 * One size is expressed as a list of one.
 *
 * Multer stores the file before any of this runs, so a refusal has to clean up
 * after itself or every rejected attempt leaves an orphan on disk that nothing
 * ever collects.
 *
 * @param {Express.Multer.File} file
 * @param {{width: number, height: number}[]} accepted
 */
async function assertImageSize(file, accepted) {
  const actual = await readImageSize(file.path);
  const matches =
    actual && accepted.some((size) => size.width === actual.width && size.height === actual.height);

  if (!matches) {
    await removeStoredFile(toPublicPath(file.path));
    const wanted = accepted.map((size) => `${size.width}x${size.height}`).join(' or ');
    throw ApiError.badRequest(
      actual
        ? `Image must be exactly ${wanted} pixels (received ${actual.width}x${actual.height})`
        : 'The uploaded file could not be read as an image',
    );
  }
}

/**
 * Builds a single-image attacher for entities that need no derivative.
 *
 * @param {object} config
 * @param {(document: object) => {width: number, height: number}[]|null} [config.acceptedSizes]
 *        the exact dimensions the upload may have, derived from the record it is
 *        being attached to. Omitted for entities that accept any size.
 */
function buildImageAttacher({ repository, page, label, field, acceptedSizes }) {
  return async function attach(id, file, context) {
    const document = await repository.findById(id, { scope: 'admin' });
    if (!document) throw ApiError.notFound(`${label} not found`);

    const accepted = acceptedSizes?.(document);
    if (accepted?.length) await assertImageSize(file, accepted);

    const { imagePath } = await storeImage(file);
    const updated = await repository.updateById(id, { [field]: imagePath });

    await removeStoredFile(document[field]);

    await logUpdate({
      user: context.userId,
      userIp: context.userIp,
      page,
      targetId: id,
      details: { [field]: { old: document[field], new: imagePath } },
    });

    return updated;
  };
}

export const attachCastPhoto = buildImageAttacher({
  repository: castRepository,
  page: 'casts',
  label: 'Cast',
  field: 'photoPath',
});

/**
 * Banner artwork. Accepts any of the banner sizes, because a banner has no type
 * of its own — the rail it appears in does, and it can appear in several.
 */
export const attachBannerImage = buildImageAttacher({
  repository: bannerRepository,
  page: 'banners',
  label: 'Banner',
  field: 'imagePath',
  acceptedSizes: () => BANNER_ACCEPTED_SIZES,
});

export const attachMusicCover = buildImageAttacher({
  repository: musicRepository,
  page: 'musics',
  label: 'Music',
  field: 'coverPath',
});

/**
 * The one size a slot's artwork may have, per variant, as a single-entry list.
 * A record whose `placement` is somehow unknown gets no size requirement rather
 * than an unexplainable rejection.
 */
const placementSize = (variant) => (ad) => {
  const size = AD_PLACEMENT_SIZES[ad.placement]?.[variant];
  return size ? [size] : null;
};

/**
 * Mobile artwork for a landing-page slot. legacy: the slot's first anchor,
 * the one shown to a viewport in portrait.
 */
export const attachPlacementAdImage = buildImageAttacher({
  repository: placementAdRepository,
  page: 'ads',
  label: 'Placement advertisement',
  field: 'imagePath',
  acceptedSizes: placementSize('mobile'),
});

/**
 * Desktop artwork. legacy: the slot's second anchor, shown by the
 * `orientation:landscape` media query.
 */
export const attachPlacementAdLandscapeImage = buildImageAttacher({
  repository: placementAdRepository,
  page: 'ads',
  label: 'Placement advertisement',
  field: 'imageLandscapePath',
  acceptedSizes: placementSize('desktop'),
});

/**
 * Attaches an MP4/WebM to a pre-roll creative.
 *
 * Not `buildImageAttacher`, because two fields move together: the file and the
 * duration the tag advertises. Keeping them in one write is what stops a
 * creative from claiming the previous file's length after a replacement.
 *
 * `durationSecond` is measured by the browser from the chosen file
 * (admin components/form/VideoUpload.jsx) and validated as a bounded number
 * here. It is advisory metadata for the VAST `<Duration>` element, not a
 * security boundary — playback is driven by the file itself, and an operator can
 * correct the value on the form.
 */
export async function attachVideoAdFile(adId, file, { durationSecond } = {}, context) {
  const ad = await videoAdRepository.findById(adId, { scope: 'admin' });
  if (!ad) throw ApiError.notFound('Video advertisement not found');

  const videoPath = toPublicPath(file.path);

  const payload = { videoPath };
  if (Number.isFinite(durationSecond)) {
    payload.durationSecond = Math.round(durationSecond);
  }

  const updated = await videoAdRepository.updateById(adId, payload);

  // Uploads never overwrite, so the superseded creative would otherwise sit on
  // disk forever — and video files are the largest thing this app stores.
  await removeStoredFile(ad.videoPath);

  await logUpdate({
    user: context.userId,
    userIp: context.userIp,
    page: 'ads',
    targetId: adId,
    details: { videoPath: { old: ad.videoPath, new: videoPath } },
  });

  return updated;
}

/**
 * Replaces a music entry's track list.
 * legacy: MusicController `?@=tracks` and `?@=deleteTracks`, which rewrote the
 * `tracks` JSON column wholesale.
 */
export async function replaceMusicTracks(musicId, tracks, context) {
  const music = await musicRepository.findById(musicId, { scope: 'admin' });
  if (!music) throw ApiError.notFound('Music not found');

  const updated = await musicRepository.updateById(musicId, { tracks });

  // Files no longer referenced by any track are removed.
  const keptFiles = new Set(tracks.map((track) => track.file));
  await Promise.all(
    (music.tracks ?? [])
      .filter((track) => !keptFiles.has(track.file))
      .map((track) => removeStoredFile(track.file)),
  );

  await logUpdate({
    user: context.userId,
    userIp: context.userIp,
    page: 'musics',
    targetId: musicId,
    details: { tracks: { old: music.tracks?.length ?? 0, new: tracks.length } },
  });

  return updated;
}

export default {
  attachMoviePoster,
  attachCastPhoto,
  attachBannerImage,
  attachMusicCover,
  attachPlacementAdImage,
  attachPlacementAdLandscapeImage,
  attachVideoAdFile,
  replaceMusicTracks,
};
