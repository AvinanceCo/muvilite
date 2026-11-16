/**
 * Model barrel.
 *
 * Purpose: one import site for every Mongoose model, so repositories and
 *          scripts don't each reach into individual files.
 * Inputs:  none
 * Outputs: the registered models
 * Deps:    all model modules
 */
export { default as Movie } from './Movie.js';
export { default as Music } from './Music.js';
export { default as Cast } from './Cast.js';
export { default as MovieCast } from './MovieCast.js';

export { default as Category } from './Category.js';
export { default as CategoryRelation } from './CategoryRelation.js';
export { default as MusicCategory } from './MusicCategory.js';
export { default as MusicCategoryRelation } from './MusicCategoryRelation.js';

export { default as Page } from './Page.js';
export { default as PageBlock } from './PageBlock.js';

export { default as VideoAd } from './VideoAd.js';
export { default as PlacementAd } from './PlacementAd.js';

export { default as Placeholder } from './Placeholder.js';
export { default as Branding } from './Branding.js';
export { default as SystemSetting } from './SystemSetting.js';

export { default as Banner } from './Banner.js';
export { default as BannerCategory } from './BannerCategory.js';
export { default as BannerCategoryRelation } from './BannerCategoryRelation.js';

export { default as Genre } from './Genre.js';
// The music taxonomy. Separate from Genre, which is films only — see the file.
export { default as MusicGenre } from './MusicGenre.js';
// HTML5 games and their own taxonomy. No legacy tables — see the files.
export { default as Game } from './Game.js';
export { default as GameGenre } from './GameGenre.js';
export { default as AgeRange } from './AgeRange.js';
export { default as Country } from './Country.js';

export { default as User } from './User.js';
export { default as UserCategory } from './UserCategory.js';
export { default as UserLog } from './UserLog.js';
export { default as PermissionGroup } from './PermissionGroup.js';
export { default as AccessPermission } from './AccessPermission.js';

export { default as WatchHistory } from './WatchHistory.js';
export { default as ListenHistory } from './ListenHistory.js';
export { default as AdsHistory } from './AdsHistory.js';
export { default as Poll } from './Poll.js';
export { default as PollHistory } from './PollHistory.js';
export { default as WatchTrendDaily } from './WatchTrendDaily.js';
