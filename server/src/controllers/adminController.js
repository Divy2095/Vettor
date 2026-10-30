import { Question } from "../models/Question.js";
import { QuestionSubmission } from "../models/QuestionSubmission.js";
import { User } from "../models/User.js";
import { ApiError } from "../utils/apiError.js";

export const getModerationStats = async (_req, res) => {
  const [totalUsers, pending, approved, rejected] = await Promise.all([
    User.countDocuments(),
    QuestionSubmission.countDocuments({ status: "pending" }),
    QuestionSubmission.countDocuments({ status: "approved" }),
    QuestionSubmission.countDocuments({ status: "rejected" }),
  ]);

  return res.status(200).json({
    stats: {
      totalUsers,
      pendingSubmissions: pending,
      approvedSubmissions: approved,
      rejectedSubmissions: rejected,
    },
  });
};

export const getModerationNotifications = async (_req, res) => {
  const pendingCount = await QuestionSubmission.countDocuments({ status: "pending" });
  return res.status(200).json({
    notifications: {
      pendingCount,
      hasUnread: pendingCount > 0,
    },
  });
};

export const listPendingSubmissions = async (req, res) => {
  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
  const search = String(req.query.search || "").trim();

  const query = { status: "pending" };
  if (search) {
    query.$or = [
      { questionText: { $regex: search, $options: "i" } },
      { company: { $regex: search, $options: "i" } },
      { tags: { $elemMatch: { $regex: search, $options: "i" } } },
    ];
  }

  const [items, total] = await Promise.all([
    QuestionSubmission.find(query)
      .populate("submittedBy", "fullName email")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    QuestionSubmission.countDocuments(query),
  ]);

  return res.status(200).json({
    submissions: items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(Math.ceil(total / limit), 1),
    },
  });
};

export const listReviewedSubmissions = async (req, res) => {
  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);

  const [items, total] = await Promise.all([
    QuestionSubmission.find({ status: { $in: ["approved", "rejected"] } })
      .populate("submittedBy", "fullName email")
      .populate("reviewedBy", "fullName email")
      .sort({ reviewedAt: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    QuestionSubmission.countDocuments({ status: { $in: ["approved", "rejected"] } }),
  ]);

  return res.status(200).json({
    submissions: items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(Math.ceil(total / limit), 1),
    },
  });
};

export const createQuestionDirectly = async (req, res) => {
  const { questionText, tags, company, seenInInterview } = req.body;

  const question = await Question.create({
    questionText,
    tags: [...new Set((tags || []).map((tag) => tag.trim().toLowerCase()).filter(Boolean))],
    company: company || "",
    seenInInterview,
    approvedBy: req.user.sub,
  });

  return res.status(201).json({
    message: "Question added to dataset",
    question,
  });
};

export const approveSubmission = async (req, res) => {
  const submission = await QuestionSubmission.findById(req.params.id);
  if (!submission) {
    throw new ApiError(404, "Submission not found");
  }

  if (submission.status !== "pending") {
    throw new ApiError(409, "Submission has already been reviewed");
  }

  const approvedQuestion = await Question.create({
    questionText: submission.questionText,
    tags: submission.tags,
    company: submission.company,
    seenInInterview: submission.seenInInterview,
    sourceSubmissionId: submission._id,
    approvedBy: req.user.sub,
  });

  submission.status = "approved";
  submission.reviewedBy = req.user.sub;
  submission.reviewedAt = new Date();
  submission.adminNote = req.body.adminNote || "";
  submission.approvedQuestionId = approvedQuestion._id;
  await submission.save();

  return res.status(200).json({
    message: "Submission approved and added to dataset",
    approvedQuestionId: approvedQuestion._id,
  });
};

export const rejectSubmission = async (req, res) => {
  const submission = await QuestionSubmission.findById(req.params.id);
  if (!submission) {
    throw new ApiError(404, "Submission not found");
  }

  if (submission.status !== "pending") {
    throw new ApiError(409, "Submission has already been reviewed");
  }

  submission.status = "rejected";
  submission.reviewedBy = req.user.sub;
  submission.reviewedAt = new Date();
  submission.adminNote = req.body.adminNote || "";
  await submission.save();

  return res.status(200).json({ message: "Submission rejected" });
};
