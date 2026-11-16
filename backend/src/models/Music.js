/**
 * Music — legacy `musics_tbl`.
 *
 * Purpose: an album/artist entry with an embedded track playlist.
 * Inputs:  admin CRUD, cover + track uploads
 * Outputs: Music documents
 * Deps:    plugins/softDelete
 *
 * Columns from api/v2/index.php::music and ::musics:
 *   id, fullname_fa, fullname_en, album_fa, album_en, description_fa,
 *   description_en, publish_date, tags, company, is_iranian, tracks,
 *   is_active, is_delete.
 *
 * Behaviours preserved:
 *   - `tracks` was a JSON column decoded on read, with each entry's file and
 *     image rewritten to assets/musics/{id}/{file}.mp3 and .../cover.jpg. It is
 *     a real subdocument array here, holding the stored paths directly.
 *   - `isIranian` drives calendar conversion: when set, the publish year is
 *     rendered as Jalali (api/v2/index.php::music calls
 *     `helper::year_gregorian_to_jalali`).
 *   - the legacy music search listed titles as
 *     CONCAT(fullname_fa, ' - ', album_fa); that concatenation is a read-model
 *     concern and is done in the service, not stored.
 */
import mongoose from 'mongoose';
import softDeletePlugin from './plugins/softDelete.js';

const trackSchema = new mongoose.Schema(
  {
    title: { type: String, trim: true, default: '' },
    /** Stored path to the audio file. */
    file: { type: String, required: true },
    /** Per-track artwork; falls back to the album cover when absent. */
    image: { type: String, default: null },
    duration: { type: Number, default: 0 },
    order: { type: Number, default: 0 },
  },
  { _id: true },
);

const musicSchema = new mongoose.Schema(
  {
    fullnameFa: { type: String, required: true, trim: true },
    fullnameEn: { type: String, trim: true, default: '' },
    albumFa: { type: String, trim: true, default: '' },
    albumEn: { type: String, trim: true, default: '' },

    descriptionFa: { type: String, default: '' },
    descriptionEn: { type: String, default: '' },

    /** Bare year, as with Movie.publishYear. Rendered Jalali when isIranian. */
    publishYear: { type: Number, default: null },

    /**
     * NEW — no legacy column. The music taxonomy, which is its own collection
     * and NOT the film `Genre` (see models/MusicGenre.js for why).
     *
     * One genre, not the three a film carries: `genre_1..3` exist on a movie
     * because the legacy schema had them and `genre_1` is load-bearing for the
     * public query. Nothing here needs that, and an album is one genre in
     * practice.
     *
     * Panel-only for now: it is edited on the music form and deliberately absent
     * from the public music shape, because the maintainer asked for it to be
     * visible in the panel alone. Exposing it later is one line in
     * services/music.service.js.
     */
    genre: { type: mongoose.Schema.Types.ObjectId, ref: 'MusicGenre', default: null, index: true },

    tags: { type: String, trim: true, default: '' },
    company: { type: String, trim: true, default: '' },

    /** legacy: musics_tbl.is_iranian — controls Jalali date rendering. */
    isIranian: { type: Boolean, default: false },

    coverPath: { type: String, default: null },
    tracks: { type: [trackSchema], default: [] },

    visitCount: { type: Number, default: 0, index: true },
  },
  { timestamps: true },
);

musicSchema.plugin(softDeletePlugin);

// Mirrors the legacy LIKE columns: fullname_fa/en, album_fa/en, tags, company,
// description_fa/en.
musicSchema.index({
  fullnameFa: 'text',
  fullnameEn: 'text',
  albumFa: 'text',
  albumEn: 'text',
  tags: 'text',
  company: 'text',
  descriptionFa: 'text',
  descriptionEn: 'text',
});

export const Music = mongoose.model('Music', musicSchema);
export default Music;
