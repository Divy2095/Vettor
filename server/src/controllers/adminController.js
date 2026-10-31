import { createUserClient } from "../config/supabase.js";
import { submissionService, questionService } from "../services/db/index.js";

/**
 * Get moderation dashboard statistics
 * @GET /api/admin/moderation/stats
 */
export const getModerationStats = async (req, res) => {
  const client = createUserClient(req.user.token);
  const stats = await submissionService.getModerationStats(client);

  return res.status(200).json({ stats });
};

/**
 * Get moderation notification counts
 * @GET /api/admin/moderation/notifications
 */
export const getModerationNotifications = async (req, res) => {
  const client = createUserClient(req.user.token);
  const stats = await submissionService.getModerationStats(client);
  const pendingCount = stats.pendingSubmissions || 0;

  return res.status(200).json({
    notifications: {
      pendingCount,
      hasUnread: pendingCount > 0,
    },
  });
};

/**
 * List pending community question submissions
 * @GET /api/admin/moderation/pending
 */
export const listPendingSubmissions = async (req, res) => {
  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
  const search = String(req.query.search || "").trim();

  const client = createUserClient(req.user.token);
  const result = await submissionService.listPendingSubmissions(client, {
    page,
    limit,
    search,
  });

  return res.status(200).json(result);
};

/**
 * List reviewed (approved or rejected) community question submissions
 * @GET /api/admin/moderation/reviewed
 */
export const listReviewedSubmissions = async (req, res) => {
  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);

  const client = createUserClient(req.user.token);
  const result = await submissionService.listReviewedSubmissions(client, {
    page,
    limit,
  });

  return res.status(200).json(result);
};

/**
 * Add a question directly to the curated question bank
 * @POST /api/admin/questions
 */
export const createQuestionDirectly = async (req, res) => {
  const { questionText, tags, company, seenInInterview, topic, difficulty } = req.body;
  const client = createUserClient(req.user.token);

  const question = await questionService.createCuratedQuestion(client, {
    questionText,
    tags,
    company,
    seenInInterview,
    topic: topic || "General",
    difficulty: difficulty || "Medium",
    approvedBy: req.user.id || req.user.sub,
  });

  return res.status(201).json({
    message: "Question added to dataset",
    question,
  });
};

/**
 * Approve a pending community submission and add to master question bank
 * @POST /api/admin/moderation/submissions/:id/approve
 */
export const approveSubmission = async (req, res) => {
  const client = createUserClient(req.user.token);
  const submissionId = req.params.id;

  const result = await submissionService.approveSubmission(client, submissionId, {
    questionText: req.body.questionText,
    topic: req.body.topic,
    tags: req.body.tags,
    company: req.body.company,
    difficulty: req.body.difficulty,
    adminNote: req.body.adminNote || "",
  });

  return res.status(200).json(result);
};

/**
 * Reject a pending community submission
 * @POST /api/admin/moderation/submissions/:id/reject
 */
export const rejectSubmission = async (req, res) => {
  const client = createUserClient(req.user.token);
  const submissionId = req.params.id;

  const result = await submissionService.rejectSubmission(
    client,
    submissionId,
    req.body.adminNote || "",
  );

  return res.status(200).json(result);
};
