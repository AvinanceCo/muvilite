/**
 * Admin entity write validators.
 *
 * Purpose: per-entity create/update rules, derived from the legacy admin forms.
 * Inputs:  none
 * Outputs: express-validator chains
 * Deps:    express-validator, config/constants, models, validators/common.write
 *
 * Field sets come from the legacy form markup and controller field arrays, e.g.
 * admin/.../views/movies/form.php for movies and the `public $fields` arrays in
 * admin/.../models/*.php for the rest. The legacy panel enforced almost no
 * validation — views/movies/update.php mass-assigned `$_POST` straight into the
 * UPDATE — so every rule here is new, but the accepted field set is not.
 */
import { body, param, query } from 'express-validator';
import {
  requiredText,
  optionalText,
  optionalLongText,
  optionalObjectId,
  requiredObjectId,
  optionalNonNegativeInt,
  textFilter,
  statusFilter,
} from './common.write.validators.js';
import {
  AD_PLACEMENTS,
  CAST_ROLE_VALUES,
  DEVICE_PLATFORM_VALUES,
  PERMISSION_ACTIONS,
  PERMISSION_PAGES,
  PLACEHOLDER_SLOT_KEYS,
  BRANDING_TEXT_FIELDS,
  SITE_THEME_KEYS,
  GAME_FOLDER_NAME_PATTERN,
  HEX_COLOR_PATTERN,
} from '../config/constants.js';
import { BLOCK_SORT_FIELDS } from '../models/PageBlock.js';
import { BANNER_CATEGORY_TYPES_AVAILABLE } from '../models/BannerCategory.js';

/* -------------------------------------------------------------- movies --- */

/**
 * legacy: admin/.../views/movies/form.php input names — title_fa, title_en,
 * publish_date, imdb_rank, imdb_code, country, company, is_review, genre_1..3,
 * age_range, description_fa, description_en, tags, movie_length,
 * default_origin, is_kids, is_active, categories[].
 */
export const movieWriteRules = [
  requiredText('titleFa', { max: 255 }),
  optionalText('titleEn', { max: 255 }),
  optionalLongText('descriptionFa'),
  optionalLongText('descriptionEn'),

  // A bare year, submitted in the Jalali calendar when defaultOrigin is 0.
  body('publishYear')
    .optional({ values: 'falsy' })
    .isInt({ min: 1000, max: 2200 })
    .withMessage('"publishYear" must be a four-digit year')
    .toInt(),
  body('defaultOrigin')
    .optional()
    .isInt({ min: 0, max: 1 })
    .withMessage('"defaultOrigin" must be 0 (Jalali) or 1 (Gregorian)')
    .toInt(),

  body('imdbRank')
    .optional({ values: 'falsy' })
    .isFloat({ min: 0, max: 10 })
    .withMessage('"imdbRank" must be between 0 and 10')
    .toFloat(),
  optionalText('imdbCode', { max: 32 }),

  optionalText('country', { max: 8 }),
  optionalText('company', { max: 255 }),
  optionalText('location', { max: 255 }),
  optionalText('tags', { max: 1000 }),

  optionalObjectId('genre1'),
  optionalObjectId('genre2'),
  optionalObjectId('genre3'),
  optionalObjectId('ageRange'),

  optionalNonNegativeInt('movieLength', { max: 100_000 }),
  optionalNonNegativeInt('price'),
  optionalNonNegativeInt('priceDiscount'),
  body('cinemaExpireHour')
    .optional({ values: 'null' })
    .isInt({ min: 0 })
    .withMessage('"cinemaExpireHour" must be a non-negative integer')
    .toInt(),

  // Splits the catalog into short vertical clips and feature films. Everything
  // above except the title, primary genre, descriptions and tags is dropped
  // from a clip's write (services/admin/registry.js CLIP_FIELDS), so the rules
  // stay optional rather than becoming conditional on this flag.
  body('isClip').optional().isBoolean().toBoolean(),
  body('isKids').optional().isBoolean().toBoolean(),
  body('isReview').optional().isBoolean().toBoolean(),
  body('isActive').optional().isBoolean().toBoolean(),

  body('platform').optional().isArray().withMessage('"platform" must be an array'),
  body('platform.*')
    .isInt()
    .toInt()
    .isIn(DEVICE_PLATFORM_VALUES)
    .withMessage('"platform" contains an unknown device'),
];

/** legacy: MovieController list filters (id, title_fa, title_en, company, status, publish_date). */
export const movieListRules = [
  textFilter('titleFa'),
  textFilter('titleEn'),
  textFilter('company'),
  statusFilter,
  query('genre1').optional().isMongoId(),
  query('publishYear').optional().isInt({ min: 1000, max: 2200 }).toInt(),
  // New: clips and films share this collection, so the grid needs to be able to
  // ask for one kind. Omitted means both.
  query('isClip').optional().isBoolean().toBoolean(),
];

/**
 * The video attached to a movie, as measured IN THE BROWSER.
 *
 * These arrive as multipart text parts on the upload route, so every one is a
 * string until `toFloat`/`toInt` runs. All three are optional: a container the
 * browser cannot decode, or a cross-origin link that will not report, yields
 * nothing — and refusing those would leave the panel unable to attach video
 * that plays perfectly well. See services/admin/movieVideo.service.js for what
 * the resulting check does and does not promise.
 */
const videoMeasurementRules = [
  body('durationSecond')
    .optional({ values: 'falsy' })
    // Twenty-four hours. Anything past that is a decode error, not a film.
    .isFloat({ min: 0, max: 86_400 })
    .withMessage('"durationSecond" must be a positive number of seconds')
    .toFloat(),
  body('width').optional({ values: 'falsy' }).isInt({ min: 1, max: 20_000 }).toInt(),
  body('height').optional({ values: 'falsy' }).isInt({ min: 1, max: 20_000 }).toInt(),
];

export const movieVideoUploadRules = [
  // Already enforced before the body was read (services/videoSettings
  // resolveUploadTranscode); declared here too so the route's contract is in one list.
  query('mode')
    .optional({ values: 'falsy' })
    .isIn(['hls', 'mp4'])
    .withMessage('"mode" must be one of: hls, mp4'),
  ...videoMeasurementRules,
];

/** The link form of the same endpoint. The URL is stored, never fetched. */
export const movieVideoLinkRules = [
  body('url')
    .isString()
    .trim()
    .isLength({ min: 1, max: 2000 })
    .withMessage('"url" is required')
    .bail()
    .matches(/^https?:\/\/\S+$/i)
    .withMessage('"url" must be an http(s) address'),
  ...videoMeasurementRules,
];

/* --------------------------------------------------------------- casts --- */

export const castWriteRules = [
  requiredText('fullnameFa', { max: 255 }),
  optionalText('fullnameEn', { max: 255 }),
  body('birthDate').optional({ values: 'falsy' }).isISO8601().toDate(),
  optionalLongText('briefFa', { max: 5000 }),
  optionalLongText('briefEn', { max: 5000 }),
  body('isActive').optional().isBoolean().toBoolean(),
];

/** legacy: movies_cast_tbl rows, managed from the movie edit screen. */
export const movieCastWriteRules = [
  requiredObjectId('movie'),
  requiredObjectId('cast'),
  body('role')
    .isInt()
    .toInt()
    .isIn(CAST_ROLE_VALUES)
    .withMessage(`"role" must be one of: ${CAST_ROLE_VALUES.join(', ')}`),
];

/* --------------------------------------------------------------- music --- */

export const musicWriteRules = [
  requiredText('fullnameFa', { max: 255 }),
  // The MUSIC taxonomy (models/MusicGenre.js), not the film one.
  optionalObjectId('genre'),
  optionalText('fullnameEn', { max: 255 }),
  optionalText('albumFa', { max: 255 }),
  optionalText('albumEn', { max: 255 }),
  optionalLongText('descriptionFa'),
  optionalLongText('descriptionEn'),
  body('publishYear').optional({ values: 'falsy' }).isInt({ min: 1000, max: 2200 }).toInt(),
  body('isIranian').optional().isBoolean().toBoolean(),
  optionalText('tags', { max: 1000 }),
  optionalText('company', { max: 255 }),
  body('isActive').optional().isBoolean().toBoolean(),
];

/** legacy: MusicController `?@=tracks` / `?@=deleteTracks`. */
export const musicTrackRules = [
  body('tracks').isArray({ min: 1 }).withMessage('"tracks" must be a non-empty array'),
  body('tracks.*.title').optional().isString().trim().isLength({ max: 255 }),
  body('tracks.*.file').isString().trim().notEmpty().withMessage('Each track needs a "file"'),
  body('tracks.*.image').optional({ values: 'falsy' }).isString().trim(),
  body('tracks.*.duration').optional().isInt({ min: 0 }).toInt(),
  body('tracks.*.order').optional().isInt({ min: 0 }).toInt(),
];

/* ---------------------------------------------------------- taxonomies --- */

export const categoryWriteRules = [
  requiredText('nameFa', { max: 255 }),
  optionalText('nameEn', { max: 255 }),
  optionalText('icon', { max: 255 }),
  optionalText('style', { max: 64 }),
  body('isActive').optional().isBoolean().toBoolean(),
];

export const genreWriteRules = [
  requiredText('nameFa', { max: 255 }),
  optionalText('nameEn', { max: 255 }),
  optionalText('colorClass', { max: 64 }),
  body('isActive').optional().isBoolean().toBoolean(),
];

/**
 * The music taxonomy. No `colorClass`: that field colours the FILM genre chips
 * in the legacy UI, and music genres are not rendered on the passenger site.
 */
export const musicGenreWriteRules = [
  requiredText('nameFa', { max: 255 }),
  optionalText('nameEn', { max: 255 }),
  body('isActive').optional().isBoolean().toBoolean(),
];

/* --------------------------------------------------------------- games --- */

/** An optional `#rgb` / `#rrggbb` colour. Blank falls back to the default. */
const optionalHexColor = (field) =>
  body(field)
    .optional({ values: 'falsy' })
    .isString()
    .trim()
    .matches(HEX_COLOR_PATTERN)
    .withMessage(`"${field}" must be a hex colour such as #1a2b3c`);

/**
 * The fields of a game an operator edits. New — the legacy application had no
 * games; the field set is Playva's upload form (`titleFa`, `genre`, `emoji`,
 * `color1`, `color2`), plus this codebase's `isActive`.
 *
 * `gameUrl` and `clicks` are NOT writable: the first is set by unpacking a
 * bundle and the second by passengers opening the game. The service drops them
 * even if they are sent (services/admin/game.service.js pickGameFields).
 */
const gameFieldRules = [
  requiredText('titleFa', { max: 255 }),
  requiredObjectId('genre'),
  // Sixteen code points is room for the longest emoji sequence in use — a
  // family or a flag is several joined together — and too short for a sentence.
  body('emoji')
    .optional({ values: 'falsy' })
    .isString()
    .trim()
    .isLength({ max: 16 })
    .withMessage('"emoji" must be a single emoji'),
  optionalHexColor('color1'),
  optionalHexColor('color2'),
  body('isActive').optional().isBoolean().toBoolean(),
];

/**
 * Creating a game. These arrive as multipart TEXT parts beside the ZIP, so the
 * chains run after multer and `isActive` is the string 'true' until coerced.
 *
 * `folderName` is optional, as in Playva: left out, it is derived from the
 * archive's file name. Given, it must already be in the allowed alphabet — it is
 * stored exactly as typed and becomes part of the game's URL.
 */
export const gameCreateRules = [
  ...gameFieldRules,
  body('folderName')
    .optional({ values: 'falsy' })
    .isString()
    .trim()
    .matches(GAME_FOLDER_NAME_PATTERN)
    .withMessage('"folderName" may contain Latin letters, digits, hyphens and underscores only (64 at most)'),
];

/** Editing one. The folder name is fixed once the bundle has been unpacked. */
export const gameUpdateRules = gameFieldRules;

export const gameListRules = [
  textFilter('titleFa'),
  textFilter('folderName'),
  query('genre').optional().isMongoId(),
  statusFilter,
];

/** The game taxonomy. Two names and nothing else, like the music one. */
export const gameGenreWriteRules = [
  requiredText('nameFa', { max: 255 }),
  optionalText('nameEn', { max: 255 }),
  body('isActive').optional().isBoolean().toBoolean(),
];

export const ageRangeWriteRules = [
  requiredText('nameFa', { max: 255 }),
  optionalText('nameEn', { max: 255 }),
  optionalLongText('description', { max: 2000 }),
  body('isActive').optional().isBoolean().toBoolean(),
];

export const countryWriteRules = [
  requiredText('countryCode', { max: 8 }),
  requiredText('countryFa', { max: 255 }),
  optionalText('countryEn', { max: 255 }),
  body('isActive').optional().isBoolean().toBoolean(),
];

/** Membership of a movie/music in a category. legacy: `?@=add` / `?@=remove`. */
export const relationWriteRules = [requiredObjectId('category'), requiredObjectId('item')];

/* ------------------------------------------------------------- banners --- */

export const bannerWriteRules = [
  optionalText('titleFa', { max: 255 }),
  optionalText('titleEn', { max: 255 }),
  optionalText('subtitleFa', { max: 255 }),
  optionalText('subtitleEn', { max: 255 }),
  optionalText('labelFa', { max: 128 }),
  optionalText('labelEn', { max: 128 }),
  body('url').optional({ values: 'falsy' }).isString().trim().isLength({ max: 2000 }),
  body('isActive').optional().isBoolean().toBoolean(),
];

export const bannerCategoryWriteRules = [
  requiredText('name', { max: 255 }),
  optionalLongText('description', { max: 2000 }),
  // The AVAILABLE list, not the schema enum: 'full' is retired, so an existing
  // category may still hold it but nothing may be set to it. A category still
  // typed 'full' therefore has to be given a new type before it can be saved
  // from the panel, which is the intended prompt.
  body('type')
    .optional()
    .isIn(BANNER_CATEGORY_TYPES_AVAILABLE)
    .withMessage(`"type" must be one of: ${BANNER_CATEGORY_TYPES_AVAILABLE.join(', ')}`),
  body('isActive').optional().isBoolean().toBoolean(),
];

/* ------------------------------------------------------ advertisements --- */

/**
 * Pre-roll creatives. New — the legacy ads were XML files, so there is no form
 * to derive a field set from; these are the VAST elements the tag needs.
 *
 * `videoPath` and `durationSecond` are NOT writable here. Both are set by the
 * upload endpoint from the file itself, so a save of the surrounding form can
 * neither blank the creative nor claim a length the file does not have.
 */
export const videoAdWriteRules = [
  requiredText('titleFa', { max: 255, label: 'عنوان تبلیغ' }),
  optionalText('titleEn', { max: 255 }),
  body('skipOffsetSecond')
    .optional({ values: 'falsy' })
    // Bounded at five minutes: a skip offset longer than the creative simply
    // means "unskippable", and anything past that is a typo.
    .isInt({ min: 0, max: 300 })
    .withMessage('"skipOffsetSecond" must be between 0 and 300')
    .toInt(),
  body('weight')
    .optional({ values: 'falsy' })
    .isInt({ min: 0, max: 1000 })
    .withMessage('"weight" must be between 0 and 1000')
    .toInt(),
  body('clickUrl').optional({ values: 'falsy' }).isString().trim().isLength({ max: 2000 }),
  body('isActive').optional().isBoolean().toBoolean(),
];

/** Landing-page slot ads. Artwork arrives through the two upload endpoints. */
export const placementAdWriteRules = [
  optionalText('titleFa', { max: 255 }),
  body('placement')
    .isIn(AD_PLACEMENTS)
    .withMessage(`"placement" must be one of: ${AD_PLACEMENTS.join(', ')}`),
  body('url').optional({ values: 'falsy' }).isString().trim().isLength({ max: 2000 }),
  optionalNonNegativeInt('order', { max: 10_000 }),
  body('isActive').optional().isBoolean().toBoolean(),
];

/** List filters for the placement-ad grid. */
export const placementAdListRules = [
  textFilter('titleFa'),
  query('placement').optional().isIn(AD_PLACEMENTS),
  statusFilter,
];

/**
 * The duration the browser measured on the selected file, sent with the upload.
 *
 * Optional: a container the browser cannot probe yields `NaN`, and refusing the
 * upload over a missing metadata field would be worse than storing zero and
 * letting the operator correct it. Bounded at an hour — a pre-roll is not a
 * feature film, and an absurd value would otherwise reach the VAST `<Duration>`.
 */
export const videoAdUploadRules = [
  body('durationSecond')
    .optional({ values: 'falsy' })
    .isFloat({ min: 0, max: 3600 })
    .withMessage('"durationSecond" must be between 0 and 3600')
    .toFloat(),
];

/** legacy: BannerController `?@=order`. */
export const bannerReorderRules = [
  requiredObjectId('bannerCategory'),
  body('entries').isArray({ min: 1 }).withMessage('"entries" must be a non-empty array'),
  body('entries.*.bannerId').isMongoId().withMessage('Each entry needs a valid "bannerId"'),
  body('entries.*.orderIndex').isInt({ min: 0 }).withMessage('Each entry needs "orderIndex"').toInt(),
];

/* --------------------------------------------------------------- pages --- */

export const pageWriteRules = [
  requiredText('titleFa', { max: 255 }),
  optionalText('titleEn', { max: 255 }),
  optionalLongText('descriptionFa'),
  optionalLongText('descriptionEn'),
  optionalText('tags', { max: 1000 }),
  body('slug')
    .optional({ values: 'falsy' })
    .isString()
    .trim()
    .matches(/^[a-z0-9-]+$/)
    .withMessage('"slug" may contain lowercase letters, digits and hyphens only')
    .isLength({ max: 100 }),
  body('isActive').optional().isBoolean().toBoolean(),
];

/**
 * legacy: PageBlockController `?@=create|update`.
 * itemSort/sortType are whitelisted here AND by the model enum — this is the
 * column the legacy code interpolated into the rail query unvalidated.
 */
export const pageBlockWriteRules = [
  requiredObjectId('page'),
  body('itemType')
    .isIn(['banner', 'category', 'music'])
    .withMessage('"itemType" must be banner, category or music'),
  requiredObjectId('itemId'),
  body('itemOrder').optional().isInt({ min: 0 }).toInt(),
  body('itemSort')
    .optional()
    .isIn(BLOCK_SORT_FIELDS)
    .withMessage(`"itemSort" must be one of: ${BLOCK_SORT_FIELDS.join(', ')}`),
  body('sortType').optional().toUpperCase().isIn(['ASC', 'DESC']),
  body('isActive').optional().isBoolean().toBoolean(),
];

/** legacy: PageBlockController `?@=order`. */
export const blockReorderRules = [
  body('entries').isArray({ min: 1 }).withMessage('"entries" must be a non-empty array'),
  body('entries.*.id').isMongoId().withMessage('Each entry needs a valid "id"'),
  body('entries.*.itemOrder').isInt({ min: 0 }).withMessage('Each entry needs "itemOrder"').toInt(),
];

/* --------------------------------------------------------------- users --- */

export const userCreateRules = [
  body('mobile')
    .isString()
    .trim()
    .isLength({ min: 10, max: 20 })
    .withMessage('"mobile" must be a valid mobile number'),
  body('password')
    .isString()
    .isLength({ min: 6 })
    .withMessage('"password" must be at least 6 characters'),
  optionalText('firstname', { max: 128 }),
  optionalText('lastname', { max: 128 }),
  optionalText('displayName', { max: 128 }),
  body('email').optional({ values: 'falsy' }).isEmail().withMessage('"email" must be valid').normalizeEmail(),
  // `birthDate` is deliberately absent: the users panel no longer collects it.
  // The schema field is kept so values carried over from the legacy database
  // are not destroyed — see services/admin/user.service.js.
  optionalLongText('comment', { max: 2000 }),
  optionalObjectId('permissionGroup'),
  body('categories').optional().isArray(),
  body('categories.*').isMongoId().withMessage('"categories" must contain valid ids'),
  body('isActive').optional().isBoolean().toBoolean(),
];

/** Same as create, but the password is optional — omit it to leave it alone. */
export const userUpdateRules = [
  body('mobile').optional().isString().trim().isLength({ min: 10, max: 20 }),
  body('password').optional({ values: 'falsy' }).isString().isLength({ min: 6 }),
  ...userCreateRules.slice(2),
];

export const userListRules = [
  textFilter('mobile'),
  textFilter('displayName'),
  statusFilter,
  query('permissionGroup').optional().isMongoId(),
];

export const userCategoryWriteRules = [
  requiredText('name', { max: 255 }),
  optionalLongText('description', { max: 2000 }),
  optionalText('topicName', { max: 128 }),
  body('isActive').optional().isBoolean().toBoolean(),
];

/* --------------------------------------------------------- permissions --- */

/**
 * A group is written either as `grants` — the section x action matrix the group
 * editor submits — or as `permissions`, the raw id array the collection stores.
 * `grants` wins when both are present; the service resolves it into ids
 * (services/admin/permissionGrant.service.js).
 */
export const permissionGroupWriteRules = [
  requiredText('name', { max: 255 }),
  body('permissions').optional().isArray(),
  body('permissions.*').isMongoId().withMessage('"permissions" must contain valid ids'),
  body('grants')
    .optional()
    .isObject()
    .withMessage('"grants" must be an object keyed by section')
    .bail()
    .custom((grants) => {
      for (const [page, actions] of Object.entries(grants)) {
        if (!PERMISSION_PAGES.includes(page)) {
          throw new Error(`"grants" contains an unknown section "${page}"`);
        }
        if (actions === null || typeof actions !== 'object' || Array.isArray(actions)) {
          throw new Error(`"grants.${page}" must be an object of actions`);
        }
        for (const [action, value] of Object.entries(actions)) {
          if (!PERMISSION_ACTIONS.includes(action)) {
            throw new Error(`"grants.${page}" contains an unknown action "${action}"`);
          }
          if (typeof value !== 'boolean') {
            throw new Error(`"grants.${page}.${action}" must be a boolean`);
          }
        }
      }
      return true;
    }),
  body('isActive').optional().isBoolean().toBoolean(),
];

export const accessPermissionWriteRules = [
  requiredText('displayName', { max: 255 }),
  body('actionPage')
    .isIn(PERMISSION_PAGES)
    .withMessage(`"actionPage" must be one of: ${PERMISSION_PAGES.join(', ')}`),
  body('actionView').optional().isBoolean().toBoolean(),
  body('actionEdit').optional().isBoolean().toBoolean(),
  body('actionDelete').optional().isBoolean().toBoolean(),
  // The panel's form has always sent this; it reached the document only because
  // writes used to take the whole body. Now that a field needs a rule to be
  // written (controllers/admin/crud.controller.js declaredBody), it has one.
  body('isActive').optional().isBoolean().toBoolean(),
];

/* --------------------------------------------------------------- polls --- */

export const pollWriteRules = [
  requiredText('questionFa', { max: 500 }),
  optionalText('questionEn', { max: 500 }),
  body('order').optional().isInt({ min: 0 }).toInt(),
  body('isActive').optional().isBoolean().toBoolean(),
];

/**
 * The two switches on the CSV importer. They arrive as multipart TEXT parts, so
 * they are the strings 'true'/'false' until `toBoolean` runs — which is why the
 * controller compares against `true` and not a truthy value.
 */
export const pollImportRules = [
  body('dryRun').optional().isBoolean().toBoolean(),
  body('skipInvalid').optional().isBoolean().toBoolean(),
];

/* -------------------------------------------------------- placeholders --- */

/**
 * The slot a fallback image belongs to.
 *
 * Checked BEFORE multer runs on the upload route, unlike every other upload
 * here: `:slot` is a path segment and needs no body parsing, so rejecting a
 * wrong one first avoids writing a file that nothing will ever reference. The
 * id-carrying upload routes cannot do that — a bad id is only discovered once
 * the record is looked up, which is after the bytes have landed.
 */
export const placeholderSlotRules = [
  param('slot')
    .isIn(PLACEHOLDER_SLOT_KEYS)
    .withMessage(`"slot" must be one of: ${PLACEHOLDER_SLOT_KEYS.join(', ')}`),
];

/* ------------------------------------------------------------ branding --- */

/**
 * The landing-page copy. Derived from BRANDING_TEXT_FIELDS so a field added
 * there is validated here without a second edit — the length limits in
 * particular live in one place, and the admin form shows the same numbers.
 *
 * Every field is OPTIONAL and every field may be EMPTY. Empty is meaningful: it
 * clears the stored text and restores the shipped default (services/branding).
 * `trim()` before the length check, so trailing whitespace cannot push a value
 * over the limit.
 */
export const brandingWriteRules = BRANDING_TEXT_FIELDS.map((field) =>
  body(field.key)
    .optional()
    .isString()
    .withMessage(`"${field.key}" must be a string`)
    .trim()
    .isLength({ max: field.maxLength })
    .withMessage(`"${field.key}" must be at most ${field.maxLength} characters`),
);

/** The passenger site's colour theme (SITE_THEMES). Required: it is the whole request. */
export const brandingThemeRules = [
  body('theme')
    .exists({ values: 'falsy' })
    .withMessage('"theme" is required')
    .bail()
    .isIn(SITE_THEME_KEYS)
    .withMessage(`"theme" must be one of: ${SITE_THEME_KEYS.join(', ')}`),
];

/** The MP4/HLS switch (services/videoSettings.service.js). Required: it is the whole request. */
export const videoSettingsWriteRules = [
  body('transcodeEnabled')
    .exists({ values: 'null' })
    .withMessage('"transcodeEnabled" is required')
    .bail()
    .isBoolean({ strict: true })
    .withMessage('"transcodeEnabled" must be true or false')
    .toBoolean(),
];

export default {
  movieWriteRules,
  movieListRules,
  movieVideoUploadRules,
  movieVideoLinkRules,
  castWriteRules,
  movieCastWriteRules,
  musicWriteRules,
  musicTrackRules,
  categoryWriteRules,
  genreWriteRules,
  musicGenreWriteRules,
  gameCreateRules,
  gameUpdateRules,
  gameListRules,
  gameGenreWriteRules,
  ageRangeWriteRules,
  countryWriteRules,
  relationWriteRules,
  bannerWriteRules,
  bannerCategoryWriteRules,
  bannerReorderRules,
  videoAdWriteRules,
  videoAdUploadRules,
  placementAdWriteRules,
  placementAdListRules,
  pageWriteRules,
  pageBlockWriteRules,
  blockReorderRules,
  userCreateRules,
  userUpdateRules,
  userListRules,
  userCategoryWriteRules,
  permissionGroupWriteRules,
  accessPermissionWriteRules,
  pollWriteRules,
  pollImportRules,
  placeholderSlotRules,
  brandingWriteRules,
  brandingThemeRules,
  videoSettingsWriteRules,
};
