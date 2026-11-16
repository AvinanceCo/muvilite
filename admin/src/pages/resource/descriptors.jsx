/**
 * Resource descriptors.
 *
 * Purpose: describe the eleven straightforward resources as data — their
 *          columns, filters, sorts and form fields — so one list page and one
 *          form page serve them all.
 * Inputs:  none
 * Outputs: a descriptor per resource
 * Deps:    utils/constants, components/ui/Card
 *
 * A `.jsx` file, not `.js`: a column may render JSX, which esbuild will not
 * transform in a `.js` source.
 *
 * Every resource here exposes exactly the same six routes and differs only in
 * its fields, so hand-writing eleven near-identical screens would be eleven
 * chances to drift. Resources whose screens do more than CRUD — movies, casts,
 * musics, banners, pages, users — have their own pages and are absent from this
 * file.
 *
 * A descriptor is:
 *   key         RESOURCE_APIS key, and the route segment
 *   permission  the permission page it is gated on — NOT always `key`
 *   labels      { singular, plural, addNew }
 *   defaultSort the API `item_sort` key this list opens on
 *   columns     extra columns; id, status and actions are added by the page
 *   fields      form fields, in order
 *   toolbarLinks optional extra buttons beside "add new", gated on `edit`
 *
 * NOTE the permission mismatches, which are the backend's and are deliberate:
 * music categories are gated on `categories`, countries on `age-ranges`, polls
 * on `pages`, user categories on `users`, and both permission-group resources
 * on `groups`.
 */
import { Badge } from '../../components/ui/Card.jsx';
import { BANNER_CATEGORY_TYPES, isClipCategory } from '../../utils/constants.js';

/** A text field. */
const text = (name, label, options = {}) => ({ type: 'text', name, label, ...options });

/** A multi-line field. */
const textarea = (name, label, options = {}) => ({ type: 'textarea', name, label, ...options });

/** A column showing a plain document field. */
const column = (key, header, options = {}) => ({ key, header, ...options });

export const DESCRIPTORS = Object.freeze({
  /* ------------------------------------------------------------- genres --- */
  genres: {
    key: 'genres',
    permission: 'genres',
    labels: { singular: 'ژانر', plural: 'ژانر ها', addNew: 'افزودن ژانر' },
    defaultSort: 'name_fa',
    defaultDirection: 'ASC',
    columns: [
      column('nameFa', 'نام', { sortKey: 'name_fa', filter: { key: 'nameFa', type: 'text' } }),
      column('nameEn', 'نام لاتین', { mono: true }),
      column('colorClass', 'کلاس رنگ', { mono: true }),
    ],
    fields: [
      text('nameFa', 'نام', { required: true, maxLength: 255 }),
      text('nameEn', 'نام لاتین', { maxLength: 255, dir: 'ltr' }),
      text('colorClass', 'کلاس رنگ', {
        maxLength: 64,
        dir: 'ltr',
        hint: 'نام کلاس CSS که رنگ برچسب ژانر را تعیین می‌کند.',
      }),
    ],
  },

  /* ------------------------------------------------------- music genres --- */
  /**
   * The MUSIC taxonomy. A different collection from `genres` above, which is
   * films only — the two vocabularies do not overlap, and `genres` is
   * load-bearing for the public movie query.
   *
   * Guarded by `genres`, the permission that already covers genre management,
   * so no installation has to re-seed a permission row to reach the section.
   *
   * No colour class: that field colours the film chips in the legacy UI, and a
   * music genre is not rendered on the passenger site at all — it is shown on
   * the panel's music form and nowhere else.
   */
  'music-genres': {
    key: 'music-genres',
    permission: 'genres',
    labels: { singular: 'ژانر موسیقی', plural: 'ژانر موسیقی', addNew: 'افزودن ژانر موسیقی' },
    defaultSort: 'name_fa',
    defaultDirection: 'ASC',
    columns: [
      column('nameFa', 'نام', { sortKey: 'name_fa', filter: { key: 'nameFa', type: 'text' } }),
      column('nameEn', 'نام لاتین', { mono: true }),
    ],
    fields: [
      text('nameFa', 'نام', { required: true, maxLength: 255 }),
      text('nameEn', 'نام لاتین', { maxLength: 255, dir: 'ltr' }),
    ],
  },

  /* -------------------------------------------------------- game genres --- */
  /**
   * The GAME taxonomy — a third collection, beside `genres` (films) and
   * `music-genres` (music). New, like the games section it belongs to: the
   * legacy application had no games.
   *
   * Guarded by `games`, not `genres`: the list exists only for the games
   * section, so one grant gives a games operator both screens.
   *
   * Unlike a music genre, this one IS shown to passengers — it is the filter row
   * on the games page and the label under every game card — which is why
   * deactivating one is worth explaining: it leaves the filter row, and its
   * games keep their label. A genre that still has games cannot be deleted at
   * all; the API refuses, since every game must have one.
   */
  'game-genres': {
    key: 'game-genres',
    permission: 'games',
    labels: { singular: 'ژانر بازی', plural: 'ژانر بازی', addNew: 'افزودن ژانر بازی' },
    defaultSort: 'name_fa',
    defaultDirection: 'ASC',
    columns: [
      column('nameFa', 'نام', { sortKey: 'name_fa', filter: { key: 'nameFa', type: 'text' } }),
      column('nameEn', 'نام لاتین', { mono: true }),
    ],
    fields: [
      text('nameFa', 'نام', { required: true, maxLength: 255 }),
      text('nameEn', 'نام لاتین', { maxLength: 255, dir: 'ltr' }),
    ],
    formNote:
      'ژانر غیرفعال از ردیف فیلترهای صفحهٔ بازی‌ها در سایت اصلی برداشته می‌شود، اما بازی‌هایش برچسب خود را نگه می‌دارند. ژانری که هنوز بازی دارد قابل حذف نیست.',
  },

  /* --------------------------------------------------------- age ranges --- */
  'age-ranges': {
    key: 'age-ranges',
    permission: 'age-ranges',
    labels: { singular: 'رده سنی', plural: 'رده های سنی', addNew: 'افزودن رده سنی' },
    defaultSort: 'name_fa',
    defaultDirection: 'ASC',
    columns: [
      column('nameFa', 'نام', { sortKey: 'name_fa', filter: { key: 'nameFa', type: 'text' } }),
      column('nameEn', 'نام لاتین', { mono: true }),
      column('description', 'توضیح', { truncate: 60 }),
    ],
    fields: [
      text('nameFa', 'نام', { required: true, maxLength: 255 }),
      text('nameEn', 'نام لاتین', { maxLength: 255, dir: 'ltr' }),
      textarea('description', 'توضیح', { maxLength: 2000, full: true }),
    ],
  },

  /* ---------------------------------------------------------- countries --- */
  // New to the UI: the legacy panel had no countries screen, though the table
  // fed the movie form's country field. Guarded by `age-ranges`, which is the
  // permission the backend put it behind.
  countries: {
    key: 'countries',
    permission: 'age-ranges',
    labels: { singular: 'کشور', plural: 'کشور ها', addNew: 'افزودن کشور' },
    defaultSort: 'country_fa',
    defaultDirection: 'ASC',
    columns: [
      column('countryCode', 'کد', {
        mono: true,
        width: 'w-24',
        filter: { key: 'countryCode', type: 'text', placeholder: 'IR' },
      }),
      column('countryFa', 'نام', {
        sortKey: 'country_fa',
        filter: { key: 'countryFa', type: 'text' },
      }),
      column('countryEn', 'نام لاتین', { mono: true }),
    ],
    fields: [
      text('countryCode', 'کد کشور', {
        required: true,
        maxLength: 8,
        dir: 'ltr',
        hint: 'کد کوتاه و یکتا؛ روی فیلم ذخیره می‌شود. مثال: IR',
      }),
      text('countryFa', 'نام', { required: true, maxLength: 255 }),
      text('countryEn', 'نام لاتین', { maxLength: 255, dir: 'ltr' }),
    ],
  },

  /* --------------------------------------------------- movie categories --- */
  categories: {
    key: 'categories',
    permission: 'categories',
    labels: {
      singular: 'دسته بندی فیلم',
      plural: 'دسته بندی فیلم ها',
      addNew: 'افزودن دسته بندی',
    },
    defaultSort: 'name_fa',
    defaultDirection: 'ASC',
    // The "contents" action is added by the list page, since it routes
    // somewhere this descriptor cannot express.
    contentRoute: (id) => `/categories/${id}/movies`,
    columns: [
      column('nameFa', 'نام', { sortKey: 'name_fa', filter: { key: 'nameFa', type: 'text' } }),
      column('nameEn', 'نام لاتین', { mono: true }),
      // What a category accepts is decided by its NAME — «کلیپ» or "clip"
      // anywhere in either field makes it clips-only (utils/constants.js
      // isClipCategory). That is invisible otherwise, so it is spelled out
      // here: an operator renaming a category is changing this rule.
      column('kind', 'می‌پذیرد', {
        width: 'w-28',
        render: (row) =>
          isClipCategory(row) ? (
            <Badge tone="accent">فقط کلیپ</Badge>
          ) : (
            <span className="text-muted">فیلم و کلیپ</span>
          ),
      }),
      column('style', 'چیدمان', { mono: true }),
    ],
    fields: [
      text('nameFa', 'نام', { required: true, maxLength: 255 }),
      text('nameEn', 'نام لاتین', { maxLength: 255, dir: 'ltr' }),
      text('icon', 'آیکن', { maxLength: 255, dir: 'ltr' }),
      text('style', 'چیدمان', {
        maxLength: 64,
        dir: 'ltr',
        hint: 'به کلاینت می‌گوید ردیف این دسته چگونه رندر شود.',
      }),
    ],
  },

  /* --------------------------------------------------- music categories --- */
  'music-categories': {
    key: 'music-categories',
    // Gated on `categories`, not `musics` — the backend's choice.
    permission: 'categories',
    labels: {
      singular: 'دسته بندی موسیقی',
      plural: 'دسته بندی موسیقی ها',
      addNew: 'افزودن دسته بندی',
    },
    defaultSort: 'name_fa',
    defaultDirection: 'ASC',
    contentRoute: (id) => `/music-categories/${id}/musics`,
    columns: [
      column('nameFa', 'نام', { sortKey: 'name_fa', filter: { key: 'nameFa', type: 'text' } }),
      column('nameEn', 'نام لاتین', { mono: true }),
      column('style', 'چیدمان', { mono: true }),
    ],
    fields: [
      text('nameFa', 'نام', { required: true, maxLength: 255 }),
      text('nameEn', 'نام لاتین', { maxLength: 255, dir: 'ltr' }),
      text('icon', 'آیکن', { maxLength: 255, dir: 'ltr' }),
      text('style', 'چیدمان', { maxLength: 64, dir: 'ltr' }),
    ],
  },

  /* -------------------------------------------------- banner categories --- */
  'banner-categories': {
    key: 'banner-categories',
    permission: 'banners',
    labels: {
      singular: 'دسته بندی بنر',
      plural: 'دسته بندی های بنر',
      addNew: 'افزودن دسته بندی',
    },
    defaultSort: 'name',
    defaultDirection: 'ASC',
    contentRoute: (id) => `/banner-categories/${id}/banners`,
    columns: [
      column('name', 'نام', { sortKey: 'name', filter: { key: 'name', type: 'text' } }),
      column('type', 'نوع', {
        options: BANNER_CATEGORY_TYPES,
        filter: { key: 'type', type: 'select', options: [...BANNER_CATEGORY_TYPES] },
      }),
      column('description', 'توضیح', { truncate: 60 }),
    ],
    fields: [
      text('name', 'نام', { required: true, maxLength: 255 }),
      {
        type: 'select',
        name: 'type',
        label: 'نوع',
        options: [...BANNER_CATEGORY_TYPES],
        defaultValue: 'item',
        hint: 'ابعاد اسلاید را در کلاینت تعیین می‌کند.',
      },
      textarea('description', 'توضیح', { maxLength: 2000, full: true }),
    ],
  },

  /* ----------------------------------------------------- user categories --- */
  'user-categories': {
    key: 'user-categories',
    permission: 'users',
    labels: {
      singular: 'دسته بندی کاربر',
      plural: 'دسته بندی کاربران',
      addNew: 'افزودن دسته بندی',
    },
    defaultSort: 'name',
    defaultDirection: 'ASC',
    columns: [
      column('name', 'نام', { sortKey: 'name', filter: { key: 'name', type: 'text' } }),
      column('topicName', 'نام Topic', { mono: true }),
      column('description', 'توضیح', { truncate: 60 }),
    ],
    fields: [
      text('name', 'نام', { required: true, maxLength: 255 }),
      text('topicName', 'نام Topic', {
        maxLength: 128,
        dir: 'ltr',
        // Carried, but inert: UserCategoryController::createFCMTopic used a
        // server key hardcoded in source and was not ported (§7.7).
        hint: 'برای انتشار اعلان نگهداری می‌شود؛ در حال حاضر هیچ اعلانی ارسال نمی‌شود.',
      }),
      textarea('description', 'توضیح', { maxLength: 2000, full: true }),
    ],
  },

  /* ---------------------------------------------------------------- polls --- */
  // Guarded by `pages`. The legacy views checked `banners` by copy-paste — a
  // defect the backend corrected (§6 defect 18), so a group that could reach
  // the poll editor through banners no longer can.
  polls: {
    key: 'polls',
    permission: 'pages',
    labels: { singular: 'سوال نظرسنجی', plural: 'سوالات نظرسنجی', addNew: 'افزودن سوال' },
    defaultSort: 'order',
    defaultDirection: 'ASC',
    columns: [
      column('order', 'ترتیب', { sortKey: 'order', mono: true, width: 'w-20', align: 'center' }),
      column('questionFa', 'سوال'),
      column('questionEn', 'سوال لاتین', { truncate: 50 }),
    ],
    fields: [
      textarea('questionFa', 'سوال', { required: true, maxLength: 500, rows: 2, full: true }),
      textarea('questionEn', 'سوال لاتین', { maxLength: 500, rows: 2, dir: 'ltr', full: true }),
      {
        type: 'number',
        name: 'order',
        label: 'ترتیب نمایش',
        min: 0,
        defaultValue: 0,
        hint: 'کوچک‌تر بالاتر نمایش داده می‌شود.',
      },
    ],
    // Bulk import, which no other resource has: a survey arrives as a list from
    // whoever wrote it, so loading a file beats retyping it question by
    // question. Needs `edit` on the same permission the form does.
    toolbarLinks: [{ to: '/polls/import', label: 'ورود از CSV', icon: '⭱' }],
    // The four-point scale is fixed in the client and not editable here.
    formNote:
      'مقیاس پاسخ ثابت است: عالی، خوب، متوسط و ضعیف. تنها متن سوال و ترتیب آن قابل تغییر است.',
  },

  /* ------------------------------------------------- access permissions --- */
  // New to the UI: the legacy panel only picked from a seeded list of these.
  'access-permissions': {
    key: 'access-permissions',
    permission: 'groups',
    labels: { singular: 'مجوز دسترسی', plural: 'مجوز های دسترسی', addNew: 'افزودن مجوز' },
    defaultSort: 'action_page',
    defaultDirection: 'ASC',
    columns: [
      column('displayName', 'عنوان'),
      column('actionPage', 'بخش', { mono: true, sortKey: 'action_page' }),
    ],
    fields: [], // Rendered by its own page — see pages/permissions/.
    customForm: true,
  },
});

/** @param {string} key */
export function getDescriptor(key) {
  const descriptor = DESCRIPTORS[key];
  if (!descriptor) {
    throw new Error(`No descriptor for "${key}"`);
  }
  return descriptor;
}

export default DESCRIPTORS;
