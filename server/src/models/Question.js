import mongoose from "mongoose";

const questionSchema = new mongoose.Schema(
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
    sourceSubmissionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "QuestionSubmission",
      default: null,
      index: true,
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true },
);

export const Question = mongoose.model("Question", questionSchema);
