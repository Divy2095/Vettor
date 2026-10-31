import { ApiError } from "../../utils/apiError.js";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Validates whether a value is a valid UUID string (8-4-4-4-12 hex format).
 *
 * @param {string} id
 * @returns {boolean}
 */
export const isValidUUID = (id) => {
  return typeof id === "string" && UUID_REGEX.test(id.trim());
};

/**
 * Asserts that an ID is a valid UUID, throwing a 400 Bad Request otherwise.
 *
 * @param {string} id
 * @param {string} [paramName="id"]
 */
export const assertValidUUID = (id, paramName = "id") => {
  if (!isValidUUID(id)) {
    throw new ApiError(400, `Invalid ${paramName}: must be a valid UUID`);
  }
};

/**
 * Maps Supabase / PostgreSQL error codes to standardized ApiError exceptions.
 *
 * @param {object} error - Supabase error object
 * @param {string} [fallbackMessage="Database operation failed"]
 * @returns {ApiError}
 */
export const handleDbError = (error, fallbackMessage = "Database operation failed") => {
  if (!error) return null;

  const code = error.code || "";
  const message = error.message || fallbackMessage;

  // PostgREST: No rows returned from .single()
  if (code === "PGRST116") {
    return new ApiError(404, "Requested resource was not found");
  }

  // PostgreSQL 42501: Insufficient privilege (RLS violation)
  if (code === "42501") {
    return new ApiError(403, "Access denied: insufficient permissions");
  }

  // PostgreSQL 23505: Unique violation
  if (code === "23505") {
    return new ApiError(409, message.includes("duplicate") ? "A record with this identifier already exists" : message);
  }

  // PostgreSQL 23503: Foreign key violation
  if (code === "23503") {
    return new ApiError(400, "Referenced record does not exist or relation is invalid");
  }

  // PostgreSQL 23514: Check constraint violation
  if (code === "23514") {
    return new ApiError(400, `Data validation failed: ${message}`);
  }

  return new ApiError(500, message);
};

/**
 * Calculates zero-based pagination range for Supabase .range(from, to) queries.
 * Supports both options object ({ page, limit, maxLimit }) and positional arguments.
 *
 * @param {number|string|object} [pageOrOptions=1]
 * @param {number|string} [limit=10]
 * @param {number} [maxLimit=100]
 * @returns {{ from: number, to: number, page: number, limit: number }}
 */
export const getPaginationRange = (pageOrOptions = 1, limit = 10, maxLimit = 100) => {
  let page = pageOrOptions;
  if (typeof pageOrOptions === "object" && pageOrOptions !== null) {
    page = pageOrOptions.page;
    limit = pageOrOptions.limit !== undefined ? pageOrOptions.limit : limit;
    maxLimit = pageOrOptions.maxLimit !== undefined ? pageOrOptions.maxLimit : maxLimit;
  }

  const parsedPage = Math.max(1, parseInt(page, 10) || 1);
  const parsedLimit = Math.min(maxLimit, Math.max(1, parseInt(limit, 10) || 10));

  const from = (parsedPage - 1) * parsedLimit;
  const to = from + parsedLimit - 1;

  return { from, to, page: parsedPage, limit: parsedLimit };
};
