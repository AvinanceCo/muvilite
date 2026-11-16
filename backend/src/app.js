/**
 * Express application wiring.
 *
 * Purpose: assemble middleware, mount routers, and install the error handlers.
 *          Kept free of any listen/connect side effects so it can be imported
 *          by tests and scripts.
 * Inputs:  none (reads config/env)
 * Outputs: a configured Express app
 * Deps:    express, helmet, cors, compression, morgan, express-rate-limit
 */
import path from 'node:path';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';

import env from './config/env.js';
import routes from './routes/index.js';
import { notFoundHandler, errorHandler } from './middleware/errorHandler.js';
import { sendSuccess } from './utils/apiResponse.js';

const app = express();

// Required for req.ip to be meaningful behind the reverse proxy this app runs
// under; also what makes the rate limiter key on the real client address.
app.set('trust proxy', 1);

app.disable('x-powered-by');

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

app.use(
  cors({
    origin: [env.frontendUrl, env.adminUrl],
    credentials: true,
  }),
);

app.use(compression());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// HTTP access log. Application/error logging is separate (utils/logger.js).
app.use(morgan(env.isProduction ? 'combined' : 'dev'));

// Blanket rate limit. The login route adds a stricter one of its own — the
// legacy admin login had no throttling at all.
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 1000,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { success: false, message: 'Too many requests', errors: [] },
  }),
);

// HTML5 game bundles are whole documents, not media, and helmet's default
// Content-Security-Policy is written for this API's own JSON: `script-src 'self'`
// forbids the inline scripts, `eval` and WebAssembly that game engines are built
// on, so a game served with it loads to a blank frame. The header is dropped for
// this one path — which is also what production does, where nginx serves
// /uploads straight off the disk and this handler is never reached (see
// frontend/nginx.conf). Keeping the two the same is the point: a game that
// works in development must not be a game that only works behind Express.
app.use('/uploads/games', (_req, res, next) => {
  res.removeHeader('Content-Security-Policy');
  next();
});

// Uploaded media. Legacy served these from /assets/**; the new path is /uploads.
// Cached for a week — EXCEPT HLS playlists, which are revalidated on every
// load (a 304 when unchanged, so it costs a few bytes). A playlist can be
// rewritten in place (services/hlsTranscode addFrameRateToMaster, and its
// backfill), and a week-old copy in a viewer's cache would hide the change;
// the segments it points to never change, so they keep the long cache.
app.use(
  '/uploads',
  express.static(path.resolve(env.uploadPath), {
    fallthrough: true,
    maxAge: '7d',
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.m3u8')) res.setHeader('Cache-Control', 'no-cache');
    },
  }),
);

app.get('/api/health', (_req, res) =>
  sendSuccess(res, { status: 'ok', uptime: process.uptime() }, { message: 'Healthy' }),
);

app.use('/api', routes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
