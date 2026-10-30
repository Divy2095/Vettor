import mongoose from "mongoose";

const generatedQuestionSchema = new mongoose.Schema(
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
        focusSkill: {
            type: String,
            trim: true,
            default: "",
        },
    },
    { _id: false },
);

const questionGenerationSessionSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        targetRole: {
            type: String,
            trim: true,
            default: "",
            maxlength: 120,
        },
        targetCompany: {
            type: String,
            trim: true,
            default: "",
            maxlength: 100,
        },
        targetLevel: {
            type: String,
            trim: true,
            default: "mid",
            enum: ["intern", "junior", "mid", "senior", "lead"],
        },
        targetDomain: {
            type: String,
            trim: true,
            default: "",
            maxlength: 80,
        },
        resumeSkills: {
            type: [String],
            default: [],
        },
        skillGap: {
            type: {
                matchedSkills: {
                    type: [String],
                    default: [],
                },
                missingSkills: {
                    type: [String],
                    default: [],
                },
                prioritizedLearningPlan: {
                    type: [String],
                    default: [],
                },
            },
            default: {
                matchedSkills: [],
                missingSkills: [],
                prioritizedLearningPlan: [],
            },
        },
        sourceFileName: {
            type: String,
            trim: true,
            default: "",
            maxlength: 255,
        },
        generatedQuestions: {
            type: [generatedQuestionSchema],
            default: [],
        },
        mlDatasetQuestions: {
            type: [
                {
                    question: {
                        type: String,
                        required: true,
                        trim: true,
                    },
                    topic: {
                        type: String,
                        trim: true,
                        default: "Unknown",
                    },
                    difficulty: {
                        type: String,
                        trim: true,
                        default: "Unknown",
                    },
                },
            ],
            default: [],
        },
        displayName: {
            type: String,
            trim: true,
            default: null,
            maxlength: 255,
        },
        lastAccessedAt: {
            type: Date,
            default: () => new Date(),
            index: true,
        },
    },
    { timestamps: true },
);

export const QuestionGenerationSession = mongoose.model(
    "QuestionGenerationSession",
    questionGenerationSessionSchema,
);
