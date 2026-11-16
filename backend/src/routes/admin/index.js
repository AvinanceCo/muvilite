/**
 * Admin API router.
 *
 * Purpose: mount every admin endpoint behind authentication, and each one
 *          behind the permission its section requires.
 * Inputs:  none
 * Outputs: an Express router
 * Deps:    controllers/admin/*, services/admin/registry, middleware/*
 *
 * Everything below `/api/admin` requires a valid token AND membership of a
 * permission group. The legacy panel's only gate was a session check inside
 * view files, which the `?@=`-dispatched controllers bypassed entirely.
 */
import { Router } from 'express';
import authRoutes from './auth.routes.js';
import createResourceRouter from './resource.routes.js';
import { createCrudController } from '../../controllers/admin/crud.controller.js';
import * as ops from '../../controllers/admin/operations.controller.js';
import * as registry from '../../services/admin/registry.js';
import { authenticate, requireAdmin } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/permission.js';
import validate from '../../middleware/validate.js';
import {
  uploadImage,
  uploadAudio,
  uploadVideo,
  uploadMovieVideoFile,
  uploadCsv,
  uploadGameZip,
  requireFile,
  UPLOAD_DIRS,
} from '../../middleware/upload.js';
import {
  objectIdParam,
  paginationQuery,
  sortQuery,
} from '../../validators/common.validators.js';
import { statusRules } from '../../validators/common.write.validators.js';
import {
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
} from '../../validators/admin.validators.js';
import { body } from 'express-validator';

const router = Router();

// Sign-in is the only unauthenticated admin route; the rest of this file is
// mounted after the guards below.
router.use('/auth', authRoutes);

router.use(authenticate, requireAdmin);

/* ------------------------------------------- entity CRUD (the common case) --- */

const resources = [
  { path: '/movies', page: 'movies', service: registry.movieService, create: movieWriteRules, update: movieWriteRules, list: movieListRules },
  { path: '/casts', page: 'casts', service: registry.castService, create: castWriteRules, update: castWriteRules },
  { path: '/musics', page: 'musics', service: registry.musicService, create: musicWriteRules, update: musicWriteRules },
  { path: '/categories', page: 'categories', service: registry.categoryService, create: categoryWriteRules, update: categoryWriteRules },
  { path: '/music-categories', page: 'categories', service: registry.musicCategoryService, create: categoryWriteRules, update: categoryWriteRules },
  { path: '/genres', page: 'genres', service: registry.genreService, create: genreWriteRules, update: genreWriteRules },
  // The music taxonomy — a separate collection from /genres, but guarded by
  // the same permission, so no installation has to re-seed to reach it.
  { path: '/music-genres', page: 'genres', service: registry.musicGenreService, create: musicGenreWriteRules, update: musicGenreWriteRules },
  // HTML5 games and their genre list — a new section with no legacy ancestor.
  // POST /games never reaches this router: the multipart upload route declared
  // below claims it first, because a game is created from its ZIP.
  { path: '/games', page: 'games', service: registry.gameService, update: gameUpdateRules, list: gameListRules },
  { path: '/game-genres', page: 'games', service: registry.gameGenreService, create: gameGenreWriteRules, update: gameGenreWriteRules },
  { path: '/age-ranges', page: 'age-ranges', service: registry.ageRangeService, create: ageRangeWriteRules, update: ageRangeWriteRules },
  { path: '/countries', page: 'age-ranges', service: registry.countryService, create: countryWriteRules, update: countryWriteRules },
  { path: '/banners', page: 'banners', service: registry.bannerService, create: bannerWriteRules, update: bannerWriteRules },
  { path: '/banner-categories', page: 'banners', service: registry.bannerCategoryService, create: bannerCategoryWriteRules, update: bannerCategoryWriteRules },
  { path: '/video-ads', page: 'ads', service: registry.videoAdService, create: videoAdWriteRules, update: videoAdWriteRules },
  { path: '/placement-ads', page: 'ads', service: registry.placementAdService, create: placementAdWriteRules, update: placementAdWriteRules, list: placementAdListRules },
  { path: '/pages', page: 'pages', service: registry.pageService, create: pageWriteRules, update: pageWriteRules },
  { path: '/page-blocks', page: 'blocks', service: registry.pageBlockService, create: pageBlockWriteRules, update: pageBlockWriteRules },
  { path: '/user-categories', page: 'users', service: registry.userCategoryService, create: userCategoryWriteRules, update: userCategoryWriteRules },
  { path: '/permission-groups', page: 'groups', service: registry.permissionGroupService, create: permissionGroupWriteRules, update: permissionGroupWriteRules },
  { path: '/access-permissions', page: 'groups', service: registry.accessPermissionService, create: accessPermissionWriteRules, update: accessPermissionWriteRules },
  { path: '/polls', page: 'pages', service: registry.pollService, create: pollWriteRules, update: pollWriteRules },
];

/**
 * Routes that must be matched BEFORE the generic `/:id` handlers, or a literal
 * path segment like `/export` would be read as an id.
 */

// -- movies ------------------------------------------------------------------
router.get('/movies/export', requirePermission('movies', 'view'), ops.exportMoviesXlsx);
// Read-only view of the MP4/HLS switch for whoever uploads a film; the switch
// itself lives under /settings/video.
router.get('/movies/video-settings', requirePermission('movies', 'view'), ops.getVideoSettings);
router.get(
  '/movies/:id/casts',
  requirePermission('movies', 'view'),
  validate([objectIdParam()]),
  ops.getMovieCasts,
);
router.get(
  '/movies/:id/categories',
  requirePermission('movies', 'view'),
  validate([objectIdParam()]),
  ops.getMovieCategories,
);
router.post(
  '/movies/:id/poster',
  requirePermission('movies', 'edit'),
  uploadImage(UPLOAD_DIRS.movies, 'poster'),
  requireFile,
  validate([objectIdParam()]),
  ops.uploadMoviePoster,
);
// The catalog's video, in its three forms. New: the legacy player derived the
// URL from the row id, so files arrived over FTP and nothing in the panel could
// attach one. POST takes a file, PUT an external link — both end up in
// `videoPath`, so setting either replaces the other. An uploaded file, in any
// container ffmpeg reads, is transcoded to HLS in the background first — or,
// with `?mode=mp4` (or the switch set to MP4), published as it is; GET
// reports how far that has got, and /retry re-runs a failed one.
router.get(
  '/movies/:id/video',
  requirePermission('movies', 'view'),
  validate([objectIdParam()]),
  ops.getMovieVideoStatus,
);
router.post(
  '/movies/:id/video',
  requirePermission('movies', 'edit'),
  uploadMovieVideoFile(UPLOAD_DIRS.movies, 'video', ops.resolveVideoTranscode),
  requireFile,
  validate([objectIdParam(), ...movieVideoUploadRules]),
  ops.uploadMovieVideo,
);
router.post(
  '/movies/:id/video/retry',
  requirePermission('movies', 'edit'),
  validate([objectIdParam()]),
  ops.retryMovieVideo,
);
router.put(
  '/movies/:id/video',
  requirePermission('movies', 'edit'),
  validate([objectIdParam(), ...movieVideoLinkRules]),
  ops.setMovieVideoLink,
);
router.delete(
  '/movies/:id/video',
  requirePermission('movies', 'edit'),
  validate([objectIdParam()]),
  ops.removeMovieVideo,
);
router.post('/movie-casts', requirePermission('movies', 'edit'), validate(movieCastWriteRules), ops.addMovieCast);
router.delete('/movie-casts', requirePermission('movies', 'delete'), validate(movieCastWriteRules), ops.removeMovieCast);
router.post('/movie-categories', requirePermission('categories', 'edit'), validate(relationWriteRules), ops.addMovieCategory);
router.delete('/movie-categories', requirePermission('categories', 'delete'), validate(relationWriteRules), ops.removeMovieCategory);

// -- category content --------------------------------------------------------
// What is *inside* a category, the inverse of /movies/:id/categories. The
// legacy admin had this grid (views/categories/content.php); the public
// endpoint of the same shape hides deactivated items, so it cannot serve it.
router.get(
  '/categories/:id/movies',
  requirePermission('categories', 'view'),
  validate([objectIdParam(), ...paginationQuery, ...sortQuery]),
  ops.getCategoryMovies,
);
router.get(
  '/music-categories/:id/musics',
  requirePermission('categories', 'view'),
  validate([objectIdParam(), ...paginationQuery, ...sortQuery]),
  ops.getMusicCategoryItems,
);

// -- casts -------------------------------------------------------------------
router.post(
  '/casts/:id/photo',
  requirePermission('casts', 'edit'),
  uploadImage(UPLOAD_DIRS.casts, 'photo'),
  requireFile,
  validate([objectIdParam()]),
  ops.uploadCastPhoto,
);

// -- music -------------------------------------------------------------------
router.get(
  '/musics/:id/categories',
  requirePermission('musics', 'view'),
  validate([objectIdParam()]),
  ops.getMusicCategories,
);
router.post(
  '/musics/:id/cover',
  requirePermission('musics', 'edit'),
  uploadImage(UPLOAD_DIRS.musics, 'cover'),
  requireFile,
  validate([objectIdParam()]),
  ops.uploadMusicCover,
);
router.post(
  '/musics/:id/track-files',
  requirePermission('musics', 'edit'),
  uploadAudio(UPLOAD_DIRS.musics, 'files'),
  requireFile,
  validate([objectIdParam()]),
  ops.uploadMusicTrackFiles,
);
router.put(
  '/musics/:id/tracks',
  requirePermission('musics', 'edit'),
  validate([objectIdParam(), ...musicTrackRules]),
  ops.putMusicTracks,
);
router.post('/music-categories-items', requirePermission('categories', 'edit'), validate(relationWriteRules), ops.addMusicCategory);
router.delete('/music-categories-items', requirePermission('categories', 'delete'), validate(relationWriteRules), ops.removeMusicCategory);

// -- games -------------------------------------------------------------------
// New section. A game is a ZIP of static files, so creating one IS the upload:
// the archive and the form fields arrive in one multipart request, and nothing
// is written unless the bundle unpacks. Declared ahead of the generic `/games`
// router, which would otherwise answer this POST with its JSON create.
router.post(
  '/games',
  requirePermission('games', 'edit'),
  uploadGameZip('zip'),
  requireFile,
  // After multer, so the multipart text parts exist and are coerced here.
  validate(gameCreateRules),
  ops.createGame,
);
// A new build for a game that already exists — its record, and its click count,
// stay; only the files change.
router.post(
  '/games/:id/bundle',
  requirePermission('games', 'edit'),
  uploadGameZip('zip'),
  requireFile,
  validate([objectIdParam()]),
  ops.replaceGameBundle,
);

// -- banners -----------------------------------------------------------------
router.patch(
  '/banners/order',
  requirePermission('banners', 'edit'),
  validate(bannerReorderRules),
  ops.reorderBanners,
);
router.post(
  '/banners/:id/image',
  requirePermission('banners', 'edit'),
  uploadImage(UPLOAD_DIRS.banners, 'image'),
  requireFile,
  validate([objectIdParam()]),
  ops.uploadBannerImage,
);
router.get(
  '/banner-categories/:id/banners',
  requirePermission('banners', 'view'),
  validate([objectIdParam()]),
  ops.getCategoryBanners,
);
router.post(
  '/banner-category-items',
  requirePermission('banners', 'edit'),
  validate([
    body('bannerCategory').isMongoId(),
    body('banner').isMongoId(),
    body('orderIndex').optional().isInt({ min: 0 }).toInt(),
  ]),
  ops.addCategoryBanner,
);
router.delete(
  '/banner-category-items',
  requirePermission('banners', 'delete'),
  validate([body('bannerCategory').isMongoId(), body('banner').isMongoId()]),
  ops.removeCategoryBanner,
);

// -- advertisements ----------------------------------------------------------
// New section. The legacy panel managed no ads: pre-roll creatives were VAST
// files uploaded over FTP and the landing-page slots were hardcoded markup.
router.post(
  '/video-ads/:id/video',
  requirePermission('ads', 'edit'),
  uploadVideo(UPLOAD_DIRS.ads, 'video'),
  requireFile,
  // Runs after multer, so the multipart text field is parsed and coerced here.
  validate([objectIdParam(), ...videoAdUploadRules]),
  ops.uploadVideoAdFile,
);
router.post(
  '/placement-ads/:id/image',
  requirePermission('ads', 'edit'),
  uploadImage(UPLOAD_DIRS.ads, 'image'),
  requireFile,
  validate([objectIdParam()]),
  ops.uploadPlacementAdImage,
);
// The landscape variant is a second file, not a second record: the legacy slot
// carried both anchors and the stylesheet chose between them by orientation.
router.post(
  '/placement-ads/:id/landscape-image',
  requirePermission('ads', 'edit'),
  uploadImage(UPLOAD_DIRS.ads, 'image'),
  requireFile,
  validate([objectIdParam()]),
  ops.uploadPlacementAdLandscapeImage,
);

// -- pages and blocks --------------------------------------------------------
router.patch(
  '/page-blocks/order',
  requirePermission('blocks', 'edit'),
  validate(blockReorderRules),
  ops.reorderBlocks,
);
// The page composer in one request: blocks in display order, each with its
// target resolved. Legacy views/pages/content.php walked these client-side.
router.get(
  '/pages/:id/blocks',
  requirePermission('pages', 'view'),
  validate([objectIdParam()]),
  ops.getPageBlocks,
);

// -- polls -------------------------------------------------------------------
// Bulk import. Must be declared before the generic `/polls` router is mounted,
// alongside the other literal segments above, and it needs `pages`/edit — the
// same permission creating one question by hand does.
router.post(
  '/polls/import',
  requirePermission('pages', 'edit'),
  uploadCsv('file'),
  requireFile,
  // After multer, so the multipart text parts exist and are coerced here.
  validate(pollImportRules),
  ops.importPolls,
);

/* ------------------------------------------------------- placeholders --- */

// New section. The legacy fallback images were files that shipped with the
// theme (see PLACEHOLDER_SLOTS in config/constants.js); nothing in the panel
// could change them. Keyed by slot rather than by id — the set is fixed, so
// there is no record to create first and no `/:id` router to sit in front of.
router.get('/placeholders', requirePermission('placeholders', 'view'), ops.getPlaceholders);
router.post(
  '/placeholders/:slot/image',
  requirePermission('placeholders', 'edit'),
  // Validation runs BEFORE multer here, unlike every other upload: `:slot` is a
  // path segment, so an unknown one is rejected without first writing a file
  // that nothing would ever reference.
  validate(placeholderSlotRules),
  uploadImage(UPLOAD_DIRS.placeholders, 'image'),
  requireFile,
  ops.uploadPlaceholderImage,
);
router.delete(
  '/placeholders/:slot',
  requirePermission('placeholders', 'delete'),
  validate(placeholderSlotRules),
  ops.removePlaceholderImage,
);

/* ------------------------------------------------------------ settings --- */
// Installation-wide switches. New: the legacy panel had no settings screen.
// Today one: whether an uploaded film/clip is transcoded to HLS or kept as MP4.
router.get('/settings/video', requirePermission('settings', 'view'), ops.getVideoSettings);
router.put(
  '/settings/video',
  requirePermission('settings', 'edit'),
  validate(videoSettingsWriteRules),
  ops.updateVideoSettings,
);

/* ------------------------------------------------------------ branding --- */

// New section. The customer logo in the footer was a theme file and the
// landing-page heading and sentence were literals in index.php; nothing in the
// panel could change either. One singleton document, so there is no `/:id` — the
// resource IS the installation's branding.
router.get('/branding', requirePermission('branding', 'view'), ops.getBrandingSettings);
router.put(
  '/branding',
  requirePermission('branding', 'edit'),
  validate(brandingWriteRules),
  ops.updateBranding,
);
// The theme saves on its own: picking a colour must not also submit whatever
// half-typed heading is sitting in the text form, and vice versa.
router.patch(
  '/branding/theme',
  requirePermission('branding', 'edit'),
  validate(brandingThemeRules),
  ops.updateBrandingTheme,
);
// The logo is a file, so it moves on its own routes: a text save must not be
// able to null a path whose file is still on disk, and vice versa.
router.post(
  '/branding/logo',
  requirePermission('branding', 'edit'),
  uploadImage(UPLOAD_DIRS.branding, 'image'),
  requireFile,
  ops.uploadBrandingLogo,
);
router.delete('/branding/logo', requirePermission('branding', 'delete'), ops.removeBrandingLogo);

/* -------------------------------------------------------------- users --- */

router.get('/users/export', requirePermission('users', 'view'), ops.exportUsersXlsx);
router.get(
  '/users',
  requirePermission('users', 'view'),
  validate([...paginationQuery, ...sortQuery, ...userListRules]),
  ops.listUsers,
);
router.get('/users/:id', requirePermission('users', 'view'), validate([objectIdParam()]), ops.getUser);
router.post('/users', requirePermission('users', 'edit'), validate(userCreateRules), ops.createUser);
router.put(
  '/users/:id',
  requirePermission('users', 'edit'),
  validate([objectIdParam(), ...userUpdateRules]),
  ops.updateUser,
);
router.patch(
  '/users/:id/status',
  requirePermission('users', 'edit'),
  validate([objectIdParam(), ...statusRules]),
  ops.setUserStatus,
);
router.patch(
  '/users/:id/password',
  requirePermission('users', 'edit'),
  validate([objectIdParam(), body('newPassword').isString().isLength({ min: 6 })]),
  ops.resetUserPassword,
);
router.delete('/users/:id', requirePermission('users', 'delete'), validate([objectIdParam()]), ops.removeUser);

/* ------------------------------------------------- history & reporting --- */

router.get('/watch-history', requirePermission('watch-history', 'view'), ops.getWatchHistory);
router.get('/listen-history', requirePermission('watch-history', 'view'), ops.getListenHistory);
router.get('/ads-history', requirePermission('watch-history', 'view'), ops.getAdsHistory);
router.get('/watch-trends', requirePermission('watch-history', 'view'), ops.getWatchTrends);
router.get('/poll-history', requirePermission('pages', 'view'), ops.getPollHistory);
router.get('/poll-summary', requirePermission('pages', 'view'), ops.getPollSummary);
router.get('/user-logs', requirePermission('user-logs', 'view'), ops.getUserLogs);

/* ----------------------------------------------- generic CRUD mounting --- */

for (const resource of resources) {
  router.use(
    resource.path,
    createResourceRouter({
      page: resource.page,
      controller: createCrudController(resource.service),
      createRules: resource.create,
      updateRules: resource.update,
      listRules: resource.list ?? [],
    }),
  );
}

export default router;
