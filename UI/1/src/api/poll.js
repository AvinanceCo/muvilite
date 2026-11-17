/**
 * Poll API.
 *
 * Purpose: fetch the survey questions and submit a set of answers.
 * Inputs:  the anonymous respondent token, {pollId, vote} pairs
 * Outputs: questions; a submission result plus the server's confirmation text
 * Deps:    api/client
 *
 * The legacy page hardcoded all nine questions as Persian HTML and persisted
 * only the answers. They come from the database now, so the survey can change
 * without a deploy.
 *
 * Submitting again within three hours REVISES the previous answers instead of
 * adding new ones, and the server returns a different confirmation for each
 * case. That message is what the UI shows — it is not reconstructed client-side.
 */
import { request, requestWithMeta } from './client.js';

/**
 * The survey questions in display order.
 * @returns {Promise<{_id: string, questionFa: string, questionEn: string, order: number}[]>}
 */
export function fetchPollQuestions() {
  return request({ url: '/poll/questions' });
}

/**
 * Submits answers.
 *
 * @param {{token: string, votes: {pollId: string, vote: number}[]}} submission
 * @returns {Promise<{data: {updated: boolean, count: number}, message: string}>}
 *          `updated` is true when this revised an existing response; `message`
 *          is the Persian confirmation to display.
 */
export function submitPollVotes({ token, votes }) {
  return requestWithMeta({ url: '/poll/votes', method: 'POST', data: { token, votes } });
}

export default { fetchPollQuestions, submitPollVotes };
