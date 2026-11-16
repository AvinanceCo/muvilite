/**
 * Environment configuration.
 *
 * Purpose: load and validate every environment variable the app depends on, so
 *          a missing secret fails loudly at boot instead of at first request.
 * Inputs:  process.env (populated from .env via dotenv)
 * Outputs: a frozen `env` object
 * Deps:    dotenv
 *
 * Legacy note: the PHP app hardcoded its MySQL root password in
 * `api/v2/models/__model.php` and `admin/includes/connection.php`, plus FCM and
 * payment-gateway keys in `admin/includes/define.php`. Nothing is hardcoded here.
 */
import dotenv from 'dotenv';

dotenv.config();

const required = ['MONGODB_URI', 'JWT_SECRET'];

const missing = required.filter((key) => !process.env[key]);
if (missing.length > 0) {
  throw new Error(
    `Missing required environment variables: ${missing.join(', ')}. Copy .env.example to .env and fill them in.`,
  );
}

const toInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

export const env = Object.freeze({
  port: toInt(process.env.PORT, 4000),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  isProduction: process.env.NODE_ENV === 'production',

  mongodbUri: process.env.MONGODB_URI,

  jwtSecret: process.env.JWT_SECRET,
  jwtExpires: process.env.JWT_EXPIRES ?? '12h',
  bcryptRounds: toInt(process.env.BCRYPT_ROUNDS, 12),

  uploadPath: process.env.UPLOAD_PATH ?? 'src/uploads',
  maxUploadSizeMb: toInt(process.env.MAX_UPLOAD_SIZE_MB, 10),
  /**
   * Video only — pre-roll creatives and a catalog title's own file. Artwork
   * stays on the much smaller cap above.
   *
   * 2 GB by default, because a feature film is the largest thing this
   * application accepts and a 200 MB ceiling refused most of them. **A reverse
   * proxy in front of this server enforces its own limit** — nginx's
   * `client_max_body_size` defaults to 1 MB — so raising this alone is not
   * enough on a real deployment.
   */
  maxVideoUploadSizeMb: toInt(process.env.MAX_VIDEO_UPLOAD_SIZE_MB, 2048),
  /**
   * One game's ZIP bundle. 100 MB is the figure Playva — the product the games
   * section is modelled on — has always used. What the archive may EXPAND to is
   * bounded separately (config/constants.js GAME_MAX_UNPACKED_BYTES).
   */
  maxGameUploadSizeMb: toInt(process.env.MAX_GAME_UPLOAD_SIZE_MB, 100),

  /**
   * The HLS transcoder (services/hlsTranscode.service.js). Both binaries are
   * looked up on PATH unless given. Without them the API still runs, but a
   * film or clip upload is refused with a 503 that names the missing tool.
   */
  ffmpegPath: process.env.FFMPEG_PATH || 'ffmpeg',
  ffprobePath: process.env.FFPROBE_PATH || 'ffprobe',
  /**
   * How many videos are transcoded at once. One by default: a single ffmpeg
   * already uses every core, and two would each take twice as long.
   */
  transcodeConcurrency: Math.max(1, toInt(process.env.TRANSCODE_CONCURRENCY, 1)),
  /** x264 preset: slower presets are smaller at the same quality, and slower. */
  transcodePreset: process.env.TRANSCODE_PRESET || 'veryfast',

  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:5173',
  adminUrl: process.env.ADMIN_URL ?? 'http://localhost:5174',

  enableCron: process.env.ENABLE_CRON === 'true',
  watchTrendCron: process.env.WATCH_TREND_CRON ?? '0 2 * * *',
});

export default env;
