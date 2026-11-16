/**
 * PageBlock — legacy `page_block_tbl`.
 *
 * Purpose: one ordered row on a Page. Each block points at a banner category, a
 *          movie category, or a music category, and carries the ordering to use
 *          when its items are fetched.
 * Inputs:  admin block editor (create/update/delete/status/order)
 * Outputs: PageBlock documents
 * Deps:    plugins/softDelete, config/constants
 *
 * Legacy query (api/v2/index.php::page):
 *   `SELECT item_type, item_sort, sort_type, item_id FROM page_block_tbl
 *    WHERE is_active = 1 AND is_delete = 0 AND page_id = ? ORDER BY item_order`
 *
 * SECURITY — deliberate divergence:
 * the legacy code interpolated `item_sort` and `sort_type` straight into the
 * rail query (`ORDER BY $itemSort $sortType`) with no whitelist, making an
 * admin-writable column a second-order SQL injection vector. Both are
 * constrained by enum here, so an invalid value cannot be persisted, and the
 * service validates again on read.
 */
import mongoose from 'mongoose';
import softDeletePlugin from './plugins/softDelete.js';
import { BLOCK_ITEM_TYPES } from '../config/constants.js';

/**
 * Union of the sort keys the legacy rail queries accepted. The per-type subset
 * is enforced in the page service, since movie rails and music rails allow
 * different keys.
 */
export const BLOCK_SORT_FIELDS = Object.freeze([
  'imdb_rank',
  'visit_count',
  'created_date',
  'publish_date',
  'modified_date',
  'id',
]);

const pageBlockSchema = new mongoose.Schema(
  {
    page: { type: mongoose.Schema.Types.ObjectId, ref: 'Page', required: true, index: true },

    /** 'banner' | 'category' | 'music' */
    itemType: { type: String, required: true, enum: BLOCK_ITEM_TYPES },

    /**
     * The referenced collection depends on itemType, so this stays an untyped
     * ObjectId and is resolved by the service (BannerCategory / Category /
     * MusicCategory). legacy: page_block_tbl.item_id
     */
    itemId: { type: mongoose.Schema.Types.ObjectId, required: true },

    /** Position of this block on the page. legacy: item_order */
    itemOrder: { type: Number, default: 0, index: true },

    /** Ordering applied to the block's items. Whitelisted, see note above. */
    itemSort: { type: String, enum: BLOCK_SORT_FIELDS, default: 'created_date' },
    sortType: { type: String, enum: ['ASC', 'DESC'], default: 'DESC' },
  },
  { timestamps: true },
);

pageBlockSchema.plugin(softDeletePlugin);
pageBlockSchema.index({ page: 1, itemOrder: 1 });

export const PageBlock = mongoose.model('PageBlock', pageBlockSchema);
export default PageBlock;
