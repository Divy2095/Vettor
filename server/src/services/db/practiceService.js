import { ApiError } from "../../utils/apiError.js";
import { assertValidUUID, handleDbError, getPaginationRange } from "./dbUtils.js";

/**
 * Normalizes a practice attempt database record into the shape expected
 * by the existing Gemini scoring and frontend display components.
 *
 * @param {object} att
 * @returns {object}
 */
export const formatPracticeAttempt = (att) => {
  if (!att) return null;

  return {
    id: att.id,
    _id: att.id, // Compatibility alias
    userId: att.user_id,
    user: att.user_id, // Compatibility
    sessionId: att.session_id,
    generationSession: att.session_id, // Compatibility with QuestionPracticeAttempt
    questionId: att.question_id,
    questionText: att.question_text,
    answerText: att.answer_text,
    rubricScore: {
      clarity: att.clarity_score,
      structure: att.structure_score,
      depth: att.depth_score,
      relevance: att.relevance_score,
    },
    overallScore: att.overall_score,
    isMatch: att.is_match,
    shouldImprove: att.should_improve,
    feedbackSummary: att.feedback_summary,
    strengths: Array.isArray(att.strengths) ? att.strengths : [],
    improvements: Array.isArray(att.improvements) ? att.improvements : [],
    feedbackProvider: att.feedback_provider || "gemini",
    createdAt: att.created_at,
  };
};

/**
 * Creates a new practice attempt with Gemini or heuristic evaluation scores.
 * Enforces strict user isolation via PostgreSQL RLS and composite foreign keys.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} client - User-scoped Supabase client
 * @param {object} attemptData
 * @param {string} attemptData.userId - Authenticated user UUID
 * @param {string} [attemptData.sessionId] - Associated interview session UUID
 * @param {string} [attemptData.questionId] - Associated session question UUID
 * @param {string} attemptData.questionText
 * @param {string} attemptData.answerText
 * @param {object} attemptData.rubricScore - { clarity, structure, depth, relevance } (0-10)
 * @param {number} attemptData.overallScore - (0-10)
 * @param {boolean} [attemptData.isMatch=false]
 * @param {boolean} [attemptData.shouldImprove=true]
 * @param {string} attemptData.feedbackSummary
 * @param {Array<string>} [attemptData.strengths=[]]
 * @param {Array<string>} [attemptData.improvements=[]]
 * @param {string} [attemptData.feedbackProvider="gemini"]
 * @returns {Promise<object>}
 */
export const createPracticeAttempt = async (client, attemptData) => {
  const {
    userId,
    sessionId = null,
    questionId = null,
    questionText,
    answerText,
    rubricScore = {},
    overallScore,
    isMatch = false,
    shouldImprove = true,
    feedbackSummary,
    strengths = [],
    improvements = [],
    feedbackProvider = "gemini",
  } = attemptData;

  assertValidUUID(userId, "userId");
  if (sessionId) assertValidUUID(sessionId, "sessionId");
  if (questionId) assertValidUUID(questionId, "questionId");

  if (!questionText || questionText.trim().length < 10) {
    throw new ApiError(400, "Question text must be at least 10 characters");
  }

  if (!answerText || answerText.trim().length < 10 || answerText.trim().length > 5000) {
    throw new ApiError(400, "Answer text must be between 10 and 5000 characters");
  }

  if (!feedbackSummary || feedbackSummary.trim().length === 0) {
    throw new ApiError(400, "Feedback summary must be non-empty");
  }

  // Clamp and validate scores (0 to 10) matching PostgreSQL CHECK constraints
  const clampScore = (score, defaultVal = 5) => {
    const num = Math.round(Number(score));
    if (isNaN(num)) return defaultVal;
    return Math.max(0, Math.min(10, num));
  };

  const clarityScore = clampScore(rubricScore.clarity);
  const structureScore = clampScore(rubricScore.structure);
  const depthScore = clampScore(rubricScore.depth);
  const relevanceScore = clampScore(rubricScore.relevance);
  const safeOverallScore = clampScore(overallScore, Math.round((clarityScore + structureScore + depthScore + relevanceScore) / 4));

  const validProvider = feedbackProvider === "heuristic" ? "heuristic" : "gemini";

  const { data, error } = await client
    .from("practice_attempts")
    .insert({
      user_id: userId,
      session_id: sessionId,
      question_id: questionId,
      question_text: questionText.trim(),
      answer_text: answerText.trim(),
      clarity_score: clarityScore,
      structure_score: structureScore,
      depth_score: depthScore,
      relevance_score: relevanceScore,
      overall_score: safeOverallScore,
      is_match: Boolean(isMatch),
      should_improve: Boolean(shouldImprove),
      feedback_summary: feedbackSummary.trim(),
      strengths: Array.isArray(strengths) ? strengths : [],
      improvements: Array.isArray(improvements) ? improvements : [],
      feedback_provider: validProvider,
    })
    .select()
    .single();

  if (error) {
    throw handleDbError(error, "Failed to record practice attempt");
  }

  return formatPracticeAttempt(data);
};

/**
 * Lists practice history for an authenticated user, optionally scoped to a session.
 * Governed by RLS: callers can only read their own attempts (or admin).
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {string} userId
 * @param {object} [options]
 * @param {string} [options.sessionId]
 * @param {number} [options.page=1]
 * @param {number} [options.limit=20]
 * @returns {Promise<{ attempts: Array<object>, pagination: object }>}
 */
export const listPracticeHistory = async (
  client,
  userId,
  { sessionId, page = 1, limit = 20 } = {},
) => {
  assertValidUUID(userId, "userId");
  if (sessionId) assertValidUUID(sessionId, "sessionId");

  const { page: pageNum, limit: limitNum, from, to } = getPaginationRange({
    page,
    limit,
    maxLimit: 100,
  });

  let query = client
    .from("practice_attempts")
    .select("*", { count: "exact" })
    .eq("user_id", userId);

  if (sessionId) {
    query = query.eq("session_id", sessionId);
  }

  query = query.order("created_at", { ascending: false }).range(from, to);

  const { data, error, count } = await query;

  if (error) {
    throw handleDbError(error, "Failed to list practice history");
  }

  const total = count || 0;
  return {
    attempts: (data || []).map(formatPracticeAttempt),
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      pages: Math.max(1, Math.ceil(total / limitNum)),
    },
  };
};

/**
 * Counts the number of practice attempts recorded for a specific session.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {string} sessionId
 * @returns {Promise<number>}
 */
export const countSessionPracticeAttempts = async (client, sessionId) => {
  assertValidUUID(sessionId, "sessionId");

  const { count, error } = await client
    .from("practice_attempts")
    .select("id", { count: "exact", head: true })
    .eq("session_id", sessionId);

  if (error) {
    throw handleDbError(error, `Failed to count practice attempts for session ${sessionId}`);
  }

  return count || 0;
};

export default {
  formatPracticeAttempt,
  createPracticeAttempt,
  listPracticeHistory,
  countSessionPracticeAttempts,
};
