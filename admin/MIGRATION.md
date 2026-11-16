# MuviLite — Admin Panel Migration Record

Legacy PHP admin (`legacy-php/admin/3P1z05m4n4Gm3nt/`) → React / Vite / Tailwind
(`refactored/admin/`).

`legacy-php/` is the read-only source of truth. Nothing in it was modified.

Read `backend/MIGRATION.md` first — it holds the API contract, the schema mapping, and the list of
legacy defects that were fixed rather than reproduced. This document does not repeat any of it.

---

## 1. What the legacy panel was

AdminLTE 2 on Bootstrap 3, jQuery, and server-side DataTables, at
`admin/3P1z05m4n4Gm3nt/` — an obscured path serving as the only thing between the internet and the
catalog. 28 view folders, each a directory of PHP files: `index.php` (a DataTables grid),
`form.php` (create and edit), `create.php` / `update.php` / `delete.php` / `status.php`
(the actions the grid posted to).

Its client libraries were jQuery 3, DataTables, Select2, bootstrap-toggle, and
babakhani's persian-datepicker. All are gone; nothing replaced them with an equivalent dependency.

---

## 2. Decisions

1. **The `material-tailwind-dashboard-react` template supplied the layout, not the code.** The
   structure it suggests — a fixed side navigation, a top bar with breadcrumb and account menu,
   card-surfaced content, a stat-tile dashboard — is what this panel does. The library itself was
   not installed: `@material-tailwind/react` v2 pins Tailwind **v3** while the rest of this
   workspace is on **v4**, it ships a light blue-gray theme, and its components assume LTR. Adopting
   it would have meant two Tailwind majors in one repository and an RTL retrofit per component.
2. **The passenger site's design tokens are reused verbatim.** Same palette — the MuviLite mark's
   azure (`#12b1f0`, sampled from the logo) over a navy-black ground — same self-hosted Vazir, same
   boarding-pass perforation, so the two applications read as one product. **One weight differs** and
   is documented in `src/index.css`: on the passenger site a solid azure fill is spent on the play
   control, which does not exist here, so here it is the **primary action** (save, add, apply). Red
   (`signal`) means the same thing in both: errors, plus the destructive acts a panel has and a
   passenger screen does not.
3. **Three read-only endpoints were added to the backend** rather than worked around in the client,
   following the precedent set when `videoPath` was added during the frontend pass. They are
   recorded in `backend/MIGRATION.md` §4.
4. **A dashboard was added.** The legacy panel had none — its «کاربران پنل» link went to the user
   list. Every figure on it comes from data the API already returns; nothing is invented.

---

## 3. Completion checklist

**Tested** means exercised in a real browser against a running backend and database — 27 routes
rendered, plus the interaction suites in §7. `—` means the screen is built and renders but the
specific flow was not exercised, because no fixture data exists for it in the dev database.

| Feature | PHP analysed | API designed | Built | Tested | Matches original |
|---|---|---|---|---|---|
| Sign-in | ✔ | ✔ | ✔ | ✔ | ✔ ‡ |
| Session restore, sign-out | ✔ | ✔ | ✔ | ✔ | ✔ ‡ |
| Own password change | ✔ | ✔ | ✔ | — | ✔ ‡ |
| Sidebar, breadcrumb, chrome | ✔ | ✔ | ✔ | ✔ | ✔ ‡ |
| Permission gating (route, menu, control) | ✔ | ✔ | ✔ | ✔ | ✔ ‡ |
| Movies list + filters + export | ✔ | ✔ | ✔ | ✔ | ✔ † |
| Movie form (~20 fields, Jalali year) | ✔ | ✔ | ✔ | ✔ | ✔ |
| Movie poster upload | ✔ | ✔ | ✔ | — | ✔ |
| Movie ↔ casts (with roles) | ✔ | ✔ | ✔ | — | ✔ |
| Movie ↔ categories | ✔ | ✔ | ✔ | ✔ | ✔ |
| Casts list + form + photo | ✔ | ✔ | ✔ | — | ✔ |
| Musics list + form + cover | ✔ | ✔ | ✔ | — | ✔ ‡ |
| Music track upload + ordering | ✔ | ✔ | ✔ | — | ✔ |
| Music ↔ categories | ✔ | ✔ | ✔ | — | ✔ |
| Categories / music categories CRUD | ✔ | ✔ | ✔ | ✔ | ✔ |
| Category contents editor | ✔ | ✔ | ✔ | ✔ | ✔ ¹ |
| Genres, age ranges | ✔ | ✔ | ✔ | ✔ | ✔ |
| Countries | ✔ | ✔ | ✔ | ✔ | ✔ ² |
| Banners list + form + image | ✔ | ✔ | ✔ | ✔ | ✔ |
| Banner categories + membership + order | ✔ | ✔ | ✔ | — | ✔ |
| Pages list + form | ✔ | ✔ | ✔ | ✔ | ✔ |
| Page composer (blocks + ordering) | ✔ | ✔ | ✔ | ✔ | ✔ ¹ |
| Poll questions CRUD | ✔ | ✔ | ✔ | ✔ | ✔ ‡ |
| Users list + form + export | ✔ | ✔ | ✔ | ✔ | ✔ |
| User password reset | ✔ | ✔ | ✔ | — | ✔ |
| User categories | ✔ | ✔ | ✔ | ✔ | ✔ |
| Permission groups + matrix | ✔ | ✔ | ✔ | ✔ | ✔ ‡ |
| Access permissions CRUD | ✔ | ✔ | ✔ | ✔ | ✔ ² |
| Watch / ads / poll history | ✔ | ✔ | ✔ | ✔ | ✔ |
| Listen history, watch trends, poll summary | — | ✔ | ✔ | ✔ | ² |
| Activity log + field diffs | ✔ | ✔ | ✔ | ✔ | ✔ ‡ |
| Dashboard | — | ✔ | ✔ | ✔ | ² |
| **Advertisement CRUD** | ✔ | ✔ | ✔ | ✔ | ³ |
| **Poll question CSV import** | ✔ | ✔ | ✔ | ✔ | ³ |
| **Placeholder images** | ✔ | ✔ | ✔ | ✔ | ³ |
| **Branding (logo + landing copy)** | ✔ | ✔ | ✔ | ✔ | ³ |
| **Games + game genres** | ✔ | ✔ | ✔ | ✔ | ³ |

† the legacy grid had filters this one does not — see §5.
‡ a legacy defect was fixed rather than reproduced; see `backend/MIGRATION.md` §6.
¹ uses an endpoint added during this pass.
² new surface: the backend serves it, the legacy panel had no screen.
³ new FUNCTIONALITY, not just a new screen — there was nothing in the legacy application to
  migrate. See §8 (advertisements), §9 (poll import), §10 (placeholder images), §15 (branding) and
  §16 (games — for which "PHP analysed" means the legacy tree was searched and has none).

---

## 4. Legacy view → route

The legacy panel addressed screens as `../movies/` and `../movies/form.php?id=`.

| Legacy view | Route |
|---|---|
| `views/users/login.php` | `/login` |
| `views/users/logout.php` | the account menu |
| — | `/` (dashboard, new) |
| — | `/profile` (own password, new) |
| `views/movies/index.php` | `/movies` |
| `views/movies/form.php` | `/movies/new`, `/movies/:id` |
| `views/movies/poster.php` | the movie form's poster panel |
| `views/movies/casts.php` | the movie form's «عوامل» panel |
| `views/movies/categories.php` | the movie form's «دسته بندی ها» panel |
| `views/movies/export.php` | the movies list's «خروجی اکسل» |
| `views/casts/*` | `/casts`, `/casts/new`, `/casts/:id` |
| `views/musics/*` | `/musics`, `/musics/new`, `/musics/:id` |
| `views/musics/upload.php` | the music form's track editor |
| `views/categories/*` | `/categories`, `/categories/:id` |
| `views/categories/content.php` | `/categories/:id/movies` |
| `views/music-categories/*` | `/music-categories`, `/music-categories/:id` |
| `views/music-categories/content.php` | `/music-categories/:id/musics` |
| `views/genres/*` | `/genres` |
| `views/age-ranges/*` | `/age-ranges` |
| — | `/countries` (new) |
| `views/banners/*` | `/banners` |
| `views/banners/order.php` | `/banner-categories/:id/banners` |
| `views/banner-categories/*` | `/banner-categories` |
| `views/pages/index.php`, `_form.php` | `/pages`, `/pages/new`, `/pages/:id` |
| `views/pages/content.php`, `graph.php` | `/pages/:id/blocks` |
| `views/blocks/*` | the composer's block dialog |
| `views/polls/*` | `/polls` |
| `views/users/panel.php` | `/users` |
| `views/users/form.php` | `/users/new`, `/users/:id` |
| `views/user-categories/*` | `/user-categories` |
| `views/groups/*` | `/permission-groups` |
| — | `/access-permissions` (new) |
| `views/user-logs/*` | `/user-logs` |
| `views/watch-history/index.php` | `/watch-history` |
| `views/ads-history/index.php` | `/ads-history` |
| `views/poll-history/index.php` | `/poll-history` |
| — | `/listen-history`, `/watch-trends`, `/poll-summary` (new) |
| — | `/video-ads`, `/placement-ads` (**new functionality** — see §8) |
| — | `/polls/import` (**new functionality** — see §9) |
| — | `/placeholders` (**new functionality** — see §10) |
| — | `/branding` (**new functionality** — see §15) |
| — | `/games`, `/games/new`, `/games/:id`, `/game-genres` (**new functionality** — see §16) |
| `views/users/access_denied.php` | the `AccessDenied` component |

---

## 5. Decisions that change what an operator sees

Everything else is a faithful port. These are not.

1. **Two legacy movie filters are gone.** The **id range** (`from_id_filter`/`to_id_filter`) meant
   "recently added" when ids were auto-increment integers; they are ObjectIds now and a range over
   them is meaningless — sorting by creation date, which the grid does by default, answers the same
   question. The **"additional" filters** (no poster, no Persian description, no English
   description, for children) have no API query parameter, and filtering one page client-side would
   silently ignore every other page. The poster column shows at a glance which titles lack art.
2. **The movie list's category multi-select is gone** for the same reason — the list endpoint takes
   no category parameter. Browsing a category's contents is what `/categories/:id/movies` is for.
3. **Persian datepicker → native date inputs.** Dates are shown in Jalali everywhere they are
   *displayed* (via `Intl`, no library), but *entered* through the browser's own date control,
   which is keyboard-accessible and needs no dependency. The movie's publish YEAR is not a date
   and keeps its own Jalali-aware number field.
4. **Select2 → plain selects, plus a search-and-pick where the list can outgrow a dropdown.** The
   API caps a page at 100 rows, so category-content editors search the catalog rather than offering
   a `<select>` that would silently omit most of it.
5. **jQuery UI sortable → up/down buttons.** Dragging needs a pointer, and a keyboard-accessible
   drag implementation is a great deal of code for lists that are typically under ten rows.
6. **The nav gates on permissions, not on a hardcoded group id.** Genres, age ranges and the two
   category sections were shown only to `$user_group_id_session == 1` — no other group, however
   privileged, could see them. They now gate on `genres`, `age-ranges` and `categories`. This is the
   same class of defect as `backend/MIGRATION.md` §6 #18.
7. **The poll editor has a menu link.** `views/polls/*` existed and nothing pointed at it.
8. **The activity log has no delete action.** The legacy one did, but
   `UserLogController::actionDelete()` targeted the wrong model and a column that does not exist, so
   it never worked (§6 #8). An audit log the audited party can erase is not an audit log.
9. **Deleting is confirmed in a dialog, not `confirm()`**, and states that the row is soft-deleted
   and recoverable — which it is, and which the legacy wording did not say.
10. **Status toggles are optimistic.** The switch moves at once and reverts if the write fails,
    rather than waiting on the round trip as the legacy `status.php` call did.

---

## 6. Not ported

- **`views/users/cities.php`** — a province/city cascade. `User.provinceId` and `User.cityId` exist
  on the schema, but no endpoint accepts them (they are absent from both the create and update
  validators and from the service's assignable-field list) and no lookup serves the options. The
  feature is dead end to end; building a UI for it would mean inventing the endpoint too.
- **`views/movies/search_casts.php`** — a cast autocomplete with no endpoint behind it. The movie
  form uses the filtered cast list instead, and says how many people it is choosing among.
- **`controllers/ClearCache.php`** — there is no cache to clear.
- **`views/pages/graph.php`** and its `go.js` diagram — the composer's ordered list shows the same
  composition, and go.js is a commercial dependency that cannot load on an aircraft anyway.
- **The captcha** — see `backend/MIGRATION.md` §6 #1; it was checked *after* the session was
  written, so it never protected anything. Rate limiting on the login route does.
- **The obscured admin path** (`/3P1z05m4n4Gm3nt/`) — the panel is a separate application on its own
  origin, and the API enforces authentication and permissions on every route regardless of path.

---

## 7. Running and verifying

```bash
cd refactored/backend && npm run dev      # :4000
cd refactored/admin   && npm install && npm run dev
```

**The dev server must be on port 5174.** The backend's CORS allow-list is `[FRONTEND_URL,
ADMIN_URL]`, and `ADMIN_URL` defaults to `http://localhost:5174`; any other port is rejected by the
browser. `vite.config.js` sets `strictPort` so this fails loudly rather than silently drifting to
5175.

Seeded administrator: `09120000000` / `changeme123`. **Change it after first sign-in.**

### Verification performed

`npm run lint` — 0 errors (3 warnings, all `react-refresh/only-export-components` for hooks
exported beside their provider, which is intentional). `npm run build` — clean. `npm audit` — 0
vulnerabilities.

Driven in a real Chrome via Playwright against the running backend:

- **All 27 routes render** with the expected heading, no console error, no page error, no failed
  request, and no unintended 404.
- **Sign-in → dashboard**, session survives a reload through `GET /auth/me`, sign-out clears the
  token, and a protected route redirects to login when signed out.
- **Jalali round-trip**: a movie stored as `2020` with `defaultOrigin: 0` loads into the form as
  `1399`. The 621-year offset this relies on was verified exact against the backend's own
  `jalaali-js` helpers across Jalali 1300–1450 and Gregorian 1920–2070.
- **Platform checkboxes** reflect the stored array (this caught a real type mismatch — see below).
- **Validation**: a missing required field is blocked client-side; a server 422 lands on the field
  that caused it rather than in a toast.
- **Create → appears in the filtered list → delete asks for confirmation → row is gone.**
- **Permission gating**, the most important check. A group granting `movies: view` only:
  the sidebar shows one item, the movies list renders, the "add" button and every row edit/delete
  control are absent, a hand-typed `/movies/new` is refused, and an unpermitted section is refused.
  Granting `edit` to that group then took effect **on the same open session with no re-login** — the
  server re-resolves permissions per request, which the legacy panel could not do.
- **Page composer**: renders, the target picker follows the chosen block type, a block is added,
  reordering marks an unsaved state and persists across a reload, and **the passenger site at
  `:5173` reflects the new composition**. The added block was then deleted cleanly.

### Bugs found and fixed during verification

1. **The sidenav overlapped every data grid.** The `<aside>` was anchored physically (`right-0`)
   while the content was inset logically (`pe-sidenav`) — and in RTL, `padding-inline-end` is the
   *left*. So the content was padded on the wrong edge and every wide table slid underneath the
   navigation. Both sides are logical now (`start-0` / `ps-sidenav`), with a comment saying why they
   must agree. Invisible in the markup; obvious the moment a real table rendered.
2. **Platform checkboxes never appeared checked.** `Movie.platform` stores numbers, checkbox `value`
   attributes are strings, and react-hook-form matches a group by identity — so every box rendered
   unchecked on a record that had platforms set, and saving the form would have silently cleared
   them.
3. **The dashboard's trend bars collapsed to a hairline.** A percentage height resolved against an
   auto-height parent. The bar now sits in a flex child of the fixed-height column.
4. **The cast picker excluded people already credited** — but `(movie, cast, role)` is the unique
   key, so a director who is also the writer could never be given the second credit.
5. **A missing media file rendered the browser's broken-image glyph** in every grid. A document
   keeps the path it was given and nothing re-checks the file exists — which is not hypothetical:
   the dev database references a poster whose file is gone. `components/data/Thumb.jsx` falls back
   on `onError`, and replaced seven copies of the same ad-hoc placeholder markup.

### Not yet exercised

No fixture data exists in the dev database for these, so the code paths render but the flows were
not driven: **file uploads** (poster, photo, cover, tracks), **banner category membership and
ordering**, **the music track editor's save**, **the xlsx exports' contents**, and **the user
password reset**. These are the first things to cover when real content is loaded.

The dev database is also dirty with smoke-test residue — a genre literally named `???` and a movie
titled `??????? ????`, from earlier shell sessions that mangled Persian. Those are data, not
rendering faults. Drop and re-seed before judging anything.

---

## 8. Advertisement management (new functionality)

Everything else in this record migrates a legacy screen. **These two do not: the legacy panel could
not create an advertisement of any kind.** Its only ad-related screen was `views/ads-history` — a
read-only report of what had already played, which survives unchanged at `/ads-history`. Pre-roll
creatives were hand-written VAST files uploaded over FTP, and the two landing-page ad slots were
literal markup in `index.php`. `backend/MIGRATION.md` §11 is the full account.

Both screens are guarded by a new permission page, **`ads`**. An existing installation must re-run
the backend's `npm run seed` before any group can see them; the seed upserts the permission row and
re-grants the full set to `Administrators` without touching passwords.

### `/video-ads` — pre-roll creatives

The form is the VAST document, field by field: the title becomes `<AdTitle>` (and the title stored
on every telemetry row), the skip offset becomes `Linear@skipoffset` — 3 seconds, as every legacy
file had — and the link becomes `<ClickThrough>`, which none of them had.

Two things worth knowing before editing this screen:

- **The duration is not a form field.** It is measured from the file by the browser during upload
  (`components/form/VideoUpload.jsx`) and written with `videoPath` in one request, so a creative
  cannot advertise the previous file's length after a replacement. The server bounds it; probing
  the container server-side would need ffmpeg for a value that is only ever advertised metadata.
- **`weight` is meaningless in isolation.** It is a ratio against the other active creatives.
  Equal weights reproduce the legacy uniform draw exactly, which is why it defaults to 1 and why
  the form says so.

The list surfaces the two facts an operator cannot get anywhere else: whether a creative has a file
at all (without one it is silently skipped by selection) and its weight.

### `/placement-ads` — the two landing-page slots

**Two image uploads per record, not one.** Each legacy slot held two anchors and the stylesheet
chose between them by viewport orientation, so the first artwork was the portrait one and the
second the landscape one; that installation shipped the same GIF twice. The landscape upload is
therefore optional — leaving it empty reproduces exactly that, because the API falls back to the
portrait path.

The grid opens sorted by `order` **ascending**, unlike every other list here. These are two or
three hand-curated items shown in a fixed sequence, not a catalogue where newest-first is right.

### Exercised end to end

Unlike the uploads listed under "Not yet exercised" above, these flows were driven against a
running server: creating both kinds, uploading a real MP4 and a GIF, the landscape fallback,
selection with and without a file attached, the generated VAST document, weighted distribution over
400 draws (91.8 % to a 9:1 creative), telemetry linking back to the creative in `/ads-history`, and
rejection of a wrong-MIME upload. Test records and their files were removed afterwards.

---

## 9. Poll question CSV import (new functionality)

`/polls/import`, reached from a second button on the poll-questions toolbar. **The legacy panel had
no import anywhere, and its `views/polls/` pair never worked at all** — the form posts to
`BannerController`, reads `$banner`, uploads into `assets/banners/` and checks the `banners`
permission; the model points at `page_block_tbl`. The nine questions were hardcoded HTML in
`poll.php`. `backend/MIGRATION.md` §12 is the full account of the endpoint and its rules.

Guarded by `pages` / `edit`, the same permission the single-question form uses. No new permission
page, and nothing to re-seed.

Three things about this screen are deliberate:

- **It previews before it writes, and both phases are the same server call.** The file is uploaded
  with `dryRun`, which runs every check — including duplicates against the questions already stored
  — and writes nothing. Parsing the CSV in the browser was rejected: the duplicate check needs the
  database, and a preview computed by different code from the import it promises is a preview that
  can lie.
- **The commit button stays disabled while the file would be refused.** A file with a bad row is
  a 400 that writes nothing unless «سطرهای نامعتبر نادیده گرفته شوند» is ticked; ticking it re-runs
  the preview, so the report on screen always describes the settings in force.
- **The template is generated in the browser**, with a UTF-8 BOM so Excel opens it as Persian
  rather than mojibake. Nothing is fetched — the panel must work with no network beyond its own API.

The generic list page grew one descriptor field for this, `toolbarLinks`, rather than the polls
list becoming a hand-written screen. Any descriptor can now put extra `edit`-gated buttons beside
"add new"; polls is the only user today.

### Exercised in a browser

Driven in Chrome against a running backend with a deliberately messy fixture (semicolon-delimited,
BOM, Persian digits, a quoted field containing `;`, a duplicate of a stored question, an in-file
duplicate, a non-numeric order, an empty question, an unreadable status): the preview reported
3 importable / 2 duplicate / 3 invalid with the right line numbers and refused to enable the commit;
ticking "skip invalid" re-ran it and relabelled the button «افزودن ۳ سوال»; the commit created
exactly three questions, toasted, and the list showed 12 of 12 without a reload. No console errors,
and no horizontal overflow at 420 px. The test records were deleted afterwards.

---

## 10. Placeholder images (new functionality)

`/placeholders`, in the platform group of the sidebar. The fallback artwork the passenger site draws
for a record with no image of its own — **six files that shipped with the legacy theme**
(`src/images/posterHolder*.jpg`, `assets/avatarHolder.jpg`) and could only be changed over FTP. No
table, controller, screen or permission ever backed them. `backend/MIGRATION.md` §13 is the full
account of the slots, the endpoints and the resolution chain.

Guarded by a NEW permission page, `placeholders`. **An existing installation must re-run
`npm run seed`** before any group can see the menu item — the same requirement `ads` introduced.

Four things about this screen are deliberate:

- **One screen, no list/form pair.** Every other section is a paginated list over records an
  operator creates; this is a fixed set of five slots defined by the backend, so a row count,
  filters and an "add new" button would all be furniture over five items. Each slot is a card
  carrying its preview and its two actions.
- **The slots come from the API, not from the panel.** Labels, order, usage text and recommended
  sizes are all served by `GET /api/admin/placeholders`. Restating them here is how the two drift.
- **The preview frame uses each slot's own ratio**, so an operator sees the shape the passenger site
  will draw into before uploading. Portrait slots are narrowed to a fixed width — a 216×332 frame at
  full card width is over 500 px tall and would set the height of every card in its grid row.
- **Delete uses a plain `Modal`, not `ConfirmDialog`.** That component promises the record "stays in
  the database and can be restored", which is true of every soft-deleted entity here and false of
  this one: the row and the file both go.

The admin's own grids and previews still show "تصویری ندارد" for a record with no image rather than
the placeholder. That is the point of the distinction: an operator has to be able to tell "nothing
uploaded" from "showing the stand-in", and the passenger site is where the stand-in belongs.

`ImageUpload` grew two small options for this: an optional `label` (the card's own heading already
names the image) and `disabledHint`, because its built-in "save the record first" text is the wrong
reason here — there is no record to save, only a permission to lack.

### Exercised in a browser

Driven in Edge against a running backend: the section appears in the sidebar, all five cards render
with their badges, and uploading through a card's file input stored the image, toasted, and flipped
the badge to «تنظیم شده» without a reload. On the passenger site the same image then appeared on
three titles that have no poster and on one whose poster file is missing from disk; clearing the slot
returned them to the bundled holder. No console errors. The test images were deleted afterwards, so
all five slots are empty.

---

## 11. Maintainer-requested corrections, round one

### 11.1 `/placement-ads` — the two artworks are named after devices, and sized

«نمای عمودی» and «نمای افقی» are now **«موبایل»** and **«دسکتاپ»**, on the form's upload cards and in
the list's "missing variant" note. The names changed; the mechanism did not — the passenger page
still chooses between them with the legacy `@media (orientation:landscape)` query, which is what the
two anchors in `index.php` did.

Each variant now has **one accepted size**, shown on the slot card and enforced twice:

| Slot | موبایل | دسکتاپ |
|---|---|---|
| بالای صفحه | ۷۵۰×۱۵۰ | ۱۵۰۰×۱۵۰ |
| پایین صفحه | ۷۵۰×۳۰۰ | ۱۵۰۰×۳۰۰ |

`AD_PLACEMENTS` in `src/utils/constants.js` carries both variants' dimensions and aspect ratios, and
**must stay in step with the backend's `AD_PLACEMENT_SIZES`** — the server is the one that refuses a
mismatch. `ImageUpload` grew a `requiredSize` prop: it measures the chosen file with a new
`validateImageSize()` (`src/services/media.js`) before sending anything, so the operator is told, in
Persian and with the file's real dimensions, that a 800×200 image is not what the slot takes — rather
than waiting for an English 400 after a multi-megabyte upload. Persian **digits**, not the number
formatter: «۱۵۰۰» is a size, «۱٬۵۰۰» is not.

A file the browser cannot decode is **not** blocked client-side; that judgement is left to the
server, which has the better decoder.

The size dropped out of the placement `<select>` labels — with two sizes per slot they no longer fit
— and both now sit on the "محل نمایش" card, where artwork can be prepared before either upload panel
is opened.

### 11.2 `/users` — the birth date field is gone

Removed from the form, from `FIELD_NAMES`, and from the submitted payload, along with the
`toDateInput` helper that existed only for it. The identity grid still lines up: the field and its
layout spacer were removed together.

The API no longer accepts it either, and the stored values are kept — see backend MIGRATION §14.2.
The **cast** form's «تاریخ تولد» is untouched.

### 11.3 `/permission-groups/:id` — a real section × action matrix

**The reported bug:** the «مشاهده» / «ویرایش» / «حذف» chips beside each permission row could not be
clicked, and clicking one just toggled that row's checkbox — the whole row was one `<label>` and the
chips were labels inside it. Since every seeded permission row grants all three actions at once, the
practical effect was that a group could only ever be given a **whole** section: there was no way to
grant view without also granting edit and delete.

The editor is now a table — one row per section, one checkbox per action, plus a «همه» box that ticks
or clears a row (sixteen sections × three add up). It submits `grants`, and reads the group back from
the `grants` the API now returns.

- **The matrix is the whole group.** It is submitted in full and the API replaces the group's
  permissions with what it resolves to — the legacy relation table was rewritten wholesale the same
  way. Which is why `PERMISSION_PAGES` here must list **every** section the backend knows: one
  missing would be silently dropped from every group that gets saved. `placeholders` was missing and
  has been added — it was introduced with that screen and never made it into this list, so the
  section could not be granted from the panel at all.
- **Overlapping rows arrive already OR-ed**, by the same rule the server authorizes with, so two
  permission documents covering one section show as the single grant they amount to instead of as a
  puzzle. The old screen showed both rows and left the operator to work it out.
- **The «همه» box is derived, never submitted** — it only drives the three real fields.
- **Edit or delete without view is allowed**, because the legacy schema allowed any combination; the
  row says so in place («بدون «مشاهده»، این بخش در منو دیده نمی‌شود») rather than the section quietly
  vanishing from the operator's sidebar. In azure, not red: it is a consequence, not an error.
- The named permission rows themselves are still managed on «مجوز های دسترسی»; this screen no longer
  lists them, because what it is asking is "what may this group do", not "which rows does it hold".

### Verified

Backend behaviour was exercised over the API (see backend MIGRATION §14). Both the admin and the
frontend bundles build clean, and `eslint src` reports only the four pre-existing
`react-refresh/only-export-components` warnings and the pre-existing missing-plugin error in
`VideoUpload.jsx`. **Not yet driven in a browser** — the three screens should be clicked through
against the running dev servers before this is called done.

---

## 12. Clips, and the video uploader the panel never had (new functionality)

Backend contract, the standard's exact numbers, and what enforcing it is worth: backend
MIGRATION §15. This section is what an operator sees.

### 12.1 `/movies` — one grid, two kinds

A «نوع» column shows فیلم or a کلیپ badge and carries the filter; omitted means both. The grid was not
split into two screens, because clips and films are one catalog with one set of row actions.

### 12.2 `/movies/:id` — the کلیپ tick

The checkbox sits **above** the first section, because it decides what the rest of the form is. With
it ticked, every film-only input is disabled — year and its calendar, IMDb rating and code, second and
third genre, age range, runtime, country, producer, location, price, discount, cinema expiry,
platforms, kids and review — leaving نام، ژانر اصلی، توضیحات، برچسب‌ها and the category picker, exactly
as asked. The cast section disappears rather than sitting empty.

Two decisions inside that:

- **نام لاتین stays enabled.** It is the same name in another language, and a clip with an English
  title is ordinary; disabling it would have been a literal reading that helps nobody.
- **فعال، پوستر and the video stay enabled.** They are not "film options": a clip that could not be
  deactivated or given artwork and a video would not be usable at all.

Disabling is presentation only — react-hook-form keeps a disabled field's value and submits it — so
what actually keeps a clip's record clean is the API dropping those fields. **Do not move that rule
into the form.**

### 12.3 The video panel — drag and drop, or a link

`components/form/MovieVideoField.jsx`, new, in the sidebar beside the poster. Three ways in: drop a
file on the frame, pick one, or paste an address and press ثبت. A badge says which of the two the
record currently holds, and حذف ویدئو clears it.

- **`dragover` must be cancelled** or the browser navigates to the dropped file and the half-filled
  form is gone. Easy to lose in a refactor.
- **The chosen file is measured here** — duration and dimensions — because the server has no ffmpeg.
  The panel refuses locally what the API would refuse anyway, in Persian and with the real numbers,
  before a two-gigabyte upload. A pasted URL is probed the same way, best effort: cross-origin
  metadata is readable even when pixels are not.
- **Unreadable metadata is not an error.** The upload proceeds and the toast says it was not
  verified — refusing would block video that plays perfectly well.
- **A 15-second timeout** on the probe: a URL that neither loads nor errors would otherwise leave the
  button spinning forever.
- **The panel reads the SAVED `isClip`, not the checkbox.** Checking against a rule the record does
  not have yet would pass here and fail at the server. Ticking the box without saving shows a notice
  saying so.

`readVideoDuration` — which the pre-roll uploader uses — is now a thin wrapper over the new
`readVideoMetadata`, so there is one probe implementation.

### 12.4 Clip categories

A category whose name contains «کلیپ» or "clip" takes clips only, and the panel never offers the
impossible action:

The movie form's category section follows the **checkbox**, live — it re-filters the moment «کلیپ»
is ticked, which is what an operator expects from a control that visibly changes the rest of the
form. Adding, though, is validated by the API against the **saved** record, so while the tick is
unsaved the picker is disabled with a line saying why. Keying the section off the saved value alone
made it look frozen; keying adds off the checkbox alone would have offered a category the server then
refused. The cast section, which has no such API rule, simply follows the checkbox.

- the categories grid gained a «می‌پذیرد» column — «فقط کلیپ» or «فیلم و کلیپ» — because the rule is
  invisible otherwise and **renaming a category changes it**;
- a film's category picker omits clip categories entirely; a clip's lists all of them;
- `/categories/:id/movies` on a clip category searches with `isClip=true`, filtered server-side —
  the picker shows ten rows, so filtering afterwards would leave a search that mostly returns nothing.

`descriptors.js` became `descriptors.jsx`: a column now renders JSX, which esbuild will not transform
in a `.js` source. `useLookupOptions` options now carry `raw`, the source document, because a
category's clip-ness reads both name fields and the label is only one of them.

### Verified

Every rule was exercised over the API against the running backend (backend MIGRATION §15) and both
bundles build clean. `eslint src` reports the five pre-existing `react-refresh` warnings and one
pre-existing error — the `jsx-a11y/media-has-caption` disable comment in `VideoUpload.jsx`, whose
plugin is not installed; the new video field deliberately does not repeat that directive.

**Not yet driven in a browser.** Drag-and-drop, the local measurement of a real video file, and the
disabling behaviour should be clicked through against the dev servers before this is called done.

---

## 13. Banners — «تمام عرض» withdrawn, and artwork with stated sizes

### 13.1 The full-width type is gone from the panel

«تمام عرض» is no longer offered when creating or editing a banner category. The option is **commented
out, not deleted** — see backend MIGRATION §16.1 for the four lines that bring it back.

One consequence to know about: a category created before this still holds `full`, and the API now
refuses to save that value. Opening such a category, choosing «کشیده» or «معمولی» and saving is the
fix; until then its form will not submit. The seeded `Home hero` category is one of these.

### 13.2 `/banners/:id` — accepted sizes, stated and enforced

| دستهٔ بنر | ابعاد |
|---|---|
| کشیده | ۱۹۲۰×۳۶۰ |
| معمولی | ۵۱۷×۲۸۲ |

Both are listed in their own block **under** the uploader — not through `ImageUpload`'s `hint`, which
is hidden while the control is disabled, and a brand new banner needs the figures before it is saved.
The chosen file is measured in the browser and refused in Persian with its real dimensions; the server
refuses the same set.

**Either size is accepted**, and the block says why: a banner has no type of its own, so the panel
cannot know which rail it is destined for at upload time. The preview frame uses 1920/360, the wider
of the two, so it does not imply a shape that is not on the list.

`ImageUpload`'s `requiredSize` became `acceptedSizes` and takes a LIST; the advertisement form passes
a list of one. `validateImageSize` matches against any of them and names all of them when it refuses,
and `formatImageSize` — Persian digits, no thousands separator — is now shared rather than being a
local helper in the ad form.

### Verified

Exercised over the API (backend MIGRATION §16). Both bundles build. **Not yet driven in a browser** —
the size block, the refusal toast and the banner-category form's behaviour on a `full` category should
be clicked through.

---

## 14. «ژانر موسیقی» (new functionality)

A genre for music, which the legacy application did not have in any form. Backend contract and the
reasoning behind a second taxonomy: backend MIGRATION §17.

- **Its own sidebar item**, «ژانر موسیقی», beside «ژانر ها» under مدیریت پلتفرم. Descriptor-driven like
  every other taxonomy screen, with نام and نام لاتین — no colour class, which exists on the film
  genre only because the legacy chips used it.
- **Gated on `genres`**, the same permission as film genres, so no group needs re-granting and no
  installation needs to re-seed.
- **The field appears on the music form and nowhere else**, which is what was asked. Not on the film
  form — it reads `/music-genres`, a different collection, so a film genre cannot appear in it. Not on
  the music list as a column or filter, and not on the passenger site; the backend does not even
  return it publicly, so surfacing it there is a backend change first.

The select clears with «—», which submits `''` and nulls the relation — the same convention the movie
form's optional genres use.

### Verified

Exercised over the API (backend MIGRATION §17); the admin bundle builds. **Not yet driven in a
browser** — the new sidebar entry, the CRUD screen and the dropdown on the music form should be
clicked through.

---

## 15. «هویت بصری» — branding (new functionality)

`/branding`, in «مدیریت پلتفرم», gated on the new `branding` permission. Backend `MIGRATION.md`
**§18** is the full account of what it replaces and why; this section is what an operator sees.

**Re-seed required.** `branding` is a new permission page, so an existing installation must re-run
`npm run seed` (or add the `AccessPermission` row by hand) before any group can be granted it — the
same requirement `ads` and `placeholders` carry. `utils/constants.js PERMISSION_PAGES` gained its
row too, without which the group editor would silently drop the grant on save.

### One screen, two cards

Like the placeholders screen, and for the same reason: there is exactly one branding record per
installation, so a list with a row count, filters and a "new" button would be furniture over a single
row that always exists.

**«لوگوی مشتری»** — the customer's own logo, shown in the passenger site's footer. The product's
lockup was *removed* from that footer rather than kept behind this slot, which the card says in as
many words: an installation with nothing uploaded shows the copyright line alone. Uploading replaces
the previous file; «حذف لوگو» deletes row field and file, behind a modal rather than `ConfirmDialog`
(that component promises the record "can be restored", which is false here).

No size is enforced — 480×120 is stated as a recommendation. Ad and banner artwork sit in fixed
frames and so must match exactly; a customer's lockup has whatever proportions it has, and the footer
scales it by height.

**«متن صفحهٔ اصلی»** — the landing page's heading and the sentence beneath it.

### The one thing worth understanding before touching this screen

**The inputs start EMPTY on a fresh installation, and that is deliberate.** The shipped wording is
the input's *placeholder*, not its value. An operator who saw the default as a value could not tell
it from their own text, and saving the form would then write the shipped wording into the database —
freezing it, so a later release could never improve it. Clearing a box and saving is therefore a real
action: it restores the default. The card says so, under the fields.

### Built from the API, not from a list in this file

`fields` comes down with `GET /api/admin/branding` — key, Persian label, `maxLength`, `default`,
`multiline`, and a usage note — and the form is rendered from it. A third text field added to the
backend's `BRANDING_TEXT_FIELDS` appears here with no client change. Duplicating the labels or the
limits here is how the two drift apart, which is the same rule the placeholders screen follows.

### Colour themes (added 2026-11-15)

A third card, «رنگ‌بندی سایت» (`pages/branding/ThemePicker.jsx`), at the top of the screen. It shows
one preview card per theme from the API's `themes` (key, Persian label, swatches), so a theme added
to the backend's `SITE_THEMES` appears with no client edit. **Select, then save**: a click only
selects, because the choice repaints a public site for every visitor. It saves through
`PATCH /api/admin/branding/theme`, apart from the text form. The panel's own palette does not change.

### Verified in a browser

Chrome at 1440×950, against the running dev backend: the screen renders RTL with both cards intact,
the logo uploads through the real control and previews, both texts save with the success toast, the
«آخرین تغییر» badge and «حذف لوگو» appear once there is something to show, and the passenger site
picks up all three changes on the next load — heading, two-line description, and the customer logo in
the footer, with the header mark untouched. Also checked at 390×844, where the footer wraps the logo
onto its own row. The test record and file were deleted afterwards.

---

## 16. «بازی» and «ژانر بازی» — HTML5 games (new functionality)

Two screens for a section the legacy application did not have: `/games` under «مدیریت محتوا» and
`/game-genres` under «مدیریت پلتفرم», both gated on the new `games` permission. Backend
`MIGRATION.md` **§19** is the full account — what a game is, how a bundle is unpacked, and whose
authority its code runs with. The model is the maintainer's Playva panel
(`playva-admin/src/pages/dashboard/games/`, `genres/`), minus its leaderboard column, trophy button
and score dialog.

**Re-seed required.** `games` is a new permission page, so an existing installation must re-run
`npm run seed` before any group can be granted it — and `utils/constants.js PERMISSION_PAGES` gained
its row, without which the group editor would silently drop the grant on save. One grant covers both
screens.

### `/games` — the grid

A game's tile (its emoji on its gradient — a game has no image), title, folder name, genre and
«بازشدن», the number of times passengers have opened it. Filterable by title, folder and genre;
sortable by title, folder and opens. Built on this panel's grid and form pages rather than Playva's
dialogs, like every other section here.

Deleting a game **removes its files**, which no other delete in the panel does, so the confirmation
says that instead of the usual line about being restorable. `ConfirmDialog` gained an optional `note`
for it — the branding screen worked around the same false promise with a bespoke modal (§15).

### `/games/new` — one submit, with the file in it

Every other form here saves a record and attaches files to it afterwards. A game cannot: without a
bundle it is not a game. So the ZIP is part of this form, required, and nothing is stored unless the
server unpacks it. The drop zone (`components/form/GameBundleDrop.jsx`) **picks** a file and waits
for the submit button; it shows upload progress, then «در حال بازکردن فایل‌ها روی سرور» while the
archive is unpacked.

- **نام پوشه** is suggested from the ZIP's file name the moment one is chosen, but never over a name
  already typed. It is Latin letters, digits, `-` and `_`, it becomes part of the game's address, and
  it cannot be changed afterwards — the edit screen shows it and does not offer it.
- **ایموجی کارت** is a text box plus twenty-four one-tap suggestions. Playva uses the
  `emoji-picker-react` component; it loads its artwork from a CDN, and this panel runs on an
  appliance with no route to the internet.
- **پیش‌نمایش کارت** beside the form redraws as the emoji and colours change, using the same shape
  the passenger site draws (`pages/games/GameTile.jsx` — keep it in step with the frontend's
  `GameCard.jsx`).
- **Refusals are explained in Persian.** What is wrong inside an archive — no `index.html`, not a
  real ZIP, paths that climb out, too large once unpacked — can only be found by the server opening
  it, and comes back as an English sentence like every API message. `explainBundleError()` maps the
  known ones; a taken folder name (409) lands on its own field.

### `/games/:id` — two separate actions

- **The card** — title, genre, emoji, colours, «فعال» — is an ordinary save.
- **The files** are replaced from their own card, behind their own button: choose a new ZIP, then
  «جایگزینی فایل‌های بازی». The record and its count of openings survive; the old directory is
  removed only after the new one is in place, and a refused archive leaves the game as it was. Playva
  has no equivalent — there a fixed build means delete and re-upload from zero.

### «آزمودن بازی» — and why the game may behave differently in it

The edit screen can run the game in a frame. **That frame is sandboxed**, without
`allow-same-origin`, because a game is somebody else's code and this panel's origin holds the
signed-in administrator's token. The game runs, but as a stranger: it cannot read the panel's
storage — or any storage, so a game that saves progress may complain or refuse to start *there*
while working for passengers. The caption says so in as many words and names the passenger site as
the real test. There is deliberately no "open in a new tab" link on this origin.

The frame's attribute is one half of the protection; the other is a response header on the admin
host (backend §19, `admin/nginx.conf`). **Never add `allow-same-origin` to that frame** — combined
with `allow-scripts` it lets the framed page remove its own sandbox.

### `/game-genres`

Descriptor-driven like the other taxonomies: نام and نام لاتین. Unlike a music genre this one is
shown to passengers — it is the filter row on the games page and the label under each card — so the
form states what deactivating does (leaves the filter row; the games keep their label) and that a
genre which still has games cannot be deleted.

### Verified in a browser

Chrome at 1440×950 and, for the edit page, 390×844, against the running dev backend:

- both sidebar items appear, and «ژانر بازی» lists the eight seeded genres;
- an empty submit is stopped on the title, genre and folder name; a filled form with no ZIP is
  stopped on the file; a `.txt` is refused by the picker — none of the three reaches the server;
- choosing `good-root.zip` fills the folder name, picking an emoji and two colours redraws the
  preview, and submitting creates the game and lands on its edit page;
- the test frame runs the game, and `localStorage` inside it **throws** — the isolation observed;
- the title edit saves and leaves the folder name, the URL and the emoji alone;
- a replacement ZIP through the panel changes the stored URL, and the passenger site then serves the
  new build;
- a bundle with no `index.html` and a taken folder name are each explained in Persian, in the right
  place;
- the grid lists five games with their tiles, and the edit page has no horizontal overflow on a phone.

**Not exercised:** drag-and-drop itself (the file was set on the hidden input, which is the same
code path after the drop handler), the progress bar on an upload large enough to show one, and the
delete confirmation's new wording — the test games were removed through the API.

---

## 17. Uploads no longer time out at thirty seconds (defect fixed)

Found while building §16 and fixed straight after it, at the maintainer's request. It is this
panel's own defect, not a legacy one.

`api/client.js` creates its axios instance with a 30-second timeout. In a browser that covers the
whole exchange, **sending included** — so every upload that took longer was aborted by the panel
itself and reported as «پاسخی دریافت نشد». That is a film of any real size, and it had never been
seen because, as §12 and §7 both say, video upload had never been driven in a browser.

The request interceptor now lifts the timeout for any multipart body, which in this panel is always
a file on its way up. One rule in the client rather than a `timeout: 0` on every upload call, so an
upload added later is covered without having to remember. A caller that asks for a
specific timeout still gets it. A connection that really dies is still noticed — the browser fails
the request, and nginx gives up on a body that stops arriving.

**Verified both ways**, through the real movie form in Chrome with the upload throttled to 20 KB/s:

- with the fix, a 900 KB file took 46 seconds and was stored;
- with the previous `client.js`, the same upload was abandoned at 31 seconds with that message and
  nothing was stored.

That control also left 600 KB of the file in `uploads/movies/`, pointed at by nothing — an aborted
upload was not being cleaned up server-side. That was a separate defect on every upload route, and it
is fixed too: backend §20.2. So leaving a page mid-upload, or losing the connection, now leaves
nothing on the server — verified through this same form.

---

## 18. The video field follows the HLS transcode (new functionality)

The movie form's «ویدئو» card (`components/form/MovieVideoField.jsx`) for backend §21:

- **Any container.** The picker accepts `.mp4 .m4v .mov .mkv .webm .avi .wmv .flv .mpg .mpeg .ts
  .mts .m2ts .3gp .ogv` (`MOVIE_VIDEO_ACCEPT`), judged by extension and size — browsers disagree
  about MIME types for anything but MP4. Pre-roll ads keep the narrower MP4/WebM `VIDEO_ACCEPT`.
- **The local check still runs first** when this browser can decode the file, so an obvious
  mismatch (a landscape clip) is refused before gigabytes are sent; an MKV/AVI it cannot decode is
  left to the server's ffprobe, whose message is shown as-is.
- **Upload progress**, then a status panel: «در صف تبدیل به HLS (نوبت n)», a progress bar while
  encoding, or «تبدیل ویدئو ناموفق بود» with ffmpeg's last lines and «تلاش دوباره». It polls
  `GET /movies/:id/video` every 3 s while queued or processing and refreshes the form when the job
  lands. When a video already exists the panel says it keeps playing until the new one is ready.
- **«لغو بارگذاری»** appears instead of «حذف ویدئو» when only an upload is in flight; both call
  `DELETE`, which cancels the transcode.
- **Badge**: «HLS — چند کیفیت», «فایل بارگذاری‌شده» (an older MP4) or «لینک بیرونی».
- **Preview** (`components/form/VideoPreview.jsx`): a browser with native HLS (Safari, Chrome 142+)
  plays the `.m3u8` itself; otherwise hls.js 1.6.19 — the version Muvi pins — is imported on demand.

Verified in Chrome against the real API: the HLS badge and preview on a transcoded film, also with
native HLS hidden (hls.js, MSE `blob:` source); a landscape MKV on a clip refused with
«کلیپ باید ویدئوی عمودی باشد؛ این فایل ۱۲۸۰×۷۲۰ و افقی است.» and nothing queued; a portrait clip
uploaded through the picker → queued → progress bar → «تبدیل ویدئو به HLS تمام شد» → panel cleared.
Not verified: the failed state's look (retry was exercised through the API), Firefox.

## 19. «تنظیمات ویدئو» — the MP4/HLS switch (new functionality)

`/settings/video` (`pages/settings/VideoSettings.jsx`, permission page «تنظیمات» / `settings`): two
options side by side — **MP4** «بدون تبدیل — یک کیفیت» and **HLS** «تبدیل به HLS — چند کیفیت» — each
listing what it accepts, what happens after upload, what passengers get and what the server needs.
Choosing one saves at once (a radio group, not a form). HLS is disabled with a warning when the server
has no ffmpeg; a «not chosen yet» note explains the default until someone chooses. Backend §21.1.

The movie form reads the switch (`GET /movies/video-settings`, movies permission) and the video card
follows it: the picker offers MP4/WebM or every container, the hint says «حالت MP4» / «حالت HLS», the
toast after an upload says which mode the SERVER applied, and the stored video's badge reads
«MP4 — یک کیفیت» or «HLS — چند کیفیت».

Verified in Chrome: the nav entry; unchosen + ffmpeg → HLS selected with the note; clicking MP4 and
back to HLS, with their toasts; the movie card's accept list and hint in each mode; the MP4 badge.

### Per-upload choice (2026-11-15)

Since the maintainer asked for MP4/HLS to be "changeable for each video", this screen sets only the
**default**. The movie form's video card has its own «نوع انتشار بارگذاری» radio pair (HLS / MP4,
`ModePicker` in `components/form/MovieVideoField.jsx`): it starts on this default (marked «پیش‌فرض»),
switches the accepted file types and the hint with it, and sends the choice as `?mode=` with the
upload. HLS is disabled, with the reason, when the server reports no ffmpeg. The choice applies to
the next upload from that card only; the attached video keeps its format.
