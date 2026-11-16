/**
 * Branding — the operator-owned parts of the passenger site's chrome and hero.
 *
 * Purpose: hold the customer logo shown in the footer, the landing page's
 *          heading and description, and the site's colour theme, so a
 *          customer's identity is data rather than a file and a literal in the
 *          theme.
 * Inputs:  admin save / upload / clear
 * Outputs: one Branding document
 * Deps:    config/constants (the text field keys)
 *
 * NEW COLLECTION — there is no legacy table behind it. See BRANDING_TEXT_FIELDS
 * in config/constants.js for what each field replaces.
 *
 * A SINGLETON. `key` is fixed to 'default' and unique, so every write upserts on
 * it and the collection can never hold a second row to disagree with the first.
 * The alternative — "the newest document wins" — turns a double submit into two
 * rows and a coin toss. The field is not part of the API: no caller passes it.
 *
 * NO SOFT DELETE and no `isActive`, for the same reason Placeholder has neither
 * (models/Placeholder.js): this is configuration, not a record an operator
 * creates and retires. Clearing the logo nulls the path and deletes the file;
 * clearing a text field restores the shipped default.
 */
import mongoose from 'mongoose';
import { SITE_THEME_KEYS, DEFAULT_SITE_THEME } from '../config/constants.js';

const brandingSchema = new mongoose.Schema(
  {
    /** Singleton guard. One value, one row — see the note above. */
    key: { type: String, default: 'default', unique: true, enum: ['default'] },

    /**
     * Public path of the customer's logo, e.g. `/uploads/branding/ab12.png`.
     *
     * null means the footer shows NO logo at all — not that it falls back to the
     * product mark. The product mark was deliberately taken out of the footer
     * (frontend layouts/MainLayout.jsx); this slot replaced it rather than
     * joining it.
     */
    footerLogoPath: { type: String, default: null },

    /** The site's name in the header, side menu and tab. Blank publishes the product's. */
    siteName: { type: String, default: '', trim: true },

    /** The landing page <h1>. Blank publishes BRANDING_DEFAULTS.homeTitle. */
    homeTitle: { type: String, default: '', trim: true },

    /** The sentence beneath it. Blank publishes the shipped default. */
    homeDescription: { type: String, default: '', trim: true },

    /**
     * The passenger site's colour theme (SITE_THEMES in config/constants.js).
     * Absent on documents saved before the field existed; the service reads
     * that as DEFAULT_SITE_THEME, so no migration is needed.
     */
    theme: { type: String, enum: SITE_THEME_KEYS, default: DEFAULT_SITE_THEME },

    /** Who last changed it — shown on the admin screen next to the timestamp. */
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

export const Branding = mongoose.model('Branding', brandingSchema);
export default Branding;
