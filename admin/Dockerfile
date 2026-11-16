# MuviLite admin panel — static React build behind nginx.
#
# Purpose: serve the admin panel on its own origin, with the API and media
#          reachable from that same origin.
# Inputs:  none at runtime — the bundle is built with VITE_API_URL=/api and
#          VITE_MEDIA_URL="" (their defaults), so every request is same-origin.
# Outputs: HTTP on 80 (published on 8080 by docker-compose.yml).

# ── Stage 1: build ───────────────────────────────────────────────────────────
FROM node:20-bookworm-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# ── Stage 2: serve ───────────────────────────────────────────────────────────
FROM nginx:1.27-alpine AS runtime

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

# Uploaded media is bind-mounted here from the shared `uploads` volume
# (docker-compose.yml). The directory exists so nginx starts even if it isn't.
RUN mkdir -p /var/www/uploads

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1/ >/dev/null 2>&1 || exit 1
