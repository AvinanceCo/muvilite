/**
 * Queue every already-uploaded film and clip for HLS.
 *
 * Purpose: bring videos uploaded BEFORE the HLS transcoder existed (progressive
 *          MP4/WebM under /uploads/movies/) onto the same footing as new ones.
 * Usage:   npm run transcode:backfill               mark them, then restart the API
 *          npm run transcode:backfill -- --dry-run  list them, change nothing
 * Deps:    config/{env,db}, models, config/constants
 *
 * IT ONLY MARKS. Each matching movie gets `videoSourcePath = videoPath` and
 * `videoStatus = queued`; the API's transcode worker picks queued movies up
 * when it STARTS (jobs/transcodeQueue.js), so restart it afterwards. Running a
 * second encoder from this script instead would race the API's worker for the
 * same output directory.
 *
 * The title keeps playing its MP4 until its HLS set is ready, and the MP4 is
 * then deleted — the same outcome as uploading the file again. External links
 * are never touched: nothing on disk belongs to them.
 */
import { connectDatabase, disconnectDatabase } from '../src/config/db.js';
import { Movie } from '../src/models/index.js';
import { VIDEO_STATUS } from '../src/config/constants.js';
import logger from '../src/utils/logger.js';

const dryRun = process.argv.includes('--dry-run');

const filter = {
  isDeleted: false,
  videoPath: { $regex: '^/uploads/movies/' },
  // Already HLS, or already on its way.
  $nor: [
    { videoPath: { $regex: '\\.m3u8$' } },
    { videoStatus: { $in: [VIDEO_STATUS.QUEUED, VIDEO_STATUS.PROCESSING] } },
  ],
};

try {
  await connectDatabase();
  const movies = await Movie.find(filter).select('_id titleFa videoPath').lean();

  for (const movie of movies) {
    logger.info(`${dryRun ? 'would queue' : 'queued'}: ${movie._id} ${movie.titleFa} (${movie.videoPath})`);
    if (dryRun) continue;
    await Movie.updateOne(
      { _id: movie._id, videoPath: movie.videoPath },
      {
        $set: {
          videoSourcePath: movie.videoPath,
          videoStatus: VIDEO_STATUS.QUEUED,
          videoProgress: 0,
          videoError: null,
        },
      },
    );
  }

  logger.info(
    movies.length === 0
      ? 'Nothing to backfill: every uploaded video is HLS already.'
      : dryRun
        ? `${movies.length} video(s) would be queued.`
        : `${movies.length} video(s) queued. Restart the API to start transcoding them.`,
  );
  await disconnectDatabase();
  process.exit(0);
} catch (error) {
  logger.error('transcode backfill failed', error);
  process.exit(1);
}
