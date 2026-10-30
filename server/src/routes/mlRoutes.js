import express from "express";
import axios from "axios";
import mongoose from "mongoose";
import { authenticate } from "../middleware/authenticate.js";
import { handleUploadResume } from "../middleware/uploadResume.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import MLPipelineService from "../utils/mlPipelineService.js";
import { QuestionGenerationSession } from "../models/QuestionGenerationSession.js";
import UserSession from "../models/UserSession.js";

const router = express.Router();

const ML_API_URL = process.env.ML_API_URL || "http://localhost:8000";

// GET /api/ml/question — fetch a single random question
router.get("/question", async (req, res) => {
    try {
        const response = await axios.get(`${ML_API_URL}/get-question`);
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ error: "ML API error" });
    }
});

// POST /api/ml/questions-by-skills — fetch questions filtered by resume skills
router.post("/questions-by-skills", authenticate, async (req, res) => {
    try {
        const { skills, maxPerSkill } = req.body;

        if (!skills || !Array.isArray(skills) || skills.length === 0) {
            return res.status(400).json({ error: "skills array is required" });
        }

        const response = await axios.post(
            `${ML_API_URL}/get-questions-by-skills`,
            {
                skills,
                max_per_skill: maxPerSkill || 5,
            },
        );

        res.json(response.data);
    } catch (error) {
        const isConnectionError =
            error.code === "ECONNREFUSED" ||
            error.code === "ECONNRESET" ||
            error.code === "ENOTFOUND";

        console.error(
            "ML API /get-questions-by-skills error:",
            isConnectionError
                ? `Connection refused at ${ML_API_URL} — is the ML API server running?`
                : error?.response?.data || error.message,
        );

        res.status(502).json({
            error: isConnectionError
                ? `ML API server is not reachable at ${ML_API_URL}. Please start it with: cd ML_Preprocessor_scripts && uvicorn ml_api:app --reload --port 8000`
                : "Could not fetch questions from ML API",
            details: error?.response?.data || error.message,
        });
    }
});

// ─────────────────────────────────────────────────────────────────
// POST /api/ml/process-resume
// Full ML pipeline: PDF → extract text → build profile → FAISS search
// Returns extracted skills + matched interview questions
// Also saves results to MongoDB and exports to JSON
// ─────────────────────────────────────────────────────────────────
router.post(
  "/process-resume",
  authenticate,
  handleUploadResume,
  asyncHandler(async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: "Resume PDF is required" });
    }

    const userId = req.user.sub;
    const startTime = Date.now();

    // Step 1: Save resume to disk for the ML pipeline
    const resumePath = await MLPipelineService.saveResumeFile(
      req.file.buffer,
      userId,
    );

    // Step 2: Run the full ML pipeline (extract + profile + FAISS search)
    const result = await MLPipelineService.processResumeEndToEnd(
      resumePath,
      30,   // top_k
      0.15, // min_score (lower threshold to get more results)
    );

    const processingTime = Date.now() - startTime;

    // Step 3: Save to MongoDB (UserSession)
    const userSession = await UserSession.create({
      userId,
      resumePath,
      profileString: result.profileString || "",
      extractedSkills: result.rawSkills || [],
      expandedSkills: result.expandedSkills || [],
      generatedQuestions: (result.questions || []).map((q, idx) => ({
        sr_no: q["sr no"] || q.sr_no || idx + 1,
        topic: q.topic || q.Topic || "General",
        question: q.question || q.Question || "",
        difficulty: q.difficulty || q.Difficulty || "Unknown",
        tags: q.tags || [],
        score: q.similarity_score || q.original_score || 0,
        tag_score: q.tag_overlap || 0,
        final_score: q.combined_score || q.similarity_score || 0,
      })),
      totalQuestions: (result.questions || []).length,
      processingTime,
      status: "completed",
      metadata: {
        userAgent: req.get("user-agent"),
        ipAddress: req.ip,
      },
    });

    // Step 4: Export questions to JSON file for quick access
    const exportData = {
      sessionId: userSession._id,
      userId,
      createdAt: new Date().toISOString(),
      processingTimeMs: processingTime,
      profile: {
        rawSkills: result.rawSkills || [],
        expandedSkills: result.expandedSkills || [],
        sectionsFound: result.sectionsFound || [],
      },
      questions: userSession.generatedQuestions,
      summary: {
        totalQuestions: userSession.totalQuestions,
        byTopic: {},
        byDifficulty: { Easy: 0, Medium: 0, Hard: 0, Unknown: 0 },
      },
    };

    // Calculate summary stats
    userSession.generatedQuestions.forEach((q) => {
      const topic = q.topic || "General";
      exportData.summary.byTopic[topic] =
        (exportData.summary.byTopic[topic] || 0) + 1;

      const diff = q.difficulty || "Unknown";
      const key =
        diff.charAt(0).toUpperCase() + diff.slice(1).toLowerCase();
      if (exportData.summary.byDifficulty[key] !== undefined) {
        exportData.summary.byDifficulty[key]++;
      } else {
        exportData.summary.byDifficulty["Unknown"]++;
      }
    });

    // Save the JSON export to disk
    try {
      const { default: fs } = await import("fs/promises");
      const { default: path } = await import("path");
      const { fileURLToPath } = await import("url");

      const __filename = fileURLToPath(import.meta.url);
      const __dirname = path.dirname(__filename);
      const outputDir = path.join(
        __dirname,
        "../../../ML_Preprocessor_scripts/data",
      );
      const outputPath = path.join(
        outputDir,
        `faiss_results_${userId}.json`,
      );

      await fs.mkdir(outputDir, { recursive: true });
      await fs.writeFile(outputPath, JSON.stringify(exportData, null, 2));
      console.log(`[ML] FAISS results exported to: ${outputPath}`);
    } catch (exportErr) {
      console.warn("[ML] Could not export JSON file:", exportErr.message);
    }

    // Step 5: Return response
    return res.status(200).json({
      success: true,
      message: `ML pipeline completed in ${processingTime}ms`,
      sessionId: userSession._id,
      processingTimeMs: processingTime,
      skills: {
        raw: result.rawSkills || [],
        expanded: result.expandedSkills || [],
      },
      questions: userSession.generatedQuestions,
      totalQuestions: userSession.totalQuestions,
      sectionsFound: result.sectionsFound || [],
    });
  }),
);

// ─────────────────────────────────────────────────────────────────
// GET /api/ml/session/:sessionId
// Retrieve a previously saved ML session with questions
// ─────────────────────────────────────────────────────────────────
router.get(
  "/session/:sessionId",
  authenticate,
  asyncHandler(async (req, res) => {
    const session = await UserSession.findOne({
      _id: req.params.sessionId,
      userId: req.user.sub,
    });

    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    return res.status(200).json({
      success: true,
      sessionId: session._id,
      status: session.status,
      skills: {
        raw: session.extractedSkills,
        expanded: session.expandedSkills,
      },
      questions: session.generatedQuestions,
      totalQuestions: session.totalQuestions,
      processingTimeMs: session.processingTime,
      createdAt: session.createdAt,
    });
  }),
);

// ─────────────────────────────────────────────────────────────────
// GET /api/ml/health
// Check if the ML API server is reachable
// ─────────────────────────────────────────────────────────────────
router.get(
  "/health",
  asyncHandler(async (_req, res) => {
    const healthy = await MLPipelineService.healthCheck();
    return res.status(healthy ? 200 : 503).json({
      success: healthy,
      message: healthy
        ? "ML API is healthy"
        : "ML API is not reachable. Start it with: cd ML_Preprocessor_scripts && python ml_api_server.py",
    });
  }),
);

// POST /api/ml/save-questions-to-session — save ML questions to a session
router.post("/save-questions-to-session", authenticate, async (req, res) => {
    try {
        const { sessionId, questions } = req.body;
    const userId = req.user.id || req.user.sub;

        if (!sessionId) {
            return res.status(400).json({ error: "sessionId is required" });
        }

        if (!Array.isArray(questions) || questions.length === 0) {
            return res
                .status(400)
                .json({ error: "questions array is required" });
        }

        // Validate sessionId is a valid MongoDB ID
        if (!mongoose.Types.ObjectId.isValid(sessionId)) {
            return res.status(400).json({ error: "Invalid sessionId" });
        }

        // Find the session and ensure it belongs to the user
        const session = await QuestionGenerationSession.findOne({
            _id: sessionId,
            user: userId,
        });

        if (!session) {
            return res.status(404).json({ error: "Session not found" });
        }

        // Extract unique questions to avoid duplicates within the new batch
        const existingQuestionTexts = new Set(
            session.mlDatasetQuestions.map((q) => q.question),
        );

        const newQuestions = questions.filter(
            (q) => !existingQuestionTexts.has(q.question),
        );

        // Add new questions to the session
        session.mlDatasetQuestions.push(...newQuestions);
        await session.save();

        res.json({
            message: "Questions saved to session",
            addedCount: newQuestions.length,
            totalCount: session.mlDatasetQuestions.length,
        });
    } catch (error) {
        console.error("Error saving questions to session:", error.message);
        res.status(500).json({
            error: "Could not save questions to session",
            details: error.message,
        });
    }
});

// POST /api/ml/create-session — create a new QuestionGenerationSession and attach ML dataset questions
router.post("/create-session", authenticate, async (req, res) => {
    try {
        const {
            targetRole,
            targetCompany,
            targetLevel,
            targetDomain,
            sourceFileName,
            resumeSkills,
            mlQuestions,
            displayName,
        } = req.body;

        if (!Array.isArray(mlQuestions) || mlQuestions.length === 0) {
            return res
                .status(400)
                .json({ error: "mlQuestions array is required" });
        }

        const userId = req.user.id || req.user.sub;

        const session = await QuestionGenerationSession.create({
            user: userId,
            targetRole: targetRole || "",
            targetCompany: targetCompany || "",
            targetLevel: targetLevel || "mid",
            targetDomain: targetDomain || "",
            sourceFileName: sourceFileName || "",
            resumeSkills: Array.isArray(resumeSkills) ? resumeSkills : [],
            mlDatasetQuestions: mlQuestions.map((q) => ({
                question: q.question,
                topic: q.topic || q.topic || "Unknown",
                difficulty: q.difficulty || "Unknown",
            })),
            displayName: displayName || null,
        });

        return res.status(201).json({ message: "Session created", session });
    } catch (error) {
        console.error("Could not create ML session:", error.message);
        return res
            .status(500)
            .json({
                error: "Could not create session",
                details: error.message,
            });
    }
});

export default router;
