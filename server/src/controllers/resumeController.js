import { ApiError } from '../utils/apiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import MLPipelineService from '../utils/mlPipelineService.js';
import { createUserClient } from '../config/supabase.js';
import { sessionService, questionService, resumeService } from '../services/db/index.js';

/**
 * Upload and process resume
 * @POST /api/resume/upload
 * Triggers ML pipeline to extract skills and generate interview questions
 */
export const uploadAndProcessResume = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new ApiError(400, 'No resume file provided');
  }

  if (!req.user) {
    throw new ApiError(401, 'Unauthorized: User not authenticated');
  }

  const startTime = Date.now();
  const userId = req.user.id || req.user.sub;
  const client = createUserClient(req.user.token);

  // Step 1: Upload resume PDF to Supabase Storage and create public.resumes record
  // uploadAndPersistResume guarantees that if DB insert fails, the Storage file is automatically cleaned up
  const resumeRecord = await resumeService.uploadAndPersistResume(client, {
    userId,
    fileName: req.file.originalname,
    buffer: req.file.buffer,
    mimeType: req.file.mimetype || 'application/pdf',
  });

  try {
    // Step 2: Create interview session record in PostgreSQL with "processing" status and linked resume_id
    const session = await sessionService.createSession(client, {
      userId,
      resumeId: resumeRecord.id,
      targetRole: 'Resume Interview',
      targetCompany: '',
      targetLevel: 'mid',
      status: 'processing',
      processingTimeMs: 0,
      displayName: req.file.originalname ? `Resume - ${req.file.originalname}` : null,
    });

    // Step 3: Process resume asynchronously (don't block response, pass buffer in-memory)
    processResumeAsync(
      client,
      session.id,
      resumeRecord.id,
      req.file.buffer,
      req.file.originalname,
      userId,
      startTime,
    );

    // Return immediate response with session ID (matching exact API contract)
    return res.status(202).json({
      success: true,
      message: 'Resume processing started',
      sessionId: session.id,
      status: 'processing',
    });
  } catch (error) {
    console.error('Session creation failed after resume upload, cleaning up resume:', error);
    // Cleanup resume record and Storage file if session creation fails
    await resumeService.deleteResume(client, resumeRecord.id).catch((e) => {
      console.warn('Compensation cleanup error:', e.message);
    });
    throw error;
  }
});

/**
 * Asynchronous resume processing
 * Runs in the background without blocking the API response
 */
async function processResumeAsync(
  client,
  sessionId,
  resumeId,
  fileBuffer,
  fileName,
  userId,
  startTime,
) {
  try {
    const session = await sessionService.getSessionById(client, sessionId);
    if (!session) return;

    // Step 1: Process resume with ML pipeline (in-memory buffer, zero disk I/O)
    const profileResult = await MLPipelineService.processResume(fileBuffer, fileName);
    const rawSkills = profileResult.rawSkills || [];
    const expandedSkills = profileResult.expandedSkills || [];
    const sectionsFound = profileResult.sectionsFound || [];

    // Step 2: Update resume metadata record with extracted skills
    if (resumeId) {
      await resumeService.updateResumeSkills(client, resumeId, {
        rawSkills,
        expandedSkills,
        sectionsFound,
      });
    }

    // Step 3: Search for relevant questions
    const questions = await MLPipelineService.searchQuestions(
      profileResult.profileString,
      expandedSkills,
      30, // top_k=30
    );

    // Step 4: Persist generated questions to PostgreSQL session_questions
    if (questions && questions.length > 0) {
      await questionService.createSessionQuestions(client, sessionId, questions);
    }

    // Step 5: Mark session as completed
    const processingTimeMs = Date.now() - startTime;
    await sessionService.updateSessionStatus(client, sessionId, {
      status: 'completed',
      processingTimeMs,
    });

    console.log(
      `✅ Resume processing completed for user ${userId} in ${processingTimeMs}ms`,
    );
  } catch (error) {
    console.error('Error in async resume processing:', error);

    // If ML processing fails: RETAIN the file in Supabase Storage and mark session as failed
    try {
      await sessionService.updateSessionStatus(client, sessionId, {
        status: 'failed',
        errorMessage: error.message,
        processingTimeMs: Date.now() - startTime,
      });
    } catch (updateError) {
      console.error('Failed to update session status:', updateError);
    }
  }
}

/**
 * Get processing status of a resume
 * @GET /api/resume/status/:sessionId
 */
export const getResumeStatus = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;

  if (!req.user) {
    throw new ApiError(401, 'Unauthorized');
  }

  const client = createUserClient(req.user.token);
  const session = await sessionService.getSessionById(client, sessionId);

  if (!session) {
    throw new ApiError(404, 'Session not found');
  }

  // Count generated questions for the session
  const { pagination } = await questionService.getSessionQuestions(client, sessionId, { limit: 1 });

  return res.status(200).json({
    success: true,
    sessionId: session.id,
    status: session.status,
    totalQuestions: pagination.total,
    processingTime: session.processingTime,
    errorMessage: session.errorMessage,
  });
});

/**
 * Get generated questions for a user session
 * @GET /api/resume/questions/:sessionId
 */
export const getSessionQuestions = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  const { page = 1, limit = 10, difficulty, topic } = req.query;

  if (!req.user) {
    throw new ApiError(401, 'Unauthorized');
  }

  const client = createUserClient(req.user.token);
  const session = await sessionService.getSessionById(client, sessionId);

  if (!session) {
    throw new ApiError(404, 'Session not found');
  }

  if (session.status !== 'completed') {
    throw new ApiError(
      400,
      `Cannot retrieve questions. Session status: ${session.status}`,
    );
  }

  const { questions, pagination } = await questionService.getSessionQuestions(client, sessionId, {
    page,
    limit,
    difficulty,
    topic,
  });

  return res.status(200).json({
    success: true,
    sessionId: session.id,
    pagination,
    questions,
    skills: {
      extracted: session.skillGap?.matchedSkills || session.resumeSkills || [],
      expanded: session.resumeSkills || [],
    },
  });
});

/**
 * Get user's session history
 * @GET /api/resume/history
 */
export const getSessionHistory = asyncHandler(async (req, res) => {
  if (!req.user) {
    throw new ApiError(401, 'Unauthorized');
  }

  const client = createUserClient(req.user.token);
  const sessions = await sessionService.listUserSessions(client, req.user.id || req.user.sub, {
    limit: 20,
  });

  return res.status(200).json({
    success: true,
    sessions: sessions.map((s) => ({
      sessionId: s.id,
      createdAt: s.createdAt,
      status: s.status,
      totalQuestions: s.totalQuestions || 0,
      processingTime: s.processingTime,
      skills: (s.resumeSkills || []).slice(0, 5), // Show first 5 skills
    })),
  });
});

/**
 * Delete a user session and safely cleanup associated Storage object
 * @DELETE /api/resume/session/:sessionId
 */
export const deleteSession = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;

  if (!req.user) {
    throw new ApiError(401, 'Unauthorized');
  }

  const client = createUserClient(req.user.token);
  await sessionService.deleteSession(client, sessionId);

  return res.status(200).json({
    success: true,
    message: 'Session deleted successfully',
  });
});

/**
 * Authenticated streaming download endpoint for candidate's resume PDF.
 * Streams binary buffer directly from private Supabase Storage without exposing public URLs.
 * @GET /api/resume/download/:sessionId
 */
export const downloadResume = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;

  if (!req.user) {
    throw new ApiError(401, 'Unauthorized');
  }

  const client = createUserClient(req.user.token);
  const session = await sessionService.getSessionById(client, sessionId);

  if (!session) {
    throw new ApiError(404, 'Session not found');
  }

  if (!session.resumeId) {
    throw new ApiError(404, 'No resume file associated with this session');
  }

  const resume = await resumeService.getResumeById(client, session.resumeId);
  if (!resume || !resume.storagePath) {
    throw new ApiError(404, 'Resume file not found');
  }

  const fileBuffer = await resumeService.downloadResumeFromStorage(client, resume.storagePath);

  const safeFilename = encodeURIComponent(resume.fileName || 'resume.pdf');
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Length', fileBuffer.length);
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${safeFilename}"; filename*=UTF-8''${safeFilename}`,
  );

  return res.status(200).send(fileBuffer);
});

/**
 * Export questions to JSON
 * @GET /api/resume/questions/:sessionId/export
 */
export const exportQuestionsToJSON = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;

  if (!req.user) {
    throw new ApiError(401, 'Unauthorized');
  }

  const client = createUserClient(req.user.token);
  const session = await sessionService.getSessionById(client, sessionId);

  if (!session) {
    throw new ApiError(404, 'Session not found');
  }

  const { questions } = await questionService.getSessionQuestions(client, sessionId, {
    limit: 200,
  });

  // Create export object
  const exportData = {
    session: {
      id: session.id,
      createdAt: session.createdAt,
      processingTime: session.processingTime,
    },
    profile: {
      extractedSkills: session.skillGap?.matchedSkills || session.resumeSkills || [],
      expandedSkills: session.resumeSkills || [],
    },
    questions,
    summary: {
      totalQuestions: questions.length,
      byDifficulty: {
        easy: questions.filter((q) => q.difficulty === 'Easy').length,
        medium: questions.filter((q) => q.difficulty === 'Medium').length,
        hard: questions.filter((q) => q.difficulty === 'Hard').length,
      },
      byTopic: {},
    },
  };

  // Calculate by topic
  questions.forEach((q) => {
    const topicKey = q.topic || 'General';
    if (!exportData.summary.byTopic[topicKey]) {
      exportData.summary.byTopic[topicKey] = 0;
    }
    exportData.summary.byTopic[topicKey]++;
  });

  // Set response headers for download
  res.setHeader('Content-Type', 'application/json');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="interview-questions-${session.id}.json"`,
  );

  return res.status(200).json(exportData);
});
