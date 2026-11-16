/**
 * Placeholder — fallback artwork for records that have no image of their own.
 *
 * Purpose: hold one uploaded image per slot (movie poster, music cover, banner,
 *          cast photo, and a catch-all), so the fallback is configurable instead
 *          of being a file shipped with the theme.
 * Inputs:  admin upload / clear
 * Outputs: Placeholder documents
 * Deps:    config/constants (the slot keys)
 *
 * NEW COLLECTION — there is no legacy table behind it. The legacy fallbacks were
 * static files under `src/images/` named in the markup; see PLACEHOLDER_SLOTS in
 * config/constants.js for which file each slot replaces.
 *
 * NO SOFT DELETE, and no `isActive`. Every other collection here carries both
 * because it holds records an operator creates and retires; this one holds at
 * most one row per fixed slot, which is either configured or not. Clearing a
 * slot deletes the row and the file, which is exactly what "no placeholder" is —
 * a soft-deleted row would leave the frontend asking whether a hidden document
 * still counts.
 */
import mongoose from 'mongoose';
import { PLACEHOLDER_SLOT_KEYS } from '../config/constants.js';

const placeholderSchema = new mongoose.Schema(
  {
    /**
     * Which fallback this is. Unique: a slot has one image, and the upload path
     * upserts on this field, so the index is what makes a double submit safe.
     */
    slot: {
      type: String,
      required: true,
      unique: true,
      enum: PLACEHOLDER_SLOT_KEYS,
    },

    /** Public path of the stored image, e.g. `/uploads/placeholders/ab12.jpg`. */
    imagePath: { type: String, required: true },

    /** Who uploaded it — shown on the admin screen next to the timestamp. */
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

export const Placeholder = mongoose.model('Placeholder', placeholderSchema);
export default Placeholder;
