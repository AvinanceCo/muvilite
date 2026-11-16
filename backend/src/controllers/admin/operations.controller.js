/**
 * Admin operation controllers.
 *
 * Purpose: the endpoints that are not plain CRUD — relation management, media
 *          attachment, ordering, history reads and spreadsheet export.
 * Inputs:  Express req/res
 * Outputs: JSON responses, or an .xlsx stream for the exports
 * Deps:    services/admin/*, repositories, utils/*
 */
import * as relations from '../../services/admin/relation.service.js';
import * as attachments from '../../services/admin/attachment.service.js';
import * as movieVideo from '../../services/admin/movieVideo.service.js';
import * as videoSettings from '../../services/videoSettings.service.js';
import * as games from '../../services/admin/game.service.js';
import * as history from '../../services/admin/history.service.js';
import * as pollImport from '../../services/admin/pollImport.service.js';
import * as placeholders from '../../services/placeholder.service.js';
import * as branding from '../../services/branding.service.js';
import * as exports_ from '../../services/admin/export.service.js';
import * as adminUsers from '../../services/admin/user.service.js';
import * as pages from '../../services/page.service.js';
import { toPublicPath } from '../../services/media.service.js';
import { bannerRepository, pageBlockRepository } from '../../repositories/index.js';
import { sendSuccess, sendCreated } from '../../utils/apiResponse.js';
import asyncHandler from '../../utils/asyncHandler.js';
import { auditContext, declaredBody } from './crud.controller.js';

/* ----------------------------------------------------------- relations --- */

export const addMovieCategory = asyncHandler(async (req, res) =>
  sendCreated(
    res,
    await relations.addMovieToCategory(req.body.category, req.body.item, auditContext(req)),
  ),
);

export const removeMovieCategory = asyncHandler(async (req, res) =>
  sendSuccess(
    res,
    await relations.removeMovieFromCategory(req.body.category, req.body.item, auditContext(req)),
    { message: 'Removed' },
  ),
);

export const getMovieCategories = asyncHandler(async (req, res) =>
  sendSuccess(res, await relations.listMovieCategories(req.params.id)),
);

export const addMusicCategory = asyncHandler(async (req, res) =>
  sendCreated(
    res,
    await relations.addMusicToCategory(req.body.category, req.body.item, auditContext(req)),
  ),
);

export const removeMusicCategory = asyncHandler(async (req, res) =>
  sendSuccess(
    res,
    await relations.removeMusicFromCategory(req.body.category, req.body.item, auditContext(req)),
    { message: 'Removed' },
  ),
);

export const getMusicCategories = asyncHandler(async (req, res) =>
  sendSuccess(res, await relations.listMusicCategories(req.params.id)),
);

export const addMovieCast = asyncHandler(async (req, res) =>
  sendCreated(
    res,
    await relations.addCastToMovie(req.body.movie, req.body.cast, req.body.role, auditContext(req)),
  ),
);

export const removeMovieCast = asyncHandler(async (req, res) =>
  sendSuccess(
    res,
    await relations.removeCastFromMovie(req.body.movie, req.body.cast, req.body.role, auditContext(req)),
    { message: 'Removed' },
  ),
);

export const getMovieCasts = asyncHandler(async (req, res) =>
  sendSuccess(res, await relations.listMovieCasts(req.params.id)),
);

/**
 * GET /api/admin/categories/:id/movies — legacy views/categories/content.php.
 * Paginated, and includes deactivated titles, as the legacy admin grid did.
 */
export const getCategoryMovies = asyncHandler(async (req, res) => {
  const { category, items, meta } = await relations.listCategoryMovies(req.params.id, req.query);
  return sendSuccess(res, { category, items }, { meta });
});

/** GET /api/admin/music-categories/:id/musics — legacy views/music-categories/content.php */
export const getMusicCategoryItems = asyncHandler(async (req, res) => {
  const { category, items, meta } = await relations.listMusicCategoryItems(req.params.id, req.query);
  return sendSuccess(res, { category, items }, { meta });
});

/**
 * GET /api/admin/pages/:id/blocks — legacy views/pages/content.php + graph.php.
 * Each block carries its resolved target name so the composer is one request.
 */
export const getPageBlocks = asyncHandler(async (req, res) =>
  sendSuccess(res, await pages.getPageBlocksForAdmin(req.params.id)),
);

export const addCategoryBanner = asyncHandler(async (req, res) =>
  sendCreated(
    res,
    await relations.addBannerToCategory(
      req.body.bannerCategory,
      req.body.banner,
      req.body.orderIndex,
      auditContext(req),
    ),
  ),
);

export const removeCategoryBanner = asyncHandler(async (req, res) =>
  sendSuccess(
    res,
    await relations.removeBannerFromCategory(
      req.body.bannerCategory,
      req.body.banner,
      auditContext(req),
    ),
    { message: 'Removed' },
  ),
);

export const getCategoryBanners = asyncHandler(async (req, res) =>
  sendSuccess(res, await relations.listCategoryBanners(req.params.id)),
);

/* ------------------------------------------------------------ ordering --- */

/** PATCH /api/admin/banners/order — legacy BannerController `?@=order` */
export const reorderBanners = asyncHandler(async (req, res) => {
  await bannerRepository.reorder(req.body.bannerCategory, req.body.entries);
  return sendSuccess(res, { reordered: req.body.entries.length }, { message: 'Order updated' });
});

/** PATCH /api/admin/page-blocks/order — legacy PageBlockController `?@=order` */
export const reorderBlocks = asyncHandler(async (req, res) => {
  await pageBlockRepository.reorder(req.body.entries);
  return sendSuccess(res, { reordered: req.body.entries.length }, { message: 'Order updated' });
});

/* ---------------------------------------------------------- attachments --- */

export const uploadMoviePoster = asyncHandler(async (req, res) =>
  sendSuccess(res, await attachments.attachMoviePoster(req.params.id, req.file, auditContext(req)), {
    message: 'Poster uploaded',
  }),
);

/**
 * GET    /api/admin/movies/:id/video        — transcode status, for polling
 * POST   /api/admin/movies/:id/video        — a file, multipart field `video`;
 *                                             answers once it is QUEUED for HLS
 * POST   /api/admin/movies/:id/video/retry  — re-run a failed transcode
 * PUT    /api/admin/movies/:id/video        — an external link, JSON `{ url }`
 * DELETE /api/admin/movies/:id/video        — clear it
 *
 * An upload is measured by the server's ffprobe; a link by the browser, whose
 * numbers arrive with it. `services/admin/movieVideo.service.js` is explicit
 * about what each check is worth.
 */
export const getMovieVideoStatus = asyncHandler(async (req, res) =>
  sendSuccess(res, await movieVideo.getMovieVideoStatus(req.params.id)),
);

export const uploadMovieVideo = asyncHandler(async (req, res) => {
  // `req.videoTranscode` was decided by the upload middleware before the file
  // was read: the upload's own `?mode=`, or the MP4/HLS switch.
  const transcode = req.videoTranscode !== false;
  const movie = await movieVideo.attachMovieVideoFile(req.params.id, req.file, req.body, auditContext(req), {
    transcode,
  });
  sendSuccess(res, movie, { message: transcode ? 'Video uploaded; transcoding queued' : 'Video uploaded' });
});

/**
 * GET /api/admin/settings/video          settings/view
 * PUT /api/admin/settings/video          settings/edit — `{ transcodeEnabled }`
 * GET /api/admin/movies/video-settings   movies/view — the same answer, read-only,
 *     so whoever uploads a film knows which files the upload will take without
 *     needing access to the settings screen.
 */
export const getVideoSettings = asyncHandler(async (_req, res) =>
  sendSuccess(res, await videoSettings.getVideoSettings()),
);

export const updateVideoSettings = asyncHandler(async (req, res) =>
  sendSuccess(res, await videoSettings.setTranscodeEnabled(req.body.transcodeEnabled, auditContext(req)), {
    message: 'Video settings saved',
  }),
);

/**
 * This upload's mode, for the upload middleware (routes stay free of services):
 * `?mode=hls|mp4` if the upload chose one, the installation's switch otherwise.
 */
export const resolveVideoTranscode = (req) => videoSettings.resolveUploadTranscode(req.query.mode);

export const retryMovieVideo = asyncHandler(async (req, res) =>
  sendSuccess(res, await movieVideo.retryMovieVideo(req.params.id, auditContext(req)), {
    message: 'Transcoding queued',
  }),
);

export const setMovieVideoLink = asyncHandler(async (req, res) =>
  sendSuccess(res, await movieVideo.setMovieVideoLink(req.params.id, req.body, auditContext(req)), {
    message: 'Video link saved',
  }),
);

export const removeMovieVideo = asyncHandler(async (req, res) =>
  sendSuccess(res, await movieVideo.clearMovieVideo(req.params.id, auditContext(req)), {
    message: 'Video removed',
  }),
);

export const uploadCastPhoto = asyncHandler(async (req, res) =>
  sendSuccess(res, await attachments.attachCastPhoto(req.params.id, req.file, auditContext(req)), {
    message: 'Photo uploaded',
  }),
);

export const uploadBannerImage = asyncHandler(async (req, res) =>
  sendSuccess(res, await attachments.attachBannerImage(req.params.id, req.file, auditContext(req)), {
    message: 'Image uploaded',
  }),
);

export const uploadMusicCover = asyncHandler(async (req, res) =>
  sendSuccess(res, await attachments.attachMusicCover(req.params.id, req.file, auditContext(req)), {
    message: 'Cover uploaded',
  }),
);

/**
 * POST /api/admin/video-ads/:id/video
 *
 * `durationSecond` rides along in the multipart body — the browser measures it
 * from the chosen file, since probing a container server-side would need ffmpeg
 * and the value is only ever advertised metadata (services/ad.service.js).
 */
export const uploadVideoAdFile = asyncHandler(async (req, res) =>
  sendSuccess(
    res,
    await attachments.attachVideoAdFile(
      req.params.id,
      req.file,
      { durationSecond: req.body.durationSecond },
      auditContext(req),
    ),
    { message: 'Video uploaded' },
  ),
);

export const uploadPlacementAdImage = asyncHandler(async (req, res) =>
  sendSuccess(
    res,
    await attachments.attachPlacementAdImage(req.params.id, req.file, auditContext(req)),
    { message: 'Image uploaded' },
  ),
);

export const uploadPlacementAdLandscapeImage = asyncHandler(async (req, res) =>
  sendSuccess(
    res,
    await attachments.attachPlacementAdLandscapeImage(req.params.id, req.file, auditContext(req)),
    { message: 'Image uploaded' },
  ),
);

/** PUT /api/admin/musics/:id/tracks — legacy MusicController `?@=tracks` */
export const putMusicTracks = asyncHandler(async (req, res) =>
  sendSuccess(
    res,
    await attachments.replaceMusicTracks(req.params.id, req.body.tracks, auditContext(req)),
    { message: 'Tracks updated' },
  ),
);

/**
 * POST /api/admin/musics/:id/track-files
 * Stores uploaded audio and returns the paths, which the client then submits
 * via PUT /tracks with titles and ordering attached.
 */
export const uploadMusicTrackFiles = asyncHandler(async (req, res) => {
  const files = req.files.map((file) => ({
    originalName: file.originalname,
    file: toPublicPath(file.path),
    size: file.size,
  }));
  return sendCreated(res, files, { message: 'Files uploaded' });
});

/* --------------------------------------------------------------- games --- */

/**
 * POST /api/admin/games — multipart: the ZIP in field `zip`, the form fields as
 * text parts beside it.
 *
 * One request, not the create-then-upload pair every other attachment uses: a
 * game with no bundle is not a game, and two steps would leave an unplayable
 * record behind whenever the second one failed.
 */
export const createGame = asyncHandler(async (req, res) =>
  sendCreated(res, await games.createGame(req.body, req.file, auditContext(req)), {
    message: 'Game uploaded',
  }),
);

/** POST /api/admin/games/:id/bundle — a new build for an existing game. */
export const replaceGameBundle = asyncHandler(async (req, res) =>
  sendSuccess(res, await games.replaceGameBundle(req.params.id, req.file, auditContext(req)), {
    message: 'Game files replaced',
  }),
);

/* -------------------------------------------------------- placeholders --- */

/**
 * GET /api/admin/placeholders
 *
 * EXHAUSTIVE, unlike the public map: every slot the application defines, with
 * its metadata and `imagePath: null` when nothing has been uploaded. The panel
 * needs the empty ones in order to offer an upload for them.
 */
export const getPlaceholders = asyncHandler(async (_req, res) =>
  sendSuccess(res, await placeholders.listPlaceholders()),
);

/** POST /api/admin/placeholders/:slot/image — multipart field `image`. */
export const uploadPlaceholderImage = asyncHandler(async (req, res) =>
  sendSuccess(
    res,
    await placeholders.setPlaceholder(req.params.slot, req.file, auditContext(req)),
    { message: 'Placeholder uploaded' },
  ),
);

/**
 * DELETE /api/admin/placeholders/:slot
 *
 * Clearing an empty slot succeeds rather than 404s: the request asks for a
 * state, and that state already holds.
 */
export const removePlaceholderImage = asyncHandler(async (req, res) =>
  sendSuccess(
    res,
    await placeholders.clearPlaceholder(req.params.slot, auditContext(req)),
    { message: 'Placeholder removed' },
  ),
);

/* ------------------------------------------------------------ branding --- */

/**
 * GET /api/admin/branding
 *
 * The RAW stored values, not the resolved ones: an operator who saw the shipped
 * default already filled into the input could not tell it from their own text,
 * and saving would then freeze that wording into the database. The field
 * definitions travel with it so the form can show the default as a placeholder.
 */
export const getBrandingSettings = asyncHandler(async (_req, res) =>
  sendSuccess(res, await branding.getBrandingSettings()),
);

/**
 * PUT /api/admin/branding — the text fields only.
 *
 * The logo has its own routes below: it is a file, and a form save must not be
 * able to null a path whose file is still on disk.
 */
export const updateBranding = asyncHandler(async (req, res) =>
  sendSuccess(res, await branding.updateBrandingText(req.body, auditContext(req)), {
    message: 'Branding updated',
  }),
);

/** PATCH /api/admin/branding/theme — `{ theme }`, one of SITE_THEME_KEYS. */
export const updateBrandingTheme = asyncHandler(async (req, res) =>
  sendSuccess(res, await branding.updateBrandingTheme(req.body.theme, auditContext(req)), {
    message: 'Theme updated',
  }),
);

/** POST /api/admin/branding/logo — multipart field `image`. */
export const uploadBrandingLogo = asyncHandler(async (req, res) =>
  sendSuccess(res, await branding.setFooterLogo(req.file, auditContext(req)), {
    message: 'Logo uploaded',
  }),
);

/**
 * DELETE /api/admin/branding/logo
 *
 * Clearing an empty slot succeeds rather than 404s, as on the placeholders: the
 * request asks for a state, and that state already holds.
 */
export const removeBrandingLogo = asyncHandler(async (req, res) =>
  sendSuccess(res, await branding.clearFooterLogo(auditContext(req)), {
    message: 'Logo removed',
  }),
);

/* --------------------------------------------------------- bulk import --- */

/**
 * POST /api/admin/polls/import — multipart `file`, plus the `dryRun` and
 * `skipInvalid` switches as text parts.
 *
 * A dry run answers 200 with the same report shape and writes nothing, so the
 * admin screen previews with the identical call it later commits with.
 */
export const importPolls = asyncHandler(async (req, res) => {
  const report = await pollImport.importPollQuestions(
    {
      buffer: req.file.buffer,
      fileName: req.file.originalname,
      dryRun: req.body.dryRun === true,
      skipInvalid: req.body.skipInvalid === true,
    },
    auditContext(req),
  );

  return sendSuccess(res, report, {
    message: report.dryRun ? 'File validated' : 'Questions imported',
  });
});

/* ------------------------------------------------------------- history --- */

const historyHandler = (reader) =>
  asyncHandler(async (req, res) => {
    const { items, meta } = await reader(req.query);
    return sendSuccess(res, items, { meta });
  });

export const getWatchHistory = historyHandler(history.listWatchHistory);
export const getListenHistory = historyHandler(history.listListenHistory);
export const getAdsHistory = historyHandler(history.listAdsHistory);
export const getPollHistory = historyHandler(history.listPollHistory);
export const getUserLogs = historyHandler(history.listUserLogs);
export const getWatchTrends = historyHandler(history.listWatchTrends);

export const getPollSummary = asyncHandler(async (_req, res) =>
  sendSuccess(res, await history.summarizePoll()),
);

/* -------------------------------------------------------------- exports --- */

export const exportMoviesXlsx = asyncHandler(async (req, res) => {
  await exports_.exportMovies(res, req.query);
});

export const exportUsersXlsx = asyncHandler(async (req, res) => {
  await exports_.exportUsers(res, req.query);
});

/* ---------------------------------------------------------------- users --- */

export const listUsers = asyncHandler(async (req, res) => {
  const { items, meta } = await adminUsers.list(req.query);
  return sendSuccess(res, items, { meta });
});

export const getUser = asyncHandler(async (req, res) =>
  sendSuccess(res, await adminUsers.getById(req.params.id)),
);

// Both go through `declaredBody`, like the generic CRUD handlers: the user
// service spreads a create payload straight into the document, so the whole
// body would let a request set `legacyPasswordHash`, `isDeleted` and the rest.
export const createUser = asyncHandler(async (req, res) =>
  sendCreated(res, await adminUsers.create(declaredBody(req), auditContext(req))),
);

export const updateUser = asyncHandler(async (req, res) =>
  sendSuccess(res, await adminUsers.update(req.params.id, declaredBody(req), auditContext(req)), {
    message: 'Updated',
  }),
);

export const setUserStatus = asyncHandler(async (req, res) =>
  sendSuccess(res, await adminUsers.setStatus(req.params.id, req.body.isActive, auditContext(req)), {
    message: 'Status updated',
  }),
);

export const removeUser = asyncHandler(async (req, res) =>
  sendSuccess(res, await adminUsers.remove(req.params.id, auditContext(req)), { message: 'Deleted' }),
);

export const resetUserPassword = asyncHandler(async (req, res) =>
  sendSuccess(
    res,
    await adminUsers.resetPassword(req.params.id, req.body.newPassword, auditContext(req)),
    { message: 'Password reset' },
  ),
);
