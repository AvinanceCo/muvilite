/**
 * Poll — legacy `poll_tbl`.
 *
 * Purpose: a satisfaction-survey question. The legacy site ran a 9-question
 *          in-flight service survey.
 * Inputs:  admin CRUD, seeded with the legacy questions
 * Outputs: Poll documents
 * Deps:    plugins/softDelete
 *
 * Legacy note: `poll_tbl` and its model existed and were loaded, but the public
 * page never queried them — poll.php hardcoded the nine questions as HTML with
 * `name="question-{1..9}"`, and only the ANSWERS were persisted (to
 * poll_history_tbl, keyed by poll_id 1..9). Serving the questions from the
 * table is what the schema was built for, and it is what lets a rewritten
 * frontend render the survey without hardcoding Persian strings.
 *
 * The four answer values are fixed by the legacy markup:
 *   4 = عالی (excellent), 3 = خوب (good), 2 = متوسط (average), 1 = ضعیف (poor).
 */
import mongoose from 'mongoose';
import softDeletePlugin from './plugins/softDelete.js';

/** Answer scale from poll.php. Value order is descending by satisfaction. */
export const POLL_ANSWERS = Object.freeze([
  { value: 4, fa: 'عالی', en: 'Excellent' },
  { value: 3, fa: 'خوب', en: 'Good' },
  { value: 2, fa: 'متوسط', en: 'Average' },
  { value: 1, fa: 'ضعیف', en: 'Poor' },
]);

export const POLL_ANSWER_VALUES = Object.freeze(POLL_ANSWERS.map((answer) => answer.value));

const pollSchema = new mongoose.Schema(
  {
    questionFa: { type: String, required: true, trim: true },
    questionEn: { type: String, trim: true, default: '' },
    /** Display position in the survey. legacy: the 1..9 question ordering. */
    order: { type: Number, default: 0, index: true },
  },
  { timestamps: true },
);

pollSchema.plugin(softDeletePlugin);

export const Poll = mongoose.model('Poll', pollSchema);
export default Poll;
