import { ApiError } from '../utils/apiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import MLPipelineService from '../utils/mlPipelineService.js';
import UserSession from '../models/UserSession.js';

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
  const userId = req.user._id;

  try {
    // Step 1: Save resume file
    const resumePath = await MLPipelineService.saveResumeFile(
      req.file.buffer,
      userId
    );

    // Step 2: Create session record with "processing" status
    let userSession = await UserSession.create({
      userId,
      resumePath,
      profileString: '',
      extractedSkills: [],
      expandedSkills: [],
      generatedQuestions: [],
      processingTime: 0,
      status: 'processing',
      metadata: {
        userAgent: req.get('user-agent'),
        ipAddress: req.ip,
      },
    });

    // Step 3: Process resume asynchronously (don't block response)
    processResumeAsync(userSession._id, resumePath, userId, startTime);

    // Return immediate response with session ID
    return res.status(202).json({
      success: true,
      message: 'Resume processing started',
      sessionId: userSession._id,
      status: 'processing',
    });
  } catch (error) {
    console.error('Resume upload error:', error);
    throw error;
  }
});

/**
 * Asynchronous resume processing
 * This runs in the background without blocking the API response
 */
async function processResumeAsync(sessionId, resumePath, userId, startTime) {
  try {
    const session = await UserSession.findById(sessionId);
    if (!session) return;

    // Step 1: Process resume with ML pipeline
    const profileResult = await MLPipelineService.processResume(resumePath);

    session.profileString = profileResult.profileString;
    session.extractedSkills = profileResult.rawSkills || [];
    session.expandedSkills = profileResult.expandedSkills || [];

    // Step 2: Search for relevant questions
    const questions = await MLPipelineService.searchQuestions(
      profileResult.profileString,
      profileResult.expandedSkills,
      30 // top_k=30
    );

    session.generatedQuestions = questions;
    session.totalQuestions = questions.length;

    // Step 3: Mark as completed
    session.status = 'completed';
    session.processingTime = Date.now() - startTime;
    await session.save();

    console.log(
      `✅ Resume processing completed for user ${userId} in ${session.processingTime}ms`
    );
  } catch (error) {
    console.error('Error in async resume processing:', error);

    // Mark session as failed
    try {
      await UserSession.findByIdAndUpdate(
        sessionId,
        {
          status: 'failed',
          errorMessage: error.message,
          processingTime: Date.now() - startTime,
        },
        { new: true }
      );
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

  const session = await UserSession.findOne({
    _id: sessionId,
    userId: req.user._id,
  });

  if (!session) {
    throw new ApiError(404, 'Session not found');
  }

  return res.status(200).json({
    success: true,
    sessionId: session._id,
    status: session.status,
    totalQuestions: session.totalQuestions,
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

  const session = await UserSession.findOne({
    _id: sessionId,
    userId: req.user._id,
  });

  if (!session) {
    throw new ApiError(404, 'Session not found');
  }

  if (session.status !== 'completed') {
    throw new ApiError(
      400,
      `Cannot retrieve questions. Session status: ${session.status}`
    );
  }

  let questions = session.generatedQuestions;

  // Apply filters
  if (difficulty) {
    questions = questions.filter((q) => q.difficulty === difficulty);
  }

  if (topic) {
    questions = questions.filter((q) => q.topic === topic);
  }

  // Pagination
  const pageNum = parseInt(page) || 1;
  const limitNum = parseInt(limit) || 10;
  const skip = (pageNum - 1) * limitNum;

  const paginatedQuestions = questions.slice(skip, skip + limitNum);

  return res.status(200).json({
    success: true,
    sessionId: session._id,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total: questions.length,
      pages: Math.ceil(questions.length / limitNum),
    },
    questions: paginatedQuestions,
    skills: {
      extracted: session.extractedSkills,
      expanded: session.expandedSkills,
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

  const sessions = await UserSession.find({ userId: req.user._id })
    .sort({ createdAt: -1 })
    .select('-generatedQuestions -profileString')
    .limit(20);

  return res.status(200).json({
    success: true,
    sessions: sessions.map((s) => ({
      sessionId: s._id,
      createdAt: s.createdAt,
      status: s.status,
      totalQuestions: s.totalQuestions,
      processingTime: s.processingTime,
      skills: s.expandedSkills.slice(0, 5), // Show first 5 skills
    })),
  });
});

/**
 * Delete a user session
 * @DELETE /api/resume/session/:sessionId
 */
export const deleteSession = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;

  if (!req.user) {
    throw new ApiError(401, 'Unauthorized');
  }

  const session = await UserSession.findOneAndDelete({
    _id: sessionId,
    userId: req.user._id,
  });

  if (!session) {
    throw new ApiError(404, 'Session not found');
  }

  return res.status(200).json({
    success: true,
    message: 'Session deleted successfully',
  });
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

  const session = await UserSession.findOne({
    _id: sessionId,
    userId: req.user._id,
  });

  if (!session) {
    throw new ApiError(404, 'Session not found');
  }

  // Create export object
  const exportData = {
    session: {
      id: session._id,
      createdAt: session.createdAt,
      processingTime: session.processingTime,
    },
    profile: {
      extractedSkills: session.extractedSkills,
      expandedSkills: session.expandedSkills,
    },
    questions: session.generatedQuestions,
    summary: {
      totalQuestions: session.totalQuestions,
      byDifficulty: {
        easy: session.generatedQuestions.filter((q) => q.difficulty === 'Easy')
          .length,
        medium: session.generatedQuestions.filter((q) => q.difficulty === 'Medium')
          .length,
        hard: session.generatedQuestions.filter((q) => q.difficulty === 'Hard')
          .length,
      },
      byTopic: {},
    },
  };

  // Calculate by topic
  session.generatedQuestions.forEach((q) => {
    if (!exportData.summary.byTopic[q.topic]) {
      exportData.summary.byTopic[q.topic] = 0;
    }
    exportData.summary.byTopic[q.topic]++;
  });

  // Set response headers for download
  res.setHeader('Content-Type', 'application/json');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="interview-questions-${session._id}.json"`
  );

  return res.status(200).json(exportData);
});
