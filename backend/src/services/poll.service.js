/**
 * Poll service — satisfaction survey.
 *
 * Purpose: reproduce `api/v2/index.php::poll()`, the only public write path in
 *          the legacy application that carries real business logic.
 * Inputs:  an anonymous respondent token, a list of {pollId, vote}
 * Outputs: whether the submission created or revised a response
 * Deps:    repositories, config/constants, utils/ApiError
 *
 * Legacy logic, verbatim:
 *
 *   SELECT id FROM poll_history_tbl
 *    WHERE created_date BETWEEN DATE_SUB(now(), INTERVAL 3 HOUR) AND now()
 *      AND token = '$token'
 *
 *   if (rows found)
 *       foreach vote: UPDATE poll_history_tbl SET vote = ?
 *                      WHERE poll_id = ? AND token = '$token'
 *       -> "نظرات شما با موفقیت بروزرسانی شد."  (your answers were updated)
 *   else
 *       foreach vote: INSERT INTO poll_history_tbl (user_ip, poll_id, vote, token)
 *       -> "نظرات شما با موفقیت ثبت شد."        (your answers were recorded)
 *
 * So a respondent may revise their answers for three hours; after that a
 * resubmission counts as a new, separate response.
 *
 * DEFECT FIXED: the legacy UPDATE had no time bound on it. Once a token
 * qualified as "recent", the update rewrote EVERY row that token had ever
 * written for that question — silently corrupting responses recorded days
 * earlier. The update below is scoped to the same three-hour window that
 * selected it, which is plainly the intent.
 *
 * The token is client-generated (`Math.random().toString(36)` kept in
 * localStorage) and anonymous. It is a deduplication key, NOT authentication,
 * and nothing of value is gated on it.
 */
import mongoose from 'mongoose';
import { pollRepository, pollHistoryRepository } from '../repositories/index.js';
import { POLL_REVOTE_WINDOW_HOURS } from '../config/constants.js';
import ApiError from '../utils/ApiError.js';

/** Start of the revision window. */
function windowStart() {
  return new Date(Date.now() - POLL_REVOTE_WINDOW_HOURS * 60 * 60 * 1000);
}

/** The survey questions, in display order. */
export async function listQuestions() {
  return pollRepository.find(pollRepository.publicScope(), {
    sort: { order: 1 },
    select: 'questionFa questionEn order',
  });
}

/**
 * Records or revises a set of answers.
 *
 * @param {object}   input
 * @param {string}   input.token   anonymous respondent id
 * @param {string}   input.userIp
 * @param {{pollId: string, vote: number}[]} input.votes
 * @returns {Promise<{updated: boolean, count: number}>}
 */
export async function submitVotes({ token, userIp, votes }) {
  const pollIds = votes.map((vote) => new mongoose.Types.ObjectId(vote.pollId));

  // Every referenced question must exist and be active, or the submission is
  // rejected wholesale rather than half-recorded.
  const questions = await pollRepository.find(pollRepository.publicScope({ _id: { $in: pollIds } }), {
    select: '_id',
  });

  if (questions.length !== new Set(votes.map((vote) => vote.pollId)).size) {
    throw ApiError.badRequest('One or more poll questions do not exist');
  }

  const since = windowStart();

  const hasRecentResponse = await pollHistoryRepository.exists({
    token,
    isDeleted: false,
    createdAt: { $gte: since },
  });

  if (hasRecentResponse) {
    // Revise the answers belonging to the in-window response only.
    await Promise.all(
      votes.map((vote) =>
        pollHistoryRepository.model.updateMany(
          { token, poll: vote.pollId, isDeleted: false, createdAt: { $gte: since } },
          { $set: { vote: vote.vote } },
        ),
      ),
    );

    return { updated: true, count: votes.length };
  }

  await pollHistoryRepository.insertMany(
    votes.map((vote) => ({
      poll: vote.pollId,
      token,
      vote: vote.vote,
      userIp,
    })),
  );

  return { updated: false, count: votes.length };
}

export default { listQuestions, submitVotes };
