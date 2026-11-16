/**
 * Page — legacy `pages_tbl`.
 *
 * Purpose: a composable landing page. The legacy site had three in production
 *          (id 3 = film, 4 = music, 5 = clips), each rendered as an ordered
 *          list of blocks.
 * Inputs:  admin CRUD
 * Outputs: Page documents
 * Deps:    plugins/softDelete
 *
 * Columns from api/v2/index.php::page:
 *   `SELECT title_fa, title_en, description_fa, description_en, tags
 *    FROM pages_tbl WHERE is_active = 1 AND is_delete = 0 AND id = ?`
 */
import mongoose from 'mongoose';
import softDeletePlugin from './plugins/softDelete.js';

const pageSchema = new mongoose.Schema(
  {
    titleFa: { type: String, required: true, trim: true },
    titleEn: { type: String, trim: true, default: '' },
    descriptionFa: { type: String, default: '' },
    descriptionEn: { type: String, default: '' },
    tags: { type: String, trim: true, default: '' },
    /**
     * Stable identifier so clients can request "the film page" without
     * depending on a generated id, replacing the legacy hardcoded ids 3/4/5.
     */
    slug: { type: String, trim: true, lowercase: true, unique: true, sparse: true },
  },
  { timestamps: true },
);

pageSchema.plugin(softDeletePlugin);

export const Page = mongoose.model('Page', pageSchema);
export default Page;
