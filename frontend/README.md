# MuviLite — Passenger Frontend

React + Vite rewrite of the public half of the legacy PHP portal
(`legacy-php/index.php`, `page.php`, `movie.php`, `player2.php`, `sound.php`, `search.php`,
`music.php`, `poll.php`).

The backend it talks to is `../backend`; its migration record — endpoint map, schema mapping, and
the list of legacy defects fixed rather than reproduced — is
[`../backend/MIGRATION.md`](../backend/MIGRATION.md). Read that before changing behaviour here.

---

## Running

```bash
cd refactored/backend && npm run seed && npm run dev   # :4000
cd refactored/frontend && npm install && npm run dev   # :5173
```

`5173` is already in the backend's CORS allow-list (`FRONTEND_URL`). With no `.env` at all the dev
server proxies `/api` and `/uploads` to `localhost:4000`, so nothing needs configuring for local
work. `.env.example` documents the three variables that exist.

```bash
npm run build     # production bundle into dist/
npm run preview   # serve that bundle
```

For a real deployment, don't run any of the above: `Dockerfile` and `nginx.conf` here build that
bundle and serve it with `/api` and `/uploads` proxied onto the same origin, and
[`../DOCKER.md`](../DOCKER.md) brings the whole stack up with one command — including on a machine
with no internet.

---

## What this application is

A public media website: films, clips, music, games and a poll, with no end-user accounts. A few
decisions that would otherwise look odd:

- **No external requests.** The Persian typeface is self-hosted from `src/assets/fonts` (the legacy
  app's own Vazir, `-FD` = Persian digits), so the site depends on no third-party host. (It was
  first built for an in-flight network with no internet, where a CDN could not load at all.)
- **No end-user login.** The running legacy application has none — no `session_start()` outside the
  admin folder, and the only public writes are the poll and the playback heartbeats. There is no
  auth context, no account screen, and no favourites. `legacy-php/src/js/custom.js` appears to
  describe a full member area; roughly 45 of its methods call actions that do not exist in the API
  (MIGRATION.md §7.1). **It is not a specification.**
- **Light on the network.** Queries cache for five minutes and do not refetch on window focus. A
  dropped playback heartbeat is swallowed rather than surfaced — the next beat retries.

---

## Routes

| Route | Replaces | Endpoints |
|---|---|---|
| `/` | `index.php` | none — a static hub |
| `/page/:idOrSlug` | `page.php` | `GET /api/pages/:idOrSlug` |
| `/category/:id` | `category.php` | `GET /api/categories/:id/movies` |
| `/music-category/:id` | `music_category.php` | `GET /api/music-categories/:id/musics` |
| `/movie/:id` | `movie.php` | `GET /api/movies/:id`, `…/similar` |
| `/player/:id` | `player2.php` | `POST /api/watch-sessions`, `PATCH …/:id` |
| `/music/:id` | `sound.php` | `GET /api/musics/:id`, `POST /api/listen-sessions`, `PATCH …/:id` |
| `/search` | `search.php` | `GET /api/search` |
| `/musics` | `music.php` | `GET /api/musics` |
| `/poll` | `poll.php` | `GET /api/poll/questions`, `POST /api/poll/votes` |

The legacy `?id=` query parameter becomes a path parameter. Pages accept a slug as well as an id,
because `GET /api/pages/:idOrSlug` resolves both — the legacy hub linked to `page?id=3`, a row id
from one specific installation.

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
  accrues nothing. This is how the legacy watch totals have always been counted.
- **An empty search returns the first page of everything**, rather than an error.
- **The poll's three-hour revision window.** A second submission from the same anonymous token
  inside three hours revises the earlier answers; the server returns a different confirmation for
  each case, and the UI displays that message rather than composing its own.
- **Media paths are stored fields.** Never rebuild `assets/movies/{id}.jpg` — uploads have unique
  filenames now. Always resolve through `src/services/media.js`.

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

---

## Deliberately not built

- **Ad pre-roll.** `POST /api/ads-events` is real and `recordAdEvent()` matches it, but the legacy
  ad break came from jwplayer's VAST client pointed at a `/vast.xml` that is not in the repository
  (MIGRATION.md §7.4). Wiring it would mean inventing an ad source and writing fabricated rows into
  `ads_history`.
- **Series, seasons, episodes.** Scaffolding only in the legacy tree; the "series" tab set a query
  parameter `search.php` ignored (§7.3).
- **Video qualities, downloads, subtitles.** Both legacy players hardcoded a single MP4 and the
  subtitle module could not load (§7.4).
- **`other/contact-us.php`** (form is inside an HTML comment), **`other/voc.php`** (empty),
  **`other/bug-report.php`** (posts nothing), **`other/500.php`** (fatal on load) — §7.5.
- **The hub's advertisement slots.** `index.php` hardcoded two GIFs under `/assets/page/index/`
  with no API or admin screen behind them. Promotional content in the new system comes from banner
  blocks on a page, which is where it renders.
