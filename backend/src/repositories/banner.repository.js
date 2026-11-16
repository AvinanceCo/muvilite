/**
 * Banner repository.
 *
 * Purpose: read banners for a rail in their configured order, and maintain that
 *          order from the admin panel.
 * Inputs:  banner category id, ordering payloads
 * Outputs: banner documents
 * Deps:    models, repositories/BaseRepository
 */
import { Banner, BannerCategoryRelation } from '../models/index.js';
import BaseRepository from './BaseRepository.js';

export const BANNER_CARD_FIELDS = {
  _id: 1,
  url: 1,
  titleFa: 1,
  titleEn: 1,
  subtitleFa: 1,
  subtitleEn: 1,
  labelFa: 1,
  labelEn: 1,
  imagePath: 1,
};

export class BannerRepository extends BaseRepository {
  constructor() {
    super(Banner);
  }

  /**
   * Active banners in a category, ordered by the relation's order_index.
   *
   * legacy (api/v2/models/PageBlock.php::getBanners):
   *   SELECT banner.id, url, title_fa, subtitle_fa, label_fa,
   *          title_en, subtitle_en, label_en
   *     FROM banner_categories_relations_tbl relation
   *     JOIN banner_tbl banner ON relation.banner_id = banner.id
   *     JOIN banner_categories_tbl category ON category.id = ?
   *    WHERE banner.is_delete = 0 AND banner.is_active = 1
   *      AND category.is_delete = 0 AND category.is_active = 1
   *      AND relation.banner_category_id = ?
   *    ORDER BY order_index
   *
   * The third JOIN in the legacy query was degenerate — it joined the category
   * table on a constant rather than on a relation column, so it only served to
   * assert the category was active. That assertion is done by the caller, which
   * loads the category first to read its `type`.
   */
  findByCategory(bannerCategoryId) {
    return BannerCategoryRelation.aggregate([
      { $match: { bannerCategory: bannerCategoryId, isDeleted: false } },
      {
        $lookup: {
          from: Banner.collection.name,
          localField: 'banner',
          foreignField: '_id',
          as: 'banner',
        },
      },
      { $unwind: '$banner' },
      { $match: { 'banner.isDeleted': false, 'banner.isActive': true } },
      { $sort: { orderIndex: 1 } },
      { $replaceRoot: { newRoot: '$banner' } },
      { $project: BANNER_CARD_FIELDS },
    ]);
  }

  /**
   * Persist a new slide order within a category.
   * legacy: admin/.../controllers/BannerController.php `?@=order`
   * @param {string} bannerCategoryId
   * @param {{bannerId: string, orderIndex: number}[]} entries
   */
  reorder(bannerCategoryId, entries) {
    return BannerCategoryRelation.bulkWrite(
      entries.map(({ bannerId, orderIndex }) => ({
        updateOne: {
          filter: { bannerCategory: bannerCategoryId, banner: bannerId, isDeleted: false },
          update: { $set: { orderIndex } },
        },
      })),
    );
  }
}

export const bannerRepository = new BannerRepository();
export default bannerRepository;
