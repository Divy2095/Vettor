import { ApiError } from "../../utils/apiError.js";
import { assertValidUUID, handleDbError } from "./dbUtils.js";
import resumeService from "./resumeService.js";

const VALID_LEVELS = new Set(["intern", "junior", "mid", "senior", "lead"]);
const VALID_STATUSES = new Set(["pending", "processing", "completed", "failed"]);

/**
 * Normalizes a database interview_session record into the shape expected
 * across existing Express controllers and the React frontend.
 *
 * @param {object} session
 * @param {number} [totalQuestions=0]
 * @param {number} [answeredCount=0]
 * @returns {object}
 */
export const formatSession = (session, totalQuestions = 0, answeredCount = 0) => {
  if (!session) return null;

  return {
    id: session.id,
    _id: session.id, // Direct backward compatibility for frontend and sessionManager
    userId: session.user_id,
    user: session.user_id, // Compatibility with QuestionGenerationSession.user
    resumeId: session.resume_id || null,
    displayName: session.display_name || null,
    targetRole: session.target_role || "",
    targetCompany: session.target_company || "",
    targetLevel: session.target_level || "mid",
    targetDomain: session.target_domain || "",
    resumeSkills: session.resume_skills || [],
    skillGap: session.skill_gap || {
      matchedSkills: [],
      missingSkills: [],
      prioritizedLearningPlan: [],
    },
    status: session.status || "completed",
    processingTime: session.processing_time_ms || 0,
    processingTimeMs: session.processing_time_ms || 0,
    errorMessage: session.error_message || null,
    lastAccessedAt: session.last_accessed_at,
    createdAt: session.created_at,
    updatedAt: session.updated_at,
    totalQuestions,
    answeredCount,
  };
};

/**
 * Creates a new interview preparation session in PostgreSQL.
 * Governed by RLS: user_id must strictly match the caller's auth.uid().
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} client - User-scoped Supabase client
 * @param {object} sessionData
 * @param {string} sessionData.userId - Authenticated user UUID
 * @param {string} [sessionData.resumeId] - Optional resume UUID reference
 * @param {string} [sessionData.displayName] - Optional custom name for the session
 * @param {string} [sessionData.targetRole=""]
 * @param {string} [sessionData.targetCompany=""]
 * @param {string} [sessionData.targetLevel="mid"]
 * @param {string} [sessionData.targetDomain=""]
 * @param {Array<string>} [sessionData.resumeSkills=[]]
 * @param {object} [sessionData.skillGap]
 * @param {string} [sessionData.status="completed"]
 * @param {number} [sessionData.processingTimeMs=0]
 * @param {string} [sessionData.errorMessage]
 * @returns {Promise<object>}
 */
export const createSession = async (client, sessionData) => {
  const {
    userId,
    resumeId = null,
    displayName = null,
    targetRole = "",
    targetCompany = "",
    targetLevel = "mid",
    targetDomain = "",
    resumeSkills = [],
    skillGap = null,
    status = "completed",
    processingTimeMs = 0,
    errorMessage = null,
  } = sessionData;

  assertValidUUID(userId, "userId");
  if (resumeId) assertValidUUID(resumeId, "resumeId");

  const normalizedLevel = VALID_LEVELS.has(targetLevel?.toLowerCase())
    ? targetLevel.toLowerCase()
    : "mid";

  const normalizedStatus = VALID_STATUSES.has(status?.toLowerCase())
    ? status.toLowerCase()
    : "completed";

  // Validate and satisfy PostgreSQL CHECK constraint: ck_interview_sessions_skill_gap
  const safeSkillGap = {
    matchedSkills: Array.isArray(skillGap?.matchedSkills) ? skillGap.matchedSkills : [],
    missingSkills: Array.isArray(skillGap?.missingSkills) ? skillGap.missingSkills : [],
    prioritizedLearningPlan: Array.isArray(skillGap?.prioritizedLearningPlan)
      ? skillGap.prioritizedLearningPlan
      : [],
  };

  const payload = {
    user_id: userId,
    resume_id: resumeId,
    display_name: displayName ? String(displayName).slice(0, 255) : null,
    target_role: String(targetRole || "").slice(0, 100),
    target_company: String(targetCompany || "").slice(0, 100),
    target_level: normalizedLevel,
    target_domain: String(targetDomain || "").slice(0, 100),
    resume_skills: Array.isArray(resumeSkills)
      ? [...new Set(resumeSkills.map((s) => String(s).trim().toLowerCase()).filter(Boolean))]
      : [],
    skill_gap: safeSkillGap,
    status: normalizedStatus,
    processing_time_ms: Math.max(0, parseInt(processingTimeMs, 10) || 0),
  };

  // If Migration 07 is executed, error_message column exists
  if (errorMessage) {
    payload.error_message = String(errorMessage);
  }

  let { data, error } = await client
    .from("interview_sessions")
    .insert(payload)
    .select()
    .single();

  // Defensive fallback if Migration 07 hasn't run yet and error_message column is unknown
  if (error && error.message?.includes("error_message")) {
    delete payload.error_message;
    const retry = await client
      .from("interview_sessions")
      .insert(payload)
      .select()
      .single();
    data = retry.data;
    error = retry.error;
  }

  if (error) {
    throw handleDbError(error, "Failed to create interview session");
  }

  return formatSession(data);
};

/**
 * Retrieves a single session by ID and computes dynamic question stats.
 * Governed by RLS: caller must own the session (or be an admin).
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {string} sessionId
 * @returns {Promise<object|null>}
 */
export const getSessionById = async (client, sessionId) => {
  assertValidUUID(sessionId, "sessionId");

  const { data: session, error } = await client
    .from("interview_sessions")
    .select("*")
    .eq("id", sessionId)
    .maybeSingle();

  if (error) {
    throw handleDbError(error, `Failed to fetch session ${sessionId}`);
  }

  if (!session) {
    return null;
  }

  // Count related session_questions
  const { count: totalQuestions } = await client
    .from("session_questions")
    .select("id", { count: "exact", head: true })
    .eq("session_id", sessionId);

  // Count distinct answered practice questions
  const { count: answeredCount } = await client
    .from("practice_attempts")
    .select("id", { count: "exact", head: true })
    .eq("session_id", sessionId);

  return formatSession(session, totalQuestions || 0, answeredCount || 0);
};

/**
 * Lists interview preparation sessions for a user, ordered by creation date.
 * Governed by RLS: callers can only see their own sessions.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {string} userId
 * @param {object} [options]
 * @param {number} [options.page=1]
 * @param {number} [options.limit=20]
 * @returns {Promise<Array<object>>}
 */
export const listUserSessions = async (client, userId, { page = 1, limit = 20 } = {}) => {
  assertValidUUID(userId, "userId");

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const from = (pageNum - 1) * limitNum;
  const to = from + limitNum - 1;

  const { data: sessions, error } = await client
    .from("interview_sessions")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) {
    throw handleDbError(error, "Failed to list user sessions");
  }

  if (!sessions || sessions.length === 0) {
    return [];
  }

  // Hydrate counts in parallel
  const sessionIds = sessions.map((s) => s.id);

  const [questionsRes, attemptsRes] = await Promise.all([
    client
      .from("session_questions")
      .select("session_id")
      .in("session_id", sessionIds),
    client
      .from("practice_attempts")
      .select("session_id")
      .in("session_id", sessionIds),
  ]);

  const questionCounts = {};
  (questionsRes.data || []).forEach((row) => {
    questionCounts[row.session_id] = (questionCounts[row.session_id] || 0) + 1;
  });

  const attemptCounts = {};
  (attemptsRes.data || []).forEach((row) => {
    attemptCounts[row.session_id] = (attemptCounts[row.session_id] || 0) + 1;
  });

  return sessions.map((s) =>
    formatSession(s, questionCounts[s.id] || 0, attemptCounts[s.id] || 0),
  );
};

/**
 * Updates the execution status of an interview session.
 * Used during asynchronous resume processing.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {string} sessionId
 * @param {object} statusUpdate
 * @param {string} statusUpdate.status - 'processing' | 'completed' | 'failed'
 * @param {number} [statusUpdate.processingTimeMs]
 * @param {string} [statusUpdate.errorMessage]
 * @param {string} [statusUpdate.resumeId]
 * @returns {Promise<object>}
 */
export const updateSessionStatus = async (client, sessionId, statusUpdate) => {
  assertValidUUID(sessionId, "sessionId");

  const { status, processingTimeMs, errorMessage, resumeId } = statusUpdate;

  if (status && !VALID_STATUSES.has(status.toLowerCase())) {
    throw new ApiError(400, `Invalid session status: ${status}`);
  }

  const updatePayload = {
    updated_at: new Date().toISOString(),
  };

  if (status) updatePayload.status = status.toLowerCase();
  if (processingTimeMs !== undefined) {
    updatePayload.processing_time_ms = Math.max(0, parseInt(processingTimeMs, 10) || 0);
  }
  if (errorMessage !== undefined) {
    updatePayload.error_message = errorMessage;
  }
  if (resumeId !== undefined) {
    if (resumeId) assertValidUUID(resumeId, "resumeId");
    updatePayload.resume_id = resumeId;
  }

  let { data, error } = await client
    .from("interview_sessions")
    .update(updatePayload)
    .eq("id", sessionId)
    .select()
    .single();

  // Gracefully fallback if Migration 07 hasn't run yet
  if (error && error.message?.includes("error_message")) {
    delete updatePayload.error_message;
    const retry = await client
      .from("interview_sessions")
      .update(updatePayload)
      .eq("id", sessionId)
      .select()
      .single();
    data = retry.data;
    error = retry.error;
  }

  if (error) {
    throw handleDbError(error, "Failed to update session status");
  }

  return formatSession(data);
};

/**
 * Updates the last accessed timestamp for a session.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {string} sessionId
 * @returns {Promise<object>}
 */
export const touchSessionAccess = async (client, sessionId) => {
  assertValidUUID(sessionId, "sessionId");

  const { data, error } = await client
    .from("interview_sessions")
    .update({
      last_accessed_at: new Date().toISOString(),
    })
    .eq("id", sessionId)
    .select()
    .single();

  if (error) {
    throw handleDbError(error, "Failed to update session access time");
  }

  return formatSession(data);
};

/**
 * Renames an interview preparation session.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {string} sessionId
 * @param {string} displayName
 * @returns {Promise<object>}
 */
export const renameSession = async (client, sessionId, displayName) => {
  assertValidUUID(sessionId, "sessionId");

  const cleanName = String(displayName || "").trim();
  if (!cleanName) {
    throw new ApiError(400, "Display name cannot be empty");
  }

  const { data, error } = await client
    .from("interview_sessions")
    .update({
      display_name: cleanName.slice(0, 255),
      updated_at: new Date().toISOString(),
    })
    .eq("id", sessionId)
    .select()
    .maybeSingle();

  if (error) {
    throw handleDbError(error, "Failed to rename session");
  }

  if (!data) {
    throw new ApiError(404, "Interview session not found or permission denied");
  }

  return formatSession(data);
};

/**
 * Deletes an interview session by ID.
 * Cascades associated session_questions and practice_attempts via PostgreSQL foreign keys.
 * Also safely triggers cleanup of associated Supabase Storage resume object if no other sessions reference it.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {string} sessionId
 * @returns {Promise<boolean>}
 */
export const deleteSession = async (client, sessionId) => {
  assertValidUUID(sessionId, "sessionId");

  const session = await getSessionById(client, sessionId);
  if (!session) {
    throw new ApiError(404, "Interview session not found or permission denied");
  }

  const { error } = await client
    .from("interview_sessions")
    .delete()
    .eq("id", sessionId);

  if (error) {
    throw handleDbError(error, "Failed to delete session");
  }

  // If a resume was associated with this session, check if any other session uses it
  if (session.resumeId) {
    try {
      const { data: siblingSessions } = await client
        .from("interview_sessions")
        .select("id")
        .eq("resume_id", session.resumeId);

      // If no other sessions are linked to this resume, safely delete the resume and Storage file
      if (!siblingSessions || siblingSessions.length === 0) {
        await resumeService.deleteResume(client, session.resumeId);
      }
    } catch (cleanupErr) {
      console.warn(`[sessionService] Warning during resume cleanup for session ${sessionId}:`, cleanupErr.message);
    }
  }

  return true;
};

export default {
  formatSession,
  createSession,
  getSessionById,
  listUserSessions,
  updateSessionStatus,
  touchSessionAccess,
  renameSession,
  deleteSession,
};
