# MuviLite — Passenger Frontend

React and Vite public media site. The API lives in `../../backend`.

---

## Running

```bash
cd backend && npm run seed && npm run dev   # :4000
cd UI/1    && npm install && npm run dev    # :5173
```

`5173` is already in the backend's CORS allow-list (`FRONTEND_URL`). With no `.env` at all the dev
server proxies `/api` and `/uploads` to `localhost:4000`, so nothing needs configuring for local
work. `.env.example` documents the three variables that exist.

```bash
npm run build     # production bundle into dist/
npm run preview   # serve that bundle
```

The `Dockerfile` builds the production bundle. The included `nginx.conf` serves the bundle
and proxies `/api` and `/uploads` on the same origin.

---

## What this application is

A public media website: films, clips, music, games and a poll, with no end-user accounts. A few
decisions that would otherwise look odd:

- **Self-hosted fonts.** The Vazir typeface in `src/assets/fonts` includes Persian digits.
- **Anonymous access.** The site has no end-user login or account screen.
- **Light on the network.** Queries cache for five minutes and do not refetch on window focus. A
  dropped playback heartbeat is swallowed rather than surfaced — the next beat retries.

---

## Routes

| Route | Endpoints |
|---|---|
| `/` | none — a static hub |
| `/page/:idOrSlug` | `GET /api/pages/:idOrSlug` |
| `/category/:id` | `GET /api/categories/:id/movies` |
| `/music-category/:id` | `GET /api/music-categories/:id/musics` |
| `/movie/:id` | `GET /api/movies/:id`, `…/similar` |
| `/player/:id` | `POST /api/watch-sessions`, `PATCH …/:id` |
| `/music/:id` | `GET /api/musics/:id`, `POST /api/listen-sessions`, `PATCH …/:id` |
| `/search` | `GET /api/search` |
| `/musics` | `GET /api/musics` |
| `/poll` | `GET /api/poll/questions`, `POST /api/poll/votes` |

Pages accept an ID or a slug through `GET /api/pages/:idOrSlug`.

---

## Behaviour that must not drift

These are business rules, not implementation choices. Each is enforced or defaulted server-side as
well; changing one here only desynchronises the two.

- **Rails hold at most 10 items and never paginate.** They also report no total, which is why a rail
  header shows a "see all" link but no count. Listing pages do report a total and do show it.
- **Similar titles: exactly 4, random order.**
- **Sort whitelists differ per endpoint and are enforced server-side.** Offering a key an endpoint
  does not accept returns HTTP 400, not a fallback. The three lists live in `src/utils/constants.js`
  with the backend file each mirrors.
- **Heartbeats credit a fixed chunk** — 30s per video beat, 15s per audio beat — regardless of
  elapsed time, and are sent only while media is actually playing. Media paused in a background tab
  accrues nothing.
- **An empty search returns the first page of everything**, rather than an error.
- **The poll's three-hour revision window.** A second submission from the same anonymous token
  inside three hours revises the earlier answers; the server returns a different confirmation for
  each case, and the UI displays that message rather than composing its own.
- **Media paths are stored fields.** Never rebuild `assets/movies/{id}.jpg` — uploads have unique
  filenames. Always resolve through `src/services/media.js`.

---

## Structure

```
src/
  api/         one module per endpoint group; api/client.js is the only place
               that knows about the { success, message, data, meta } envelope
  components/  ui/ primitives, catalog/ cards and rails, player/ controls
  hooks/       useMediaSession (watch + listen telemetry), usePollToken, …
  layouts/     MainLayout (site chrome), PlayerLayout (chromeless)
  pages/       one per route
  routes/      lazy route table
  services/    media path resolution, Persian display formatting
  utils/       constants traceable to the backend, guarded localStorage
```

Server state is TanStack Query's; there is no global client state, because there is nothing to keep
in one — no session, no cart, no preferences.
