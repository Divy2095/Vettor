import { PDFParse } from "pdf-parse";

import { ApiError } from "../utils/apiError.js";
import { evaluateAnswerWithGemini } from "../services/geminiService.js";
import { extractSkillsFromResumeText } from "../utils/skillExtractor.js";
import MLPipelineService from "../utils/mlPipelineService.js";
import { createUserClient } from "../config/supabase.js";
import {
  sessionService,
  questionService,
  practiceService,
  submissionService,
  resumeService,
} from "../services/db/index.js";

const normalizeTags = (tags) =>
    [
        ...new Set(
            (tags || []).map((tag) => tag.trim().toLowerCase()).filter(Boolean),
        ),
    ].slice(0, 10);

const normalizeTextList = (items) => [
    ...new Set(
        (items || []).map((item) => item.trim().toLowerCase()).filter(Boolean),
    ),
];

const normalizeSessionField = (value) => (value || "").trim().toLowerCase();

const buildSessionIdentity = ({
    targetRole,
    targetCompany,
    targetLevel,
    targetDomain,
    sourceFileName,
    resumeSkills,
    questionCount,
}) => ({
    targetRole: normalizeSessionField(targetRole || ""),
    targetCompany: normalizeSessionField(targetCompany || ""),
    targetLevel: normalizeSessionField(targetLevel || "mid"),
    targetDomain: normalizeSessionField(targetDomain || ""),
    sourceFileName: normalizeSessionField(sourceFileName || ""),
    resumeSkills: [...normalizeTextList(resumeSkills)].sort(),
    questionCount: Number(questionCount || 0),
});

const sessionMatchesIdentity = (session, identity) => {
    const sessionSkills = [...normalizeTextList(session.resumeSkills)].sort();

    return (
        normalizeSessionField(session.targetRole || "") ===
            identity.targetRole &&
        normalizeSessionField(session.targetCompany || "") ===
            identity.targetCompany &&
        normalizeSessionField(session.targetLevel || "mid") ===
            identity.targetLevel &&
        normalizeSessionField(session.targetDomain || "") ===
            identity.targetDomain &&
        normalizeSessionField(session.sourceFileName || "") ===
            identity.sourceFileName &&
        sessionSkills.length === identity.resumeSkills.length &&
        sessionSkills.every(
            (skill, index) => skill === identity.resumeSkills[index],
        )
    );
};

const roleSkillMap = {
    frontend: [
        "react",
        "javascript",
        "typescript",
        "css",
        "testing",
        "performance",
        "accessibility",
    ],
    backend: [
        "node.js",
        "api design",
        "databases",
        "authentication",
        "scalability",
        "testing",
    ],
    fullstack: [
        "react",
        "node.js",
        "api design",
        "databases",
        "system design",
        "testing",
    ],
    data: [
        "python",
        "sql",
        "statistics",
        "machine learning",
        "data visualization",
    ],
    devops: [
        "ci/cd",
        "docker",
        "kubernetes",
        "cloud",
        "monitoring",
        "security",
    ],
};

const buildSkillGapInsights = ({
    resumeSkills,
    targetRole,
    targetCompany: _targetCompany,
    targetLevel: _targetLevel,
    targetDomain: _targetDomain,
}) => {
    const normalizedResumeSkills = normalizeTextList(resumeSkills);
    const resumeSkillSet = new Set(normalizedResumeSkills);

    const lookupRole = (targetRole || "").toLowerCase();
    const matchedRoleKey = Object.keys(roleSkillMap).find((roleKey) =>
        lookupRole.includes(roleKey),
    );

    const baselineSkills = matchedRoleKey
        ? roleSkillMap[matchedRoleKey]
        : [
              "problem solving",
              "system design",
              "communication",
              "testing",
              "performance",
          ];

    const matchedSkills = baselineSkills.filter((skill) =>
        resumeSkillSet.has(skill),
    );
    const missingSkills = baselineSkills.filter(
        (skill) => !resumeSkillSet.has(skill),
    );

    const prioritizedLearningPlan = missingSkills.map(
        (skill, index) =>
            `Week ${index + 1}: Build practical confidence in ${skill} through targeted projects and mock interview drills.`,
    );

    return {
        matchedSkills,
        missingSkills,
        prioritizedLearningPlan,
    };
};

const buildGeneratedQuestions = ({
    resumeSkills,
    targetRole,
    targetCompany,
    targetLevel,
    targetDomain,
    questionCount,
}) => {
    const skills = normalizeTextList(resumeSkills);
    const primarySkill = skills[0] || targetDomain || targetRole || "core concepts";
    const secondarySkill = skills[1] || "system design";

    const baseTemplates = [
        `How would you design and implement a production-grade feature using ${primarySkill} for a ${targetLevel} ${targetRole} role at ${targetCompany || "a high-growth product company"}?`,
        `Describe a challenging debugging scenario involving ${primarySkill}. How did you identify root cause and prevent regressions?`,
        `How do you evaluate performance bottlenecks when working with ${secondarySkill} in high-throughput environments?`,
        `Explain how you maintain testing standards, code reviews, and reliability when shipping complex changes with ${primarySkill}.`,
        `Walk me through an architectural trade-off you made between development speed and long-term maintainability using ${secondarySkill}.`,
        `How do you handle data consistency, failure recovery, and observability in distributed workflows relevant to ${targetDomain || targetRole}?`,
        `What strategies do you use for secure configuration, secret management, and access controls in modern services?`,
        `Describe how you collaborate across product, design, and engineering to clarify underspecified requirements under tight deadlines.`,
        `How do you mentor junior teammates and establish effective engineering best practices across a team?`,
        `Tell me about an ambiguous production outage or escalation you resolved under pressure. What was the impact?`,
    ];

    const generated = [];
    for (let index = 0; index < questionCount; index += 1) {
        const template = baseTemplates[index % baseTemplates.length];
        const focusSkill = index % 2 === 0 ? primarySkill : secondarySkill;

        generated.push({
            questionText: template,
            question: template,
            tags: normalizeTags([
                focusSkill,
                targetRole,
                targetCompany,
                targetLevel,
            ]),
            focusSkill,
            topic: focusSkill,
            difficulty: index % 3 === 0 ? "Easy" : index % 3 === 1 ? "Medium" : "Hard",
            sourceType: "fallback",
        });
    }

    return generated;
};

const scoreAnswerRubric = (answerText, _questionText) => {
    const text = (answerText || "").trim();
    const length = text.length;

    const clarity = Math.min(10, Math.max(3, Math.floor(length / 90) + 3));
    const structure = /first|second|then|finally|result|because/i.test(text) ? 8 : 5;
    const depth = /(metric|latency|scale|trade-off|architecture|test|cache)/i.test(text) ? 8 : 4;
    const relevance = length > 120 ? 8 : 4;

    const rubricScore = { clarity, structure, depth, relevance };
    const overallScore = Math.round(
        (clarity + structure + depth + relevance) / 4,
    );

    return {
        rubricScore,
        overallScore,
        isMatch: overallScore >= 7,
        shouldImprove: overallScore < 8,
        strengths: [
            "Includes relevant technical context and intent.",
            "Demonstrates direct practical familiarity with the question.",
        ],
        improvements: [
            "Quantify business and engineering outcomes using metrics.",
            "State architectural trade-offs explicitly before detailing your approach.",
        ],
        feedbackSummary:
            overallScore >= 7
                ? "Good foundation. Add more structure, evidence, and measurable outcomes."
                : "Answer needs more structure and deeper examples to be interview-ready.",
    };
};

/**
 * Submit community interview question
 * @POST /api/questions/submissions
 */
export const createSubmission = async (req, res) => {
    const { questionText, tags, company, seenInInterview } = req.body;
    const client = createUserClient(req.user.token);

    const submission = await submissionService.createSubmission(client, {
        submittedBy: req.user.id || req.user.sub,
        questionText,
        tags: normalizeTags(tags),
        company: company || "",
        seenInInterview: Boolean(seenInInterview),
    });

    return res.status(201).json({
        message: "Question submitted for admin review",
        submission: {
            id: submission.id,
            status: submission.status,
            createdAt: submission.createdAt,
        },
    });
};

/**
 * List submissions by authenticated user
 * @GET /api/questions/submissions/me
 */
export const listMySubmissions = async (req, res) => {
    const client = createUserClient(req.user.token);
    const result = await submissionService.listUserSubmissions(
        client,
        req.user.id || req.user.sub,
        {
            page: req.query.page,
            limit: req.query.limit,
        },
    );

    return res.status(200).json({ submissions: result.submissions });
};

/**
 * Upload resume buffer and extract skills via ML pipeline with Supabase Storage persistence
 * @POST /api/questions/resume/skills
 */
export const uploadResumeAndExtractSkills = async (req, res) => {
    if (!req.file) {
        throw new ApiError(400, "Resume PDF is required");
    }

    const userId = req.user.id || req.user.sub;
    const client = createUserClient(req.user.token);

    // Upload to Supabase Storage and create metadata record
    const resumeRecord = await resumeService.uploadAndPersistResume(client, {
        userId,
        fileName: req.file.originalname,
        buffer: req.file.buffer,
        mimeType: req.file.mimetype || "application/pdf",
    });

    try {
        const profileResult = await MLPipelineService.processResume(
            req.file.buffer,
            req.file.originalname,
        );
        const rawSkills = profileResult.rawSkills || [];
        const expandedSkills = profileResult.expandedSkills || [];
        const sectionsFound = profileResult.sectionsFound || [];

        // Update resume metadata record with extracted skills
        await resumeService.updateResumeSkills(client, resumeRecord.id, {
            rawSkills,
            expandedSkills,
            sectionsFound,
        });

        return res.status(200).json({
            message: "Resume analyzed with ML pipeline successfully",
            fileName: req.file.originalname,
            skills: rawSkills,
            expandedSkills: expandedSkills,
            totalSkills: rawSkills.length,
            totalExpanded: expandedSkills.length,
            sectionsFound,
            resumeId: resumeRecord.id,
        });
    } catch (error) {
        console.warn(
            "ML pipeline unavailable, falling back to local extractor:",
            error.message,
        );

        const parser = new PDFParse({ data: req.file.buffer });
        let parsed;
        try {
            parsed = await parser.getText();
        } finally {
            if (typeof parser.destroy === "function") {
                await parser.destroy();
            }
        }

        const resumeText = (parsed?.text || "").trim();
        if (!resumeText) {
            throw new ApiError(
                400,
                "Could not read text from the uploaded PDF",
            );
        }

        const skills = extractSkillsFromResumeText(resumeText);

        await resumeService.updateResumeSkills(client, resumeRecord.id, {
            rawSkills: skills,
            expandedSkills: skills,
            sectionsFound: [],
        });

        return res.status(200).json({
            message:
                "Resume analyzed successfully (fallback mode — ML API unavailable)",
            fileName: req.file.originalname,
            skills,
            expandedSkills: skills,
            totalSkills: skills.length,
            totalExpanded: skills.length,
            sectionsFound: [],
            fallback: true,
            resumeId: resumeRecord.id,
        });
    }
};

/**
 * Generate questions and create an interview session
 * @POST /api/questions/generate
 */
export const generateQuestions = async (req, res) => {
    const {
        targetRole,
        targetCompany,
        targetLevel,
        targetDomain,
        sourceFileName,
        resumeSkills,
        questionCount = 10,
        forceNew,
    } = req.body;

    const requestedCount = Math.max(10, questionCount || 10);
    const userId = req.user.id || req.user.sub;
    const client = createUserClient(req.user.token);

    const sessionIdentity = buildSessionIdentity({
        targetRole,
        targetCompany,
        targetLevel,
        targetDomain,
        sourceFileName,
        resumeSkills,
        questionCount: requestedCount,
    });

    // Check for existing matching session if forceNew is not set
    if (!forceNew) {
        const existingSessions = await sessionService.listUserSessions(
            client,
            userId,
            { limit: 50 },
        );

        const matchingSession = existingSessions.find((session) =>
            sessionMatchesIdentity(session, sessionIdentity),
        );

        if (matchingSession) {
            const { questions } = await questionService.getSessionQuestions(
                client,
                matchingSession.id,
                { limit: 100 },
            );
            const answeredCount = await practiceService.countSessionPracticeAttempts(
                client,
                matchingSession.id,
            );

            return res.status(409).json({
                message:
                    "A matching session already exists for this resume and target setup.",
                existingSession: {
                    ...matchingSession,
                    answeredCount,
                    totalQuestions: questions.length,
                    generatedQuestions: questions,
                },
                duplicate: true,
            });
        }
    }

    const skillGap = buildSkillGapInsights({
        resumeSkills,
        targetRole,
        targetCompany,
        targetLevel,
        targetDomain,
    });

    const searchSkills =
        resumeSkills && resumeSkills.length > 0
            ? resumeSkills
            : skillGap.missingSkills.slice(0, 5);

    const profileParts = [
        searchSkills.length > 0
            ? `Technical skills: ${searchSkills.join(", ")}`
            : "",
        targetRole ? `Target role: ${targetRole}` : "",
        targetCompany ? `Target company: ${targetCompany}` : "",
        targetLevel ? `Target level: ${targetLevel}` : "",
        targetDomain ? `Target domain: ${targetDomain}` : "",
    ]
        .filter(Boolean)
        .join(". ");

    const profileString =
        profileParts ||
        "Looking for interview questions based on resume skills";

    let generatedQuestions = [];
    let mlApiError = null;

    try {
        const mlQuestions = await MLPipelineService.searchQuestions(
            profileString,
            searchSkills,
            Math.max(requestedCount, 30),
            0.15,
        );

        if (mlQuestions && mlQuestions.length > 0) {
            generatedQuestions = mlQuestions
                .slice(0, requestedCount)
                .map((q) => ({
                    questionText:
                        q.question || q.questionText || "Interview question",
                    question:
                        q.question || q.questionText || "Interview question",
                    tags: normalizeTags([
                        ...(q.tags || []),
                        targetRole,
                        targetCompany,
                        targetLevel,
                    ]),
                    focusSkill: q.topic || q.tags?.[0] || searchSkills[0] || "",
                    topic: q.topic || searchSkills[0] || "General",
                    difficulty: q.difficulty || "Medium",
                    score: q.similarity_score || q.score || 0.85,
                    tag_score: q.tag_overlap || 0,
                    final_score: q.combined_score || q.similarity_score || 0.85,
                    sourceType: "ml_dataset",
                }));
        }
    } catch (error) {
        mlApiError = error.message;
        console.warn(
            "[generateQuestions] ML API error (using fallback):",
            mlApiError,
        );
    }

    if (generatedQuestions.length === 0) {
        generatedQuestions = buildGeneratedQuestions({
            resumeSkills: searchSkills,
            targetRole,
            targetCompany,
            targetLevel,
            targetDomain,
            questionCount: requestedCount,
        });
    }

    if (generatedQuestions.length < 10) {
        const additionalCount = 10 - generatedQuestions.length;
        const fallbackQuestions = buildGeneratedQuestions({
            resumeSkills: searchSkills,
            targetRole,
            targetCompany,
            targetLevel,
            targetDomain,
            questionCount: additionalCount,
        });
        generatedQuestions = [...generatedQuestions, ...fallbackQuestions];
    }

    const finalQuestions = generatedQuestions.slice(0, requestedCount);

    // Create session in PostgreSQL
    const session = await sessionService.createSession(client, {
        userId,
        targetRole: targetRole || "",
        targetCompany: targetCompany || "",
        targetLevel: targetLevel || "mid",
        targetDomain: targetDomain || "",
        sourceFileName: sourceFileName || "",
        resumeSkills: normalizeTags(resumeSkills),
        skillGap,
        status: "completed",
    });

    // Persist questions in session_questions
    const persistedQuestions = await questionService.createSessionQuestions(
        client,
        session.id,
        finalQuestions,
    );

    const responseData = {
        ...session,
        answeredCount: 0,
        totalQuestions: persistedQuestions.length,
        generatedQuestions: persistedQuestions,
    };

    return res.status(201).json({
        message: "Questions generated successfully",
        session: responseData,
        usedMLAPI: generatedQuestions.length > 0 && !mlApiError,
        mlAPIError: mlApiError || null,
        questionCount: responseData.generatedQuestions.length,
    });
};

/**
 * List history of generated question sessions
 * @GET /api/questions/history
 */
export const listQuestionHistory = async (req, res) => {
    const userId = req.user.id || req.user.sub;
    const client = createUserClient(req.user.token);

    const sessions = await sessionService.listUserSessions(client, userId, {
        limit: 20,
    });

    const sessionsWithCount = await Promise.all(
        sessions.map(async (session) => {
            const answeredCount = await practiceService.countSessionPracticeAttempts(
                client,
                session.id,
            );
            const { questions } = await questionService.getSessionQuestions(
                client,
                session.id,
                { limit: 100 },
            );

            return {
                ...session,
                answeredCount,
                totalQuestions: questions.length,
                generatedQuestions: questions,
            };
        }),
    );

    return res.status(200).json({ sessions: sessionsWithCount });
};

/**
 * Submit answer for practice and receive AI feedback
 * @POST /api/questions/practice
 */
export const practiceAnswerFeedback = async (req, res) => {
    const { questionText, answerText, generationSessionId, questionId } = req.body;
    const userId = req.user.id || req.user.sub;
    const client = createUserClient(req.user.token);

    let analysis = null;
    let feedbackProvider = "heuristic";

    try {
        const geminiAnalysis = await evaluateAnswerWithGemini({
            questionText,
            answerText,
        });

        if (geminiAnalysis) {
            analysis = {
                rubricScore: geminiAnalysis.rubricScore,
                overallScore: geminiAnalysis.overallScore,
                isMatch: geminiAnalysis.isMatch,
                shouldImprove: geminiAnalysis.shouldImprove,
                feedbackSummary: geminiAnalysis.feedbackSummary,
                strengths: geminiAnalysis.strengths,
                improvements: geminiAnalysis.improvements,
            };
            feedbackProvider = "gemini";
        }
    } catch (error) {
        console.warn(
            "Gemini feedback failed. Falling back to heuristic scoring:",
            error.message,
        );
    }

    if (!analysis) {
        analysis = scoreAnswerRubric(answerText, questionText);
    }

    const attempt = await practiceService.createPracticeAttempt(client, {
        userId,
        sessionId: generationSessionId || null,
        questionId: questionId || null,
        questionText,
        answerText,
        rubricScore: analysis.rubricScore,
        overallScore: analysis.overallScore,
        isMatch: analysis.isMatch,
        shouldImprove: analysis.shouldImprove,
        feedbackSummary: analysis.feedbackSummary,
        strengths: analysis.strengths,
        improvements: analysis.improvements,
        feedbackProvider,
    });

    if (generationSessionId) {
        try {
            await sessionService.touchSessionAccess(client, generationSessionId);
        } catch (_touchErr) {
            // Non-critical touch failure
        }
    }

    return res.status(201).json({
        message: "Practice feedback generated",
        attempt,
        feedbackProvider,
    });
};

/**
 * Access session (touch last accessed)
 * @POST /api/questions/:sessionId/access
 */
export const accessSession = async (req, res) => {
    const { sessionId } = req.params;
    const client = createUserClient(req.user.token);

    const session = await sessionService.touchSessionAccess(client, sessionId);

    return res.status(200).json({
        message: "Session accessed",
        session,
    });
};

/**
 * Rename session
 * @PATCH /api/questions/:sessionId/rename
 */
export const renameSession = async (req, res) => {
    const { sessionId } = req.params;
    const { displayName } = req.body;
    const client = createUserClient(req.user.token);

    const session = await sessionService.renameSession(client, sessionId, displayName);

    return res.status(200).json({
        message: "Session renamed successfully",
        session,
    });
};

/**
 * Delete session
 * @DELETE /api/questions/:sessionId
 */
export const deleteSession = async (req, res) => {
    const { sessionId } = req.params;
    const client = createUserClient(req.user.token);

    await sessionService.deleteSession(client, sessionId);

    return res.status(200).json({
        message: "Session deleted successfully",
    });
};

/**
 * Create custom blank or initial session
 * @POST /api/questions/create
 */
export const createSession = async (req, res) => {
    const {
        targetRole,
        targetCompany,
        targetLevel,
        targetDomain,
        sourceFileName,
        resumeSkills,
        displayName,
    } = req.body;

    const userId = req.user.id || req.user.sub;
    const client = createUserClient(req.user.token);

    const session = await sessionService.createSession(client, {
        userId,
        targetRole: targetRole || "",
        targetCompany: targetCompany || "",
        targetLevel: targetLevel || "mid",
        targetDomain: targetDomain || "",
        sourceFileName: sourceFileName || "",
        resumeSkills: Array.isArray(resumeSkills)
            ? resumeSkills.map((s) => s.toLowerCase())
            : [],
        displayName: displayName || null,
        status: "completed",
    });

    const responseData = {
        ...session,
        answeredCount: 0,
        totalQuestions: 0,
        generatedQuestions: [],
    };

    return res
        .status(201)
        .json({ message: "Session created", session: responseData });
};
