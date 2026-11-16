/**
 * SystemSetting — installation-wide switches an operator flips in the panel.
 *
 * Purpose: hold settings that belong to the installation rather than to any
 *          one record. One document, like Branding.
 * Inputs:  admin «تنظیمات ویدئو» screen
 * Outputs: the singleton document
 * Deps:    mongoose
 *
 * NEW (beyond parity). The legacy application had no settings screen.
 *
 * `videoTranscodeEnabled` — whether an uploaded film or clip is transcoded to
 * HLS (backend MIGRATION §21) or kept as the MP4/WebM it was uploaded as
 * (the behaviour before the transcoder). It is null until an operator first
 * chooses, and null means "follow the server": HLS when ffmpeg is installed,
 * MP4 when it is not — so a server set up without the transcoder works out
 * of the box, and one with it uses it. See services/videoSettings.service.js.
 */
import mongoose from 'mongoose';

const systemSettingSchema = new mongoose.Schema(
  {
    /** Singleton guard: one value, one row. */
    key: { type: String, default: 'default', unique: true, enum: ['default'] },

    /** true = HLS, false = keep MP4, null = not chosen yet (follow the server). */
    videoTranscodeEnabled: { type: Boolean, default: null },

    /** Who last changed a setting — shown on the admin screen. */
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

export const SystemSetting = mongoose.model('SystemSetting', systemSettingSchema);
export default SystemSetting;
