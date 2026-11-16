/**
 * Repository barrel.
 *
 * Purpose: expose one repository instance per collection. Entities whose access
 *          pattern is plain CRUD get a BaseRepository directly; the ones with
 *          real query logic have their own module.
 * Inputs:  none
 * Outputs: repository singletons
 * Deps:    models, repositories/*
 */
import {
  Cast,
  MovieCast,
  Category,
  CategoryRelation,
  MusicCategory,
  MusicCategoryRelation,
  BannerCategory,
  BannerCategoryRelation,
  VideoAd,
  PlacementAd,
  Genre,
  MusicGenre,
  GameGenre,
  AgeRange,
  Country,
  UserCategory,
  UserLog,
  PermissionGroup,
  AccessPermission,
  WatchHistory,
  ListenHistory,
  AdsHistory,
  Poll,
  PollHistory,
  WatchTrendDaily,
} from '../models/index.js';
import BaseRepository from './BaseRepository.js';

export {
  movieRepository,
  MOVIE_SORT_FIELDS,
  MOVIE_CARD_FIELDS,
  MOVIE_ADMIN_ROW_FIELDS,
} from './movie.repository.js';
export {
  musicRepository,
  MUSIC_SORT_FIELDS,
  MUSIC_CARD_FIELDS,
  MUSIC_ADMIN_ROW_FIELDS,
} from './music.repository.js';
export {
  gameRepository,
  GAME_SORT_FIELDS,
  GAME_CARD_FIELDS,
  GAME_GENRE_POPULATE,
} from './game.repository.js';
export { pageRepository, pageBlockRepository } from './page.repository.js';
export { bannerRepository, BANNER_CARD_FIELDS } from './banner.repository.js';
export { placeholderRepository } from './placeholder.repository.js';
export { brandingRepository } from './branding.repository.js';
export { systemSettingRepository } from './systemSetting.repository.js';
export { userRepository } from './user.repository.js';
export { default as BaseRepository } from './BaseRepository.js';

// Plain CRUD collections.
export const castRepository = new BaseRepository(Cast);
export const movieCastRepository = new BaseRepository(MovieCast);
export const categoryRepository = new BaseRepository(Category);
export const categoryRelationRepository = new BaseRepository(CategoryRelation);
export const musicCategoryRepository = new BaseRepository(MusicCategory);
export const musicCategoryRelationRepository = new BaseRepository(MusicCategoryRelation);
export const bannerCategoryRepository = new BaseRepository(BannerCategory);
export const bannerCategoryRelationRepository = new BaseRepository(BannerCategoryRelation);
export const videoAdRepository = new BaseRepository(VideoAd);
export const placementAdRepository = new BaseRepository(PlacementAd);
export const genreRepository = new BaseRepository(Genre);
export const musicGenreRepository = new BaseRepository(MusicGenre);
export const gameGenreRepository = new BaseRepository(GameGenre);
export const ageRangeRepository = new BaseRepository(AgeRange);
export const countryRepository = new BaseRepository(Country);
export const userCategoryRepository = new BaseRepository(UserCategory);
export const userLogRepository = new BaseRepository(UserLog);
export const permissionGroupRepository = new BaseRepository(PermissionGroup);
export const accessPermissionRepository = new BaseRepository(AccessPermission);
export const watchHistoryRepository = new BaseRepository(WatchHistory);
export const listenHistoryRepository = new BaseRepository(ListenHistory);
export const adsHistoryRepository = new BaseRepository(AdsHistory);
export const pollRepository = new BaseRepository(Poll);
export const pollHistoryRepository = new BaseRepository(PollHistory);
export const watchTrendDailyRepository = new BaseRepository(WatchTrendDaily);
