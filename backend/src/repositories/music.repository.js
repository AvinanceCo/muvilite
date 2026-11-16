/**
 * Music repository.
 *
 * Purpose: database access for the music catalog, mirroring the movie side but
 *          with the legacy music-specific quirks.
 * Inputs:  filters, sort objects, pagination
 * Outputs: plain music documents
 * Deps:    models, repositories/BaseRepository
 */
import { Music, MusicCategoryRelation } from '../models/index.js';
import BaseRepository from './BaseRepository.js';

/**
 * legacy `item_sort` values accepted by api/v2/index.php::music_categories —
 * a SMALLER set than the movie endpoint allows, and defaulting to `id`.
 */
export const MUSIC_SORT_FIELDS = Object.freeze({
  visit_count: 'visitCount',
  id: '_id',
  publish_date: 'publishYear',
});

export const MUSIC_CARD_FIELDS = {
  _id: 1,
  fullnameFa: 1,
  fullnameEn: 1,
  albumFa: 1,
  albumEn: 1,
  coverPath: 1,
  visitCount: 1,
};

/** Row projection for the admin's category-content editor, which shows status. */
export const MUSIC_ADMIN_ROW_FIELDS = Object.freeze({
  ...MUSIC_CARD_FIELDS,
  publishYear: 1,
  isActive: 1,
  createdAt: 1,
});

/** Post-`$unwind` match on the joined music document, shared by find and count. */
function musicScope(activeOnly) {
  return activeOnly
    ? { 'music.isDeleted': false, 'music.isActive': true }
    : { 'music.isDeleted': false };
}

export class MusicRepository extends BaseRepository {
  constructor() {
    super(Music);
  }

  /**
   * Music entries in a category.
   *
   * legacy (api/v2/models/Music.php::musicList):
   *   SELECT music.id,
   *          CONCAT(fullname_fa,' - ',album_fa) AS title_fa,
   *          CONCAT(fullname_en,' - ',album_fa) AS title_en
   *     FROM music_category_relation_tbl
   *     JOIN musics_tbl AS music ON item_id = music.id
   *    WHERE music.is_delete = 0 AND music.is_active = 1 AND category_id = ?
   *    ORDER BY <sort>, id LIMIT <offset>, <count>
   *
   * The CONCAT display title is a presentation concern and is applied in the
   * service, so the stored fields stay separately addressable.
   *
   * `activeOnly` is false for the admin's category-content editor — see the
   * matching note on MovieRepository.findByCategory.
   */
  async findByCategory(categoryId, { sort, skip = 0, limit, activeOnly = true, project = MUSIC_CARD_FIELDS }) {
    const pipeline = [
      { $match: { category: categoryId, isDeleted: false } },
      {
        $lookup: {
          from: Music.collection.name,
          localField: 'item',
          foreignField: '_id',
          as: 'music',
        },
      },
      { $unwind: '$music' },
      { $match: musicScope(activeOnly) },
      { $replaceRoot: { newRoot: '$music' } },
      { $sort: sort },
      { $skip: skip },
    ];

    if (limit) pipeline.push({ $limit: limit });
    pipeline.push({ $project: project });

    return MusicCategoryRelation.aggregate(pipeline);
  }

  async countByCategory(categoryId, { activeOnly = true } = {}) {
    const [result] = await MusicCategoryRelation.aggregate([
      { $match: { category: categoryId, isDeleted: false } },
      {
        $lookup: {
          from: Music.collection.name,
          localField: 'item',
          foreignField: '_id',
          as: 'music',
        },
      },
      { $unwind: '$music' },
      { $match: musicScope(activeOnly) },
      { $count: 'total' },
    ]);
    return result?.total ?? 0;
  }

  /**
   * Music search filter.
   *
   * legacy (api/v2/index.php::musics) matched LIKE '%text%' across fullname_fa,
   * fullname_en, album_fa, album_en, tags, company, description_fa and
   * description_en — a wider column set than the movie search uses.
   *
   * NOTE: the legacy query had NO LIMIT clause and returned every matching row.
   * The new endpoint paginates; that is a deliberate correction, recorded in
   * MIGRATION.md, not a change in what matches.
   */
  buildSearchFilter(text) {
    if (!text) {
      return this.publicScope();
    }

    const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(escaped, 'i');

    return this.publicScope({
      $or: [
        { fullnameFa: pattern },
        { fullnameEn: pattern },
        { albumFa: pattern },
        { albumEn: pattern },
        { tags: pattern },
        { company: pattern },
        { descriptionFa: pattern },
        { descriptionEn: pattern },
      ],
    });
  }

  incrementVisitCount(id) {
    return Music.updateOne({ _id: id }, { $inc: { visitCount: 1 } });
  }
}

export const musicRepository = new MusicRepository();
export default musicRepository;
