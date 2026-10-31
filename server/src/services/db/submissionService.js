import { ApiError } from "../../utils/apiError.js";
import { assertValidUUID, handleDbError, getPaginationRange } from "./dbUtils.js";

/**
 * Normalizes a community question submission record for frontend contracts.
 *
 * @param {object} sub
 * @returns {object}
 */
export const formatSubmission = (sub) => {
  if (!sub) return null;

  return {
    id: sub.id,
    _id: sub.id, // Backward compatibility
    questionText: sub.question_text,
    tags: Array.isArray(sub.tags) ? sub.tags : [],
    company: sub.company || "",
    seenInInterview: sub.seen_in_interview || false,
    submittedBy: sub.profiles
      ? {
          id: sub.profiles.id,
          _id: sub.profiles.id,
          fullName: sub.profiles.full_name,
        }
      : sub.submitted_by,
    reviewedBy: sub.reviewer_profile
      ? {
          id: sub.reviewer_profile.id,
          _id: sub.reviewer_profile.id,
          fullName: sub.reviewer_profile.full_name,
        }
      : sub.reviewed_by || null,
    status: sub.status,
    adminNote: sub.admin_note || "",
    approvedQuestionId: sub.approved_question_id || null,
    reviewedAt: sub.reviewed_at || null,
    createdAt: sub.created_at,
    updatedAt: sub.updated_at,
  };
};

/**
 * Submits a new community interview question for moderation.
 * Governed by RLS: caller must set submitted_by to their own auth.uid() and status to 'pending'.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} client - User-scoped Supabase client
 * @param {object} submissionData
 * @param {string} [submissionData.submittedBy] - User UUID
 * @param {string} [submissionData.userId] - User UUID alias
 * @param {string} submissionData.questionText
 * @param {Array<string>} [submissionData.tags=[]]
 * @param {string} [submissionData.company=""]
 * @param {boolean} [submissionData.seenInInterview=false]
 * @returns {Promise<object>}
 */
export const createSubmission = async (client, submissionData) => {
  const {
    submittedBy = submissionData.userId,
    questionText,
    tags = [],
    company = "",
    seenInInterview = false,
  } = submissionData;

  assertValidUUID(submittedBy, "submittedBy");

  if (!questionText || questionText.trim().length < 10) {
    throw new ApiError(400, "Question text must be at least 10 characters long");
  }

  const cleanTags = Array.isArray(tags)
    ? [...new Set(tags.map((t) => String(t).trim().toLowerCase()).filter(Boolean))].slice(0, 10)
    : [];

  const { data, error } = await client
    .from("community_question_submissions")
    .insert({
      submitted_by: submittedBy,
      question_text: questionText.trim().slice(0, 1000),
      tags: cleanTags,
      company: company ? company.trim().slice(0, 100) : "",
      seen_in_interview: Boolean(seenInInterview),
      status: "pending",
    })
    .select()
    .single();

  if (error) {
    throw handleDbError(error, "Failed to submit community question");
  }

  return formatSubmission(data);
};

/**
 * Fetches all community submissions made by a specific user.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {string} userId
 * @param {object} [options]
 * @param {number} [options.page=1]
 * @param {number} [options.limit=20]
 * @returns {Promise<{ submissions: Array<object>, pagination: object }>}\n */
export const listUserSubmissions = async (
  client,
  userId,
  { page = 1, limit = 20 } = {},
) => {
  assertValidUUID(userId, "userId");

  const { page: pageNum, limit: limitNum, from, to } = getPaginationRange({
    page,
    limit,
    maxLimit: 100,
  });

  const { data, error, count } = await client
    .from("community_question_submissions")
    .select("*", { count: "exact" })
    .eq("submitted_by", userId)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) {
    throw handleDbError(error, "Failed to list user submissions");
  }

  const total = count || 0;
  return {
    submissions: (data || []).map(formatSubmission),
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      pages: Math.max(1, Math.ceil(total / limitNum)),
    },
  };
};

/**
 * Admin workflow: Lists pending question submissions awaiting moderation.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} adminClient
 * @param {object} [options]
 * @param {number} [options.page=1]
 * @param {number} [options.limit=20]
 * @param {string} [options.search=""]
 * @returns {Promise<{ submissions: Array<object>, pagination: object }>}\n */
export const listPendingSubmissions = async (
  adminClient,
  { page = 1, limit = 20, search = "" } = {},
) => {
  const { page: pageNum, limit: limitNum, from, to } = getPaginationRange({
    page,
    limit,
    maxLimit: 100,
  });

  let query = adminClient
    .from("community_question_submissions")
    .select("*, profiles:submitted_by(id, full_name)", { count: "exact" })
    .eq("status", "pending");

  if (search && search.trim()) {
    query = query.or(
      `question_text.ilike.%${search.trim()}%,company.ilike.%${search.trim()}%`,
    );
  }

  query = query.order("created_at", { ascending: false }).range(from, to);

  const { data, error, count } = await query;

  if (error) {
    throw handleDbError(error, "Failed to list pending submissions");
  }

  const total = count || 0;
  return {
    submissions: (data || []).map(formatSubmission),
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.max(1, Math.ceil(total / limitNum)),
    },
  };
};

/**
 * Admin workflow: Lists already reviewed (approved or rejected) submissions.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} adminClient
 * @param {object} [options]
 * @param {number} [options.page=1]
 * @param {number} [options.limit=20]
 * @returns {Promise<{ submissions: Array<object>, pagination: object }>}\n */
export const listReviewedSubmissions = async (
  adminClient,
  { page = 1, limit = 20 } = {},
) => {
  const { page: pageNum, limit: limitNum, from, to } = getPaginationRange({
    page,
    limit,
    maxLimit: 100,
  });

  const { data, error, count } = await adminClient
    .from("community_question_submissions")
    .select(
      "*, profiles:submitted_by(id, full_name), reviewer_profile:reviewed_by(id, full_name)",
      { count: "exact" },
    )
    .in("status", ["approved", "rejected"])
    .order("reviewed_at", { ascending: false })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) {
    throw handleDbError(error, "Failed to list reviewed submissions");
  }

  const total = count || 0;
  return {
    submissions: (data || []).map(formatSubmission),
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.max(1, Math.ceil(total / limitNum)),
    },
  };
};

/**
 * Admin workflow: Calculates dashboard statistics for moderation.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} adminClient
 * @returns {Promise<{ totalUsers: number, pendingSubmissions: number, approvedSubmissions: number, rejectedSubmissions: number }>}
 */
export const getModerationStats = async (adminClient) => {
  const [usersCount, pendingCount, approvedCount, rejectedCount] = await Promise.all([
    adminClient.from("profiles").select("id", { count: "exact", head: true }),
    adminClient.from("community_question_submissions").select("id", { count: "exact", head: true }).eq("status", "pending"),
    adminClient.from("community_question_submissions").select("id", { count: "exact", head: true }).eq("status", "approved"),
    adminClient.from("community_question_submissions").select("id", { count: "exact", head: true }).eq("status", "rejected"),
  ]);

  return {
    totalUsers: usersCount.count || 0,
    pendingSubmissions: pendingCount.count || 0,
    approvedSubmissions: approvedCount.count || 0,
    rejectedSubmissions: rejectedCount.count || 0,
  };
};

/**
 * Moderation action: Atomically approves a submission using PostgreSQL RPC function.
 * Allows admins to polish/edit text and metadata prior to adding to master question bank.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} client - Authenticated admin client
 * @param {string} submissionId - UUID of submission to approve
 * @param {object} [edits]
 * @param {string} [edits.questionText]
 * @param {string} [edits.topic]
 * @param {Array<string>} [edits.tags]
 * @param {string} [edits.company]
 * @param {string} [edits.difficulty]
 * @param {string} [edits.adminNote]
 * @returns {Promise<{ message: string, approvedQuestionId: string }>}\n */
export const approveSubmission = async (client, submissionId, edits = {}) => {
  assertValidUUID(submissionId, "submissionId");

  const rpcParams = {
    p_submission_id: submissionId,
    p_question_text: edits.questionText && edits.questionText.trim().length > 0 ? edits.questionText.trim() : null,
    p_topic: edits.topic && edits.topic.trim().length > 0 ? edits.topic.trim() : null,
    p_tags: Array.isArray(edits.tags) && edits.tags.length > 0 ? edits.tags : null,
    p_company: edits.company && edits.company.trim().length > 0 ? edits.company.trim() : null,
    p_difficulty: edits.difficulty && edits.difficulty.trim().length > 0 ? edits.difficulty.trim() : null,
    p_admin_note: edits.adminNote || "",
  };

  const { data: newQuestionId, error } = await client.rpc(
    "approve_community_submission",
    rpcParams,
  );

  if (error) {
    throw handleDbError(error, "Failed to approve community question submission");
  }

  return {
    message: "Submission approved and added to dataset",
    approvedQuestionId: newQuestionId,
  };
};

/**
 * Moderation action: Rejects a submission and records an admin note.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} client - Authenticated admin client
 * @param {string} submissionId
 * @param {string} [adminNote=""]
 * @returns {Promise<{ message: string }>}\n */
export const rejectSubmission = async (client, submissionId, adminNote = "") => {
  assertValidUUID(submissionId, "submissionId");

  const { data, error } = await client
    .from("community_question_submissions")
    .update({
      status: "rejected",
      admin_note: adminNote ? String(adminNote).slice(0, 1000) : "",
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", submissionId)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();

  if (error) {
    throw handleDbError(error, "Failed to reject community question submission");
  }

  if (!data) {
    throw new ApiError(404, "Submission not found or has already been reviewed");
  }

  return { message: "Submission rejected" };
};

export default {
  formatSubmission,
  createSubmission,
  listUserSubmissions,
  listPendingSubmissions,
  listReviewedSubmissions,
  getModerationStats,
  approveSubmission,
  rejectSubmission,
};
