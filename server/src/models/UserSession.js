import mongoose from 'mongoose';

/**
 * Stores the results of ML pipeline processing for each user
 * Contains generated interview questions for a user session
 */
const userSessionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    resumePath: {
      type: String,
      required: true,
    },
    profileString: {
      type: String,
      required: true, // The semantic profile created from resume
    },
    extractedSkills: {
      type: [String],
      required: true, // Original skills extracted from resume
    },
    expandedSkills: {
      type: [String],
      required: true, // Skills after ontology expansion
    },
    generatedQuestions: {
      type: [
        {
          sr_no: Number,
          topic: String,
          question: String,
          difficulty: String,
          tags: [String],
          score: Number, // Relevance score (0-1)
          tag_score: Number, // Tag matching score
          final_score: Number, // Combined score
        },
      ],
      required: true,
      default: [],
    },
    totalQuestions: {
      type: Number,
      default: 0,
    },
    processingTime: {
      // Time taken to generate questions (in milliseconds)
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed'],
      default: 'pending',
    },
    errorMessage: {
      type: String,
      default: null,
    },
    metadata: {
      userAgent: String,
      ipAddress: String,
    },
  },
  {
    timestamps: true,
  }
);

// Index for faster queries
userSessionSchema.index({ userId: 1, createdAt: -1 });
userSessionSchema.index({ status: 1 });

export default mongoose.model('UserSession', userSessionSchema);
