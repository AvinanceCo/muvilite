/**
 * SystemSetting repository — the installation's one settings document.
 *
 * Purpose: read and patch the singleton, creating it on first write.
 * Inputs:  partial updates
 * Outputs: the lean document (or null before anything was ever saved)
 * Deps:    models/SystemSetting
 */
import { SystemSetting } from '../models/index.js';

const SINGLETON_KEY = 'default';

export class SystemSettingRepository {
  /** @returns the document, or null before anything has ever been saved. */
  find() {
    return SystemSetting.findOne({ key: SINGLETON_KEY }).lean();
  }

  /** @param {object} patch only the fields being changed */
  update(patch) {
    return SystemSetting.findOneAndUpdate(
      { key: SINGLETON_KEY },
      { $set: patch },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
    ).lean();
  }
}

export const systemSettingRepository = new SystemSettingRepository();
export default systemSettingRepository;
