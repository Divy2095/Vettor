import express from "express";
import axios from "axios";
import { authenticate } from "../middleware/authenticate.js";
import { handleUploadResume } from "../middleware/uploadResume.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import MLPipelineService from "../utils/mlPipelineService.js";
import { createUserClient } from "../config/supabase.js";
import { isValidUUID } from "../services/db/dbUtils.js";
import { sessionService, questionService, resumeService } from "../services/db/index.js";

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
// Full ML pipeline: PDF → Supabase Storage → extract text → build profile → FAISS search
// Returns extracted skills + matched interview questions
// Also saves results to PostgreSQL and exports to JSON
// ─────────────────────────────────────────────────────────────────
router.post(
  "/process-resume",
  authenticate,
  handleUploadResume,
  asyncHandler(async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: "Resume PDF is required" });
    }

    const userId = req.user.id || req.user.sub;
    const client = createUserClient(req.user.token);
    const startTime = Date.now();

    // Step 1: Upload to Supabase Storage and persist metadata record in PostgreSQL
    const resumeRecord = await resumeService.uploadAndPersistResume(client, {
      userId,
      fileName: req.file.originalname,
      buffer: req.file.buffer,
      mimeType: req.file.mimetype || "application/pdf",
    });

    // Step 2: Run the full ML pipeline (extract + profile + FAISS search) using in-memory buffer
    let result;
    try {
      result = await MLPipelineService.processResumeEndToEnd(
        req.file.buffer,
        30,   // top_k
        0.15, // min_score (lower threshold to get more results)
        req.file.originalname,
      );
    } catch (mlErr) {
      // In accordance with Phase 3 requirement: on ML failure, retain the uploaded resume
      // in Storage & DB, and create a failed session record for tracking.
      console.error("[ML] Resume processing failed:", mlErr.message);
      await sessionService.createSession(client, {
        userId,
        resumeId: resumeRecord.id,
        targetRole: "Resume Interview",
        targetCompany: "",
        targetLevel: "mid",
        status: "failed",
        errorMessage: mlErr.message || "ML processing failed",
        displayName: req.file.originalname
          ? `Resume - ${req.file.originalname}`
          : null,
      }).catch((sessErr) => {
        console.warn("[ML] Failed to record failed session:", sessErr.message);
      });
      throw mlErr;
    }

    const processingTime = Date.now() - startTime;

    // Step 3: Update resume record with extracted skills
    if (result.rawSkills || result.expandedSkills || result.sectionsFound) {
      try {
        await resumeService.updateResumeSkills(client, resumeRecord.id, {
          rawSkills: result.rawSkills,
          expandedSkills: result.expandedSkills,
          sectionsFound: result.sectionsFound,
        });
      } catch (skillUpdateErr) {
        console.warn("[ML] Could not update resume skills record:", skillUpdateErr.message);
      }
    }

    // Step 4: Save to PostgreSQL (interview_sessions)
    const session = await sessionService.createSession(client, {
      userId,
      resumeId: resumeRecord.id,
      targetRole: "Resume Interview",
      targetCompany: "",
      targetLevel: "mid",
      resumeSkills: result.rawSkills || [],
      skillGap: {
        matchedSkills: result.rawSkills || [],
        missingSkills: [],
        prioritizedLearningPlan: [],
      },
      status: "completed",
      processingTimeMs: processingTime,
      displayName: req.file.originalname
        ? `Resume - ${req.file.originalname}`
        : null,
    });

    // Save questions
    let savedQuestions = [];
    if (result.questions && result.questions.length > 0) {
      const questionsToInsert = result.questions.map((q, idx) => ({
        question: q.question || q.Question || "",
        topic: q.topic || q.Topic || "General",
        difficulty: q.difficulty || q.Difficulty || "Unknown",
        tags: Array.isArray(q.tags) ? q.tags : [],
        score: q.similarity_score || q.original_score || 0,
        tag_score: q.tag_overlap || 0,
        final_score: q.combined_score || q.similarity_score || 0,
        orderIndex: q["sr no"] || q.sr_no || idx + 1,
        sourceType: "generated",
      }));

      savedQuestions = await questionService.createSessionQuestions(
        client,
        session.id,
        questionsToInsert,
      );
    }

    // Step 5: Export questions to JSON file for quick access (if directory exists)
    const exportData = {
      sessionId: session.id,
      resumeId: resumeRecord.id,
      userId,
      createdAt: new Date().toISOString(),
      processingTimeMs: processingTime,
      profile: {
        rawSkills: result.rawSkills || [],
        expandedSkills: result.expandedSkills || [],
        sectionsFound: result.sectionsFound || [],
      },
      questions: savedQuestions,
      summary: {
        totalQuestions: savedQuestions.length,
        byTopic: {},
        byDifficulty: { Easy: 0, Medium: 0, Hard: 0, Unknown: 0 },
      },
    };

    // Calculate summary stats
    savedQuestions.forEach((q) => {
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

    // Step 6: Return response
    return res.status(200).json({
      success: true,
      message: `ML pipeline completed in ${processingTime}ms`,
      sessionId: session.id,
      resumeId: resumeRecord.id,
      processingTimeMs: processingTime,
      skills: {
        raw: result.rawSkills || [],
        expanded: result.expandedSkills || [],
      },
      questions: savedQuestions,
      totalQuestions: savedQuestions.length,
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
    const { sessionId } = req.params;
    if (!isValidUUID(sessionId)) {
      return res.status(404).json({ error: "Session not found" });
    }

    const client = createUserClient(req.user.token);
    const session = await sessionService.getSessionById(client, sessionId);

    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    const { questions, pagination } = await questionService.getSessionQuestions(
      client,
      sessionId,
      { limit: 200 },
    );

    return res.status(200).json({
      success: true,
      sessionId: session.id,
      status: session.status,
      skills: {
        raw: session.skillGap?.matchedSkills || session.resumeSkills || [],
        expanded: session.resumeSkills || [],
      },
      questions,
      totalQuestions: pagination.total,
      processingTimeMs: session.processingTimeMs || session.processingTime || 0,
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

        if (!sessionId) {
            return res.status(400).json({ error: "sessionId is required" });
        }

        if (!Array.isArray(questions) || questions.length === 0) {
            return res
                .status(400)
                .json({ error: "questions array is required" });
        }

        // Validate sessionId is a valid UUID
        if (!isValidUUID(sessionId)) {
            return res.status(400).json({ error: "Invalid sessionId" });
        }

        const client = createUserClient(req.user.token);

        // Find the session and ensure it belongs to the user
        const session = await sessionService.getSessionById(client, sessionId);

        if (!session) {
            return res.status(404).json({ error: "Session not found" });
        }

        // Fetch existing questions to deduplicate and determine orderIndex
        const { questions: existingQuestions } =
            await questionService.getSessionQuestions(client, sessionId, {
                limit: 500,
            });

        const existingQuestionTexts = new Set(
            existingQuestions.map((q) => (q.question || q.questionText || "").toLowerCase().trim()),
        );

        const newQuestions = questions.filter(
            (q) => {
                const text = (q.question || q.questionText || "").toLowerCase().trim();
                return text && !existingQuestionTexts.has(text);
            },
        );

        if (newQuestions.length > 0) {
            const questionsToInsert = newQuestions.map((q, idx) => ({
                question: q.question || q.questionText || "",
                topic: q.topic || "Unknown",
                difficulty: q.difficulty || "Medium",
                tags: Array.isArray(q.tags) ? q.tags : [],
                score: q.score || q.similarity_score || null,
                tag_score: q.tag_score || null,
                final_score: q.final_score || null,
                sourceType: "ml_dataset",
                orderIndex: existingQuestions.length + idx,
            }));

            await questionService.createSessionQuestions(
                client,
                sessionId,
                questionsToInsert,
            );
        }

        const totalCount = existingQuestions.length + newQuestions.length;

        res.json({
            message: "Questions saved to session",
            addedCount: newQuestions.length,
            totalCount,
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
        const client = createUserClient(req.user.token);

        const session = await sessionService.createSession(client, {
            userId,
            targetRole: targetRole || "",
            targetCompany: targetCompany || "",
            targetLevel: targetLevel || "mid",
            targetDomain: targetDomain || "",
            resumeSkills: Array.isArray(resumeSkills) ? resumeSkills : [],
            displayName: displayName || (sourceFileName ? `ML - ${sourceFileName}` : null),
            status: "completed",
        });

        const questionsToInsert = mlQuestions.map((q, idx) => ({
            question: q.question,
            topic: q.topic || "Unknown",
            difficulty: q.difficulty || "Unknown",
            tags: Array.isArray(q.tags) ? q.tags : [],
            orderIndex: idx,
            sourceType: "ml_dataset",
        }));

        const insertedQuestions = await questionService.createSessionQuestions(
            client,
            session.id,
            questionsToInsert,
        );

        return res.status(201).json({
            message: "Session created",
            session: {
                ...session,
                mlDatasetQuestions: insertedQuestions,
            },
        });
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
