/**
 * Country — legacy `countries_tbl`.
 *
 * Purpose: country lookup for a movie's production country.
 * Inputs:  reference data (seeded)
 * Outputs: Country documents
 * Deps:    plugins/softDelete
 *
 * Legacy note: `movies_tbl.country` stores the country *code*, not an id —
 * `SELECT country_en AS en, country_fa AS fa FROM countries_tbl
 *  WHERE country_code = '$movie[country]'` (api/v2/index.php::movie).
 * The code therefore stays the unique business key here.
 */
import mongoose from 'mongoose';
import softDeletePlugin from './plugins/softDelete.js';

const countrySchema = new mongoose.Schema(
  {
    countryCode: { type: String, required: true, trim: true, uppercase: true, unique: true },
    countryFa: { type: String, required: true, trim: true },
    countryEn: { type: String, trim: true, default: '' },
  },
  { timestamps: true },
);

countrySchema.plugin(softDeletePlugin);

export const Country = mongoose.model('Country', countrySchema);
export default Country;
