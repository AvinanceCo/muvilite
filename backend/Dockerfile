# MuviLite backend — Node/Express API.
#
# Purpose: a production image that serves the REST API and the scheduled jobs.
# Inputs:  the environment listed in .env.example (MONGODB_URI and JWT_SECRET
#          are mandatory — src/config/env.js refuses to boot without them).
# Outputs: an HTTP listener on 4000.
#
# Two stages, because bcrypt and sharp are native addons. The build stage keeps
# a C toolchain around so they compile if no prebuilt binary matches the host;
# the runtime stage carries neither the toolchain nor the npm cache.

# ── Stage 1: dependencies ────────────────────────────────────────────────────
FROM node:20-bookworm-slim AS deps

# node-gyp fallback for bcrypt/sharp when a prebuild is unavailable.
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ ca-certificates \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copied on their own so the (slow) install layer is reused whenever only
# application source has changed.
COPY package.json package-lock.json ./

RUN npm ci --omit=dev && npm cache clean --force

# ── Stage 2: runtime ─────────────────────────────────────────────────────────
FROM node:20-bookworm-slim AS runtime

# The HLS transcoder: ffprobe measures every uploaded film/clip and ffmpeg
# re-encodes it into an adaptive HLS ladder (services/hlsTranscode.service.js).
RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg \
 && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production \
    PORT=4000 \
    UPLOAD_PATH=/app/src/uploads

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY src ./src
COPY scripts ./scripts

# The upload tree mirrors middleware/upload.js's UPLOAD_DIRS. Creating it here —
# owned by `node` — is what gives the named volume the right ownership when
# Docker initialises it from this path on first run.
RUN mkdir -p /app/src/uploads/movies \
             /app/src/uploads/musics \
             /app/src/uploads/casts \
             /app/src/uploads/banners \
             /app/src/uploads/users \
             /app/src/uploads/ads \
             /app/src/uploads/games \
 && chown -R node:node /app/src/uploads

USER node

EXPOSE 4000

# No shell form: the process must receive SIGTERM directly so server.js's
# graceful shutdown runs.
CMD ["node", "src/server.js"]
