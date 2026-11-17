# MuviLite — Frontend Migration Record

Legacy PHP public site (`legacy-php/*.php`) → React/Vite (`refactored/frontend/`).

`legacy-php/` is the read-only source of truth. Nothing in it was modified. The backend counterpart
of this document is [`../backend/MIGRATION.md`](../backend/MIGRATION.md); its §4 endpoint map and §6
defect list are assumed here rather than repeated.

---

## 1. Completion checklist

**Tested** means exercised in a browser against a running backend and database. `—` means built and
type-clean but never rendered with real content, because no fixture data exists for it yet. The
backend record marks the same areas honestly in its §3, and the gaps line up: whatever was never
exercised server-side has no data to exercise here either.

| Feature | PHP analysed | API designed | Frontend built | Tested | Matches original |
|---|---|---|---|---|---|
| Landing hub (`index.php`) | ✔ | ✔ | ✔ | ✔ | ✔ ¹ |
| Page with rails (`page.php`) | ✔ | ✔ | ✔ | — | ✔ |
| Banner rails (`PageLayout::displayBanners`) | ✔ | ✔ | ✔ | — | ✔ ² |
| Category listing (`category.php`) | ✔ | ✔ | ✔ | — | ✔ ³ |
| Music category listing (`music_category.php`) | ✔ | ✔ | ✔ | — | ✔ ³ |
| Movie detail (`movie.php`) | ✔ | ✔ | ✔ | — | ✔ ⁴ |
| Similar titles (`?@=similar`) | ✔ | ✔ | ✔ | — | ✔ |
| Video player (`player2.php`) | ✔ | ✔ | ✔ | — | ✔ ⁵ |
| Pre-roll ad break (`player.php`) | ✔ | ✔ | ✔ | — | ✔ ⁹ |
| Landing-page ad slots (`index.php`) | ✔ | ✔ | ✔ | — | ✔ ⁹ |
| Album + audio player (`sound.php`) | ✔ | ✔ | ✔ | — | ✔ ⁶ |
| Movie search (`search.php`) | ✔ | ✔ | ✔ | — | ✔ ³ |
| Music search (`music.php`) | ✔ | ✔ | ✔ | — | ✔ ³ |
| Poll (`poll.php`) | ✔ | ✔ | ✔ | — | ✔ ⁷ |
| Header / sidebar / footer (`_layout/*`) | ✔ | — | ✔ | ✔ | ✔ ⁸ |
| Not found (`other/404.php`) | ✔ | — | ✔ | ✔ | ✔ |
| Placeholder artwork (theme `posterHolder*.jpg`) | ✔ | ✔ | ✔ | ✔ | ✔ ¹⁰ |
| Branding (footer logo, landing copy) | ✔ | ✔ | ✔ | ✔ | ✔ ¹¹ |
| **Games: list, play screen, search rail (new — §9)** | ✔ ¹² | ✔ | ✔ | ✔ | n/a ¹² |

¹ links by page **slug** rather than the legacy `page?id=3`, which was a row id on one installation.
² style → shape mapping reconstructed from the legacy placeholder dimensions; see §3.
³ pagination and sorting added — the legacy pages rendered neither.
⁴ genres render as labels, not links; see §3.
⁵ native `<video>` replaced flowplayer; no auto-fullscreen; see §3. Since §11 the film plays in the Muvi player instead.
⁶ native `<audio>` replaces jwplayer; no pre-roll on the album player; see §4.
⁷ questions come from the database instead of hardcoded markup. The submission result is a
  toast, as the legacy SweetAlert was: the banner it briefly replaced sat above a form long
  enough to scroll, so a passenger at the submit button saw no confirmation at all.
⁸ the commented-out genre dropdown and the dead "series" tab are not carried over.
⁹ built after the migration, at the maintainer's request, against the new ad API. The legacy
  *behaviour* is preserved (weighted-random creative, three-second skip, orientation swap on the
  landing-page slots); the legacy *authoring* — hand-written VAST files — is not. Backend §11.
¹⁰ the legacy fallback images are preserved as a CONCEPT and their sizes as the recommended ones,
  but they are uploaded in the panel now instead of shipping with the theme, and they are a genuine
  fallback rather than a lazy-load placeholder that a missing file replaced with a 404. See §7.
¹¹ new at the maintainer's request, and a departure rather than a migration: the product lockup was
  REMOVED from the footer in favour of the customer's own uploaded logo, and the landing heading and
  its sentence became operator text. The shipped wording is unchanged and is still what an
  unconfigured installation shows. See §8, and backend §18.
¹² not a migration at all: the legacy site had no games, so there is nothing to match. What was
  analysed is that absence, and the maintainer's Playva front end, which the section is modelled on.
  See §9, and backend §19.

---

## 2. Legacy page → route

| Legacy | Route | Endpoints |
|---|---|---|
| `index.php` | `/` | none — a static hub |
| `page.php?id=` | `/page/:idOrSlug` | `GET /api/pages/:idOrSlug` |
| `category.php?id=` | `/category/:id` | `GET /api/categories/:id/movies` |
| `music_category.php?id=` | `/music-category/:id` | `GET /api/music-categories/:id/musics` |
| `movie.php?id=` | `/movie/:id` | `GET /api/movies/:id`, `…/similar` |
| `player.php` / `player2.php` | `/player/:id` | `POST /api/watch-sessions`, `PATCH …/:id` |
| `sound.php?id=` | `/music/:id` | `GET /api/musics/:id`, `POST /api/listen-sessions`, `PATCH …/:id` |
| `search.php` | `/search` | `GET /api/search` |
| `music.php` | `/musics` | `GET /api/musics` |
| `poll.php` | `/poll` | `GET /api/poll/questions`, `POST /api/poll/votes` |
| `other/404.php` | `*` | — |
| — (new, §9) | `/games` | `GET /api/games`, `GET /api/games/genres` |
| — (new, §9) | `/game/:id` | `GET /api/games/:id`, `POST /api/games/:id/click`, then the bundle itself from `/uploads/games/**` |

---

## 3. Decisions that change what a user sees

Each of these is a deliberate departure. Behaviour users depend on was preserved; what was plainly
broken or unreachable was not reproduced.

| # | Legacy behaviour | Here | Why |
|---|---|---|---|
| 1 | Genre chips linked to `/search?genre={id}` | Plain labels | `search.php` read only `text`, and the search endpoint filters on `text` alone — the legacy links landed on an unfiltered page. A dead link is worse than a label. |
| 2 | No pagination controls anywhere | Pagination on every listing | The legacy count query was written but never called, so listings silently truncated (backend §7.6). The API returns the count as `meta`. |
| 3 | No sort controls | A sort control per listing | The whitelists existed server-side and nothing exposed them. Each page offers only the keys its own endpoint accepts — they genuinely differ, and a wrong key is a 400. |
| 4 | Player went fullscreen on load | Fullscreen on the first tap | A browser rejects a programmatic fullscreen request with no user gesture behind it, so the legacy call only ever worked incidentally. |
| 5 | Runtime printed as «۹۵دقیقه» | «۱ ساعت و ۳۵ دقیقه» | Display only. |
| 6 | Album fetch opened a listen-history row | Session opens on first play | The legacy read wrote a row, so every crawler hit inflated the statistics (backend §6 defect 13). |
| 7 | Two hardcoded ad GIFs on the hub | Managed records in the same two slots | `/assets/page/index/top.gif` was markup with no API behind it; both slots are now editable under /placement-ads in the panel and rendered by `components/ads/PlacementAdSlot.jsx`. The legacy orientation swap between the slot's two anchors is preserved. See backend §11. |
| 8 | Banner styles named `full` / `long` / `item` | Aspect ratios 16/6, 16/3, 517/282 | Reconstructed from the placeholder dimensions in `_layout/PageLayout.php` (1920×720, 1920×360, 517×282) and from its class assignment, which grouped `full` and `long` as hero strips and only `item` as a multi-card rail. |
| 9 | A banner with no `url` rendered as `<a>` with no href | Rendered as `<figure>` | A dead link is not a control. |
| 10 | Poll answers keyed by position (`{id: 1..9}`) | Keyed by question `_id` | Positional ids bound answers to row order, so reordering or deleting a question silently misattributed every response after it. |
| 11 | Seek buttons injected into the flowplayer bar | The player's own chrome — first the app's `PlayerControls.jsx`, since §11 the Muvi player's bar, with the pair added beside play | Native `<video controls>` cannot be added to, which stranded the ±15/+30 buttons in a row beneath the picture instead of beside the play control. Owning the bar puts them back where flowplayer had them, and lets the film fill the viewport rather than sharing it with a strip of controls. |
| 12 | A poster click opened `movie.php?id=` | A poster click opens `/player/:id` | Requested by the maintainer: one tap from poster to picture. The detail page is unchanged and still routed at `/movie/:id` — the player's back control and both of its error states link to it — it is simply no longer the poster's destination. Titles with no video file are safe to open this way: the player already renders its "file not uploaded" notice with a link through to the detail page. |
| 13 | Holder images named in the markup (`src/images/posterHolder216x332.jpg` and five siblings) | The placeholder an operator uploads under /placeholders, then the one bundled image | The legacy holders were lazy-load placeholders, not fallbacks: `data-src` swapped in a URL derived from the row id, so a record with nothing uploaded traded the holder for a 404. Changing one meant an FTP upload. See backend §13. |
| 14 | The product's own lockup sat in the footer | The CUSTOMER's logo, uploaded under «هویت بصری» — and nothing at all until one is | Requested by the maintainer: the footer identifies whoever the installation belongs to, not the product. The header mark is a different image and is unchanged. There is no fallback to the lockup, because falling back to it would defeat the point. See backend §18. |
| 15 | The landing heading and the sentence under it were literals in `index.php` | Operator text from `GET /api/branding`, edited under «هویت بصری» | Same request. The shipped wording is still what an unconfigured installation shows, and clearing a field in the panel restores it. |
| 16 | «… برای مبین وان محفوظ می‌باشد» in the footer | «… برای آوین انس محفوظ می‌باشد» | Requested by the maintainer. It was the only occurrence in the repository. |
| 17 | — (this hero did not exist in `index.php`, which was a bare tile grid) | The Latin eyebrow «In-flight entertainment» above the heading was removed | Requested by the maintainer. It labelled the product in a language the rest of the page is not written in, and with the heading now operator text it was the one line on the page nobody could change. The operator's heading opens the hero. |
| 18 | Four tiles on the hub: film, music, clips, poll | A fifth row, «بازی» (`GAM`), between clips and the poll | Requested by the maintainer with the games section (§9). It is a fixed row like the others and links without asking the network whether any games exist. |
| 19 | `search.php` searched films only | A typed term is also run against the games, and matches appear as one rail above the film results | Requested by the maintainer: "add search games to search page". The film results, their sort control and their pagination are untouched; with an empty box the page is still the film catalog and shows no games. |

### Behaviour deliberately preserved despite looking odd

- **An empty search returns everything.** It is a browse screen, not an error.
- **Rails show at most 10 items and report no total**, so a rail header carries a "see all" link but
  no count. Listing pages do report a total and do show it.
- **Similar titles are exactly 4, in random order** — they reshuffle on every visit.
- **The poll pre-selects the top answer on every question**, exactly as the legacy markup did.
- **Heartbeats credit a fixed chunk** and are sent only while media plays, so media paused in a
  background tab accrues nothing.

---

## 4. Not built — and why

- **A pre-roll on the ALBUM player.** The film player has one — see §7 below. The album player's
  legacy ad tag (`sound.php:32-33`, and 112 and 131 for flowplayer) was `/vast.xml` at the web
  root, which is absent from the legacy repository, so that break demonstrably never played.
  Adding one would be inventing a placement rather than restoring it. `GET /api/ads/preroll` is
  generic, so wiring it in later is a frontend change only.
- **Any member area.** No registration, login, profile, favourites, comments, ratings, packages or
  payments. `src/js/custom.js` describes roughly 45 such calls; none of those actions exist in the
  API (backend §7.1). There is no end-user login anywhere in the running legacy application.
- **Series, seasons, episodes** — scaffolding only in the legacy tree (backend §7.3).
- **Video qualities, downloads, subtitles** — both legacy players hardcoded a single MP4 and the
  subtitle module could not load (backend §7.4).
- **`other/contact-us.php`** (the form is inside an HTML comment), **`other/voc.php`** (an empty
  `<p>`), **`other/bug-report.php`** (never posts anything), **`other/500.php`** (fatal on load) —
  backend §7.5. `poll-absoulate.php` is a second copy of the poll with the same questions.

---

## 5. One backend change

`videoPath` is now returned by `GET /api/movies/:id` and `POST /api/watch-sessions`, and
`posterPath` by the latter. Without it the player has no source: the legacy page derived the URL as
`/assets/video/{id}.mp4`, and media paths stopped being derivable from an id when uploads moved to
unique filenames. Recorded in the backend record's §4.

---

## 6. Advertising

Added after the migration, at the maintainer's request. The backend record's §11 is the full
account, including which legacy defects were and were not reproduced; this is what the passenger
app does.

### The film pre-roll — `components/player/PrerollAd.jsx`

`Player.jsx` asks `GET /api/ads/preroll` for a creative, alongside opening the watch session, and
waits for both before rendering. If one comes back it plays first, in **its own `<video>` element**
overlaid on the film's. Two elements rather than a source swap, for three reasons: the heartbeat
handlers are bound to the film, so ad time can never be credited as watch time; `?seek=` is
untouched; and the film buffers underneath while the ad runs.

Preserved from `player.php`: no seek bar and no pause on the ad, a skip control after the
creative's skip offset (three seconds in every legacy VAST file), and the film following either
outcome. Each outcome reports once to `POST /api/ads-events` — the legacy `adSkipped` and
`adComplete` handlers — fire-and-forget, because a dropped report is not worth interrupting a
passenger's film over.

Three things the legacy break did not do:

- **A creative that fails to load does not block the film.** `onError` hands over immediately and
  reports nothing, since no impression occurred. A quarter of legacy playbacks began with an ad
  whose media file had never been uploaded.
- **The real playhead position is reported on completion.** The legacy client sent the ad's
  *description* field as the seconds watched.
- **Autoplay refusal is handled.** Every mobile browser refuses unmuted autoplay without a gesture,
  and muting an advertisement defeats it, so a refusal renders a tap-to-play target instead. Once
  the ad has been tapped, the film starts without a second tap — user activation is sticky for the
  document — and a browser that still refuses leaves the film paused behind its own controls,
  which is the no-ad behaviour.

### The landing-page slots — `components/ads/PlacementAdSlot.jsx`

`Home.jsx` renders the `top` and `bottom` slots from `GET /api/ads/placements`. The `top` slot is
the **first thing under the navbar**, before the page's own heading, and the `bottom` slot the
**last thing before the footer**, after every word the page has to say. That is why the page is a
fragment rather than a single padded container: each slot sits flush against the layout chrome
instead of floating inside the text column's vertical padding. Both stay in the content column's
`max-w-3xl`, which also matches the legacy artwork width of 750px.

Each slot carries its own spacing, never a wrapper — `PlacementAdSlot` returns null when it has
nothing to show, so an empty slot contributes no padding at all and the page closes up exactly as
it did before ads existed.

**The tiles never wait on that request**: they paint immediately and an ad appears if and when one
arrives, because this is the first screen a passenger sees on a slow cabin link. A failed fetch
resolves to empty slots.

Each slot's two artworks are the legacy slot's two anchors — portrait and landscape — swapped by
Tailwind's `portrait:` / `landscape:` variants, which are the same media query the legacy
stylesheet used. Sizing follows `.ads>a>img{width:100%}` exactly: full width, natural height,
nothing cropped.

---

## 7. Placeholder artwork

Every image the site draws resolves through `components/media/MediaImage.jsx`:

```
the record's own file  ->  the slot's placeholder  ->  the `general` placeholder
                       ->  src/assets/images/posterHolder216x332.jpg
```

The map of configured placeholders comes from `GET /api/placeholders`, read once per session by
`context/PlaceholderContext.jsx`; backend §13 covers the slots and the panel that fills them.

- **Nothing blocks on that request.** The map starts empty, so the first frames use the bundled
  poster and swap when it lands. A record with its own image never waits for it either way.
- **It is a component, not a helper, because the error case is real.** A document keeps the path it
  was given and nothing re-checks that the file is still on disk; a database restored without its
  uploads directory has records pointing at 404s. `MediaImage` steps down the chain on `onError`
  too, so a dangling path lands on the placeholder rather than the browser's broken-image glyph.
  This is what the admin grids have always done (`admin components/data/Thumb.jsx`).
- **Two callers refuse the bundled last resort.** The banner rail drops a slide it has no artwork
  for rather than showing a strip of identical holders, and the player leaves its `poster`
  unset — a 216×332 holder floating in a full-screen player reads as a fault, where black does not.
  Both use `usePlaceholderUrl`, which returns only what an operator configured.
- **A configured `banner` placeholder changes which slides render.** Without one, an imageless
  slide is skipped, exactly as before; with one, it is drawn. That is the intended effect of
  configuring it.

---

## 8. Branding

Three things on the passenger site belong to the customer rather than to the product, and all three
come from `GET /api/branding`, read once per session by `context/BrandingContext.jsx`:

```
footerLogoPath  ->  the image in the footer, or nothing
homeTitle       ->  the landing page <h1>
homeDescription ->  the sentence under it
```

Backend §18 covers the collection, the panel that fills it and the rules; what matters here:

- **Nothing blocks on the request.** The two sentences are rendered on the first frame from
  `DEFAULT_BRANDING` in that context file and replaced when the operator's own text lands — the same
  bargain the placeholder map strikes. Those defaults are duplicated from the backend's
  `BRANDING_TEXT_FIELDS` deliberately, and the comment in both files says to keep them in step: the
  alternative is a landing page with an empty heading for the length of one round trip.
- **The logo has no default and no fallback.** The product lockup was taken *out* of the footer, not
  hidden behind this slot, so an installation with nothing uploaded shows the copyright line alone.
  The element is not rendered at all in that case — an empty `<span>` would leave the line stretched
  across the footer for no reason.
- **The logo is scaled by HEIGHT** (`h-8 w-auto max-w-[12rem] object-contain`). A customer's lockup
  has whatever proportions it has; constraining both axes would letterbox or squash somebody's mark.
- **The description renders `whitespace-pre-line`**, because the panel edits it in a textarea. An
  operator who pressed Enter gets the break they typed rather than one run-on paragraph.
- **The hero has no eyebrow line any more.** «In-flight entertainment» sat above the heading and was
  removed at the maintainer's request; the operator's own heading is the first thing in the hero, so
  the `<h1>` carries no top margin. The destination rows below are still fixed — they name the
  product's sections, not the customer's. (There were four when this was written; §9 added a fifth.)
- **The header mark is untouched.** `assets/images/muvilite-mark.png` is still the product's, and
  the full lockup file stays in `assets/` — unused now, rather than deleted, since it is the
  product's own artwork.

### Site name (added 2026-11-15)

The payload's `siteName` replaces the product name in the header wordmark, the side menu and the
browser tab (`useDocumentTitle` reads it from the context). A Latin name keeps the original look —
monospace capitals, letterspaced; a Persian one is set in the body face without letterspacing, which
would pull joined letters apart. The name is remembered on the device for the first paint, like the
theme. Not changed: the header mark image, and the static `<title>` in `index.html` that a crawler
which does not run JavaScript sees.

### Colour themes (added 2026-11-15)

The payload also carries `theme` — `dark-blue` (the original palette, the default), `dark-red`,
`dark-pink` or `navy-orange` — chosen in the panel. `BrandingContext` applies it as `<html data-theme>`, and
`src/index.css` has one block per theme that re-points the existing design tokens, so every
Tailwind class follows untouched. The token names keep their old words: `azure` is "the accent",
whatever its hue. In `dark-red` the error colour (`signal`) turns amber, and in `navy-orange` a
brighter red, so an error never reads as one more accent.

What CSS cannot reach lives in `src/utils/themes.js`: the video player's colour tokens (one frozen
props object per theme, so playback is never restarted by a re-render) and the browser's
`theme-color`. The last theme is remembered on the device and applied in `main.jsx` before React
mounts, so a returning visitor does not see a flash of the default. The header mark is a raster image
in the original azure and does not change colour.

---

## 9. Games

A section with no legacy page behind it. The legacy site had no games; this one is modelled on the
maintainer's Playva front end (`playva-front/components/GamesList.js`, `GameCard.js`,
`app/game/[id]/GamePlayer.js`), without its leaderboard. Backend §19 covers the API, the upload and
what a game's code is allowed to do; what matters here:

```
/              a fifth board row, «بازی» / GAM            pages/Home.jsx
/games         search box, filter row, grid, pagination   pages/Games.jsx
/game/:id      a bar over an iframe, in PlayerLayout      pages/GamePlay.jsx
/search        a rail of matching games above the films   pages/Search.jsx
side menu      «بازی‌ها»                                   layouts/MainLayout.jsx
```

- **A game has no image.** Its card is an emoji on a gradient between two colours — three fields on
  the record, Playva's design. So `components/catalog/GameCard.jsx` is the one card that does not
  draw through `MediaImage` and has no placeholder slot: there is no file that could be missing. The
  gradient is the game's artwork and is drawn as given, the way an advertiser's creative is.
- **The card is the control.** Playva's tile carries a solid «بازی کن» button; here a screen gets one
  solid fill (`src/index.css`), so the tile itself opens the game, as a poster opens the player.
  «پرطرفدار» appears on a card at 50 opens — Playva's threshold, a display rule only.
- **`/games` behaves like the two search pages.** The URL is the state (`text`, `genre`, `popular`,
  `page`), an empty box is the whole catalog, and typing settles into the URL with `replace`.
- **«پرطرفدار» and a genre are alternatives**, one selection in one row, as in Playva — choosing one
  clears the other. There is no sort control: the catalog is newest-first and «پرطرفدار» is the only
  other ordering (opened at least once, most opened first), which a dropdown could only contradict.
- **The filter row is not waited for.** The grid renders with «همه» and «پرطرفدار»; genres join when
  `GET /api/games/genres` answers, and if it fails the row just stays short.
- **The play screen is chromeless**, in `PlayerLayout` like the film player: a 48-pixel bar (back,
  the game's tile and name, fullscreen, open-in-new-tab) and the frame gets everything under it.
- **The frame is not sandboxed, on purpose.** Games keep progress in `localStorage`, which a
  sandboxed frame is denied, and this origin holds nothing a game could take — there is no sign-in
  here. The admin panel is the opposite case and is handled there (backend §19).
- **Fullscreen is the browser's own, on the bar and the frame together**, so the way out stays on
  screen. The button is drawn only where `document.fullscreenEnabled` is true; an iPhone does not
  offer it for anything but video, and a control that does nothing is worse than none.
- **One opening is one count.** `POST /api/games/:id/click` is sent when the game's record arrives,
  not when the route is entered, behind a ref that survives React's development double-effect. A
  reload is a new opening and counts again.
- **On `/search` the games are a rail, not a second grid**, so films — still what that page is for —
  are never pushed more than one row down. The rail shows the real total and a «نمایش همه» into
  `/games?text=…` when there are more than it holds. Its request is independent of the film one: it
  cannot delay the film results, and if it fails the rail is simply absent.

Not done, and not asked for: games as a **page block** (the panel's page composer still offers
banner, film-category and music-category rails only), a games rail on the hub itself, and any
per-game detail page — a card opens the game.

---

## 10. Verifying

```bash
cd refactored/backend  && npm run seed && npm run dev   # :4000
cd refactored/frontend && npm install    && npm run dev # :5173
```

1. `/` renders the five board rows; each navigates.
2. `/page/film` renders rails; no rail exceeds 10 items; "see all" reaches `/category/:id`.
3. `/category/:id` paginates and re-sorts, and the sort choice survives a refresh (it is in the URL).
4. `?item_sort=modified_date` works on `/category/:id` and is **rejected** on
   `/music-category/:id` — the whitelists genuinely differ, and the rejection must read as a clear
   message rather than a blank page.
5. `/movie/:id` shows genres, casts, country and runtime, and at most 4 similar titles. A movie with
   no primary genre shows the not-found state, not an error (the API 404s it deliberately).
6. `/player/:id` — one `POST /api/watch-sessions`, then one `PATCH` every 30s **while playing and
   none while paused**; `watchedSecond` climbs by exactly 30 per beat.
7. `/music/:id` — no request on load, then `POST /api/listen-sessions` on first play and a `PATCH`
   every 15s. Next/prev wrap at both ends.
8. `/poll` — submit and read the confirmation; submit again within three hours and confirm the
   wording changes to the revision message **and the row count in `pollhistories` does not grow**.
9. `/search` with a title that has no poster draws the `moviePoster` placeholder uploaded in the
   panel — and the `general` one when that slot is empty. Clearing both returns it to the bundled
   holder image.
10. `/` with nothing configured under «هویت بصری» shows the two shipped sentences and a footer with
    **no logo at all**. Upload a customer logo and save a heading in the panel, reload, and all three
    change; the header mark does not. A description saved with a line break renders on two lines.
11. Upload two or three games in the panel (admin §16). `/games` lists them newest-first with a
    count; a genre chip narrows the list and puts `genre=` in the URL; «پرطرفدار» shows only games
    that have been opened; typing filters by title; a term that matches nothing shows the empty
    state with a way back.
12. Open a game: the frame fills everything under the bar, the game runs, and whatever it saves is
    still there after a reload. Its count in the panel rises by one per opening — **one**, not two,
    in a development build.
13. `/search?text=…` with a term that matches a game shows a «بازی‌ها» rail above the films;
    `/search` with an empty box shows none.
14. `npm run build` completes clean.

Steps 11–13 were run in Chrome at 1440×950 and 390×844 against a hand-made bundle — see backend §19
for what that fixture does and does not prove.

---

## 11. HLS films — the Muvi player

New, at the maintainer's request (backend §21 has the transcoder). An uploaded film or clip is now an
adaptive HLS set, and `/player/:id` plays it with **Muvi** — the maintainer's own player SDK from
`D:\projects\player-ai` (hls.js under a Tailwind UI) — in `components/player/MuviFilm.jsx`.

```
videoPath ends in .m3u8   → MuviFilm, as HLS: adaptive quality, settings, PiP, fullscreen
anything else             → MuviFilm, as one progressive file (an external MP4 link, a pre-HLS upload)
no videoPath, status queued/processing → «این فیلم در حال آماده‌سازی است»
```

- **One player.** Muvi plays both HLS and single files since player-ai `060a9a0`, so the app's own
  `<video>` + `PlayerControls.jsx` + `SeekButtons.jsx` path was removed (it briefly existed for
  non-HLS sources while Muvi was HLS-only). Muvi picks the engine by URL extension and takes an
  extension-less URL to be HLS; here such a URL can only be a pasted external link, and the old player
  treated every non-HLS link as a plain file, so `MuviFilm` marks it `type: 'mp4'` — the browser
  sniffs the real container. A file that will not load ends on «پخش این فیلم ممکن نشد», as before.
- **What carries over into Muvi**, so a passenger sees the same controls: the legacy −15/+30 pair
  (Muvi's own symmetric ±10 is removed from its control list and the pair is moved beside the play
  control), the arrow keys moving 5 s, `?seek=` (the playlist item's `starttime`), the watch
  heartbeat (on with play/resume, off with pause/end/error — the same `useWatchSession`), and a back
  link to `/movie/:id`, top-left, fading with Muvi's controls via its `muvi-flag-user-inactive`
  class. Muvi draws the title (top-right), scrubber, volume, Settings → quality, PiP and fullscreen.
- **The pre-roll is unchanged.** `PrerollAd` still covers the film (`z-20`) and the hand-over calls
  Muvi's `play()`.
- **Theme**: the logo palette (azure `#12b1f0` accent, night panels), Vazir, `locale: 'fa'`, RTL.
- **Offline.** Muvi, its CSS and hls.js are bundled; they load as their own chunks on the player page
  only (~66 kB + ~163 kB gzipped). The one thing Muvi can fetch from outside — Google's Cast sender —
  loads only when `remote.castAppId` is set, which it is not. Cast, AirPlay and the TV remote are
  left out of the control set.
- **Installed from tarballs in `vendor/muvi/`** (`file:` dependencies), committed, because the
  packages are on no registry and the appliance and Docker builds have no `player-ai` checkout next
  to them. The Dockerfile copies `vendor/` before `npm ci`. To update the player: in `player-ai`,
  `pnpm build` and pack both packages, copy the two `.tgz` over these, then
  `npm install file:vendor/muvi/avinance-muvi-player-0.1.0.tgz file:vendor/muvi/avinance-muvi-player-react-0.1.0.tgz`.
  **A bare `npm install` does nothing**: the version is still 0.1.0, so npm keeps the old copy and
  the old lockfile integrity — check that `node_modules/@avinance/muvi-player/dist` has today's date.

Verified in Chrome 156 (branded, for H.264/AAC) against the real API: the seek pair sits beside play
and moves +30/−15; quality levels Auto/360p/480p/720p for a 720p film; 31 segments fetched over a
minute; `?seek=100` starts at 101.7 s; the back link reaches opacity 0 with the controls; a heartbeat
`PATCH` fires at 30 s; a portrait clip plays upright, pillarboxed; no request left `localhost`; no
page errors. After the switch to one player: a 60 s MP4 link plays inside Muvi with the same bar
(one quality level, +30/−15 exact, heartbeat `PATCH` at 30 s, `?seek=20` honoured, the pre-roll
handing over), an extension-less link plays, an HLS clip still plays, and a missing file ends on the
error screen. Muvi labels a portrait clip's rungs by height (640p…1920p) — its labelling, not ours. Not verified: Safari / iOS (Muvi uses native HLS
there), Firefox, a phone on the cabin Wi-Fi.
