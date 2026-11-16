/**
 * Placeholder repository.
 *
 * Purpose: read every configured fallback image, and set or clear one slot.
 * Inputs:  slot keys, stored image paths
 * Outputs: Placeholder documents
 * Deps:    models
 *
 * NOT a BaseRepository. That class exists to apply the soft-delete/active scope
 * every legacy query repeated by hand, and Placeholder has neither field (see
 * models/Placeholder.js) — inheriting it would mean every call passing a filter
 * that matches nothing.
 */
import { Placeholder } from '../models/index.js';

export class PlaceholderRepository {
  /** Every configured slot. At most PLACEHOLDER_SLOTS.length documents. */
  findAll() {
    return Placeholder.find({}).sort({ slot: 1 }).lean();
  }

  findBySlot(slot) {
    return Placeholder.findOne({ slot }).lean();
  }

  /**
   * Sets a slot's image, creating the row on first upload.
   *
   * Upsert rather than create-or-update in the service: two operators saving the
   * same slot at once would otherwise race between the read and the write, and
   * the unique index would turn the loser into a 500.
   */
  upsertSlot(slot, { imagePath, updatedBy }) {
    return Placeholder.findOneAndUpdate(
      { slot },
      { $set: { imagePath, updatedBy } },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
    ).lean();
  }

  /** Removes a slot entirely. @returns the deleted document, or null. */
  deleteSlot(slot) {
    return Placeholder.findOneAndDelete({ slot }).lean();
  }
}

export const placeholderRepository = new PlaceholderRepository();
export default placeholderRepository;
