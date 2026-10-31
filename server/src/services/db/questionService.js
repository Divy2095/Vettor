import { ApiError } from "../../utils/apiError.js";
import { assertValidUUID, handleDbError, getPaginationRange } from "./dbUtils.js";

const VALID_DIFFICULTIES = new Set(["Easy", "Medium", "Hard", "Unknown"]);
const VALID_SOURCE_TYPES = new Set(["generated", "ml_dataset", "fallback"]);

/**
 * Normalizes a session question record into the shape expected across
 * both QuestionsDisplay.jsx and legacy resume/ml controllers.
 *
 * @param {object} q
 * @param {number} [idx]
 * @returns {object}
 */
export const formatSessionQuestion = (q, idx) => {
  if (!q) return null;

  const orderIndex = q.order_index !== undefined ? q.order_index : (idx || 0);
  const relevance = q.relevance_score !== null && q.relevance_score !== undefined ? Number(q.relevance_score) : 0;
  const tagScore = q.tag_score !== null && q.tag_score !== undefined ? Number(q.tag_score) : 0;
  const combined = q.combined_score !== null && q.combined_score !== undefined ? Number(q.combined_score) : relevance;

  return {
    id: q.id,
    _id: q.id, // Compatibility
    sessionId: q.session_id,
    orderIndex,
    sr_no: orderIndex + 1, // 1-based display number for QuestionsDisplay.jsx
    question: q.question_text, // Frontend expects question
    questionText: q.question_text, // Frontend & backend alias
    topic: q.topic || q.focus_skill || "General",
    focusSkill: q.focus_skill || q.topic || "",
    difficulty: q.difficulty || "Medium",
    tags: Array.isArray(q.tags) ? q.tags : [],
    score: relevance, // Semantic distance
    similarity_score: relevance, // ML alias
    tag_score: tagScore, // Tag density
    final_score: combined, // Match percentage
    sourceType: q.source_type || "generated",
    createdAt: q.created_at,
  };
};

/**
 * Batch-persists generated questions for an interview session.
 * Governed by RLS: caller must own the parent session.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {string} sessionId
 * @param {Array<object>} questions
 * @returns {Promise<Array<object>>}
 */
export const createSessionQuestions = async (client, sessionId, questions) => {
  assertValidUUID(sessionId, "sessionId");

  if (!Array.isArray(questions) || questions.length === 0) {
    return [];
  }

  const rows = questions.map((q, idx) => {
    const rawText = (q.questionText || q.question || "").trim();
    if (rawText.length < 10) {
      throw new ApiError(400, `Question at position ${idx} is too short (minimum 10 characters)`);
    }

    const rawDiff = q.difficulty ? String(q.difficulty).trim() : "Medium";
    const difficulty = VALID_DIFFICULTIES.has(rawDiff)
      ? rawDiff
      : VALID_DIFFICULTIES.has(rawDiff.charAt(0).toUpperCase() + rawDiff.slice(1).toLowerCase())
      ? rawDiff.charAt(0).toUpperCase() + rawDiff.slice(1).toLowerCase()
      : "Unknown";

    const rawSource = q.sourceType || q.source_type || "generated";
    const sourceType = VALID_SOURCE_TYPES.has(rawSource) ? rawSource : "generated";

    const relScore = q.relevanceScore !== undefined
      ? q.relevanceScore
      : q.similarity_score !== undefined
      ? q.similarity_score
      : q.score !== undefined
      ? q.score
      : null;

    const row = {
      session_id: sessionId,
      order_index: q.orderIndex !== undefined ? Number(q.orderIndex) : idx,
      question_text: rawText.slice(0, 1000),
      focus_skill: (q.focusSkill || q.topic || "").trim().slice(0, 80),
      tags: Array.isArray(q.tags) ? q.tags.map((t) => String(t).trim().toLowerCase()).filter(Boolean) : [],
      difficulty,
      source_type: sourceType,
      relevance_score: relScore !== null && !isNaN(relScore) ? Math.min(1.0, Math.max(0.0, Number(relScore))) : null,
    };

    // Include Migration 07 fields if available
    if (q.topic) row.topic = String(q.topic).trim().slice(0, 100);
    if (q.tag_score !== undefined && q.tag_score !== null && !isNaN(q.tag_score)) {
      row.tag_score = Math.min(1.0, Math.max(0.0, Number(q.tag_score)));
    }
    if (q.final_score !== undefined && q.final_score !== null && !isNaN(q.final_score)) {
      row.combined_score = Math.min(1.0, Math.max(0.0, Number(q.final_score)));
    } else if (q.combined_score !== undefined && q.combined_score !== null && !isNaN(q.combined_score)) {
      row.combined_score = Math.min(1.0, Math.max(0.0, Number(q.combined_score)));
    }

    return row;
  });

  // Attempt insert with rich columns; gracefully fallback to core schema if Migration 07 is not yet executed
  let { data, error } = await client
    .from("session_questions")
    .insert(rows)
    .select();

  if (error && (error.message?.includes("topic") || error.message?.includes("tag_score") || error.message?.includes("combined_score"))) {
    const strippedRows = rows.map((r) => {
      const { topic, tag_score, combined_score, ...core } = r;
      return core;
    });

    const retry = await client
      .from("session_questions")
      .insert(strippedRows)
      .select();

    data = retry.data;
    error = retry.error;
  }

  if (error) {
    throw handleDbError(error, "Failed to persist session questions");
  }

  return (data || []).map((q, idx) => formatSessionQuestion(q, idx));
};

/**
 * Retrieves questions for an interview session with optional filtering and pagination.
 * Governed by RLS: parent session must belong to caller (or admin).
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {string} sessionId
 * @param {object} [options]
 * @param {number} [options.page=1]
 * @param {number} [options.limit=10]
 * @param {string} [options.difficulty]
 * @param {string} [options.topic]
 * @returns {Promise<{ questions: Array<object>, pagination: object }>}\n */
export const getSessionQuestions = async (
  client,
  sessionId,
  { page = 1, limit = 10, difficulty, topic } = {},
) => {
  assertValidUUID(sessionId, "sessionId");

  const { page: pageNum, limit: limitNum, from, to } = getPaginationRange({
    page,
    limit,
    maxLimit: 100,
  });

  let query = client
    .from("session_questions")
    .select("*", { count: "exact" })
    .eq("session_id", sessionId);

  if (difficulty && VALID_DIFFICULTIES.has(difficulty)) {
    query = query.eq("difficulty", difficulty);
  }

  if (topic && topic.trim()) {
    query = query.or(`focus_skill.ilike.%${topic.trim()}%,topic.ilike.%${topic.trim()}%`);
  }

  query = query.order("order_index", { ascending: true }).range(from, to);

  const { data, error, count } = await query;

  if (error) {
    throw handleDbError(error, `Failed to fetch questions for session ${sessionId}`);
  }

  const total = count || 0;
  return {
    questions: (data || []).map((q, idx) => formatSessionQuestion(q, from + idx)),
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      pages: Math.max(1, Math.ceil(total / limitNum)),
    },
  };
};

/**
 * Lists questions from the curated question bank (public.questions).
 * Accessible to authenticated candidates and admins.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {object} [options]
 * @param {number} [options.page=1]
 * @param {number} [options.limit=20]
 * @param {string} [options.topic]
 * @param {string} [options.difficulty]
 * @param {string} [options.company]
 * @param {string} [options.search]
 * @returns {Promise<{ questions: Array<object>, pagination: object }>}\n */
export const listCuratedQuestions = async (
  client,
  { page = 1, limit = 20, topic, difficulty, company, search } = {},
) => {
  const { page: pageNum, limit: limitNum, from, to } = getPaginationRange({
    page,
    limit,
    maxLimit: 100,
  });

  let query = client
    .from("questions")
    .select("id, question_text, topic, difficulty, tags, company, seen_in_interview, is_active, approved_by, created_at", {
      count: "exact",
    })
    .eq("is_active", true);

  if (topic && topic.trim()) {
    query = query.ilike("topic", `%${topic.trim()}%`);
  }

  if (difficulty && VALID_DIFFICULTIES.has(difficulty)) {
    query = query.eq("difficulty", difficulty);
  }

  if (company && company.trim()) {
    query = query.ilike("company", `%${company.trim()}%`);
  }

  if (search && search.trim()) {
    query = query.ilike("question_text", `%${search.trim()}%`);
  }

  query = query.order("created_at", { ascending: false }).range(from, to);

  const { data, error, count } = await query;

  if (error) {
    throw handleDbError(error, "Failed to list curated questions");
  }

  const total = count || 0;
  return {
    questions: (data || []).map((q) => ({
      id: q.id,
      _id: q.id,
      questionText: q.question_text,
      question: q.question_text,
      topic: q.topic,
      difficulty: q.difficulty,
      tags: q.tags || [],
      company: q.company,
      seenInInterview: q.seen_in_interview,
      approvedBy: q.approved_by,
      createdAt: q.created_at,
    })),
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      pages: Math.max(1, Math.ceil(total / limitNum)),
    },
  };
};

/**
 * Admin workflow: Adds a question directly to the curated question bank.
 * Restricted by RLS: admin-only INSERT policy.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} client - Admin-privileged or authenticated admin client
 * @param {object} questionData
 * @param {string} questionData.questionText
 * @param {string} [questionData.topic="General"]
 * @param {string} [questionData.difficulty="Medium"]
 * @param {Array<string>} [questionData.tags=[]]
 * @param {string} [questionData.company=""]
 * @param {boolean} [questionData.seenInInterview=false]
 * @param {string} [questionData.approvedBy]
 * @returns {Promise<object>}
 */
export const createCuratedQuestion = async (client, questionData) => {
  const {
    questionText,
    topic = "General",
    difficulty = "Medium",
    tags = [],
    company = "",
    seenInInterview = false,
    approvedBy = null,
  } = questionData;

  if (!questionText || questionText.trim().length < 10) {
    throw new ApiError(400, "Question text must be at least 10 characters");
  }

  if (approvedBy) assertValidUUID(approvedBy, "approvedBy");

  const normalizedDiff = VALID_DIFFICULTIES.has(difficulty) ? difficulty : "Medium";

  const { data, error } = await client
    .from("questions")
    .insert({
      question_text: questionText.trim(),
      topic: topic ? topic.trim().slice(0, 100) : "General",
      difficulty: normalizedDiff,
      tags: Array.isArray(tags) ? tags.map((t) => String(t).trim().toLowerCase()).filter(Boolean) : [],
      company: company ? company.trim().slice(0, 100) : "",
      seen_in_interview: Boolean(seenInInterview),
      approved_by: approvedBy,
      is_active: true,
    })
    .select()
    .single();

  if (error) {
    throw handleDbError(error, "Failed to create curated question");
  }

  return {
    id: data.id,
    _id: data.id,
    questionText: data.question_text,
    topic: data.topic,
    difficulty: data.difficulty,
    tags: data.tags,
    company: data.company,
    seenInInterview: data.seen_in_interview,
    approvedBy: data.approved_by,
    createdAt: data.created_at,
  };
};

export default {
  formatSessionQuestion,
  createSessionQuestions,
  getSessionQuestions,
  listCuratedQuestions,
  createCuratedQuestion,
};
