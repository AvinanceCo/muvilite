# MuviLite — Admin Panel

React and Vite administration panel for the API in `../backend`.

---

## Running

```bash
cd backend && npm run seed && npm run dev   # :4000
cd admin    && npm install && npm run dev    # :5174
```

**Port 5174 is required, not preferred.** The backend's CORS allow-list is
`[FRONTEND_URL, ADMIN_URL]` and `ADMIN_URL` defaults to `http://localhost:5174`; any other origin
is rejected by the browser. `vite.config.js` sets `strictPort` so a clash fails loudly instead of
drifting to 5175 and producing CORS errors that look like an auth bug. 5173 belongs to the
passenger frontend, which runs alongside this.

With no `.env` the dev server proxies `/api` and `/uploads` to `localhost:4000`, so nothing needs
configuring for local work. `.env.example` documents the three variables that exist.

The `Dockerfile` builds the panel for production. The included `nginx.conf` serves the panel
and proxies `/api` and `/uploads` on the same origin. Single-server deployment is documented in [English](../DEPLOYMENT.md) and [فارسی](../DEPLOYMENT_FA.md).

The seeded administrator is `09120000000` / `changeme123`. **Change it after first sign-in**, from
the account menu → «تغییر رمز عبور».

```bash
npm run build     # production bundle into dist/
npm run preview   # serve that bundle
npm run lint
```

---

## Layout

```
src/
  api/          client (envelope, token, 401 vs 403), auth, resources, operations, reports
  components/
    auth/       RequireAuth, RequirePermission, Can
    data/       DataTable, RowControls, Thumb
    form/       Field, ImageUpload, RelationPicker, OrderableList
    ui/         Button, Input, Card, Modal, Toast, Pagination, Feedback
  context/      AuthContext
  hooks/        useResource, useListParams, usePermissions, …
  layouts/      DashboardLayout (sidenav + top bar)
  pages/        one folder per feature; `resource/` holds the generic CRUD pair
  routes/       route table, and `nav.js` — the sidebar model
  services/     format (Persian/Jalali display), jalali (year maths), media, download
```

Two pieces carry most of the panel:

**`pages/resource/`** — eleven straightforward resources (genres, age ranges, countries, the two
category kinds, banner and user categories, polls, access permissions) are declared as data in
`descriptors.js` and rendered by one list page and one form page. They all expose the same six
routes, so hand-writing eleven near-identical screens would have been eleven chances to drift.
Resources whose screens do more than CRUD — movies, casts, musics, banners, pages, users, permission
groups — have their own modules.

**`hooks/useListParams.js`** — the page, page size, sort and filters of every grid live in the URL,
so a filtered view can be linked, bookmarked, and survives the back button after editing a row.

---

## Things that will bite you

- **`permissions` is a sparse map.** A section the administrator has no grant for is absent
  entirely, not present with false flags. Always go through `usePermissions()`; indexing directly
  throws on exactly the accounts that must be denied.
- **`PUT` is a full replace.** The API applies the same validation rules to create and update, so a
  field required on create is required on update. Load the record, edit it, send the whole thing.
- **401 ends the session; 403 must not.** A permission an operator lacks is not a reason to sign
  them out. `api/client.js` is the only place that distinguishes them.
- **A movie's publish year is a bare year in whichever calendar `defaultOrigin` names,** and the
  *server* converts it. Convert for display when loading, pass through untouched on save —
  converting on both sides shifts every year by 621.
- **Uploads are separate requests** from the form save, so a record must exist before it can have a
  picture. Each endpoint has its own multipart field name.
- **Music tracks replace wholesale** and delete unreferenced files from disk. Always send the
  complete list.
- **RTL offsets must agree.** If the sidenav is anchored `start-0`, the content is inset
  `ps-*` — mixing a physical anchor with a logical inset pads the wrong edge and slides every table
  under the navigation.
- **Permission records.** If `ads`, `placeholders` or `branding` cannot be granted because their
  `AccessPermission` records are missing, run `npm run seed`. Keep their keys in
  `PERMISSION_PAGES` in `utils/constants.js` so the group editor preserves the grants.
- **No external asset host.** The panel depends on no third-party host: the typeface and the
  favicon are self-hosted, and the charts are hand-rolled rather than pulling a charting library.
