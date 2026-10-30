import mongoose from "mongoose";

const rubricScoreSchema = new mongoose.Schema(
  {
    clarity: {
      type: Number,
      required: true,
      min: 0,
      max: 10,
    },
    structure: {
      type: Number,
      required: true,
      min: 0,
      max: 10,
    },
    depth: {
      type: Number,
      required: true,
      min: 0,
      max: 10,
    },
    relevance: {
      type: Number,
      required: true,
      min: 0,
      max: 10,
    },
  },
  { _id: false },
);

const questionPracticeAttemptSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    generationSession: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "QuestionGenerationSession",
      default: null,
      index: true,
    },
    questionText: {
      type: String,
      required: true,
      trim: true,
      minlength: 10,
      maxlength: 500,
    },
    answerText: {
      type: String,
      required: true,
      trim: true,
      minlength: 10,
      maxlength: 5000,
    },
    rubricScore: {
      type: rubricScoreSchema,
      required: true,
    },
    overallScore: {
      type: Number,
      required: true,
      min: 0,
      max: 10,
    },
    isMatch: {
      type: Boolean,
      required: true,
      default: false,
    },
    shouldImprove: {
      type: Boolean,
      required: true,
      default: true,
    },
    feedbackSummary: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
    strengths: {
      type: [String],
      default: [],
    },
    improvements: {
      type: [String],
      default: [],
    },
  },
  { timestamps: true },
);

export const QuestionPracticeAttempt = mongoose.model(
  "QuestionPracticeAttempt",
  questionPracticeAttemptSchema,
);
