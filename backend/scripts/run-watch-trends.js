/**
 * CLI entry point for the daily watch-trend aggregation.
 *
 * Purpose: run the job once and exit, for crontab or a manual invocation.
 * Usage:   npm run cron:watch-trends            aggregate the last COMPLETE day
 *          npm run cron:watch-trends -- --today aggregate the day in progress
 *          npm run cron:watch-trends -- --date=2026-08-01
 * Deps:    jobs/watchTrendDaily, config/env
 *
 * Replaces admin/3P1z05m4n4Gm3nt/includes/crons/watch_history_daily.php, which
 * had no CLI guard and could also be triggered over HTTP.
 */
import env from '../src/config/env.js';
import { runStandalone } from '../src/jobs/watchTrendDaily.job.js';
import logger from '../src/utils/logger.js';

const args = process.argv.slice(2);
const today = args.includes('--today');
const dateArg = args.find((arg) => arg.startsWith('--date='))?.split('=')[1];

const date = dateArg ? new Date(dateArg) : new Date();

if (Number.isNaN(date.getTime())) {
  logger.error(`Invalid --date value: "${dateArg}". Use YYYY-MM-DD.`);
  process.exit(1);
}

try {
  // An explicit --date names the day to aggregate, so it is not "the previous
  // day" relative to itself; nudge the reference forward so the same
  // last-complete-day logic selects it.
  const reference = dateArg ? new Date(date.getTime() + 24 * 3_600_000) : date;

  const result = await runStandalone(env.mongodbUri, { date: reference, previousDay: !today });

  logger.info(
    `watch-trend complete: ${result.movies} movies for ${result.windowStart.toISOString().slice(0, 10)}`,
  );
  process.exit(0);
} catch (error) {
  logger.error('watch-trend job failed', error);
  process.exit(1);
}
