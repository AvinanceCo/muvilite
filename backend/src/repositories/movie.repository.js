/**
 * Movie repository.
 *
 * Purpose: every database read/write for the movie catalog, including the two
 *          queries that were joins in the legacy schema — category membership
 *          and cast credits.
 * Inputs:  filters, sort objects, pagination
 * Outputs: plain movie documents
 * Deps:    models, repositories/BaseRepository
 */
import { Movie, CategoryRelation, MovieCast } from '../models/index.js';
import BaseRepository from './BaseRepository.js';
import { VIDEO_STATUS } from '../config/constants.js';

/**
 * Legacy `item_sort` value -> schema path.
 * The accepted set differs per endpoint, so each service supplies its own
 * subset of these keys to resolveSort().
 */
export const MOVIE_SORT_FIELDS = Object.freeze({
  imdb_rank: 'imdbRank',
  visit_count: 'visitCount',
  created_date: 'createdAt',
  publish_date: 'publishYear',
  modified_date: 'updatedAt',
  id: '_id',
});

/** Card projection used by every list/rail endpoint. */
export const MOVIE_CARD_FIELDS = {
  _id: 1,
  titleFa: 1,
  titleEn: 1,
  imdbRank: 1,
  posterPath: 1,
  thumbnailPath: 1,
  visitCount: 1,
  // A clip is a different shape of card — vertical artwork, no year, no rating
  // worth showing — so every consumer of this projection needs to be able to
  // tell one apart.
  isClip: 1,
};

/** Row projection for the admin's category-content editor, which shows status. */
export const MOVIE_ADMIN_ROW_FIELDS = Object.freeze({
  ...MOVIE_CARD_FIELDS,
  publishYear: 1,
  isActive: 1,
  createdAt: 1,
});

/** Post-`$unwind` match on the joined movie, shared by find and count. */
function movieScope(activeOnly) {
  return activeOnly
    ? { 'movie.isDeleted': false, 'movie.isActive': true }
    : { 'movie.isDeleted': false };
}

export class MovieRepository extends BaseRepository {
  constructor() {
    super(Movie);
  }

  /**
   * Movies belonging to a category, ordered and paginated.
   *
   * legacy (api/v2/models/Movie.php::movieList):
   *   SELECT movie.id, movie.title_fa, movie.title_en, movie.imdb_rank
   *     FROM category_relation_tbl
   *     JOIN movies_tbl AS movie ON category_relation_tbl.item_id = movie.id
   *    WHERE movie.is_delete = 0 AND movie.is_active = 1
   *      AND category_relation_tbl.category_id = ?
   *    ORDER BY <sort>, id
   *    LIMIT <offset>, <count>
   *
   * The trailing `, id` tiebreaker is preserved by the caller passing one in
   * `sort`, so pages don't reshuffle between requests.
   *
   * `activeOnly` is false for the admin's category-content editor: the legacy
   * admin query (admin/.../models/MovieModel.php::movieList) filtered only
   * `movie.is_delete = 0`, so a deactivated title stayed visible and removable.
   * The public path keeps `is_active = 1`, as its own query did.
   */
  async findByCategory(categoryId, { sort, skip = 0, limit, activeOnly = true, project = MOVIE_CARD_FIELDS }) {
    const pipeline = [
      { $match: { category: categoryId, isDeleted: false } },
      {
        $lookup: {
          from: Movie.collection.name,
          localField: 'item',
          foreignField: '_id',
          as: 'movie',
        },
      },
      { $unwind: '$movie' },
      { $match: movieScope(activeOnly) },
      { $replaceRoot: { newRoot: '$movie' } },
      { $sort: sort },
      { $skip: skip },
    ];

    if (limit) pipeline.push({ $limit: limit });
    pipeline.push({ $project: project });

    return CategoryRelation.aggregate(pipeline);
  }

  /**
   * Total movies in a category.
   * legacy: api/v2/models/Movie.php::totalItemsMovieList (the same join wrapped
   * in a COUNT). Defined but never called by the legacy pages, which is why no
   * pagination controls were ever rendered; the new API returns it as `meta`.
   */
  async countByCategory(categoryId, { activeOnly = true } = {}) {
    const [result] = await CategoryRelation.aggregate([
      { $match: { category: categoryId, isDeleted: false } },
      {
        $lookup: {
          from: Movie.collection.name,
          localField: 'item',
          foreignField: '_id',
          as: 'movie',
        },
      },
      { $unwind: '$movie' },
      { $match: movieScope(activeOnly) },
      { $count: 'total' },
    ]);
    return result?.total ?? 0;
  }

  /**
   * Movies sharing the current title's primary genre, in random order.
   *
   * legacy (api/v2/index.php::similar):
   *   SELECT id, title_fa, title_en, imdb_rank FROM movies_tbl
   *    WHERE id NOT IN (?) AND genre_1 = ? AND is_active = 1 AND is_delete = 0
   *    ORDER BY RAND() LIMIT 0, 4
   *
   * `$sample` is the aggregation equivalent of ORDER BY RAND() + LIMIT.
   */
  findSimilar(movieId, genreId, limit) {
    return Movie.aggregate([
      {
        $match: {
          _id: { $ne: movieId },
          genre1: genreId,
          isDeleted: false,
          isActive: true,
        },
      },
      { $sample: { size: limit } },
      { $project: MOVIE_CARD_FIELDS },
    ]);
  }

  /**
   * Full-text-ish catalog search.
   *
   * legacy (api/v2/index.php::search) matched with LIKE '%text%' across
   * title_fa, title_en, tags, company and imdb_code. A regex keeps that
   * substring semantics — a MongoDB text index would instead match whole
   * tokens, which would silently change which titles are found.
   */
  buildSearchFilter(text) {
    if (!text) {
      // legacy: an empty query returned the first page of all active movies.
      return this.publicScope();
    }

    const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(escaped, 'i');

    return this.publicScope({
      $or: [
        { titleFa: pattern },
        { titleEn: pattern },
        { tags: pattern },
        { company: pattern },
        { imdbCode: pattern },
      ],
    });
  }

  /**
   * A movie with its genre, age range and country resolved.
   *
   * legacy (api/v2/models/Movie.php::withGenre) used an INNER JOIN on
   * genres_tbl via genre_1, which means a movie with no primary genre is
   * invisible on the detail page. That behaviour is load-bearing for what the
   * catalog shows, so the caller enforces it explicitly rather than silently
   * returning a genre-less movie.
   */
  findDetailById(id) {
    return Movie.findOne(this.publicScope({ _id: id }))
      .populate('genre1 genre2 genre3', 'nameFa nameEn colorClass')
      .populate('ageRange', 'nameFa nameEn')
      .lean();
  }

  /**
   * Credits for a movie, ordered by role.
   *
   * legacy (api/v2/models/Movie.php::casts):
   *   SELECT movies_cast_tbl.role, casts_tbl.id, fullname_fa, fullname_en
   *     FROM movies_cast_tbl JOIN casts_tbl ON cast_id = casts_tbl.id
   *    WHERE movie_id = ? AND casts_tbl.is_active = 1 AND casts_tbl.is_delete = 0
   *    ORDER BY movies_cast_tbl.role
   */
  async findCasts(movieId) {
    return MovieCast.find({ movie: movieId, isDeleted: false })
      .populate({
        match: { isActive: true, isDeleted: false },
        path: 'cast',
        select: 'fullnameFa fullnameEn photoPath',
      })
      .sort({ role: 1 })
      .lean();
  }

  /**
   * Updates the movie only while it still holds the given upload.
   *
   * The transcoder finishes minutes after it starts, and in between the
   * operator may have replaced or removed the video. Matching on the source
   * path makes a late result a no-op instead of clobbering the newer state.
   * Deleted records are matched too: a title removed mid-transcode still owns
   * its files, and the job's own cleanup depends on knowing that it won.
   *
   * @returns {Promise<object|null>} the updated movie, or null when it moved on
   */
  updateIfVideoSource(id, sourcePath, payload) {
    return this.model
      .findOneAndUpdate({ _id: id, videoSourcePath: sourcePath }, { $set: payload }, { new: true })
      .lean();
  }

  /** Uploads the transcoder must pick up again after a restart. */
  findPendingTranscodes() {
    return this.model
      .find({
        videoStatus: { $in: [VIDEO_STATUS.QUEUED, VIDEO_STATUS.PROCESSING] },
        videoSourcePath: { $ne: null },
      })
      .select('_id videoSourcePath')
      .sort({ updatedAt: 1 })
      .lean();
  }

  incrementVisitCount(id) {
    return Movie.updateOne({ _id: id }, { $inc: { visitCount: 1 } });
  }
}

export const movieRepository = new MovieRepository();
export default movieRepository;
