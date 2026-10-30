import { z } from "zod";

export const createSubmissionSchema = z.object({
    questionText: z
        .string()
        .trim()
        .min(10, "Question must be at least 10 characters")
        .max(500),
    tags: z
        .array(z.string().trim().min(1).max(40))
        .max(10)
        .optional()
        .default([]),
    company: z.string().trim().max(100).optional().default(""),
    seenInInterview: z.boolean(),
});

export const moderateSubmissionSchema = z.object({
    adminNote: z.string().trim().max(500).optional().default(""),
});

export const createQuestionSchema = z.object({
    questionText: z
        .string()
        .trim()
        .min(10, "Question must be at least 10 characters")
        .max(500),
    tags: z
        .array(z.string().trim().min(1).max(40))
        .max(10)
        .optional()
        .default([]),
    company: z.string().trim().max(100).optional().default(""),
    seenInInterview: z.boolean(),
});

export const generateQuestionsSchema = z.object({
    targetRole: z.string().trim().max(120).optional().default(""),
    targetCompany: z.string().trim().max(100).optional().default(""),
    targetLevel: z
        .enum(["intern", "junior", "mid", "senior", "lead"])
        .optional()
        .default("mid"),
    targetDomain: z.string().trim().max(80).optional().default(""),
    sourceFileName: z.string().trim().max(255).optional().default(""),
    resumeSkills: z
        .array(z.string().trim().min(1).max(50))
        .max(20)
        .optional()
        .default([]),
    questionCount: z.coerce.number().int().min(10).max(50).optional().default(10),
    forceNew: z.coerce.boolean().optional().default(false),
});

export const practiceAnswerSchema = z.object({
    questionText: z.string().trim().min(10).max(500),
    answerText: z.string().trim().min(10).max(5000),
    generationSessionId: z.string().trim().optional().nullable(),
});
