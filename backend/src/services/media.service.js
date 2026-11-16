/**
 * Media service — post-processing for uploaded files.
 *
 * Purpose: derive the poster thumbnail the catalog grids use, turn absolute
 *          disk paths into public URLs, and remove superseded files.
 * Inputs:  multer file objects
 * Outputs: stored relative paths
 * Deps:    sharp, node:fs, config/env
 *
 * Legacy behaviour: the grids requested `assets/movies/{id}-216x332.jpg` and
 * the detail/player pages `assets/movies/{id}.jpg`, so every poster had a
 * 216x332 derivative. That size is reproduced exactly — changing it would
 * change how every existing card renders.
 */
import path from 'node:path';
import fs from 'node:fs/promises';
import sharp from 'sharp';
import env from '../config/env.js';
import logger from '../utils/logger.js';

/** Legacy poster thumbnail dimensions, from the assets/movies/*-216x332.jpg files. */
export const THUMBNAIL_WIDTH = 216;
export const THUMBNAIL_HEIGHT = 332;

/**
 * Disk path -> the path stored on a document and served by the static handler.
 * `/uploads` is mounted in app.js.
 */
export function toPublicPath(absolutePath) {
  const relative = path.relative(path.resolve(env.uploadPath), absolutePath);
  return `/uploads/${relative.split(path.sep).join('/')}`;
}

/**
 * Generates the 216x332 companion for a poster.
 *
 * `cover` crops to fill rather than letterboxing, which is what the fixed-size
 * legacy cards assumed.
 *
 * @param {string} absolutePath the uploaded original
 * @returns {Promise<string|null>} public path of the thumbnail, or null if the
 *          source could not be processed (e.g. a corrupt image)
 */
export async function generateThumbnail(absolutePath) {
  const parsed = path.parse(absolutePath);
  const thumbnailPath = path.join(
    parsed.dir,
    `${parsed.name}-${THUMBNAIL_WIDTH}x${THUMBNAIL_HEIGHT}${parsed.ext}`,
  );

  try {
    await sharp(absolutePath)
      .resize(THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT, { fit: 'cover', position: 'centre' })
      .toFile(thumbnailPath);

    return toPublicPath(thumbnailPath);
  } catch (error) {
    logger.error(`Failed to generate thumbnail for ${absolutePath}`, error);
    return null;
  }
}

/**
 * Reads an uploaded image's pixel dimensions.
 *
 * `pageHeight` rather than `height` for animated GIFs: sharp reports the height
 * of every frame stacked when it knows the file is animated, and a landing-page
 * ad is routinely an animated GIF (that is what the legacy slots shipped). One
 * frame is the size the browser paints, so that is the size checked.
 *
 * @param {string} absolutePath
 * @returns {Promise<{width: number, height: number}|null>} null when the file
 *          cannot be decoded at all
 */
export async function readImageSize(absolutePath) {
  try {
    const { width, height, pageHeight } = await sharp(absolutePath).metadata();
    if (!width || !(pageHeight || height)) return null;
    return { width, height: pageHeight || height };
  } catch (error) {
    logger.warn(`Failed to read image dimensions for ${absolutePath}`, error);
    return null;
  }
}

/**
 * Deletes a previously stored file.
 *
 * Uploads never overwrite, so replacing an image leaves the old one behind;
 * this is how it gets cleaned up. A missing file is not an error — the record
 * may point at something already removed.
 *
 * @param {string|null} publicPath a value produced by toPublicPath()
 */
export async function removeStoredFile(publicPath) {
  if (!publicPath?.startsWith('/uploads/')) return;

  const relative = publicPath.slice('/uploads/'.length);
  const absolute = path.resolve(env.uploadPath, relative);
  const root = path.resolve(env.uploadPath);

  // Refuse to follow a path that escapes the upload root.
  if (!absolute.startsWith(root + path.sep)) {
    logger.warn(`Refusing to delete outside upload root: ${publicPath}`);
    return;
  }

  try {
    await fs.unlink(absolute);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      logger.warn(`Failed to delete ${publicPath}`, error);
    }
  }
}

/** Suffix of the directory an HLS set is published in, beside its source. */
export const HLS_DIR_SUFFIX = '-hls';
/** Suffix while ffmpeg is still writing it; never referenced by any record. */
export const HLS_PARTIAL_SUFFIX = '-hls.partial';

/**
 * The directory an uploaded source's HLS set is written to and published from:
 * `movies/1730…-ab12.mkv` → `movies/1730…-ab12-hls/`. The source name is
 * already unique, so the set's is too.
 *
 * @param {string} sourceAbsolutePath
 * @returns {{finalDir: string, partialDir: string}}
 */
export function hlsDirsFor(sourceAbsolutePath) {
  const parsed = path.parse(sourceAbsolutePath);
  return {
    finalDir: path.join(parsed.dir, `${parsed.name}${HLS_DIR_SUFFIX}`),
    partialDir: path.join(parsed.dir, `${parsed.name}${HLS_PARTIAL_SUFFIX}`),
  };
}

/** Public path → absolute path inside the upload root, or null when it escapes. */
export function toAbsoluteUploadPath(publicPath) {
  if (!publicPath?.startsWith('/uploads/')) return null;
  const root = path.resolve(env.uploadPath);
  const absolute = path.resolve(root, publicPath.slice('/uploads/'.length));
  return absolute.startsWith(root + path.sep) ? absolute : null;
}

/**
 * Deletes a stored video, whichever form it takes.
 *
 * A progressive file is one file. An HLS set is a directory of playlists and
 * segments, referenced by its master playlist, and the whole directory goes.
 * Only a directory named like one this app creates (`…-hls`) is removed
 * recursively, so a bad path can never take a sibling folder with it.
 *
 * @param {string|null} publicPath a stored `videoPath` / `videoSourcePath`
 */
export async function removeStoredVideo(publicPath) {
  const absolute = toAbsoluteUploadPath(publicPath);
  if (!absolute) return removeStoredFile(publicPath);

  const directory = path.dirname(absolute);
  if (!publicPath.endsWith('.m3u8') || !path.basename(directory).endsWith(HLS_DIR_SUFFIX)) {
    return removeStoredFile(publicPath);
  }

  await removeDirectory(directory);
  return undefined;
}

/** `rm -rf` that is quiet about a directory that is already gone. */
export async function removeDirectory(absoluteDirectory) {
  try {
    await fs.rm(absoluteDirectory, { recursive: true, force: true });
  } catch (error) {
    logger.warn(`Failed to delete ${absoluteDirectory}`, error);
  }
}

/**
 * Stores an uploaded image and, when asked, its thumbnail.
 * @param {Express.Multer.File} file
 * @param {{withThumbnail?: boolean}} [options]
 */
export async function storeImage(file, { withThumbnail = false } = {}) {
  const imagePath = toPublicPath(file.path);
  const thumbnailPath = withThumbnail ? await generateThumbnail(file.path) : null;
  return { imagePath, thumbnailPath };
}

export default {
  toPublicPath,
  generateThumbnail,
  readImageSize,
  removeStoredFile,
  removeStoredVideo,
  removeDirectory,
  hlsDirsFor,
  toAbsoluteUploadPath,
  storeImage,
  THUMBNAIL_WIDTH,
  THUMBNAIL_HEIGHT,
};
