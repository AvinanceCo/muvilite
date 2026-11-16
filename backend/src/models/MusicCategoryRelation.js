/**
 * MusicCategoryRelation — legacy `music_category_relation_tbl`.
 *
 * Purpose: many-to-many membership of music entries in music categories.
 * Inputs:  admin category assignment
 * Outputs: MusicCategoryRelation documents
 * Deps:    plugins/softDelete
 *
 * Legacy columns: category_id, item_id (a musics_tbl id), is_delete.
 */
import mongoose from 'mongoose';
import softDeletePlugin from './plugins/softDelete.js';

const musicCategoryRelationSchema = new mongoose.Schema(
  {
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'MusicCategory', required: true, index: true },
    item: { type: mongoose.Schema.Types.ObjectId, ref: 'Music', required: true, index: true },
  },
  { timestamps: true },
);

musicCategoryRelationSchema.plugin(softDeletePlugin);
musicCategoryRelationSchema.index({ category: 1, item: 1 }, { unique: true });

export const MusicCategoryRelation = mongoose.model('MusicCategoryRelation', musicCategoryRelationSchema);
export default MusicCategoryRelation;
