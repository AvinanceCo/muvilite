/**
 * Scheduled job registration.
 *
 * Purpose: register cron-driven jobs when the process is configured to run
 *          them, and stop them cleanly on shutdown.
 * Inputs:  config/env (ENABLE_CRON, WATCH_TREND_CRON)
 * Outputs: running node-cron tasks
 * Deps:    node-cron, jobs/watchTrendDaily, utils/logger
 *
 * The legacy schedule lived in an external crontab that is not in the
 * repository, so the expression is configurable rather than hardcoded. Set
 * ENABLE_CRON=false and use `npm run cron:watch-trends` instead if the
 * deployment prefers to drive it externally, as the legacy setup did.
 */
import cron from 'node-cron';
import env from '../config/env.js';
import { runWatchTrendDaily } from './watchTrendDaily.job.js';
import logger from '../utils/logger.js';

const tasks = [];

export function startScheduledJobs() {
  if (!cron.validate(env.watchTrendCron)) {
    logger.error(`Invalid WATCH_TREND_CRON expression: "${env.watchTrendCron}" — job not scheduled`);
    return;
  }

  const task = cron.schedule(env.watchTrendCron, async () => {
    try {
      await runWatchTrendDaily();
    } catch (error) {
      // A failed run must not take the process down; the job is idempotent, so
      // the next tick recovers.
      logger.error('watch-trend job failed', error);
    }
  });

  tasks.push(task);
  logger.info(`Scheduled watch-trend aggregation: ${env.watchTrendCron}`);
}

export function stopScheduledJobs() {
  for (const task of tasks) {
    task.stop();
  }
  tasks.length = 0;
}

export default { startScheduledJobs, stopScheduledJobs };
