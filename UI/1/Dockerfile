# MuviLite passenger frontend — static React build behind nginx.
#
# Purpose: serve the passenger site, and give the browser a single origin for
#          the page, the API and the media, exactly as the dev proxy does.
# Inputs:  none at runtime — the bundle is built with VITE_API_URL=/api and
#          VITE_MEDIA_URL="" (their defaults), so every request is same-origin
#          and CORS never enters the picture.
# Outputs: HTTP on 80.

# ── Stage 1: build ───────────────────────────────────────────────────────────
FROM node:20-bookworm-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./
# The Muvi player is installed from tarballs committed under vendor/ (it is not
# on any registry), so they must be in place before `npm ci` resolves them.
COPY vendor ./vendor
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
