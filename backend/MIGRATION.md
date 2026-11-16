# MuviLite — Backend Migration Record

Legacy PHP (`legacy-php/`) → Node.js / Express / MongoDB (`refactored/backend/`).

`legacy-php/` is the read-only source of truth. Nothing in it was modified.

---

## 1. What the legacy application is

**MuviLite** — a Persian-language (RTL) in-flight / captive-portal media portal
(MuviLite branding). Passengers browse curated pages of movies and music, stream
them in-browser with VAST pre-roll ads, and answer a nine-question satisfaction survey. Behind it
sits a full MVC admin panel with permission groups, an activity log, and a daily analytics cron.

Three layers, all against one MySQL database (`airplane`):

| Layer | Location | Role |
|---|---|---|
| Page scripts | root `*.php` | server-rendered HTML |
| Dispatcher | `includes/app.control.php` | sanitises input, validates numeric `id`, dispatches |
| API | `api/v2/index.php` | `?@=<action>` dispatcher holding all SQL |
| Models | `api/v2/models/*.php` | one class per table over `Model` (`__model.php`) |

---

## 2. Migration decisions

1. **No SQL dump was available.** The schema was reconstructed from the queries in the PHP source.
   No data-migration script was written.
2. **Scope: the full backend** — public API and admin API, all features.
3. **Port only what actually runs.** Orphaned and unreachable subsystems are recorded in §7 rather
   than invented.
4. **Clean REST only.** No `?@=action` compatibility shim; the frontend is being rewritten.

---

## 3. Completion checklist

**Tested** means exercised end to end against a running server and database, not merely written.
`—` means implemented but not yet exercised: the code paths exist and import cleanly, but no
fixture data was created for them during verification. Those are the areas to cover first when
real content is loaded.

| Feature | PHP analysed | DB understood | API designed | Backend | Tested | Matches original |
|---|---|---|---|---|---|---|
| Page + blocks (`?@=page`) | ✔ | ✔ | ✔ | ✔ | partial ¹ | ✔ |
| Movie detail (`?@=movie`) | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| Similar movies (`?@=similar`) | ✔ | ✔ | ✔ | ✔ | partial ² | ✔ |
| Category listing (`?@=categories`) | ✔ | ✔ | ✔ | ✔ | — | ✔ |
| Music categories (`?@=music_categories`) | ✔ | ✔ | ✔ | ✔ | — | ✔ |
| Music detail (`?@=music`) | ✔ | ✔ | ✔ | ✔ | — | ✔ ‡ |
| Music search (`?@=musics`) | ✔ | ✔ | ✔ | ✔ | — | ✔ † |
| Movie search (`?@=search`) | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| Watch session (`?@=watch_add`) | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| Watch heartbeat (`?@=watch_update`) | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| Listen session + heartbeat (`?@=listen_update`) | ✔ | ✔ | ✔ | ✔ | — | ✔ ‡ |
| Ad telemetry (`?@=ads_add`) | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ ‡ |
| Poll voting (`?@=poll`) | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ ‡ |
| Admin authentication | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ ‡ |
| Permission groups | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ ‡ |
| Movies CRUD + poster | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| Movie ↔ casts / categories relations | ✔ | ✔ | ✔ | ✔ | — | ✔ ‡ |
| Casts CRUD + photo | ✔ | ✔ | ✔ | ✔ | — | ✔ |
| Music CRUD + cover + tracks | ✔ | ✔ | ✔ | ✔ | — | ✔ |
| Categories / music categories | ✔ | ✔ | ✔ | ✔ | — | ✔ |
| Genres / age ranges / countries | ✔ | ✔ | ✔ | ✔ | ✔ ³ | ✔ |
| Banners + categories + ordering | ✔ | ✔ | ✔ | ✔ | — | ✔ |
| Pages + blocks + ordering | ✔ | ✔ | ✔ | ✔ | partial ¹ | ✔ |
| Users + user categories | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ ‡ |
| Activity log | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ ‡ |
| History reads (watch/listen/ads/poll) | ✔ | ✔ | ✔ | ✔ | partial ⁴ | ✔ |
| Excel export (movies, users) | ✔ | ✔ | ✔ | ✔ | — | ✔ |
| Daily watch-trend cron | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ ‡ |
| **Ad management (new — §11)** | ✔ | n/a ⁵ | ✔ | ✔ | ✔ | n/a ⁵ |
| **Poll CSV import (new — §12)** | ✔ | ✔ | ✔ | ✔ | ✔ | n/a ⁵ |
| **Placeholder images (new — §13)** | ✔ | ✔ | ✔ | ✔ | ✔ | n/a ⁵ |
| **Branding (new — §18)** | ✔ | ✔ | ✔ | ✔ | ✔ | n/a ⁵ |
| **HTML5 games + game genres (new — §19)** | ✔ ⁶ | n/a ⁶ | ✔ | ✔ | ✔ | n/a ⁶ |

† pagination added where the legacy query had none — see §6.
‡ a legacy defect was fixed rather than reproduced — see §6.
¹ page resolves by slug and returns its block list; no rail was populated with content.
² endpoint returns correctly for a movie with a genre; no same-genre sibling existed to match.
³ genres exercised via create; age ranges and countries seeded only.
⁴ poll history, user logs and watch trends read back; listen history not exercised.
⁵ the four rows here that are NOT migrations. The legacy app had no ad management and no table
  behind it, so there is nothing to match; the pre-roll's legacy *behaviour* is preserved and
  audited in §11. The CSV importer writes ordinary `Poll` documents — the collection is a
  migration, the way of filling it is not — see §12. The placeholder slots replace six theme files
  that no table, controller or permission ever backed — see §13. Branding replaces a theme image and
  two literals in `index.php`, with the same absence behind them — see §18.
⁶ games are not a migration of anything: `legacy-php/` was searched and contains no game, no table
  for one and no page that links to one. What was "analysed" is the absence, and the reference
  implementation the maintainer named instead — their Playva product — see §19.

---

## 4. Legacy action → REST endpoint

The legacy API was one dispatcher: `api/v2/index.php?platform=<n>&@=<action>`, all verbs `GET`.

### Public

| Legacy action | New endpoint |
|---|---|
| `?@=page` | `GET /api/pages/:idOrSlug` |
| `?@=movie` | `GET /api/movies/:id` |
| `?@=similar` | `GET /api/movies/:id/similar` |
| `?@=categories` | `GET /api/categories/:id/movies` |
| `?@=music_categories` | `GET /api/music-categories/:id/musics` |
| `?@=music` | `GET /api/musics/:id` |
| `?@=musics` | `GET /api/musics` |
| `?@=search` | `GET /api/search` |
| `?@=watch_add` | `POST /api/watch-sessions` |
| `?@=watch_update` | `PATCH /api/watch-sessions/:id` |
| (side effect of `?@=music`) | `POST /api/listen-sessions` |
| `?@=listen_update` | `PATCH /api/listen-sessions/:id` |
| `?@=ads_add` | `POST /api/ads-events` |
| `?@=poll` | `POST /api/poll/votes` |
| (hardcoded in `poll.php` HTML) | `GET /api/poll/questions` |
| (static `assets/ads/vast{1..5}.xml`) | `GET /api/ads/preroll` and `GET /api/ads/vast.xml` |
| (hardcoded in `index.php` HTML) | `GET /api/ads/placements` |
| — | `GET /api/lookups/{genres,age-ranges,countries,static}` |
| (theme files `src/images/posterHolder*.jpg`) | `GET /api/placeholders` — see §13 |
| — (no legacy games) | `GET /api/games`, `GET /api/games/genres`, `GET /api/games/:id`, `POST /api/games/:id/click` — see §19 |

`GET /api/movies/:id` and `POST /api/watch-sessions` also return `videoPath` (and the session
response returns `posterPath`). The legacy player page read both from public derived URLs —
`assets/video/{id}.mp4` and `assets/movies/{id}.jpg` — so exposing the stored paths preserves what
the client already had; media paths stopped being derivable from the id when uploads moved to
unique filenames (§5).

Only `music`, `watch_update`, `ads_add`, `listen_update` and `poll` were reachable over HTTP in the
legacy app (`api/v2/index.php:813-833`); the rest were commented out of the dispatcher and invoked
in-process by `App::process()`.

### Admin

Legacy dispatch was by file path plus `?@=<action>` at the bottom of each controller. All admin
endpoints now live under `/api/admin` and require `Authorization: Bearer <jwt>`.

| Legacy controller | New base route | Permission |
|---|---|---|
| `views/users/login.php` | `POST /api/admin/auth/login` | — |
| `MovieController` | `/api/admin/movies` | `movies` |
| `CastController` | `/api/admin/casts` | `casts` |
| `MovieCastController` | `/api/admin/movie-casts` | `movies` |
| `MusicController` | `/api/admin/musics` | `musics` |
| `CategoryController` | `/api/admin/categories`, `/api/admin/movie-categories` | `categories` |
| `MusicCategoryController` | `/api/admin/music-categories`, `/api/admin/music-categories-items` | `categories` |
| `views/categories/content.php` | `GET /api/admin/categories/:id/movies` | `categories` |
| `views/music-categories/content.php` | `GET /api/admin/music-categories/:id/musics` | `categories` |
| `views/pages/content.php`, `graph.php` | `GET /api/admin/pages/:id/blocks` | `pages` |
| `GenreController` | `/api/admin/genres` | `genres` |
| `AgeRangeController` | `/api/admin/age-ranges`, `/api/admin/countries` | `age-ranges` |
| `BannerController` | `/api/admin/banners`, `/api/admin/banner-categories` | `banners` |
| `PageController` | `/api/admin/pages` | `pages` |
| `PageBlockController` / `IndexBlockController` | `/api/admin/page-blocks` | `blocks` |
| `UserController` | `/api/admin/users` | `users` |
| `UserCategoryController` | `/api/admin/user-categories` | `users` |
| `PermissionGroupController` | `/api/admin/permission-groups`, `/api/admin/access-permissions` | `groups` |
| `UserLogController` | `GET /api/admin/user-logs` | `user-logs` |
| `WatchHistoryController` | `GET /api/admin/watch-history`, `/listen-history`, `/watch-trends` | `watch-history` |
| `AdsHistoryController` | `GET /api/admin/ads-history` | `watch-history` |
| — (no legacy controller) | `/api/admin/video-ads`, `/api/admin/placement-ads` | `ads` |
| — (no legacy controller) | `/api/admin/placeholders` | `placeholders` |
| — (no legacy controller) | `/api/admin/games`, `POST /api/admin/games/:id/bundle`, `/api/admin/game-genres` | `games` |
| `PollHistoryController` | `GET /api/admin/poll-history`, `/poll-summary` | `pages` |
| `views/polls/` (unfinished) | `/api/admin/polls`, `POST /api/admin/polls/import` | `pages` |
| `views/movies/export.php` | `GET /api/admin/movies/export` | `movies` |
| `views/users/export.php` | `GET /api/admin/users/export` | `users` |

Each resource exposes `GET /`, `GET /:id`, `POST /`, `PUT /:id`, `PATCH /:id/status`,
`DELETE /:id`. Verb → permission: `GET` → `view`, `POST`/`PUT`/`PATCH` → `edit`, `DELETE` → `delete`.

#### Added during the admin-panel pass

The last three rows above were added when the React admin was built, for the same reason
`videoPath` was added during the frontend pass: the legacy app had the screen, and the new API had
no way to serve it. All three are read-only.

The two category-content readers are the **inverse** of `GET /movies/:id/categories` — what is
inside a category rather than which categories a title belongs to. The public endpoints of that
shape (`GET /api/categories/:id/movies`) cannot serve the admin because they filter
`isActive: true`, and the legacy admin grid
(`admin/.../models/MovieModel.php::movieList`) filtered `is_delete = 0` only — a deactivated title
stayed listed and removable. `findByCategory`/`countByCategory` therefore take an `activeOnly` flag,
`true` on the public path and `false` here. Pagination is added, which the legacy query lacked, on
the same grounds as defect 12: which rows match is unchanged.

`GET /api/admin/pages/:id/blocks` returns a page with its blocks in display order, each block's
untyped `itemId` resolved against `BannerCategory` / `Category` / `MusicCategory` by `itemType`, so
the page composer is one request rather than N+1. Unlike the public reader it includes deactivated
pages and blocks, and keeps a block whose target no longer resolves (with `target: null`) instead of
dropping it — the public page hides such a block, but the admin has to see it to fix it.

Note for anyone extending these: `findByCategory` matches inside an **aggregation** pipeline, which
does not cast a string to an ObjectId the way a query does. Pass a resolved `category._id`, never
`req.params.id`. Doing the latter returns an empty list with no error, which is how it was caught.

---

## 5. Schema mapping

Legacy tables map 1:1 to collections. `is_active` → `isActive`, `is_delete` → `isDeleted`,
`created_date`/`modified_date` → Mongoose `timestamps`.

| Legacy table | Collection |
|---|---|
| `movies_tbl` | `Movie` |
| `musics_tbl` | `Music` |
| `casts_tbl` | `Cast` |
| `movies_cast_tbl` | `MovieCast` |
| `categories_tbl` / `category_relation_tbl` | `Category` / `CategoryRelation` |
| `music_categories_tbl` / `music_category_relation_tbl` | `MusicCategory` / `MusicCategoryRelation` |
| `pages_tbl` / `page_block_tbl` | `Page` / `PageBlock` |
| `banner_tbl` / `banner_categories_tbl` / `banner_categories_relations_tbl` | `Banner` / `BannerCategory` / `BannerCategoryRelation` |
| `genres_tbl`, `age_range_tbl`, `countries_tbl` | `Genre`, `AgeRange`, `Country` |
| `users_tbl` | `User` |
| `user_categories_tbl` + relations | `UserCategory` (membership is an array on `User`) |
| `permission_group_tbl` + `permission_group_relation_tbl` | `PermissionGroup` (relation collapsed into an array) |
| `access_permission_tbl` | `AccessPermission` |
| `user_log_tbl` | `UserLog` |
| `watch_history_tbl`, `listen_history_tbl`, `ads_history_tbl` | `WatchHistory`, `ListenHistory`, `AdsHistory` |
| (no table — `assets/ads/vast*.xml` on disk) | `VideoAd` — see §11 |
| (no table — hardcoded in `index.php`) | `PlacementAd` — see §11 |
| (no table — theme files under `src/images/`) | `Placeholder` — see §13 |
| (no table — a theme image, and two literals in `index.php`) | `Branding` — see §18 |
| `poll_tbl`, `poll_history_tbl` | `Poll`, `PollHistory` |
| `watch_history_trend_daily_tbl` | `WatchTrendDaily` |

Notable modelling decisions:

- **Admins and end users share one collection**, exactly as the legacy schema did: an administrator
  is a `User` whose `permissionGroup` is set. This is the condition the legacy login query used
  (`permission_group_id IS NOT NULL AND permission_group_id != 0`).
- **`publishYear` is a bare year, not a date.** The legacy helpers
  (`year_jalali_to_gregorian`, `year_gregorian_to_jalali`) converted only the year component. The
  admin form submits Jalali when `defaultOrigin === 0`; music renders Jalali when `isIranian`.
- **Media paths are stored fields, not derived from the id.** The legacy app served
  `assets/movies/{id}.jpg` and `{id}-216x332.jpg`, so an upload overwrote the previous file and the
  filename leaked the row id. Uploads now get unique generated names and the path is stored on the
  document. The 216×332 thumbnail size is reproduced exactly.
- **Relation tables stay their own collections** where the admin manages them independently and they
  carry their own delete flags; the two that were always rewritten wholesale (permission-group
  membership, user categories) collapsed into arrays.
- `movies_tbl.platform` was stored comma-joined; it is an array.
- `movies_tbl.season_id` is carried but unused — see §7.

---

## 6. Legacy defects fixed, not reproduced

Each of these is a bug rather than a business rule. Behaviour that users depend on was preserved;
behaviour that was plainly broken was corrected.

| # | Defect | Legacy location | Resolution |
|---|---|---|---|
| 1 | **Captcha checked *after* the credential check and session write.** A wrong captcha still produced a fully authenticated session; it only changed the redirect. | `views/users/login.php:29` vs `:31` | Nothing is issued until the password verifies. |
| 2 | **Permission aggregation used `sum(...) == 1`.** Two rows granting the same flag summed to 2, the equality failed, and access was silently denied. | `models/PermissionGroupModel.php:23-29` | Permissions are booleans, OR-ed together. |
| 3 | **Controllers performed no authorization at all.** Only view files checked; the `?@=`-dispatched controllers were reachable directly. | `controllers/*.php` | Guards are mounted on the route, so there is no path around them. |
| 4 | **Second-order SQL injection** via `item_sort`/`sort_type`, read from `page_block_tbl` and interpolated into the rail query with no whitelist. | `models/PageBlock.php` | Constrained by schema enum on write and mapped through a fixed table on read. |
| 5 | **Poll update had no time bound.** Once a token qualified as recent, the update rewrote every row that token had ever written for that question, corrupting responses recorded days earlier. | `api/v2/index.php:757-763` | The update is scoped to the same three-hour window that selected it. |
| 6 | **Unsalted `sha1()` passwords**, with the hash interpolated into the login SQL. | `controllers/UserController.php` | bcrypt. `legacyPasswordHash` allows a one-time verify-and-upgrade if a real database is imported. |
| 7 | **Password change was a guaranteed fatal error** — `UserController::update()` required `models/UserTokenModel.php`, which does not exist. | `controllers/UserController.php` | No such dependency. |
| 8 | **`UserLogController::actionDelete()` targeted the wrong model and a non-existent column** (`UserModel->delete("row = $id")`). | `controllers/UserLogController.php` | Not ported; logs are read-only. |
| 9 | **Daily cron was not idempotent** — it INSERTed unconditionally, so a re-run duplicated every row. | `crons/watch_history_daily.php` | Upsert on `(movie, windowStart)`, enforced by a unique index, over a **calendar-day** window — see the note below. |
| 10 | **Daily cron divided by zero** computing the mean of an empty group. | same | `$avg` in the aggregation pipeline. |
| 11 | **Daily cron was web-reachable** — no CLI guard, printed HTML. | same | Importable module plus a CLI script; no HTTP surface. |
| 12 | **Music search had no `LIMIT`**, returning every matching row. | `api/v2/index.php::musics` | Paginated. Which rows match is unchanged. |
| 13 | **Metadata reads wrote rows** — fetching music detail INSERTed a listen-history row, so every crawler hit inflated the stats. | `api/v2/index.php::music` | Session creation is an explicit `POST /api/listen-sessions`. |
| 14 | **Heartbeat targeted the wrong row** — `player2.php` sent the movie id where the session id was expected. | `player2.php` | The session id is a path parameter, making the mistake unrepresentable. |
| 15 | **No rate limiting on login.** `MAX_TRY_LOGIN` existed but belonged to the public API and was never applied. | `views/users/login.php` | Strict limiter on the login route; a general limiter app-wide. |
| 16 | **Secrets committed to source**: MySQL root password, FCM server key, Asiatech bearer token. | `__model.php:14-20`, `admin/includes/define.php`, `controllers/UserCategoryController.php` | All configuration is environment-driven; `env.js` fails at boot if a required secret is missing. |
| 17 | **Authentication events were never logged** — the activity log covered entity CRUD only. | `models/UserLogModel.php` | Login and logout are audited. |
| 18 | **Wrong permission identifiers** — `views/polls/*` checked `banners`; `views/music-categories/*` checked `categories`/`musics` by copy-paste. | those views | Each route names the section it actually guards. |

#### Note on defect 9 — the aggregation window changed alignment

The legacy job aggregated `[now - 24h, now]`, a window anchored to the moment of invocation. That
leaves the bucket with no stable identity: two runs minutes apart describe different, overlapping
windows, so no key exists on which a re-run can be recognised as the same work. An upsert keyed on
that window is therefore no better than the legacy INSERT — it never matches, and rows still
duplicate. (This was caught in testing: three runs produced three rows before the fix.)

The job now aggregates a whole **UTC calendar day**, defaulting to the last complete one. That gives
the bucket a stable key, which is what makes the upsert idempotent — verified as three consecutive
runs producing exactly one row. The legacy job was invoked daily from cron, so a daily bucket is its
intent; only the alignment changed. `--today` and `--date=YYYY-MM-DD` override the day.

The window boundary is half-open (`>= start`, `< end`) so consecutive days cannot both claim a
session that lands exactly on midnight.

### Behaviour deliberately preserved despite looking odd

- **A movie with no `genre_1` is invisible.** The legacy detail query INNER JOINed `genres_tbl` on
  `genre_1`. This is load-bearing for what the catalog shows, so it is enforced explicitly.
- **Per-endpoint sort whitelists differ and were not unified.** Category listing allows five keys
  and defaults to `created_date`; music categories allow three and default to `id`; search allows
  five and defaults to `id`.
- **Rails are hard-capped at 10 items with no pagination.**
- **Similar movies: same `genre_1`, random order, exactly 4.**
- **Pagination default and maximum are both 100.**
- **Heartbeats credit a fixed chunk** (30s video, 15s audio) rather than elapsed time — the client
  cannot choose how many seconds to add.
- **The poll's three-hour revision window**, keyed on an anonymous client-generated token.
- **Empty search text returns the first page of everything**, rather than an error.

---

## 7. Not ported — and why

These subsystems are referenced by legacy code but are **not runnable**. Porting them would have
meant inventing business logic the PHP never contained, which the migration brief forbids.

### 7.1 The phantom client API (`src/js/custom.js`)

`custom.js` defines roughly 45 `AjaxRequests` methods against `api/v2/?@=<action>`:

- SMS-OTP registration — `register_step1`, `register_step2`, `register_step3`
- `auth_login`, `auth_logout`, `user_data`, `user_update`, `password_update`,
  `password_forget_step1`, `password_forget_step2`
- `watch_history`, `favorite_list`, `favorite_add`, `favorite_delete`
- `package_list`, `transaction_user_package`, `buy_check_discount`, `buy_package`,
  `list_payment_port`
- `comment_list`, `comment_new`, `comment_replay`, `comment_replies`, `comment_like`
- `rank_new` (user ratings), `award_movie`, `award_serie`, `cast_details`, `cast_list_role`
- `movie_share`, `series_share`, `series_details`
- `location_countries`, `location_country`, `location_provinces`, `location_cities`,
  `list_qualities`, `list_age_ranges`, `list_platforms`, `list_currencies`

**None of these actions exist in `api/v2/index.php`.** One of them
(`getGeners`) still points at `GetDataController.php`, a v1 endpoint that is no longer in the tree.
There is no end-user login anywhere in the running application: no `session_start()` or `$_SESSION`
outside the admin folder, and the only public write paths are the poll plus the implicit
history inserts.

The taxonomy lookups among these — genres, age ranges, countries, cast roles, qualities, platforms,
languages — *are* served, because the tables and constants behind them are real. They are at
`GET /api/lookups/*`.

### 7.2 Billing and payments (`includes/backRequest.include.php`)

Implements an Asiatech payment callback over `transaction_tbl`, `packages_tbl`,
`used_discounts_tbl` and `user_token_tbl`, including a hardcoded bearer token for
`https://esb.asiatech.ir`. It `require`s `Model.php` and `defineResultFa.php` — **neither file
exists in `includes/`** — so the module cannot even load. No route reaches it.

### 7.3 Series and episodes

Scaffolding only: `season_id` filtering in the never-called `Movie::simpleSearch()`, a
`data-type="series"` tab whose click handler builds a query parameter `search.php` ignores,
season-picker markup in `player2.php` that is never populated, and
`includes/series.function.php` (a Persian number-to-words helper) which nothing includes.
`season_id` is carried on the `Movie` schema so the concept remains expressible.

### 7.4 Video qualities, downloads, subtitles

`VIDEO_QUALITIES_LIST` is defined and never referenced; both players hardcode a single MP4.
`includes/get-subtitles.php` requires `includes/SrtParser/library.php`, which does not exist, and no
page includes it. `application.control.include.php` calls `?@=list_subtitle_style`, an action with
no implementation.

### 7.5 Broken-on-arrival pages

- `other/500.php` — a guaranteed fatal error: it instantiates `\includes\MetaDataModel` (wrong
  namespace) with no arguments against a constructor requiring `array $meta`, and includes a
  `tabmenu.php` that does not exist. `_layout/metadataModel.php` is a 91-byte stub with no
  properties and no methods.
- `other/bug-report.php` — never posts anything. Its handler in
  `application.control.include.php` is never included, no `bug_report` action exists, and the
  client always shows a success dialog. It also loads reCAPTCHA but never renders the widget.
- `other/contact-us.php` — the entire form is inside an HTML comment.
- `other/voc.php` — an empty `<p>`.

### 7.6 Other dead code

`_layout/modals.php` and `_layout/movie-popup-details.php` are referenced by nothing;
`admin/3P1z05m4n4Gm3nt/captcha/img.php` is a second, unreferenced captcha implementation;
`includes/reCAPTCHA.php` is unused in the admin panel; `visit_movie_tbl` and its model are dead;
`Movie::simpleSearch()` and `Movie::totalItemsMovieList()` are defined but never called (the latter
is why the legacy pages rendered no pagination controls — the new API returns the count as `meta`).

### 7.7 Firebase push notifications

`UserCategoryController::createFCMTopic()` subscribed user segments to FCM topics using a server key
and IID token hardcoded in the source. `UserCategory.topicName` is carried, but no push integration
is implemented — it needs credentials that should not come from source control, and no other part of
the application sends notifications.

---

## 8. Configuration

Copy `.env.example` to `.env`. `PORT`, `MONGODB_URI`, `JWT_SECRET`, `JWT_EXPIRES`, `UPLOAD_PATH`,
`FRONTEND_URL`, `ADMIN_URL` are as the brief specifies; `BCRYPT_ROUNDS`, `MAX_UPLOAD_SIZE_MB`,
`MAX_VIDEO_UPLOAD_SIZE_MB` (§15), `MAX_GAME_UPLOAD_SIZE_MB` (§19), `ENABLE_CRON` and
`WATCH_TREND_CRON` are additions. `MONGODB_URI` and `JWT_SECRET` are required —
the process refuses to boot without them.

The legacy cron schedule lived in an external crontab not present in the repository, so
`WATCH_TREND_CRON` is configurable. Leave `ENABLE_CRON=false` and drive it externally with
`npm run cron:watch-trends` to match the legacy arrangement.

---

## 9. Running and verifying

```bash
cd refactored/backend
npm install
cp .env.example .env        # then set MONGODB_URI and JWT_SECRET
npm run seed                # reference data + an admin account
npm run dev
```

`npm run seed` creates an administrator — mobile `09120000000`, password `changeme123` unless
`SEED_ADMIN_MOBILE` / `SEED_ADMIN_PASSWORD` are set. **Change it after first sign-in.** Re-running
the seed never resets an existing password.

### Smoke tests

```bash
# health
curl localhost:4000/api/health

# public reads
curl localhost:4000/api/pages/film
curl localhost:4000/api/lookups/genres
curl "localhost:4000/api/search?text=&limit=5"

# watch session lifecycle: create, then two heartbeats (30s each -> 60)
curl -XPOST localhost:4000/api/watch-sessions \
     -H 'content-type: application/json' -d '{"movieId":"<id>"}'
curl -XPATCH localhost:4000/api/watch-sessions/<sessionId>

# poll: vote, then re-vote inside 3 hours (must UPDATE, not insert)
curl -XPOST localhost:4000/api/poll/votes -H 'content-type: application/json' \
     -d '{"token":"abcd1234","votes":[{"pollId":"<id>","vote":4}]}'

# admin
curl -XPOST localhost:4000/api/admin/auth/login -H 'content-type: application/json' \
     -d '{"mobile":"09120000000","password":"changeme123"}'
curl localhost:4000/api/admin/movies -H 'authorization: Bearer <token>'
```

### Verification performed

Run against Node 22.15.1 and a local MongoDB. `npm audit` reports **0 vulnerabilities**.

Unit-level, comparing against the legacy helpers:

- Jalali ↔ Gregorian year conversion — `1399 → 2020`, `1400 → 2021`, `2020 → 1399`, `1999 → 1378`,
  round-trip stable. Matches `year_jalali_to_gregorian` / `year_gregorian_to_jalali`.
- Mobile normalization — `09121234567`, `9121234567`, `+989121234567` and `0912 123 4567` all
  produce `+989121234567`. Matches `normalize_mobile_number`.
- Pagination — default 100, capped at 100, offset `(page-1)*limit`. Matches `api/system/define.php`.
- Sort whitelisting — unknown sort fields rejected rather than interpolated.

End to end:

- **Jalali conversion through the API**: a movie POSTed with `publishYear: 1399, defaultOrigin: 0`
  stored `2020`.
- **UTF-8 round-trip**: Persian text survives write and read intact (verified by codepoint).
- **Watch heartbeats**: create → 30 → 60 seconds, exactly `WATCH_CHUNK_TIME` per call.
- **Poll three-hour window**: first submission inserted (`updated: false`); a second submission from
  the same token updated in place (`updated: true`) leaving **one** row with the revised vote.
- **Permission denial**: a user in a group with no permissions gets 403 on both read and write.
- **Live permission propagation**: granting a permission took effect on the *same* token, with no
  re-login — the legacy panel required signing out and back in.
- **`genre1` visibility rule**: a movie without a primary genre returns 404 publicly but 200 in the
  admin, matching the legacy INNER JOIN.
- **Audit log**: creates recorded with field-level diffs; logins recorded.
- **Cron idempotency**: three consecutive runs over the same day produce **one** row.
- **Uploads**: unique filename, thumbnail generated at exactly 216×332, non-image rejected with 400.
- **Guards**: unauthenticated admin request 401, unknown route 404, invalid sort field 400.

Two real bugs were found and fixed during this pass: `jalaali-js` is CommonJS and its named ESM
import broke the whole module graph at boot; and the cron's window key was derived from the
invocation instant, so the upsert never matched and rows still duplicated (see the note under §6).

Things worth checking explicitly when real content is loaded, because they are where parity is
easiest to lose:

1. a re-vote inside three hours returns `"نظرات شما با موفقیت بروزرسانی شد."` and does **not** add rows;
2. an admin whose group lacks a permission gets 403, and the audit log records the writes that do succeed;
3. `npm run cron:watch-trends` twice over the same window produces one row per movie, not two;
4. a movie with no `genre1` returns 404 from `GET /api/movies/:id`;
5. `GET /api/categories/:id/movies?item_sort=modified_date` works but the same parameter on
   `/api/music-categories/:id/musics` is rejected — the whitelists genuinely differ.

---

## 10. Not in scope

The React frontend and admin applications, and any data migration from MySQL.

---

## 11. Beyond parity — advertisement management

**This section is the one place in this document that describes NEW FUNCTIONALITY.** Everything
else here reproduces something the legacy application did. Ad management does not: the legacy
application had no way to create an advertisement, and this was built at the maintainer's explicit
request after that gap was reported.

### What the legacy application actually had

Three separate things, none of them managed:

1. **A pre-roll video before a film.** `player.php:39-42` configured jwplayer's VAST client with a
   tag the CLIENT chose:

   ```js
   var randomm = Math.floor(Math.random() * 4) + 1;
   "advertising": { "client": "vast", "tag": "/assets/ads/vast"+randomm+".xml" }
   ```

   Those five files were hand-written VAST 3.0 documents sitting beside their MP4s in
   `assets/ads/`. Adding a campaign meant an FTP upload and a text editor.

2. **A pre-roll on the music player.** `sound.php:32-33` (and again at 112 and 131 for flowplayer)
   pointed at `/vast.xml` at the web root, **which does not exist in the repository**. That ad
   break never played.

3. **Two still adverts on the landing page.** `index.php:23-27` and `108-112`, hardcoded markup
   pointing at `assets/page/index/top.gif` and `bottom.gif`.

The only ad-related database table was `ads_history_tbl` — write-once telemetry of what the player
reported (`title`, `watched_second`, `user_ip`), with no key to join against, because there was
nothing to join to. `AdsHistoryController` is a report and nothing else: one `index` action, a grid
and a CSV export.

### What was added

| Concern | Collection | Public endpoint | Admin route |
|---|---|---|---|
| Pre-roll creatives | `VideoAd` | `GET /api/ads/preroll`, `GET /api/ads/vast.xml` | `/api/admin/video-ads` (+ `POST /:id/video`) |
| Landing-page slots | `PlacementAd` | `GET /api/ads/placements` | `/api/admin/placement-ads` (+ `POST /:id/image`, `/:id/landscape-image`) |

Both are guarded by a new permission page, **`ads`**. Existing installations must re-run
`npm run seed` before any group can reach the section — the seed upserts the permission row and
re-grants the full set to `Administrators`; it never resets a password.

`MAX_VIDEO_UPLOAD_SIZE_MB` (default 200) governs creative uploads. The image cap stays at
`MAX_UPLOAD_SIZE_MB`, which would reject every realistic video.

### Legacy behaviour preserved

- **Selection is a weighted random draw, and equal weights reproduce the legacy uniform draw
  exactly.** `weight` defaults to 1, so an installation that never touches it behaves as
  `Math.random()` over the eligible set did. Measured at 400 draws with weights 1 and 9: 91.8 %
  went to the heavier creative.
- **A skip control after three seconds.** Every legacy VAST file carried
  `skipoffset="00:00:03"`; that is the per-creative default.
- **The film follows the ad whether it was watched or skipped**, and both outcomes report to the
  telemetry endpoint — the legacy `adSkipped` and `adComplete` handlers.
- **Two artworks per landing-page slot.** Each legacy slot held two anchors and the stylesheet
  chose between them by viewport orientation (`.ads>a:last-child{display:none}`, reversed under
  `@media (orientation:landscape)`). So the first was the portrait artwork and the second the
  landscape one; that installation just shipped the same GIF twice. `imageLandscapePath` falls back
  to `imagePath`, which reproduces exactly that.
- **Artwork is not resized or cropped.** The legacy rule was `.ads>a>img{width:100%}` with no
  height constraint. The recommended 750×150 and 750×300 are advisory in the panel.
- **A VAST tag URL still works.** `GET /api/ads/vast.xml` renders the selected creative as the same
  document shape the five legacy files had, so a native client configured with a tag URL keeps
  working. It even keeps the redundant `<Description>` holding the duration in seconds, because the
  legacy player read `eventObjet.description` from it.

### Legacy defects not reproduced

| # | Defect | Where | Now |
|---|---|---|---|
| A | **`vast5.xml` could never play.** The draw was `Math.random() * 4 + 1`, covering tags 1-4 of 5. | `player.php:27` | Selection covers every eligible creative. |
| B | **A quarter of playbacks got a broken ad.** `vast1.xml` pointed its `MediaFile` at `assets/ads/adVideo.mp4`, which was never uploaded — while `1.mp4` sat unused beside it. | `assets/ads/vast1.xml` | A creative with no `videoPath` is filtered out of selection, and if playback fails anyway the film starts immediately. |
| C | **The client picked its own advert.** Nothing stopped a viewer requesting the same tag every time, or none. | `player.php:27` | The server draws; the client receives one creative. |
| D | **Completion reported the wrong number.** `adComplete` sent `eventObjet.description` — the ad's description field — as the seconds watched. | `player.php:138` | The real playhead position is reported for both outcomes, and `eventType` distinguishes them. |
| E | **Telemetry could not identify a creative.** `title` was free text from an XML file; two campaigns sharing a name were indistinguishable. | `ads_history_tbl` | `AdsHistory.ad` references the creative. Null on legacy rows and on third-party players, which still report a title only. |

### Deliberately not carried over

The `sound.php` music-player ad break. Its tag (`/vast.xml`) is absent from the legacy repository,
so that break demonstrably never played, and the music player has no ad slot here either. Adding
one would be inventing a placement rather than restoring it. `GET /api/ads/preroll` is generic —
wiring it into the music player is a frontend change if that is ever wanted.

### A correction to an earlier claim

The frontend record (§4, "Ad pre-roll") and the comments in `frontend/src/api/tracking.js` and
`MusicDetail.jsx` previously said the pre-roll was not built because the VAST tag "is not in the
repository". That is true of `sound.php`'s `/vast.xml` and **false of the film player**:
`assets/ads/vast1-5.xml` and four working MP4s are present. The pre-roll was skipped on thinner
grounds than were stated. Those three places are corrected.

---

## 12. Beyond parity — poll questions from a CSV file

**The second piece of new functionality in this document**, added at the maintainer's request. Like
ad management it restores nothing: the legacy application had no import of any kind, anywhere.

### What the legacy application had

`poll_tbl` and `admin/.../models/Poll.php` both existed, and neither worked:

- The model extended `AdminModel('page_block_tbl')` — it pointed at the **wrong table**.
- `views/polls/form.php` and `index.php` are a copy of the banner screens with the strings left
  alone: the form posts to `BannerController`, reads `$banner`, uploads to `assets/banners/`, and
  checks the `banners` permission. Nothing in it touches a poll.
- `poll.php` therefore hardcoded the nine questions as HTML (`name="question-1..9"`), and only the
  ANSWERS were ever persisted, keyed by `poll_id` 1-9 against rows nobody could edit.

Changing a survey question meant editing PHP. There was no screen to add one, let alone ninety.

### What was added

```
POST /api/admin/polls/import      multipart: file=<csv>, dryRun=<bool>, skipInvalid=<bool>
```

Permission `pages` / `edit` — the same one that creates a question by hand. The parser is
`src/utils/csv.js` (RFC 4180, no dependency added); the rules live in
`src/services/admin/pollImport.service.js`.

| Column | Header aliases | Required | Behaviour |
|---|---|---|---|
| `questionFa` | سوال، پرسش، متن سوال، `question`, `questionFa` | yes | ≤ 500 chars, as `pollWriteRules` |
| `questionEn` | سوال لاتین، سوال انگلیسی، `questionEn`, `english` | no | ≤ 500 chars |
| `order` | ترتیب، اولویت، ردیف، `order`, `sort`, `position` | no | integer ≥ 0; blank appends after the current highest |
| `isActive` | وضعیت، فعال، `isActive`, `active`, `status` | no | فعال/غیرفعال, 1/0, true/false, yes/no; defaults active |

Decisions worth knowing before changing any of it:

- **Import is idempotent.** A row whose `questionFa` already exists — compared with ZWNJ and
  whitespace collapsed, case-folded, and Arabic ي/ك normalised to Persian ی/ک — is skipped and
  reported, not created again and not an error. Re-uploading a corrected file adds only what is new.
  Soft-deleted questions do NOT block a re-import, so a question deleted on purpose can come back.
- **One bad row fails the whole file** unless `skipInvalid` is set. A half-loaded survey is worse
  than none, and the 400 names every offending line in `errors[]` as `line N`.
- **`dryRun` never refuses.** It reports the same structure with `wouldFail: true`, because a
  preview whose job is to describe a broken file must not decline to describe it. The admin screen
  previews and commits with the same call.
- **The file is parsed, never stored.** `uploadCsv` uses multer's memory storage: a spreadsheet is
  not an asset this app serves, so writing it under `uploads/` would leave litter nothing cleans up.
  Caps: 2 MB, 500 rows.
- **Excel reality is handled deliberately** — a UTF-8 BOM, a `;` or tab delimiter from a non-en-US
  locale, CRLF/CR/LF, quoted fields containing the delimiter or a newline, and Persian/Arabic-Indic
  digits in `order`. A file with no header row is read positionally as
  `questionFa, questionEn, order, isActive` and the report says so.
- **One audit entry per import, not per question.** `USER_LOG_ACTIONS.CREATE` on page `pages`, with
  `details.ids` listing what was created. Fifty entries would bury every other action in the log.

The four-point answer scale (عالی/خوب/متوسط/ضعیف) is fixed in `POLL_ANSWERS` and is not part of the
file — the legacy markup fixed it, and nothing in the schema ever varied it per question.

### Verified

Against a running server and the seeded nine questions, with a deliberately messy fixture
(semicolon-delimited, BOM, Persian digits, a quoted field containing `;`, a duplicate of a stored
question, an in-file duplicate, a non-numeric order, an empty question and an unreadable status):
dry run reported 3 importable / 2 duplicate / 3 invalid with the right line numbers; the commit
without `skipInvalid` returned 400 and wrote nothing; with it, exactly 3 rows were created, ordered
10, 11 and 12 after the stored maximum of 9, with the row that named `order` 12 keeping it; the
public `GET /api/poll/questions` then served 11 (the imported inactive row correctly hidden); and
re-running the same file created 0 and reported 5 duplicates. The test records were removed
afterwards.

---

## 13. Beyond parity — configurable placeholder images

**The third piece of new functionality in this document**, added at the maintainer's request. Unlike
the first two it does have a legacy ancestor — one that was a set of files rather than a feature.

### What the legacy application had

Six images that shipped with the theme and were named directly in the markup:

| File | Drawn for | Named at |
|---|---|---|
| `src/images/posterHolder216x332.jpg` | movie posters | `_layout/PageLayout.php:97`, `search.php:57` |
| `src/images/posterHolder216x331.jpg` | movie posters (the same grid, a different file) | `category.php:34` |
| `src/images/posterHolder200x200.jpg` | music covers | `music.php:46`, `_layout/PageLayout.php:154` |
| `src/images/posterHolder1920x720.jpg` | `full` banner slides | `_layout/PageLayout.php:7` |
| `src/images/posterHolder1920x360.jpg` | `long` banner slides | `_layout/PageLayout.php:8` |
| `src/images/posterHolder517x282.jpg` | `item` banner slides | `_layout/PageLayout.php:9` |
| `assets/avatarHolder.jpg` | cast photos | `includes/get-images.php:128` |

Changing any of them meant an FTP upload. No screen in the panel touched them, and there was no
table, controller or permission behind them.

Two of those uses did not work as intended, and neither defect is reproduced:

1. **They were lazy-load placeholders, not fallbacks.** `<img src="…posterHolder…" data-src="/assets/movies/{id}.jpg">`
   swapped the real image in on scroll, and the real URL was derived from the row id — so a title
   with nothing uploaded swapped a holder image out for a 404 and showed a broken frame.
2. **The one real server-side fallback is dead code.** `includes/get-images.php:124-129` selects
   `posterHolder`/`avatarHolder` when the file is missing, but `die('file not found:'.$path)` sits
   on the line above it, so a missing image answers with that text.

### What was added

```
GET    /api/placeholders                      public; { slot: path } for configured slots only
GET    /api/admin/placeholders                permission placeholders/view
POST   /api/admin/placeholders/:slot/image    placeholders/edit — multipart field `image`
DELETE /api/admin/placeholders/:slot          placeholders/delete
```

`PLACEHOLDER_SLOTS` in `src/config/constants.js` defines the five slots — `moviePoster`,
`musicCover`, `banner`, `castPhoto` and the catch-all `general` — with the recommended dimensions
taken from the legacy filenames above. Storage is one document per slot (`Placeholder`), files land
in `uploads/placeholders/`, and `src/services/placeholder.service.js` holds the rules.

Decisions worth knowing before changing any of it:

- **The API never substitutes.** A record with no image still answers `posterPath: null`; the client
  resolves `own → slot → general → the image bundled with the client`. Substituting server-side
  would leave the admin panel unable to tell "no image uploaded" from "showing the stand-in", which
  is the one place that distinction has to survive.
- **The map is cached in process** and dropped on every write. `GET /api/placeholders` is on the
  critical path of a passenger's first page load and the answer is five rows that change perhaps
  twice in the life of an installation. With more than one Node process, a second process serves its
  copy until it writes or restarts — acceptable for artwork, and not a pattern to copy for anything
  with a real consistency requirement.
- **The slot is validated BEFORE multer runs**, unlike every other upload here. `:slot` is a path
  segment and needs no body parsing, so an unknown one is rejected without first writing a file that
  nothing would reference. The id-carrying uploads cannot do this — a bad id is only discovered after
  the bytes have landed.
- **Clearing is a hard delete**, row and file together, and it is idempotent: clearing an empty slot
  is a 200, because the request asks for a state and that state already holds. `Placeholder` is
  therefore the one collection with no `isDeleted`/`isActive` — a slot is configured or it is not.
- **Replacing a slot deletes the file it replaced**, in that order: a crash between the two leaves an
  orphaned file, which is harmless, where the other order leaves a row pointing at nothing.
- Uploads and clears are audited on page `placeholders` with the old and new path in `details`.

`placeholders` is a new permission identifier. **An existing installation must re-run `npm run seed`**
(or insert the `AccessPermission` row by hand) before any group can reach the section — the same
requirement `ads` introduced in §11.

### Verified

Against a running server: an unknown slot is a 422 and writes no file; an upload stores the image and
appears in the public map immediately; replacing it deletes the superseded file and serves the new one
over `/uploads`; `DELETE` removes both row and file, a second `DELETE` is still a 200, and the map is
empty again; the audit log carries one `UPDATE` and one `DELETE` row on page `placeholders` with the
paths. In a browser, three seeded titles with no poster and one whose file is missing from disk all
drew the uploaded `moviePoster` image, and with only `general` configured they drew that instead. The
test placeholders were removed afterwards.

---

## 14. Maintainer-requested corrections, round one

Three changes asked for after the panel had been in use. None of them alters how authorization is
evaluated or how any passenger-facing page renders.

### 14.1 Landing-page ad artwork now has an enforced size

`AD_PLACEMENT_SIZES` in `src/config/constants.js` used to be one recommended size per slot, honoured
by nobody: `POST /api/admin/placement-ads/:id/image` accepted any image at any dimensions, exactly as
the legacy CSS did — `.ads>a>img{width:100%}` stretched whatever was there, so artwork prepared for
the wrong slot went live blurry or the wrong height.

The constant is now **required** dimensions, per slot *and* per variant:

| Slot | موبایل (portrait anchor) | دسکتاپ (landscape anchor) |
|---|---|---|
| `top` | 750×150 | 1500×150 |
| `bottom` | 750×300 | 1500×300 |

The mobile figures are the legacy HTML comments verbatim (`<!-- size : 750x150 -->` and
`<!-- size :750x300 -->`). **The desktop figures are new.** The legacy installation shipped the same
GIF in both anchors, so no second size ever existed; these are double the width at the same height —
the wider shape a landscape viewport wants — and 1500 px covers the widest the slot is ever painted,
since the tile column is capped at 70rem.

`buildImageAttacher` in `src/services/admin/attachment.service.js` grew a `requiredSize(document)`
option, used only by the two placement-ad attachers. It measures the file with
`readImageSize()` (new, in `src/services/media.service.js`) and rejects a mismatch with a 400 naming
both the required and the received dimensions.

- **The size comes from the record, not the request.** The variant is fixed by which route was hit
  and the slot by the ad's own `placement`, so an operator cannot declare their way past the check.
- **A rejected upload deletes its own file.** Multer has already written to `uploads/ads/` by the
  time any of this runs, so a refusal that did not clean up would leave an orphan per attempt that
  nothing ever collects.
- **`pageHeight` before `height`.** These slots are routinely animated GIFs — that is what the legacy
  ones were — and sharp reports the stacked height of every frame when it knows a file is animated.
  One frame is what the browser paints, so one frame is what is checked.
- An ad whose `placement` is somehow unknown gets **no** requirement rather than an unexplainable
  rejection.

### 14.2 `birthDate` retired from the users panel

The users section no longer collects a birth date. `birthDate` is gone from `userCreateRules` /
`userUpdateRules` and from the `assignable` list in `src/services/admin/user.service.js`, and
`create()` deletes it from the payload explicitly — that path spreads the whole body, so leaving it
out of the validator alone would not have stopped a hand-crafted request from setting it.

**The schema field stays.** `users_tbl.birth_date` carries over from the legacy database, and
dropping the path would delete those values on the next save of each document. It is now write-once
history: readable, never written.

`casts_tbl.birth_date` is untouched — a person's date of birth is real catalogue data there, and the
cast form still edits it.

### 14.3 Permission groups are granted per action, not per section

`PUT`/`POST /api/admin/permission-groups` now accept `grants` — the section × action matrix the group
editor submits — beside the raw `permissions` id array, which still works. `grants` wins when both
are present.

```jsonc
{ "name": "Editors",
  "grants": { "movies": { "view": true, "edit": true, "delete": false } } }
```

`GET /api/admin/permission-groups/:id` answers with `grants` alongside `permissions`, flattened by
the same OR the authorization resolver applies, so overlapping rows (which the legacy panel allowed,
and which it then silently denied — §6 defect 2) read as the single grant they amount to.

Why it was needed: a group's access is stored the legacy way, as references to `access_permission_tbl`
rows, and every seeded row grants all three actions at once ("Full access: movies"). No row expressed
"view only", so no group could be given one — the panel could hand out a whole section or nothing.

`src/services/admin/permissionGrant.service.js` resolves the matrix:

1. a section with nothing ticked contributes nothing;
2. an existing, non-deleted row granting **exactly** that combination is reused — which keeps the
   seeded "Full access: …" rows in use whenever all three boxes are ticked, so a group saved
   unchanged comes back referencing the same documents it started with;
3. only an unseen combination creates a row, named mechanically (`movies: view, edit`) so it is
   recognisable next to the hand-named ones.

Reuse-before-create is what stops `access_permission_tbl` filling with near-duplicates: there are
seven useful combinations per section and a deployment uses two or three.

Resolution sits in a wrapper around the CRUD service rather than in `transformWrite`, because it
reads and sometimes writes another collection and the factory's transform is synchronous.

### Verified

Against the running server: a group written with `{"movies":{"view":true}}` reads back as exactly
that and references a newly created `movies: view` row; the same group written with all three ticked
references the seeded `Full access: movies` document again, by id. An unknown section is a 422
(`"grants" contains an unknown section "nope"`), as is a non-boolean action. Uploading 800×200 or
1500×150 artwork to a `top` slot's mobile route is a 400 naming both sizes, 750×150 succeeds, the
mirror-image cases hold on the desktop route, and `uploads/ads/` gained a file only for the two
accepted uploads. A user update that omits `birthDate` succeeds; one that sends it is accepted and
the field stays `null`.

---

## 15. Beyond parity — clips, and a video the panel can actually attach

**The fourth piece of new functionality in this document.** It has no legacy ancestor at all: the
legacy catalog had one shape of title, and its player read the file from a URL derived from the row
id — `"file": "/assets/video/<?= $movieObj['id'] ?>.mp4"` (player.php:31, player2.php:102). Video
therefore arrived over FTP and **no screen in the panel could attach one**; `videoPath` survived the
migration as a stored, publicly exposed field with nothing able to write it.

### 15.1 `isClip` — one collection, two kinds

`Movie.isClip` (new, indexed) splits the catalog into short vertical **clips** and full-length
**films**. A second collection was considered and rejected: a clip carries the same title, genre,
description, tags, categories, poster and video as a film and appears in the same rails, and only the
metadata it does *not* use differs.

A clip's write keeps `titleFa`, `titleEn`, `genre1`, `descriptionFa`, `descriptionEn`, `tags`,
`isClip` and `isActive`. **Everything else is dropped** — year, calendar origin, IMDb rating and code,
country, company, location, second and third genre, age range, runtime, price, discount, cinema
expiry, platforms, kids and review flags (`CLIP_FIELDS` in `src/services/admin/registry.js`).

Dropped, not cleared: flipping a film to a clip and back must not destroy its metadata, and a clip's
copies of those fields sit at their schema defaults anyway. The panel disables the same inputs, so
this makes the API agree with the form rather than trusting it — react-hook-form submits a disabled
field's last value, so the form alone would not have been enough.

`GET /api/admin/movies?isClip=true|false` filters the grid; omitted means both. `isClip` is also on
the public movie shape and in `MOVIE_CARD_FIELDS`, because the distinction is meaningless if only the
panel can see it.

### 15.2 The video, uploaded or linked

```
POST   /api/admin/movies/:id/video   movies/edit — multipart field `video`
PUT    /api/admin/movies/:id/video   movies/edit — { url, durationSecond, width, height }
DELETE /api/admin/movies/:id/video   movies/edit
```

**One field, two sources.** A file and a link both land in `videoPath`; both clients already pass an
absolute `http(s)` value through untouched, so a second column would only create a "which one wins"
question with no right answer. Setting either replaces the other, and the file that was replaced is
deleted — the rule every attacher here follows. `DELETE` is idempotent.

Nothing fetches a submitted URL. The operator is trusted with the address exactly as they are with an
advertisement's click-through, and what it serves is probed in the browser before submission.

### 15.3 The standard, and what enforcing it is actually worth

| | orientation | duration |
|---|---|---|
| clip | portrait — taller than wide | shorter than 3 minutes |
| film | either | longer than 5 minutes |

**The 3-to-5-minute gap is intentional** and was confirmed with the maintainer: a four-minute video is
neither kind, and the rejection says so and names the flag that would accept it. Both bounds are
exclusive. The numbers are `CLIP_MAX_DURATION_SECONDS` and `MOVIE_MIN_DURATION_SECONDS` in
`src/config/constants.js`.

**This server cannot measure a video.** There is no ffmpeg in the image and sharp does not read video,
so the browser decodes the file — or probes the pasted URL — and sends `durationSecond`, `width` and
`height` with the request, exactly as the pre-roll uploader has always done for its duration. The
numbers are stored on the movie and are what `assertVideoMeetsStandard` checks.

That makes the check a **consistency rule, not a security boundary**: it holds an honest client to the
standard and keeps the stored metadata true to what was accepted, but a hand-crafted request can claim
any numbers it likes. Making it a boundary means running ffprobe over the stored file — an additive
change to one function in `src/services/admin/movieVideo.service.js` plus a new dependency in the
image. Nothing downstream trusts these numbers for anything but display and this check.

Metadata that is **missing** is treated differently from metadata that is **wrong**: a container the
browser cannot decode, or a cross-origin link that will not report, sends nothing, is accepted, and is
stored as null. Refusing those would leave the panel unable to attach video that plays perfectly well.

`MAX_VIDEO_UPLOAD_SIZE_MB` now defaults to **2048** (was 200) — a feature film is the largest thing
this application accepts. `client_max_body_size` in `admin/nginx.conf` was raised to match; a
deployment behind any other proxy must do the same, or the upload is refused before the API sees it.

### 15.4 Clip categories

A category **whose name contains «کلیپ» or "clip"**, in `nameFa` or `nameEn`, holds clips only.
Hardcoded at the maintainer's request (`CLIP_CATEGORY_KEYWORDS` / `isClipCategory`) rather than
carried on a column: existing categories are already named this way, and a flag would have to be set
by hand on every one of them. Matching is case-insensitive and substring-based, so «کلیپ های ورزشی»
and "Sport Clips" both qualify.

The rule is **one-directional**, exactly as asked: a clip category refuses films, while an ordinary
category takes both. So «کلیپ های ورزشی» stays a clip rail and a mixed category like «پیشنهاد سردبیر»
can carry a short clip beside a feature.

Enforced in `addMovieToCategory`, which is the single path behind both the movie form's category
picker and the category-content screen. Two consequences worth knowing: **renaming a category changes
what it accepts**, and titles already linked are left alone when it does — silently detaching them
would lose curation nobody asked to undo.

### Verified

Against the running server: creating a movie with `isClip: true` and a payload full of film fields
stored the title and tags and left price, year and company at their defaults; the clip/film matrix
behaved on every branch — a 100-second portrait clip accepted, the same clip at 200 seconds and at
1280x720 refused with the reason, a 240-second film refused as falling in the gap, a 3600-second film
accepted in both orientations, and a `javascript:` URL rejected by the validator. File uploads
behaved the same way, a refused upload left nothing in `uploads/movies/`, replacing a video deleted
the file it superseded, and `DELETE` removed both row reference and file and stayed a 200 on a second
call. A film could not be added to a category named "Sport Clips" (400 naming both), while a clip
could be added to that category and to an ordinary one. Test records and files were removed afterwards.

---

## 16. The full-width banner, retired — and banner artwork gets a size

### 16.1 `full` is withdrawn, not deleted

The maintainer withdrew the full-width banner style. Every trace of it is
**commented out rather than removed**, at their request, so restoring it is a matter of uncommenting
four lines:

| File | What is commented |
|---|---|
| `src/models/BannerCategory.js` | `'full'` in `BANNER_CATEGORY_TYPES_AVAILABLE` |
| `src/config/constants.js` | `full: 1920x720` in `BANNER_IMAGE_SIZES` |
| admin `src/utils/constants.js` | the «تمام عرض» option |
| frontend `BannerRail.jsx` | the `full` slide style |

**The schema enum still contains `'full'`.** Narrowing it would make every category already carrying
that value fail validation on its next save, which is data loss by another name. What changed is that
nothing may be SET to it: `BANNER_CATEGORY_TYPES_AVAILABLE` is a second, shorter list, and it is what
the write validator uses. A category still typed `full` therefore reads and renders normally but must
be given a surviving type before the panel will save it — which is the intended prompt.

**An existing `full` rail renders as `long`.** `RETIRED_STYLES` in the frontend maps it there rather
than letting it fall through to the `item` default: 'long' is the surviving full-bleed style, and
dropping such a rail to a strip of small cards would be a bigger change to a live page than the
withdrawal itself.

The seed no longer creates its `Home hero` category as `full` — a fresh installation must not be
seeded with a type the panel refuses to save. **Existing databases are not migrated**; a deployment
with a `full` category should retype it by hand.

### 16.2 Banner artwork now has accepted sizes

`BANNER_IMAGE_SIZES` in `src/config/constants.js`:

| Category type | Required artwork |
|---|---|
| «کشیده» (`long`) | 1920×360 |
| «معمولی» (`item`) | 517×282 |

These are the **legacy** figures, not new ones: `_layout/PageLayout.php::displayBanners` sized each
rail by the category's type, and the holder image shipped for each names the dimensions exactly
(`posterHolder1920x360.jpg`, `posterHolder517x282.jpg`).

**Any of them is accepted, not the one matching the banner's category.** A banner carries no type of
its own — the rail it appears in does, and it can appear in several — and it is routinely uploaded
before it is filed, so a rule derived from current membership would change under the operator as they
added it to a rail. The panel states both figures under the uploader and the server enforces the same
set, so the two never disagree.

`buildImageAttacher`'s `requiredSize` became `acceptedSizes`, returning a LIST; the advertisement
slots pass a list of one. `assertImageSize` reports every accepted size in its message
(`Image must be exactly 1920x360 or 517x282 pixels (received 1920x720)`), and still deletes the file
multer already wrote before refusing.

### Verified

Against the running server: 1920×360 and 517×282 uploads succeed; 1920×720 — the retired full-width
size — and 800×200 are both refused with a message naming both accepted sizes, and neither leaves a
file behind. Creating a banner category with `type: 'full'` is a 422 (`"type" must be one of: long,
item`), `long` succeeds, and the pre-existing `Home hero` category still reads back as `full`. The two
advertisement slots still enforce their single sizes through the renamed option. Test records and
files were removed afterwards.

---

## 17. Beyond parity — a music genre

**The fifth piece of new functionality in this document.** `musics_tbl` had no genre column and the
legacy music form (`admin/.../views/musics/form.php`) had no such field — music was organised by music
CATEGORY alone. Added at the maintainer's request.

### 17.1 A second taxonomy, not a shared one

`MusicGenre` is its own collection. Reusing `Genre` was considered and rejected on two grounds:

1. **The vocabularies do not overlap.** «کمدی» and «مستند» are not music genres, «پاپ» is not a film
   genre, and one shared list would put nonsense in both dropdowns.
2. **`Genre` is load-bearing for films.** The public movie query inner-joins `genre_1` and "similar
   movies" matches on it, which is not a collection to start mixing unrelated values into.

`colorClass` is deliberately absent. On `Genre` it is the legacy CSS class the film chips were
coloured with; a music genre is not rendered on the passenger site at all, so the field would have no
consumer.

```
GET/POST/PUT/PATCH/DELETE  /api/admin/music-genres   permission `genres`
```

**Guarded by `genres`, not a new key.** A new permission identifier would mean every existing
installation had to re-run `npm run seed` before anyone could reach the section — the requirement
`ads` and `placeholders` introduced in §11 and §13. Reusing the permission that already covers genre
management avoids that entirely, and follows the precedent set by music categories on `categories`
and countries on `age-ranges`.

### 17.2 `Music.genre`

One genre, not the three a film carries: `genre_1..3` exist on a movie because the legacy schema had
them and `genre_1` is load-bearing for the public query. Nothing here needs that, and an album is one
genre in practice.

**Deliberately absent from the public music shape.** The maintainer asked for it to be visible in the
panel's music form and nowhere else, so `services/music.service.js` does not return it and the
passenger site cannot render it. Exposing it later is one line there.

The admin music service populates `genre` so the form can show its name.

A known, benign edge: `optionalObjectId('genre')` checks that the value is a Mongo id, not that a
MusicGenre with that id exists. A hand-crafted request can therefore store a dangling reference —
which populates back as `null` and reads exactly like "no genre". The panel only ever submits ids from
`/music-genres`, and an existence check would mean wrapping the generic CRUD service the way
permission groups are wrapped; not worth it for a case that degrades to the default.

The seed creates seven starting genres (پاپ، سنتی، کلاسیک، راک، رپ، بی‌کلام، محلی) so a fresh
installation's dropdown is not empty. It is an upsert keyed on `nameFa`, like every other taxonomy, so
re-running it is safe.

### Verified

Against the running server: the seed creates seven music genres and leaves the eight film genres
untouched; a music document written with a music-genre id reads back with it populated; `''` clears it;
a FILM genre's id is accepted as an ObjectId but populates as `null`, so a film genre cannot attach to
music through the API either; and `GET /api/musics/:id` carries no `genre` key at all. The test record
was removed afterwards.

---

## 18. Beyond parity — branding: the customer logo and the landing-page copy

**The seventh piece of new functionality in this document**, added at the maintainer's request: "in
the front footer remove the logo, and make a place to upload logo — this logo is the customer logo
and is different from the main logo … make the text on the main page and the description settable
from the admin panel … add a section in admin so we can do these two things in one place, like a
branding section".

Like the placeholder images (§13), it has a legacy ancestor that was files and literals rather than a
feature.

### What the legacy application had

| Thing | Where it lived | How you changed it |
|---|---|---|
| The mark in the site footer | an image shipped with the theme, named in `_layout/footer.php` | FTP |
| The landing-page heading | a Persian literal in `index.php` | edit the file on the server |
| The sentence under it | a Persian literal in `index.php` | edit the file on the server |

No table, no controller, no permission — the same shape of gap as the placeholders.

### What was added

```
GET    /api/branding              public; { footerLogoPath, homeTitle, homeDescription, theme }
GET    /api/admin/branding        permission branding/view   — RAW stored values + field metadata
PUT    /api/admin/branding        branding/edit              — the text fields only
PATCH  /api/admin/branding/theme  branding/edit              — { theme }, see "Colour themes" below
POST   /api/admin/branding/logo   branding/edit              — multipart field `image`
DELETE /api/admin/branding/logo   branding/delete
```

One new collection, `Branding` (`models/Branding.js`), one new upload directory
(`uploads/branding/`), and one new permission page, `branding`. **An existing installation must
re-run `npm run seed`** (or insert the `AccessPermission` row by hand) before any group can reach the
section — the same requirement `ads` and `placeholders` carry.

### The decisions worth knowing

- **It is a SINGLETON, not a list.** `key` is fixed to `'default'` and unique, and every write
  upserts on it, so the row springs into existence on the first save and a double submit cannot
  produce a second one to disagree with the first. That is also why there is no `/:id` route: the
  resource *is* the installation's branding.

- **Blank means default, and the substitution happens on the way OUT.** The stored value is exactly
  what the operator typed. `getPublicBranding()` swaps in `BRANDING_DEFAULTS`
  (`config/constants.js`) for a field that is empty or whitespace. Storing the default on first save
  would freeze it — an installation that had once opened the screen would never receive an improved
  shipped wording again. It also makes "clear the box and save" a real, documented way to restore the
  original text.

- **The admin endpoint returns the RAW values; the public one returns the resolved ones.** An
  operator who saw the default pre-filled into the input could not tell it from their own text, and
  saving the form would then freeze it. The field definitions — Persian label, `maxLength`, `default`,
  `multiline`, a usage note — travel with the admin response, so the panel renders the form from the
  backend's list and a third field appears there with no client edit.

- **The text fields are always present in the public payload; `footerLogoPath` may be null.** Unlike
  the placeholder map, where an absent key means "use your own built-in", a client here renders what
  it is given. A client that had to choose between an empty heading and a default would be a second
  place the defaults live, and the two would drift.

- **The logo moves on its own two routes, not as a field of the save.** A text save must not be able
  to null a path whose file is still on disk, and an upload must not overwrite text an operator is
  mid-edit on. `updateBrandingText()` reads only the keys `BRANDING_TEXT_FIELDS` defines off the
  payload, so a crafted request cannot set `footerLogoPath` through `PUT /api/admin/branding` —
  verified.

- **The logo has NO enforced size**, unlike ad (`AD_PLACEMENT_SIZES`) and banner
  (`BANNER_ACCEPTED_SIZES`) artwork. Those sit in fixed frames the layout cannot adapt to; this is a
  customer's own lockup, whose proportions differ per customer. `BRANDING_LOGO_SIZE` (480×120) is
  advisory and shown under the uploader; the footer scales by height and lets the width follow.

- **Replacing the logo deletes the file it replaced**, after the new path is stored — a crash between
  the two leaves an orphan file (harmless) rather than a document pointing at a file that is gone.
  The same order as every other attachment here. Clearing an already-empty logo answers 200, not 404:
  the request asks for a state, and that state already holds.

- **The public payload is cached in process**, on exactly the terms `services/placeholder.service.js`
  states: it is on the critical path of the first page load, it is one small document, and every
  write drops the cache — so the only staleness window is between two Node processes. Acceptable for
  a logo and a heading; anything with a real consistency requirement must not copy the pattern.

### Site name (added 2026-11-15)

A third text field, `siteName` (max 40), at the head of `BRANDING_TEXT_FIELDS`, so it is validated,
saved, audited and rendered in the panel by the existing text machinery with no new route. Blank
publishes the product name, `MuviLite`. The shipped `homeTitle` default is now the template
`به {siteName} خوش آمدید`, filled on the way out (and in the admin placeholder) with the resolved
name, so a renamed site does not keep welcoming visitors to MuviLite; an operator's own heading is
published exactly as typed. Verified on a throwaway database: fresh defaults; a Persian name stored
trimmed with the welcome default following it; an own heading kept; 41 characters → 422; clearing
both restores the shipped text.

### Colour themes (added 2026-11-15)

Asked for by the maintainer: the operator picks the passenger site's colour combination in the panel.
`SITE_THEMES` (`config/constants.js`) lists four — `dark-blue` (the original logo-derived palette,
and the default), `dark-red`, `dark-pink` (dark blue and pink) and `navy-orange`. `Branding.theme` stores the key;
a document saved before the field existed, or holding a retired key, reads as `DEFAULT_SITE_THEME`,
so no migration and no re-seed is needed (it reuses the `branding` permission).

- **Its own route, `PATCH /api/admin/branding/theme`**, for the same reason the logo has its own:
  saving a colour must not submit a half-typed heading, and `PUT /api/admin/branding` ignores a
  `theme` key — verified. Re-saving the current theme writes nothing and logs nothing; a change is
  audited as `{ theme: { old, new } }`.
- **The backend holds only keys, labels and preview swatches.** The palettes themselves are the
  frontend's (`src/index.css`, `src/utils/themes.js`); `swatches` exist only for the admin's
  preview cards and must be kept in step with those by hand.

Verified against a throwaway database: the public payload starts at `dark-blue`; an unknown or
missing key answers 422 with a `theme` field error; unauthenticated answers 401; a valid key is
published on the next `GET /api/branding` (the cache is dropped) and audited.

### Verified

Against the running dev server, and then in Chrome against both clients:

1. `GET /api/branding` on an unconfigured installation answers the two shipped sentences and
   `footerLogoPath: null`.
2. `PUT` with Persian text round-trips byte for byte, newlines included, and the public endpoint
   reflects it on the next request (the cache is dropped on write).
3. A 121-character `homeTitle` is rejected with a field error naming the 120 limit.
4. `{"footerLogoPath": "/uploads/evil.png"}` through `PUT` changes nothing — the field is not in the
   allowlist.
5. Uploading a logo stores it under `uploads/branding/`, serves it, and a second upload replaces it
   and **404s the first file**. `DELETE` removes row field and file; a second `DELETE` answers 200.
6. Saving `""` and `"   "` restores both defaults on the public endpoint while the admin endpoint
   still shows them empty.
7. Every write lands one `branding` row in the activity log with the old and new value.
8. Unauthenticated `GET /api/admin/branding` answers 401.

The test document and its uploaded file were deleted afterwards, so the dev database holds no
`Branding` row.

---

## 19. Beyond parity — HTML5 games

**The eighth piece of new functionality in this document**, and the first that is a whole new
section of the product rather than a way of managing something the legacy site already showed. Added
at the maintainer's request: "add an html5 games section similar to playva-fullstack, that can upload
html5 zipped games and serve on website, add a games to main page and a games list page, also add
search games to search page, games should have genres, the game structure should be similar to
playva but without the leaderboard, add the crud for game and genres in admin".

### What the legacy application had

Nothing. `legacy-php/` contains no game, no table for one and no page that links to one — the four
tiles on `index.php` were film, music, clips and the poll. (A search of every PHP file for «بازی»
and `game` finds only «بازیگر» / «بازیگران», the cast role, and one Material icon called `games` in
the category form's icon picker.) So unlike §11, §13 and §18 there is no file-or-literal ancestor to
point at, and no legacy behaviour to preserve.

### The reference instead: Playva

The maintainer named their other product as the model. Everything below was read from
`playva-backend/` (`models/Game.js`, `models/Genre.js`, `routes/games.js`, `routes/genres.js`,
`middleware/injectGameHook.js`) rather than invented.

| Playva | Here |
|---|---|
| `Game`: `titleFa`, `folderName`, `genre`, `emoji`, `color1`, `color2`, `gameUrl`, `clicks` | the same eight fields, same names — plus `isActive`/`isDeleted`, which every content collection here has |
| `Game`: `leaderboardEnabled`, `scoreOrder`, `scoreLabel`, `scoreFormat`, `minScore`, `maxScore` | **not carried** — the leaderboard was excluded |
| `Score` collection, `/leaderboard`, `/:id/scores…` | **not carried** |
| `injectGameHook` + `public/playva-hook.js`, a script added to every game page to report scores | **not carried** — a game is served exactly as uploaded |
| `Genre`: `name`, `name_en` | `GameGenre`: `nameFa`, `nameEn` — this codebase's naming |
| `POST /api/games` — ZIP + fields in one multipart request | the same |
| ZIP → `games/<folderName>/`, `index.html` at the root or one directory down | the same rule; the directory is `uploads/games/<folderName>-<8 hex>/` (below) |
| `?search=`, `?genre=<id>`, `?genre=popular`, `?sort=` | `?text=`, `?genre=<id>`, `?popular=true`, `?item_sort=&sort_type=` |
| `POST /api/games/:id/click` | the same |
| deleting a genre in use is refused | the same |
| deleting a game removes its directory | the same; the row is soft-deleted, as everywhere here |
| a game's card is an emoji on a two-colour gradient, no image | the same |

### What was added

```
GET    /api/games                    public; ?text ?genre ?popular ?page ?limit ?item_sort ?sort_type
GET    /api/games/genres             public; active game genres, by name
GET    /api/games/:id                public; one game
POST   /api/games/:id/click          public; counts one opening (60/min per address)

GET    /api/admin/games              games/view     — grid; filters titleFa, folderName, genre, isActive
GET    /api/admin/games/:id          games/view
POST   /api/admin/games              games/edit     — multipart: `zip` + titleFa, genre, folderName?,
                                                      emoji?, color1?, color2?, isActive?
PUT    /api/admin/games/:id          games/edit     — the card fields only
POST   /api/admin/games/:id/bundle   games/edit     — multipart `zip`: a new build, same record
PATCH  /api/admin/games/:id/status   games/edit
DELETE /api/admin/games/:id          games/delete   — flags the row, deletes the files

       /api/admin/game-genres        games/*        — the standard six routes
```

Two new collections (`Game`, `GameGenre`), one new upload directory (`uploads/games/`), one new
dependency (`yauzl`, to read archives), one new variable (`MAX_GAME_UPLOAD_SIZE_MB`, default **100** —
Playva's figure), and one new permission page, `games`, which covers the games **and** their genre
list. **An existing installation must re-run `npm run seed`** before any group can reach the section —
the same requirement `ads`, `placeholders` and `branding` carry. The seed also adds eight starter
game genres, because the genre is required and the dropdown must not start empty.

The bundles themselves are **static files**. No route in this API serves them: they are published
under `/uploads/games/**` by whatever serves `/uploads` — nginx in both deployments, `express.static`
in development.

### The decisions worth knowing

- **Creating a game is ONE request, with the file in it.** Every other attachment here is
  create-the-record-then-upload. A game with no bundle is not a game, and two steps would leave an
  unplayable record whenever the second failed. The order inside is genre exists → folder name free →
  unpack → write the row, and a row that fails to write takes its freshly unpacked directory with it.
  The generic JSON `POST /api/admin/games` is unreachable (the multipart route is declared first) and
  the service refuses it anyway.

- **The archive is inspected before a byte is written.** Playva extracts everything to a scratch
  directory and then looks for `index.html`. Here the archive's directory is read first, so a bundle
  with no entry file, more than `GAME_MAX_FILES` (5000) files, or a declared size over
  `GAME_MAX_UNPACKED_BYTES` (512 MB) is refused with nothing on disk. The upload cap says nothing
  about the expanded size — 600 KB of ZIP can declare 600 MB, which is the test fixture — and this
  disk also holds every film.

- **Only the game's own files are written.** Entries outside the directory holding `index.html` are
  skipped, as are symbolic links and the `__MACOSX` / `.DS_Store` litter a Mac adds. Every
  destination is resolved and checked to lie inside the target; yauzl already refuses `../` and
  absolute names (the whole archive is rejected), and the check does not rely on that.

- **The directory carries a random suffix — `<folderName>-<8 hex>` — and `gameUrl` is therefore a
  stored field, not derivable.** Playva unpacks to `games/<folderName>/`, which is sound there because
  its server answers game pages with `Cache-Control: no-cache`. Here `/uploads` is served by nginx
  with `expires 7d`. Deleting a broken game and re-uploading the fix under the same name — the
  ordinary way to repair one — would keep serving the broken files to every browser that had opened
  it, for a week. A fresh directory per upload gives every build its own URLs, and is the rule the
  rest of this application already follows: generated names, nothing overwritten. `folderName` is
  still unique among live games and still the stem of the URL.

- **Unpacking is staged.** Files go to a hidden `.incoming-…` sibling and the directory is renamed
  into place at the end, so a half-written bundle is never reachable under its final URL and a
  failure leaves nothing behind.

- **The uploaded ZIP never touches `uploads/`.** It is written to the system temp directory and
  deleted when the response closes, whatever the outcome — everything under `uploads/` is published,
  and an archive that has not been inspected should not be downloadable. On the Ubuntu appliance the
  unit runs with `PrivateTmp=yes`, so that is the service's own `/tmp`. An upload the browser
  abandons half-way is deleted by the storage engine as the connection drops, and each new upload
  also sweeps anything in that directory older than an hour, for the case of the process dying with
  an archive in it (§20.2).

- **A game's files can be replaced without replacing the game.** `POST /:id/bundle` unpacks a new
  build, repoints the record, then deletes the old directory — in that order, so a refused archive
  leaves the game playable. Playva has no such route: there a fixed build means delete and re-upload,
  which resets the click count. This is the one thing here Playva does not do.

- **Delete removes the files, and that is an exception.** Every other soft delete in this API leaves
  its media on disk. A game's bundle is thousands of files nothing will serve again, so the directory
  goes; the row stays, flagged. `folderName` is unique only among rows that are not deleted (a
  partial index), so the name is free again at once. `removeGameBundle()` will only delete a direct
  child of `uploads/games` named by a well-formed `gameUrl` — it is a recursive delete whose argument
  comes out of the database.

- **Writes go through a whitelist.** `pickGameFields()` copies only `titleFa`, `genre`, `emoji`,
  `color1`, `color2`, `isActive`, so `gameUrl`, `clicks`, `folderName` and `isDeleted` cannot be
  moved by a save — verified. When this was written every admin write took the whole request body
  and this was the only thing protecting a game; §20.1 since closed that for all resources, and the
  whitelist now matters mainly on the multipart create route, which still hands the body over whole.
  Blank presentation fields are stored as Playva's defaults (🎮, `#000000`, `#222222`) rather than
  empty.

- **`popular=true`, not `genre=popular`.** Playva overloads the genre parameter with a magic value.
  Here `genre` is always an id and "popular" is its own flag with the same meaning: games opened at
  least once, most opened first, overriding any `item_sort`. The search term is `text`, as on
  `/search` and `/musics`, and it is escaped — Playva passes it to `$regex` raw.

- **Counting an opening is its own call**, for the reason the music detail stopped opening a listen
  session: a read should not write. It only counts games the public can see, and it is rate-limited
  because it is an unauthenticated write that moves a number other passengers see.

- **A game genre in use cannot be deleted** (409, naming the count). `Game.genre` is required, so
  deleting it would orphan every game under it. Deactivating is how a genre with games is retired: it
  leaves the public filter row and the games keep their label.

- **Helmet's Content-Security-Policy is dropped for `/uploads/games`, in development only by
  construction.** Its default (`script-src 'self'`) forbids the inline scripts, `eval` and WebAssembly
  game engines are built on; with it a game loads to a blank frame. Production never reaches that
  handler — nginx serves `/uploads` off the disk with no CSP — so removing the header is what keeps
  the two environments behaving the same.

### Who the game's code runs as

A bundle is published as uploaded and is not read, rewritten or vetted. It is somebody else's
JavaScript, and it runs on whichever origin serves it.

- **On the passenger site it runs unsandboxed, deliberately.** Games keep progress in `localStorage`
  and IndexedDB, which a sandboxed frame is denied. That origin has no sign-in and holds one stored
  value, an anonymous poll token; there is nothing there for a game to take.

- **On the admin host it must not**, because that origin's `localStorage` holds the signed-in
  administrator's token — a game opened there could act as them. Two things stop it:
  `admin/nginx.conf` and the admin vhost in `serve-ubuntu.sh` answer `/uploads/games/**` with
  `Content-Security-Policy: sandbox allow-scripts allow-pointer-lock`, which gives the document an
  opaque origin however it is opened; and the panel's own test frame carries the matching `sandbox`
  attribute. The passenger vhosts serve the same files without the header.

- **What that does not cover.** The header is nginx's. Behind the Vite dev proxy both clients reach
  the same Express handler, which cannot tell them apart and sends no sandbox — so in development
  only the panel's test frame is isolated, and pasting a game's address into the bar on the admin
  origin is not. Any deployment that serves the admin bundle some third way has to add the header
  itself. Who may upload a game at all is the `games` permission; grant it as you would the ability
  to publish a page.

### Verified

Against the running dev server (67 checks), then in Chrome at 1440×950 and 390×844 against both
clients (56 checks):

1. **Refusals, each leaving nothing on disk:** no token (401); no file; a `.txt`; plain text named
   `.zip`; an archive with no `index.html` (and one with it two levels down); an archive with a
   `../../` entry — refused, and nothing written outside; a 600 KB archive declaring 600 MB; a
   missing title, a folder name with a space and a colour that is not hex (422, on their fields); a
   genre id that does not exist.
2. **Create:** a root-level bundle and a zipped folder both unpack flat; the folder name is derived
   from the file name when omitted; `__MACOSX`, `.DS_Store` and a symlink entry are not written; the
   Persian title and the emoji round-trip; the page is served as `text/html` with **no** CSP while
   `/api/health` keeps its own; a duplicate folder name is a 409.
3. **Public reads:** listing, search by Persian title, a regex metacharacter as the term (200,
   empty), genre filter, `popular` before and after clicks and in click order, sort by clicks,
   an unknown sort key (400), `genre=popular` (422). A card carries the nine public fields only.
4. **Update:** editable fields change; `clicks`, `gameUrl`, `folderName` and `isDeleted` sent in the
   same body do not; a blank emoji becomes the default; an unknown genre is refused.
5. **Status:** a deactivated game is a 404, absent from the list, and cannot be clicked.
6. **Replace:** the URL changes, the old directory is gone, the clicks survive; a refused replacement
   leaves the current build serving.
7. **Genres:** create, update, deactivate (leaves the public row), delete; delete while in use is 409.
8. **Delete:** the directory is removed, a second delete is 404, and the folder name can be reused.
9. **In the browser:** on the passenger origin the fixture game runs its inline script and `eval`,
   reads and writes `localStorage`, and its progress survives a reload; in the admin test frame the
   same game runs and `localStorage` **throws** — the isolation, observed rather than assumed.
10. The temp directory held no ZIP afterwards, and `uploads/games` was empty again.

**Not verified:**

- **The nginx `sandbox` header itself.** The two config blocks were written and read, never run
  through nginx — there is none on the development machine. `serve-ubuntu.sh` runs `nginx -t` before
  it reloads, so a syntax error would stop a deploy rather than break a running appliance, but that
  the header does what is described above is untested until it is deployed.
- **A real game.** Every check used a hand-made bundle that exercises the things a game engine needs
  (inline script, `eval`, storage, relative assets in a subdirectory). No Phaser, Construct, Unity or
  Godot export has been uploaded.
- **A large upload.** The fixtures are a kilobyte each. The 100 MB path, and the time a
  several-thousand-file bundle takes to unpack, have not been measured. Unpacking is sequential and
  asynchronous, so it does not block the API, but it runs inside the upload request.
- **Docker.** As ever (§9): nothing here has been built into the images.

Every test game was deleted through the API and the soft-deleted rows were then removed, along with
the one test genre, so the dev database holds the eight seeded game genres and no games. The `games`
rows in the activity log are a true record of the testing and were left.

---

## 20. Defects in this codebase, found during the games work and fixed

Not legacy defects (§6) — these were ours. Both were noticed while building §19 and fixed straight
after it, at the maintainer's request.

### 20.1 An admin write could set any field the schema has

`createCrudController` handed the service `req.body` whole, and the service `$set` whatever it was
given. The validators only ever checked the fields they named; a field they did not name was not
refused, it was simply **not looked at** — and written. One request could create a movie with
`visitCount: 99999`, a `videoPath` pointing anywhere and `isDeleted: true`, or give a pre-roll ad a
file it never uploaded. Several comments in `registry.js` and `admin.validators.js` already said
those fields "cannot be blanked by a PUT carrying the whole form"; that was the intent and not the
behaviour. `middleware/validate.js` had been computing a filtered `req.validated` all along, and
nothing read it.

`declaredBody(req)` (`controllers/admin/crud.controller.js`) now cuts the body down to the top-level
fields the route's rules declare, for every generic create and update and for the two user routes —
`user.service.js` spreads a create payload straight into the document.

- **Which fields** comes from the validators; **the values** still come from `req.body`.
  `matchedData()`'s own values omit an optional field that was sent empty, so using them would have
  turned "clear this field" — an empty string in a PUT, which every form in the panel sends — into
  "leave it alone". That regression was the reason not to simply switch to `req.validated`.
- **A field now needs a rule to be writable**, and a missing rule drops it silently. The whole
  schema was audited against the rules before the change: every undeclared path was one that should
  not be form-writable (media paths set by upload routes, counters, legacy columns) with **one
  exception** — the access-permission form sends `isActive`, which had no rule and had only ever
  been saved by accident. It has one now, so it is validated as well as kept.

Verified against the running server across movies, video ads, access permissions, permission groups
(the `grants` matrix), users, genres, polls, countries, banner categories, pages and page blocks —
23 checks: the undeclared fields are dropped, an empty string still clears a field, arrays and the
clip transform still work. The same script run against the previous controllers fails on exactly the
smuggling checks, which is what shows the hole was real and not inferred.

### 20.2 An abandoned upload left its file behind — on every upload route

Found while testing §20.1's sibling fix in the panel (`admin/MIGRATION.md` §17): a film upload cut
off at 600 of 900 KB left a 600 KB `.mp4` in `uploads/movies/` that no record pointed at.

`multer.diskStorage` writes the incoming file and reports back when the write **finishes**. When a
browser gives up half-way — a closed tab, a page left mid-upload, a dropped connection, a client
timeout — the write never finishes, so nothing is reported, multer never learns the file's name, and
the partial stays for good with its stream still open. Under `uploads/` that is a publicly served
fragment of a film. Measured on the code as it stood: **every** upload route left one, and the audio
route also kept the complete tracks that preceded the cut one.

`middleware/upload.js` now uses its own storage engine, `abortSafeStorage`, for every disk upload —
images, audio, video and the game archive. It does what `diskStorage` did and keeps hold of the write
stream, so when the request closes before its body is complete it stops the write, deletes the file,
and tells multer the upload failed — at which point multer removes the files it *had* finished for
that request. `req.complete` is what separates an abandoned request from the ordinary `close` every
request ends with. One listener per request, however many files it carries.

- The game archive's temp directory keeps its age-based sweep (`sweepStaleGameZips`), now as a
  backstop rather than the mechanism: it catches the one case the engine cannot, the **process**
  dying while an archive sits there.
- **Not covered, and not fixable from inside the process:** the same crash mid-upload for a film or
  an image. The partial is then in `uploads/` and nothing remembers it. That needs a sweep for files
  no document references, which does not exist. It takes a crash or a power cut at exactly the wrong
  moment, not an operator closing a tab.
- multer itself is unchanged (1.4.5-lts). The engine uses only its documented storage interface, so
  it should carry over to multer 2 as it is — untried.

**Verified**, with the previous code as the baseline:

| Abandoned half-way | Before | After |
|---|---|---|
| film (`/movies/:id/video`) | 1 orphan | nothing |
| poster image | 1 orphan | nothing |
| audio, one whole track then a cut one | 2 orphans | nothing |
| game ZIP (temp directory) | 1 orphan | nothing |

Ordinary uploads are unchanged — a poster with its generated thumbnail, byte-identical; a film at
full size; two tracks with their sizes; an image over the limit refused with nothing left; a wrong
type refused; the 67-check games suite. And in Chrome, through the real movie form on a throttled
connection: a file was being written at 147 KB, the page was left, and the file was gone with the
movie's `videoPath` still null.

Two things that test taught, worth knowing before repeating it: closing the *page* through browser
automation, or switching the emulated network to offline, lifts the throttle and lets Chrome finish
sending — the upload then simply completes, record and file consistent, which looks like a failure of
the fix and is not. Navigating away while the throttle stays attached is what actually cancels it.

---

## 21. Beyond parity — uploaded video is transcoded to HLS

**The ninth piece of new functionality in this document.** Added at the maintainer's request: "i want
a transcoder that when i upload a video in mp4 or other format get the video transcoded to hls and
play it in front (m3u8) and change the player to D:\project\player-ai". The maintainer's three
choices, asked before any code was written:

| Question | Answer |
|---|---|
| How many qualities | an adaptive ladder — 360p, 480p, 720p, 1080p, only rungs at or below the source |
| The original upload after a successful transcode | **deleted** (kept on failure, for a retry) |
| Which videos | films and clips only — pre-roll ads stay MP4/WebM in their existing overlay |

### What the legacy application had

One progressive MP4 per title at `assets/video/{id}.mp4`, placed over FTP (§18 is where the panel
learned to attach one at all). No transcoding, no second quality.

### The flow

```
POST /api/admin/movies/:id/video   (multipart `video`, any of .mp4 .m4v .mov .mkv .webm .avi .wmv
                                    .flv .mpg .mpeg .ts .mts .m2ts .3gp .ogv)
  multer writes uploads/movies/<random>.<ext>
  ffprobe measures it               → 400 "no video track" / clip-film standard → 400, file deleted
  any transcode for this title is cancelled, and its pending original deleted
  movie.videoSourcePath = the file, videoStatus = queued        ← the request answers here
  jobs/transcodeQueue.js, one job at a time (TRANSCODE_CONCURRENCY)
    videoStatus = processing, videoProgress 0–99 (written at most every 2 s)
    ffmpeg → uploads/movies/<random>-hls.partial/{360p,480p,…}/index.m3u8 + seg_00000.ts…
    rename .partial → <random>-hls/, then in ONE write:
    videoPath = /uploads/movies/<random>-hls/master.m3u8, duration/width/height from ffprobe,
    videoStatus = ready, videoSourcePath = null
    the superseded video (file or HLS directory) and the original upload are deleted
GET  /api/admin/movies/:id/video        movies/view — status, progress, error, queue position
POST /api/admin/movies/:id/video/retry  movies/edit — re-queue a `failed` one (409 otherwise)
```

`PUT` (a link) and `DELETE` keep their meaning and now also cancel a transcode in flight. A link is
never transcoded: the passenger player (Muvi, frontend §11) plays an `.m3u8` link as HLS and anything
else as a single progressive file.

### The decisions worth knowing

- **`videoPath` is always what plays.** An upload never touches it until the HLS set is complete, so
  a title whose video is being replaced keeps playing the old one throughout, and a passenger is never
  handed a playlist that is still being written (`.partial` until the rename).
- **The clip/film standard is now a real boundary for uploads.** §18 had to trust numbers the browser
  sent, because there was no ffmpeg; ffprobe now measures the file on the server, before anything is
  replaced, and the browser's numbers are ignored for uploads. Links still use the browser's numbers.
- **Rotation.** A phone stores a portrait clip as a landscape frame plus a rotation flag. The probe
  reports DISPLAY dimensions (it swaps on a quarter turn), so the clip rule sees a portrait video, and
  ffmpeg applies the rotation when encoding, so the output is upright.
- **The ladder is sized by the short side**, so a 1080×1920 clip gets the same "1080p" rung as a
  1920×1080 film. A source below 360p gets one rendition at its own size; nothing is upscaled.
- **One ffmpeg run per title**: one decode, `split` into one scaler per rung, keyframes forced every
  6 s on every rung so the player can switch at any segment boundary. H.264 Main, yuv420p, AAC stereo
  48 kHz, MPEG-TS segments — the combination every browser, phone and TV decodes.
- **The queue is in memory, the truth is in Mongo.** On start-up every `queued`/`processing` movie is
  queued again (a `processing` one from scratch) and stray `.partial` directories are swept. On
  shutdown the running ffmpeg is killed so a deploy does not leave an orphaned encoder.
- **A late result loses.** Every job write is conditional on the movie still holding that job's
  source (`movieRepository.updateIfVideoSource`), so replacing or removing the video mid-transcode
  wins and the late output is deleted.
- **ffmpeg's whole process tree is killed** (`taskkill /T` on Windows, the process group elsewhere).
  Found in testing: Chocolatey's `ffmpeg.exe` is a launcher shim, so killing the spawned process left
  the real encoder running and holding the pipes — the cancel waited forever.
- **Without ffmpeg/ffprobe the API still starts**, logs a warning, and refuses film/clip uploads with
  a 503 that names the missing tool. Installed by `setup-ubuntu.sh` and the backend Docker image.
- **Disk.** The 1080p ladder is about 10 Mb/s summed, so roughly 4.5 GB per hour of 1080p film (the
  original is deleted afterwards). A 720p source is about 2.3 GB per hour.
- **Uploads from before this feature** stay progressive MP4 and still play (frontend §11).
  `npm run transcode:backfill` marks every one `queued` (`-- --dry-run` lists them); restart the API
  and its worker transcodes them in the background, each title playing its MP4 until its HLS is ready.

New settings (all optional): `FFMPEG_PATH`, `FFPROBE_PATH`, `TRANSCODE_CONCURRENCY` (default 1),
`TRANSCODE_PRESET` (default `veryfast`). New `Movie` fields: `videoSourcePath`, `videoStatus`
(`none|queued|processing|ready|failed`), `videoProgress`, `videoError`. The session response of
`POST /api/watch-sessions` gains `movie.videoStatus` so the player can say "being prepared".

### Verified

On Windows with ffmpeg 6.1 (Chocolatey), MongoDB, the real API:

- Probe + transcode: a landscape 720p MKV with audio (→ 360/480/720p, no upscale), a phone MP4
  with a 90° display-matrix rotation (→ portrait 360×640 … 1080×1920, upright), a 320×240 AVI with
  no audio (→ one 240p rendition, video-only master), a text file named `.mp4` (→ 400). Every
  segment exactly 6 s; master playlists carry `CODECS` and `RESOLUTION`.
- API: landscape-as-clip, too-short-as-film, garbage and `.txt` all refused with nothing left on
  disk; a clip queued → processing (progress 0…96) → ready, original deleted; a film cancelled at
  1 % by `DELETE` — ffmpeg (shim and real process) gone, `.partial` and original deleted, status
  `none`, in ~3 s; a film interrupted at 10 % by a server restart, resumed from scratch and finished
  (5½ min of 720p in about 5 min); a simulated failure retried to `ready`, and a second retry while
  queued refused with 409.
- Not verified: the Ubuntu appliance and the Docker image (ffmpeg comes from Debian/Ubuntu packages
  there, not tested in either), a real 1080p feature film's encode time on the appliance's CPU, and a
  multi-gigabyte upload end to end.

### 21.1 The MP4/HLS switch

Added at the maintainer's request: "a toggle that enables and disables video transcoding — if enabled
the uploaded video gets transcoded and if disabled the video stays MP4 as before". Read as ONE
installation-wide switch (the reason given was server load), in a new admin screen «تنظیمات ویدئو»
under a new permission page `settings` (`npm run seed` adds it to existing installations).

```
GET  /api/admin/settings/video          settings/view  { transcodeEnabled, chosen, transcoderAvailable, updatedAt }
PUT  /api/admin/settings/video          settings/edit  { transcodeEnabled: boolean }  — 409 for HLS without ffmpeg
GET  /api/admin/movies/video-settings   movies/view    the same, read-only, for the movie form
```

- **Stored** in a new singleton `SystemSetting.videoTranscodeEnabled`. `null` = never chosen = follow
  the server: HLS when ffmpeg/ffprobe are installed, MP4 when not — so a server deployed without the
  transcoder works with no setup. Whether ffmpeg is installed is cached for a minute.
- **MP4 mode** is the behaviour before §21: `uploadVideo` (MP4/WebM by MIME and extension), the file
  becomes `videoPath` in the same request, `videoStatus` stays `none`. It is measured by ffprobe when
  the server has it, and by the browser's numbers when it does not — the §18 consistency check.
- **The switch is read before multer reads the body** (`uploadMovieVideoFile` in
  middleware/upload.js), because the two modes accept different files, and the decision travels on
  `req.videoTranscode` so the service treats the file the way it was accepted.
- **It affects the next upload only.** Existing videos keep their format; a queued or running
  transcode finishes. An HLS upload replaces a published MP4 (deleting it) and vice versa.
- `setup-ubuntu.sh --no-ffmpeg` provisions a server without the transcoder. Requirements for both
  kinds of server: [DEPLOYMENT.md](../DEPLOYMENT.md).

Verified against the real API, with ffmpeg and with `FFMPEG_PATH`/`FFPROBE_PATH` pointing at nothing:
defaults (`chosen:false`, follows ffmpeg presence, both ways); non-boolean and missing values → 422;
MP4 mode refuses MKV and publishes an MP4 at once (ffprobe: 1080×1920); switching to HLS queues the
next upload while the MP4 keeps playing, and the MP4 is deleted once HLS is ready; without ffmpeg
HLS → 409, a false landscape claim for a clip refused from the browser's numbers, a true one published.

### 21.3 FRAME-RATE in the master playlist (2026-11-15)

Reported by the maintainer: in the player's quality menu every quality but «خودکار» showed
«در دسترس نیست». Cause: ffmpeg's HLS muxer writes no `FRAME-RATE` attribute; hls.js then reports
each level's frame rate as `0`, and the Muvi player hands that to
`navigator.mediaCapabilities.decodingInfo()` to check each quality — which rejects a zero frame rate
with a TypeError ("The video configuration dictionary is not valid"; confirmed in headless Edge),
and the player treats the rejection as "cannot decode". The player itself is not modified.

`addFrameRateToMaster()` (services/hlsTranscode) now runs after every successful transcode: it
ffprobes the first segment of the first variant and appends `FRAME-RATE=<fps>` to every
`#EXT-X-STREAM-INF`. Measured from the output, so it needs no database; idempotent; a failure is
logged and does not fail the transcode (playback and «خودکار» work without it). Sets made earlier
are repaired by `npm run hls:frame-rate` (`scripts/hls-frame-rate-backfill.js`, `-- --dry-run` to
list). Verified: a fresh 720p/25 fps transcode gets `FRAME-RATE=25` on all three variants; the
script patched an existing set once and skipped it the second time, other lines byte-identical.

**Playlists are no longer cached for a week.** `/uploads` was served with `max-age=7d` for every file,
so a repaired playlist would not reach a viewer who had already loaded the film until the week ran
out. `.m3u8` files now carry `Cache-Control: no-cache` — revalidated each load, a 304 when unchanged —
in Express (`app.js`), `frontend/nginx.conf`, `admin/nginx.conf` and the nginx blocks in
DEPLOY-SERVER.md / DEPLOY-LIARA.md (a regex location scoped to `/uploads/movies/`, so it cannot
shadow the games sandbox). Segments keep the long cache. Verified on the dev server: both playlist
levels `no-cache`, a segment `max-age=604800`, a conditional request 304. The nginx configs were not
syntax-checked (no nginx or running Docker on the dev machine). A browser that cached a playlist
before this change still needs one hard reload (Ctrl+F5).

### 21.2 MP4 or HLS per upload (2026-11-15)

Requested by the maintainer: "I want it changeable for each video". `POST /api/admin/movies/:id/video`
now takes an optional `?mode=hls|mp4`. The installation switch above is demoted to the **default** —
an upload that sends no `mode` gets it, exactly as before, so existing clients are unaffected.

- **In the query string, not the body**, because the mode decides which files multer accepts and so
  must be known before the body is read (`middleware/upload.js` calls
  `videoSettings.resolveUploadTranscode(req.query.mode)` first).
- **An explicit `hls` on a server without ffmpeg is refused with 409 before the file is received**,
  rather than accepted and failed later. Any other value → 422 with a `mode` query error.
- Nothing is stored per film: the mode only decides how *this* file is published, and the result is
  visible from `videoPath` (`.m3u8` or not) as it always was.

Verified against a throwaway database with real ffmpeg-generated files: bad mode → 422; `mp4` with an
MKV refused, with an MP4 published at once; `hls` with an MKV queued and transcoded; no mode follows
the switch in both positions; `mp4` overrides an HLS default and `hls` an MP4 default; with ffmpeg
hidden from the server's PATH, `hls` → 409 and `mp4` still publishes.

---

## 22. Renamed to MuviLite, and deployed as an ordinary website

At the maintainer's request (2026-11-14): "change its name to MuviLite", every part — technical
names included — and "remove things about deploying in airplane, consider it a normal product on
web".

**The name.** `MediaWifi` / `mediawifi` / `MEDIAWIFI` became `MuviLite` / `muvilite` / `MUVILITE`
in every tracked file under `refactored/` (393 occurrences in 43 files): page titles, the admin
header, package names, Docker images and project, systemd/nginx names in the guides, `/opt` and
`/var/lib` paths, environment templates, Liara app names. `assets/images/mediawifi-mark.png` became
`muvilite-mark.png` in both apps (the mark has no lettering). Kept on purpose:

- `frontend/src/assets/images/mediawifi-logo.png` — the full logo has "MEDIA WIFI" drawn into the
  artwork; nothing imports it, and a MuviLite wordmark needs new artwork, not a new file name.
- **Existing databases and `.env` files.** Only the templates changed (`MONGO_DB=muvilite`,
  `…/muvilite` in `MONGODB_URI`); an installation's own `.env` keeps its database name, so it keeps
  its data.
- **The admin's sign-in** moved from `mediawifi.admin.token` to `muvilite.admin.token` in
  localStorage; `api/client.js` carries the old key over once, so nobody is signed out by the update.

**The in-flight appliance is gone.** Removed: `serve-ubuntu.sh` (own Wi-Fi access point, DHCP/DNS,
captive portal, systemd units for all of it), `UBUNTU.md`, `docker/bundle-offline.sh` (images for an
air-gapped host) and `frontend/public/hello.html` (the captive-portal splash). The last commit that
has them is tagged **`appliance-final`** — `git checkout appliance-final -- refactored/serve-ubuntu.sh`
brings the script back if a box built that way ever needs maintaining. The deployment guides
(DEPLOYMENT.md, DEPLOY-SERVER.md, DOCKER.md, DEPLOY-LIARA.md), the setup/build scripts and the READMEs
now describe a normal web server; "passenger site" is "main site" there. The public site's own copy
no longer mentions a flight («به MuviLite خوش آمدید», empty states say «در فهرست سایت»), and the
panel says «سایت اصلی» for the public site. The shipped home-page texts are BRANDING_DEFAULTS, so an
installation that never customised them changes automatically.

Not changed: code comments that explain past design decisions ("the cabin link is slow") — they are
history, and the decisions (no CDN, aggressive caching) still hold — and the seeded poll questions,
which are airline-satisfaction questions carried over from the legacy database and are data the
operator manages in the panel.

**A defect found on the way:** `up.sh` had never parsed. `"${host_ip:-<this machine's IP>}"` — an
apostrophe inside a `${…:-…}` default within double quotes — is a syntax error in bash, so the Docker
path could not have run. Fixed; all shell scripts now pass `bash -n`.
