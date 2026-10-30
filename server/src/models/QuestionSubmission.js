import mongoose from "mongoose";

const questionSubmissionSchema = new mongoose.Schema(
  {
    questionText: {
      type: String,
      required: true,
      trim: true,
      minlength: 10,
      maxlength: 500,
    },
    tags: {
      type: [String],
      default: [],
    },
    company: {
      type: String,
      trim: true,
      default: "",
      maxlength: 100,
    },
    seenInInterview: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      index: true,
    },
    submittedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    adminNote: {
      type: String,
      trim: true,
      default: "",
      maxlength: 500,
    },
    approvedQuestionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Question",
      default: null,
    },
  },
  { timestamps: true },
);

export const QuestionSubmission = mongoose.model("QuestionSubmission", questionSubmissionSchema);
