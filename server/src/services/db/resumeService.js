import { ApiError } from "../../utils/apiError.js";
import { assertValidUUID, handleDbError, isValidUUID } from "./dbUtils.js";

const MAX_RESUME_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB (matching schema CHECK constraint)
const STORAGE_BUCKET = "resumes";

/**
 * Normalizes a resume record from PostgreSQL into the standard API representation.
 *
 * @param {object} r
 * @returns {object}
 */
export const formatResume = (r) => {
  if (!r) return null;

  return {
    id: r.id,
    _id: r.id, // Compatibility
    userId: r.user_id,
    fileName: r.file_name,
    storagePath: r.storage_path,
    fileSizeBytes: r.file_size_bytes,
    mimeType: r.mime_type || "application/pdf",
    rawSkills: Array.isArray(r.raw_skills) ? r.raw_skills : [],
    expandedSkills: Array.isArray(r.expanded_skills) ? r.expanded_skills : [],
    sectionsFound: Array.isArray(r.sections_found) ? r.sections_found : [],
    createdAt: r.created_at,
  };
};

/**
 * Validates and uploads a resume PDF buffer into the private Supabase Storage bucket.
 * Follows the strict path hierarchy: <user_id>/<resume_id>.pdf
 * Governed by Storage RLS: caller's token must match the root folder UUID.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} client - User-scoped Supabase client
 * @param {object} params
 * @param {string} params.userId
 * @param {string} params.resumeId
 * @param {Buffer} params.buffer
 * @param {string} [params.mimeType="application/pdf"]
 * @returns {Promise<{ storagePath: string }>}
 */
export const uploadResumeToStorage = async (
  client,
  { userId, resumeId, buffer, mimeType = "application/pdf" },
) => {
  assertValidUUID(userId, "userId");
  assertValidUUID(resumeId, "resumeId");

  if (!buffer || !Buffer.isBuffer(buffer)) {
    throw new ApiError(400, "Valid resume file buffer is required");
  }

  if (buffer.length === 0) {
    throw new ApiError(400, "Resume file buffer is empty");
  }

  if (buffer.length > MAX_RESUME_SIZE_BYTES) {
    throw new ApiError(
      400,
      `Resume file exceeds maximum allowed limit of ${MAX_RESUME_SIZE_BYTES / (1024 * 1024)}MB`,
    );
  }

  const storagePath = `${userId}/${resumeId}.pdf`;

  const { error } = await client.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, buffer, {
      contentType: mimeType,
      upsert: false,
    });

  if (error) {
    throw handleDbError(error, `Storage upload failed: ${error.message}`);
  }

  return { storagePath };
};

/**
 * Downloads a resume PDF from Supabase Storage as a Node.js Buffer.
 * Governed by Storage RLS: user can only download their own resume (or admin).
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} client - User-scoped client
 * @param {string} storagePath - e.g. <userId>/<resumeId>.pdf
 * @returns {Promise<Buffer>}
 */
export const downloadResumeFromStorage = async (client, storagePath) => {
  if (!storagePath || typeof storagePath !== "string") {
    throw new ApiError(400, "storagePath is required");
  }

  const { data, error } = await client.storage
    .from(STORAGE_BUCKET)
    .download(storagePath);

  if (error) {
    throw handleDbError(error, `Failed to download resume from storage: ${error.message}`);
  }

  if (!data) {
    throw new ApiError(404, "Resume file not found in storage");
  }

  // Convert Blob to Buffer in Node.js
  const arrayBuffer = await data.arrayBuffer();
  return Buffer.from(arrayBuffer);
};

/**
 * Deletes a resume PDF object from the Supabase Storage bucket.
 * Tolerates already-missing objects to avoid aborting cascading deletions.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {string} storagePath
 * @returns {Promise<boolean>}
 */
export const deleteResumeFromStorage = async (client, storagePath) => {
  if (!storagePath || typeof storagePath !== "string") {
    return false;
  }

  try {
    const { error } = await client.storage
      .from(STORAGE_BUCKET)
      .remove([storagePath]);

    if (error) {
      console.warn(`[resumeService] Warning deleting storage object (${storagePath}):`, error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn(`[resumeService] Storage remove exception (${storagePath}):`, err.message);
    return false;
  }
};

/**
 * Inserts a resume metadata record into PostgreSQL (public.resumes).
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {object} resumeData
 * @returns {Promise<object>}
 */
export const createResumeRecord = async (client, resumeData) => {
  const {
    id,
    userId,
    fileName,
    storagePath,
    fileSizeBytes,
    mimeType = "application/pdf",
    rawSkills = [],
    expandedSkills = [],
    sectionsFound = [],
  } = resumeData;

  assertValidUUID(userId, "userId");
  if (id) assertValidUUID(id, "resumeId");

  const cleanFileName = String(fileName || "resume.pdf").trim().slice(0, 255);
  if (!cleanFileName) {
    throw new ApiError(400, "Resume file name cannot be empty");
  }

  const { data, error } = await client
    .from("resumes")
    .insert({
      id: id || undefined,
      user_id: userId,
      file_name: cleanFileName,
      storage_path: storagePath,
      file_size_bytes: fileSizeBytes,
      mime_type: mimeType,
      raw_skills: Array.isArray(rawSkills) ? rawSkills : [],
      expanded_skills: Array.isArray(expandedSkills) ? expandedSkills : [],
      sections_found: Array.isArray(sectionsFound) ? sectionsFound : [],
    })
    .select()
    .single();

  if (error) {
    throw handleDbError(error, `Failed to create resume record: ${error.message}`);
  }

  return formatResume(data);
};

/**
 * Atomic helper: Uploads resume PDF buffer to Supabase Storage and creates
 * the corresponding metadata row in PostgreSQL. If the database insertion fails,
 * executes an automatic compensation rollback to purge the uploaded file.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {object} params
 * @param {string} params.userId
 * @param {string} params.fileName
 * @param {Buffer} params.buffer
 * @param {string} [params.mimeType="application/pdf"]
 * @param {Array<string>} [params.rawSkills=[]]
 * @param {Array<string>} [params.expandedSkills=[]]
 * @param {Array<string>} [params.sectionsFound=[]]
 * @returns {Promise<object>}
 */
export const uploadAndPersistResume = async (client, {
  userId,
  fileName,
  buffer,
  mimeType = "application/pdf",
  rawSkills = [],
  expandedSkills = [],
  sectionsFound = [],
}) => {
  assertValidUUID(userId, "userId");

  // Generate unique UUID for this resume
  const resumeId = crypto.randomUUID();
  const storagePath = `${userId}/${resumeId}.pdf`;

  // Step 1: Upload to Supabase Storage
  await uploadResumeToStorage(client, {
    userId,
    resumeId,
    buffer,
    mimeType,
  });

  // Step 2: Persist metadata with compensation rollback on error
  try {
    const resumeRecord = await createResumeRecord(client, {
      id: resumeId,
      userId,
      fileName,
      storagePath,
      fileSizeBytes: buffer.length,
      mimeType,
      rawSkills,
      expandedSkills,
      sectionsFound,
    });

    return resumeRecord;
  } catch (dbError) {
    console.error(
      "Database insertion failed after Storage upload. Executing compensation cleanup:",
      dbError.message,
    );
    // Compensating action: remove orphaned file from Supabase Storage
    await deleteResumeFromStorage(client, storagePath);
    throw dbError;
  }
};

/**
 * Updates an existing resume metadata record with extracted skills from ML processing.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {string} resumeId
 * @param {object} skillsData
 * @param {Array<string>} [skillsData.rawSkills=[]]
 * @param {Array<string>} [skillsData.expandedSkills=[]]
 * @param {Array<string>} [skillsData.sectionsFound=[]]
 * @returns {Promise<object|null>}
 */
export const updateResumeSkills = async (client, resumeId, {
  rawSkills = [],
  expandedSkills = [],
  sectionsFound = [],
}) => {
  assertValidUUID(resumeId, "resumeId");

  const { data, error } = await client
    .from("resumes")
    .update({
      raw_skills: Array.isArray(rawSkills) ? rawSkills : [],
      expanded_skills: Array.isArray(expandedSkills) ? expandedSkills : [],
      sections_found: Array.isArray(sectionsFound) ? sectionsFound : [],
    })
    .eq("id", resumeId)
    .select()
    .single();

  if (error) {
    console.warn(`[resumeService] Could not update resume skills (${resumeId}):`, error.message);
    return null;
  }

  return formatResume(data);
};

/**
 * Fetches a resume metadata record by ID.
 * Governed by RLS: caller must own the resume (or admin).
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {string} resumeId
 * @returns {Promise<object|null>}
 */
export const getResumeById = async (client, resumeId) => {
  assertValidUUID(resumeId, "resumeId");

  const { data, error } = await client
    .from("resumes")
    .select("*")
    .eq("id", resumeId)
    .maybeSingle();

  if (error) {
    throw handleDbError(error, `Failed to retrieve resume ${resumeId}`);
  }

  return formatResume(data);
};

/**
 * Deletes a resume record and its associated Supabase Storage file.
 * Handles partial failures safely without crashing.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {string} resumeId
 * @returns {Promise<{ success: boolean }>}
 */
export const deleteResume = async (client, resumeId) => {
  assertValidUUID(resumeId, "resumeId");

  // Fetch record to retrieve the storage path
  const resume = await getResumeById(client, resumeId);
  if (!resume) {
    return { success: true };
  }

  // 1. Delete file from Supabase Storage
  if (resume.storagePath) {
    await deleteResumeFromStorage(client, resume.storagePath);
  }

  // 2. Delete database record
  const { error } = await client
    .from("resumes")
    .delete()
    .eq("id", resumeId);

  if (error) {
    throw handleDbError(error, `Failed to delete resume record ${resumeId}`);
  }

  return { success: true };
};

export default {
  formatResume,
  uploadResumeToStorage,
  downloadResumeFromStorage,
  deleteResumeFromStorage,
  createResumeRecord,
  uploadAndPersistResume,
  updateResumeSkills,
  getResumeById,
  deleteResume,
};
