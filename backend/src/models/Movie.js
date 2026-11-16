/**
 * Movie — legacy `movies_tbl`.
 *
 * Purpose: the central catalog entity. Everything on the public site other than
 *          music hangs off this collection.
 * Inputs:  admin CRUD, poster uploads
 * Outputs: Movie documents
 * Deps:    plugins/softDelete, config/constants
 *
 * Column provenance — reconstructed from:
 *   - api/v2/models/Movie.php (withGenre, movieList, simpleSearch, movie_exists)
 *   - api/v2/index.php::movie / ::search / ::similar
 *   - admin/3P1z05m4n4Gm3nt/views/movies/form.php (the edit form's field names)
 *   - admin/3P1z05m4n4Gm3nt/views/movies/update.php (per-field coercion rules)
 *   - admin/3P1z05m4n4Gm3nt/controllers/MovieController.php (list filters)
 *
 * Behaviours preserved:
 *   - `publishYear` holds a bare YEAR, not a date. The admin form submits it in
 *     the Jalali calendar when `defaultOrigin === 0` (see utils/dates.js).
 *   - `price`, `priceDiscount` and `movieLength` coerce empty input to 0, and
 *     `genre2`/`genre3` coerce empty input to null
 *     (views/movies/update.php:39-56).
 *   - `platform` was stored comma-joined by the legacy form handler
 *     (`implode(',', $value)`); it is a real array here.
 *   - `seasonId` is the only trace of the never-finished series feature. It is
 *     carried so the `season_id IS NULL` filter in the legacy search helper
 *     remains expressible, but no series functionality is implemented.
 */
import mongoose from 'mongoose';
import softDeletePlugin from './plugins/softDelete.js';
import {
  DEVICE_PLATFORM_VALUES,
  VIDEO_STATUS,
  VIDEO_STATUS_VALUES,
} from '../config/constants.js';

const movieSchema = new mongoose.Schema(
  {
    titleFa: { type: String, required: true, trim: true },
    titleEn: { type: String, trim: true, default: '' },

    /**
     * NEW — no legacy column. Splits this collection into short vertical clips
     * and full-length films. See config/constants.js for the video rules each
     * kind accepts and why a clip lives here rather than in its own collection.
     *
     * A clip uses only the title, primary genre, descriptions, tags and
     * category membership; the rest of the fields below are ignored on write
     * for a clip (services/admin/registry.js) rather than being cleared, so
     * flipping a film to a clip and back does not destroy its metadata.
     */
    isClip: { type: Boolean, default: false, index: true },

    descriptionFa: { type: String, default: '' },
    descriptionEn: { type: String, default: '' },

    /** Bare year. Jalali on input when defaultOrigin === 0, stored Gregorian. */
    publishYear: { type: Number, default: null },

    /** 0 = the source data is Persian/Jalali. legacy: movies_tbl.default_origin */
    defaultOrigin: { type: Number, default: 0 },

    imdbRank: { type: Number, default: 0, min: 0, max: 10 },
    imdbCode: { type: String, trim: true, default: '' },

    /** Country CODE, matching Country.countryCode — not an id. */
    country: { type: String, trim: true, default: '' },
    company: { type: String, trim: true, default: '' },
    location: { type: String, trim: true, default: '' },

    tags: { type: String, trim: true, default: '' },

    /**
     * genre1 is required for a movie to be visible: the legacy detail query
     * INNER JOINs genres_tbl on genre_1, and "similar movies" matches on it.
     */
    genre1: { type: mongoose.Schema.Types.ObjectId, ref: 'Genre', default: null, index: true },
    genre2: { type: mongoose.Schema.Types.ObjectId, ref: 'Genre', default: null },
    genre3: { type: mongoose.Schema.Types.ObjectId, ref: 'Genre', default: null },

    ageRange: { type: mongoose.Schema.Types.ObjectId, ref: 'AgeRange', default: null },

    /** Runtime in minutes. Empty input coerces to 0, as in the legacy form. */
    movieLength: { type: Number, default: 0 },

    isKids: { type: Boolean, default: false },
    /** Editorial "under review" flag. legacy: movies_tbl.is_review */
    isReview: { type: Boolean, default: false },

    price: { type: Number, default: 0, min: 0 },
    priceDiscount: { type: Number, default: 0, min: 0 },
    /** Nullable in the legacy form: an empty value is unset, not zeroed. */
    cinemaExpireHour: { type: Number, default: null },

    /** Devices this title is offered on. legacy stored these comma-joined. */
    platform: {
      type: [{ type: Number, enum: DEVICE_PLATFORM_VALUES }],
      default: [],
    },

    /**
     * Media paths. The legacy app derived these from the row id
     * (assets/movies/{id}.jpg, {id}-216x332.jpg). Storing them explicitly lets
     * uploads use unique generated filenames without overwriting, per CLAUDE.md.
     */
    posterPath: { type: String, default: null },
    thumbnailPath: { type: String, default: null },
    trailerPath: { type: String, default: null },
    /**
     * Either an uploaded file under `/uploads/movies/` or an absolute external
     * URL — both clients already pass an `http(s)` value through untouched, so
     * one field serves both. The legacy player derived this from the row id
     * (`assets/video/{id}.mp4`) and nothing in the panel could set it.
     */
    videoPath: { type: String, default: null },

    /**
     * What the video actually is, MEASURED IN THE BROWSER at upload time.
     *
     * The server has no ffmpeg, so it cannot open a video file; the admin panel
     * decodes the metadata locally and sends these three numbers with the
     * upload, exactly as the pre-roll uploader already does for its duration.
     * They are what the clip/film standard is checked against — see
     * services/admin/movieVideo.service.js for what that check can and cannot
     * promise.
     */
    videoDurationSecond: { type: Number, default: null },
    videoWidth: { type: Number, default: null },
    videoHeight: { type: Number, default: null },

    /**
     * The HLS transcode of the latest UPLOADED video (NEW, beyond parity — see
     * config/constants.js VIDEO_STATUS and services/admin/movieVideo.service.js).
     *
     * `videoPath` is always what plays. An upload does not touch it: the file
     * lands in `videoSourcePath`, the transcoder turns it into an HLS set, and
     * only then does `videoPath` move to that set's master playlist — so a title
     * being re-encoded keeps playing its previous video until the new one is
     * ready. Once that happens the source is deleted (the maintainer's call).
     *
     * For uploads, the three measurements above are written by the server's
     * ffprobe once the transcode succeeds, not taken from the browser.
     */
    videoSourcePath: { type: String, default: null },
    videoStatus: { type: String, enum: VIDEO_STATUS_VALUES, default: VIDEO_STATUS.NONE },
    /** 0–100 while `processing`. */
    videoProgress: { type: Number, default: 0 },
    /** Why the last transcode failed — for the operator, never shown to passengers. */
    videoError: { type: String, default: null },

    /** Incremented by playback; also a sort key on list endpoints. */
    visitCount: { type: Number, default: 0, index: true },

    /** Unused series scaffolding carried over from the legacy schema. */
    seasonId: { type: mongoose.Schema.Types.ObjectId, default: null },
  },
  { timestamps: true },
);

movieSchema.plugin(softDeletePlugin);

// Search covers exactly the columns the legacy LIKE query touched:
// title_fa, title_en, tags, company, imdb_code.
movieSchema.index({ titleFa: 'text', titleEn: 'text', tags: 'text', company: 'text', imdbCode: 'text' });

// Supports the ordered, filtered list endpoints.
movieSchema.index({ isDeleted: 1, isActive: 1, isClip: 1, createdAt: -1 });
movieSchema.index({ isDeleted: 1, isActive: 1, imdbRank: -1 });
movieSchema.index({ isDeleted: 1, isActive: 1, createdAt: -1 });
movieSchema.index({ isDeleted: 1, isActive: 1, publishYear: -1 });
// The transcoder's start-up question: "which uploads were waiting or running?"
// Sparse in practice — nearly every row is `none` or `ready`.
movieSchema.index({ videoStatus: 1 });

export const Movie = mongoose.model('Movie', movieSchema);
export default Movie;
