/**
 * Page and PageBlock repository.
 *
 * Purpose: fetch a page and its ordered, active blocks. Resolving each block's
 *          items is the service's job, since which collection to read depends
 *          on the block type.
 * Inputs:  page id or slug
 * Outputs: page and block documents
 * Deps:    models, repositories/BaseRepository
 */
import { Page, PageBlock } from '../models/index.js';
import BaseRepository from './BaseRepository.js';

export class PageRepository extends BaseRepository {
  constructor() {
    super(Page);
  }

  /** Accepts either an ObjectId or the human-friendly slug. */
  findPublic(idOrSlug) {
    const filter = this.publicScope(
      idOrSlug.match(/^[0-9a-fA-F]{24}$/) ? { _id: idOrSlug } : { slug: idOrSlug.toLowerCase() },
    );
    return Page.findOne(filter).lean();
  }

  /**
   * Ordered blocks for a page.
   *
   * legacy (api/v2/index.php::page):
   *   SELECT item_type, item_sort, sort_type, item_id FROM page_block_tbl
   *    WHERE is_active = 1 AND is_delete = 0 AND page_id = ?
   *    ORDER BY item_order
   */
  findBlocks(pageId) {
    return PageBlock.find({ page: pageId, isDeleted: false, isActive: true })
      .sort({ itemOrder: 1 })
      .lean();
  }

  /** Admin view: includes deactivated blocks so they remain editable. */
  findBlocksForAdmin(pageId) {
    return PageBlock.find({ page: pageId, isDeleted: false }).sort({ itemOrder: 1 }).lean();
  }
}

export class PageBlockRepository extends BaseRepository {
  constructor() {
    super(PageBlock);
  }

  /**
   * Persist a new ordering.
   * legacy: admin/.../controllers/PageBlockController.php `?@=order`
   * @param {{id: string, itemOrder: number}[]} entries
   */
  reorder(entries) {
    return PageBlock.bulkWrite(
      entries.map(({ id, itemOrder }) => ({
        updateOne: { filter: { _id: id, isDeleted: false }, update: { $set: { itemOrder } } },
      })),
    );
  }
}

export const pageRepository = new PageRepository();
export const pageBlockRepository = new PageBlockRepository();
export default pageRepository;
