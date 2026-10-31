import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { handleUploadResume } from '../middleware/uploadResume.js';
import {
  uploadAndProcessResume,
  getResumeStatus,
  getSessionQuestions,
  getSessionHistory,
  deleteSession,
  exportQuestionsToJSON,
  downloadResume,
} from '../controllers/resumeController.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * POST /api/resume/upload
 * Upload resume and trigger ML pipeline
 */
router.post('/upload', handleUploadResume, uploadAndProcessResume);

/**
 * GET /api/resume/status/:sessionId
 * Get processing status of a resume
 */
router.get('/status/:sessionId', getResumeStatus);

/**
 * GET /api/resume/questions/:sessionId
 * Get generated questions for a session
 */
router.get('/questions/:sessionId', getSessionQuestions);

/**
 * GET /api/resume/history
 * Get user's session history
 */
router.get('/history', getSessionHistory);

/**
 * DELETE /api/resume/session/:sessionId
 * Delete a session and clean up Storage object
 */
router.delete('/session/:sessionId', deleteSession);

/**
 * GET /api/resume/download/:sessionId
 * Stream authenticated resume PDF directly from private Supabase Storage
 */
router.get('/download/:sessionId', downloadResume);
router.get('/file/:sessionId', downloadResume);

/**
 * GET /api/resume/questions/:sessionId/export
 * Export questions to JSON
 */
router.get('/questions/:sessionId/export', exportQuestionsToJSON);

export default router;
