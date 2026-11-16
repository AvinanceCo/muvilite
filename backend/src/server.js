/**
 * Process entry point.
 *
 * Purpose: connect to MongoDB, start the HTTP listener, optionally register
 *          scheduled jobs, and shut all of it down cleanly.
 * Inputs:  config/env
 * Outputs: a running server
 * Deps:    app, config/db, jobs/scheduler
 */
import app from './app.js';
import env from './config/env.js';
import { connectDatabase, disconnectDatabase } from './config/db.js';
import { startScheduledJobs, stopScheduledJobs } from './jobs/scheduler.js';
import { startTranscodeWorker, stopTranscodeWorker } from './jobs/transcodeQueue.js';
import logger from './utils/logger.js';

async function start() {
  await connectDatabase();

  const server = app.listen(env.port, () => {
    logger.info(`Server listening on port ${env.port} (${env.nodeEnv})`);
  });

  if (env.enableCron) {
    startScheduledJobs();
  }

  // The HLS transcoder. Not behind ENABLE_CRON: it is not a schedule but the
  // second half of every film upload, and it resumes jobs a restart interrupted.
  await startTranscodeWorker();

  const shutdown = async (signal) => {
    logger.info(`${signal} received, shutting down`);
    stopScheduledJobs();
    // Kill any running ffmpeg first: a child process outlives its parent, and
    // an orphaned encoder would hold the CPU through the next deploy. The job
    // stays `processing` and is resumed when the server starts again.
    await stopTranscodeWorker();
    server.close(async () => {
      await disconnectDatabase();
      process.exit(0);
    });
    // Don't let a hung connection block the exit indefinitely.
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', error);
  process.exit(1);
});

start().catch((error) => {
  logger.error('Failed to start server', error);
  process.exit(1);
});
