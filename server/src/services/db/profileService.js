import { ApiError } from "../../utils/apiError.js";
import { assertValidUUID, handleDbError, getPaginationRange } from "./dbUtils.js";

/**
 * Normalizes a profile record to ensure frontend compatibility.
 *
 * @param {object} profile
 * @returns {object}
 */
const formatProfile = (profile) => {
  if (!profile) return null;
  return {
    id: profile.id,
    _id: profile.id, // Compatibility alias
    fullName: profile.full_name,
    role: profile.role,
    createdAt: profile.created_at,
    updatedAt: profile.updated_at,
  };
};

/**
 * Fetches a user profile by ID.
 * Subject to RLS: authenticated users can read their own profile; admins can read any.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {string} userId
 * @returns {Promise<object>}
 */
export const getProfileById = async (client, userId) => {
  assertValidUUID(userId, "userId");

  const { data, error } = await client
    .from("profiles")
    .select("id, full_name, role, created_at, updated_at")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw handleDbError(error, `Failed to fetch profile for user ${userId}`);
  }

  if (!data) {
    throw new ApiError(404, "User profile not found");
  }

  return formatProfile(data);
};

/**
 * Updates an authenticated user's profile information (e.g. full name).
 * Note: Role changes are restricted and guarded by PostgreSQL trigger `protect_profile_role()`.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {string} userId
 * @param {object} updates
 * @param {string} [updates.fullName]
 * @returns {Promise<object>}
 */
export const updateProfile = async (client, userId, { fullName }) => {
  assertValidUUID(userId, "userId");

  const payload = {};
  if (fullName !== undefined) {
    if (typeof fullName !== "string" || fullName.trim().length === 0) {
      throw new ApiError(400, "Full name must be a non-empty string");
    }
    payload.full_name = fullName.trim();
  }

  if (Object.keys(payload).length === 0) {
    throw new ApiError(400, "No valid profile update fields provided");
  }

  const { data, error } = await client
    .from("profiles")
    .update(payload)
    .eq("id", userId)
    .select("id, full_name, role, created_at, updated_at")
    .maybeSingle();

  if (error) {
    throw handleDbError(error, "Failed to update profile");
  }

  if (!data) {
    throw new ApiError(404, "User profile not found or permission denied");
  }

  return formatProfile(data);
};

/**
 * Admin workflow: Lists profiles with optional full-name search and pagination.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} adminClient
 * @param {object} [options]
 * @param {number} [options.page=1]
 * @param {number} [options.limit=20]
 * @param {string} [options.search=""]
 * @returns {Promise<{ profiles: Array<object>, pagination: object }>}
 */
export const listProfilesForAdmin = async (adminClient, { page = 1, limit = 20, search = "" } = {}) => {
  const { page: pageNum, limit: limitNum, from, to } = getPaginationRange({ page, limit, maxLimit: 100 });

  let query = adminClient
    .from("profiles")
    .select("id, full_name, role, created_at, updated_at", { count: "exact" });

  if (search && search.trim()) {
    query = query.ilike("full_name", `%${search.trim()}%`);
  }

  query = query.order("created_at", { ascending: false }).range(from, to);

  const { data, error, count } = await query;

  if (error) {
    throw handleDbError(error, "Failed to list profiles for admin");
  }

  const total = count || 0;
  return {
    profiles: (data || []).map(formatProfile),
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.max(1, Math.ceil(total / limitNum)),
    },
  };
};

export default {
  getProfileById,
  updateProfile,
  listProfilesForAdmin,
};
