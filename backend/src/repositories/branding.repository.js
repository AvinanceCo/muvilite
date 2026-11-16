/**
 * Branding repository.
 *
 * Purpose: read the single branding document and patch it.
 * Inputs:  field patches
 * Outputs: the Branding document
 * Deps:    models
 *
 * NOT a BaseRepository, for the same reason PlaceholderRepository is not: that
 * class applies the soft-delete/active scope every legacy query repeated by
 * hand, and this collection has neither field.
 *
 * Every write is an UPSERT on the singleton key, so the row springs into
 * existence on the first save and two operators saving at once cannot create
 * two of it.
 */
import { Branding } from '../models/index.js';

/** The one document's identity. Not part of the API; no caller supplies it. */
const SINGLETON_KEY = 'default';

export class BrandingRepository {
  /** @returns the document, or null before anything has ever been saved. */
  find() {
    return Branding.findOne({ key: SINGLETON_KEY }).lean();
  }

  /**
   * Applies a partial update, creating the document if it is not there yet.
   * @param {object} patch only the fields being changed
   */
  update(patch) {
    return Branding.findOneAndUpdate(
      { key: SINGLETON_KEY },
      { $set: patch },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
    ).lean();
  }
}

export const brandingRepository = new BrandingRepository();
export default brandingRepository;
