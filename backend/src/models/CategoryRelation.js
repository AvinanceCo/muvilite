/**
 * CategoryRelation — legacy `category_relation_tbl`.
 *
 * Purpose: many-to-many membership of movies in categories.
 * Inputs:  admin category assignment
 * Outputs: CategoryRelation documents
 * Deps:    plugins/softDelete
 *
 * Legacy columns: category_id, item_id (a movies_tbl id), is_delete.
 * Kept as its own collection rather than an array on Movie because the admin
 * manages the relation independently and it carries its own delete flag.
 */
import mongoose from 'mongoose';
import softDeletePlugin from './plugins/softDelete.js';

const categoryRelationSchema = new mongoose.Schema(
  {
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true, index: true },
    /** legacy `item_id` — always a movie. */
    item: { type: mongoose.Schema.Types.ObjectId, ref: 'Movie', required: true, index: true },
  },
  { timestamps: true },
);

categoryRelationSchema.plugin(softDeletePlugin);
categoryRelationSchema.index({ category: 1, item: 1 }, { unique: true });

export const CategoryRelation = mongoose.model('CategoryRelation', categoryRelationSchema);
export default CategoryRelation;
