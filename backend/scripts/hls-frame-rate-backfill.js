/**
 * Add FRAME-RATE to the master playlists of HLS sets transcoded before it was
 * written.
 *
 * Purpose: repair existing films so the player's quality menu offers every
 *          quality instead of showing them all as «در دسترس نیست».
 * Usage:   npm run hls:frame-rate               patch them
 *          npm run hls:frame-rate -- --dry-run  list what would change
 * Deps:    config/env, services/hlsTranscode
 *
 * Why the attribute matters is explained at `addFrameRateToMaster`
 * (services/hlsTranscode.service.js). New transcodes get it automatically; this
 * script is for the sets made before that.
 *
 * FILES ONLY — no database, and safe to run while the API is up: it walks the
 * movie upload directory for `*-hls/` sets, and a set that already has the
 * attribute is skipped, so running it twice changes nothing the second time.
 * Needs ffprobe, which measures the first segment of each set.
 */
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import env from '../src/config/env.js';
import { UPLOAD_DIRS } from '../src/middleware/upload.js';
import { addFrameRateToMaster } from '../src/services/hlsTranscode.service.js';
import { HLS_MASTER_PLAYLIST } from '../src/config/constants.js';
import logger from '../src/utils/logger.js';

const dryRun = process.argv.includes('--dry-run');

const moviesDir = path.resolve(env.uploadPath, UPLOAD_DIRS.movies);

let entries = [];
try {
  entries = await readdir(moviesDir, { withFileTypes: true });
} catch (error) {
  logger.error(`Cannot read ${moviesDir}: ${error.message}`);
  process.exit(1);
}

const sets = entries.filter((entry) => entry.isDirectory() && entry.name.endsWith('-hls'));
let patched = 0;
let skipped = 0;
let failed = 0;

for (const set of sets) {
  const outDir = path.join(moviesDir, set.name);

  if (dryRun) {
    logger.info(`Would check ${set.name}/${HLS_MASTER_PLAYLIST}`);
    continue;
  }

  try {
    const { changed, frameRate } = await addFrameRateToMaster(outDir);
    if (changed) {
      patched += 1;
      logger.info(`Patched ${set.name}: FRAME-RATE=${frameRate}`);
    } else {
      skipped += 1;
    }
  } catch (error) {
    failed += 1;
    logger.warn(`Failed ${set.name}: ${error.message}`);
  }
}

logger.info(
  dryRun
    ? `${sets.length} HLS set(s) found in ${moviesDir}; nothing changed (dry run)`
    : `${sets.length} HLS set(s): ${patched} patched, ${skipped} already fine or unreadable, ${failed} failed`,
);
process.exit(failed > 0 ? 1 : 0);
