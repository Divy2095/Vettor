/**
 * ML Pipeline Service - Bridges Node.js backend with Python ML pipeline
 * Communicates with Flask API server instead of spawning processes
 */

import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { PDFParse } from "pdf-parse";
import { ApiError } from "./apiError.js";
import { env } from "../config/env.js";
import { extractSkillsFromResumeText } from "./skillExtractor.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ML_SCRIPTS_DIR = path.join(
    __dirname,
    "../../..",
    "ML_Preprocessor_scripts",
);
const USER_RESUMES_DIR = path.join(ML_SCRIPTS_DIR, "user_resumes");
const FALLBACK_SKILLS = [
    "problem solving",
    "communication",
    "ownership",
    "system design",
    "collaboration",
];
const FALLBACK_QUESTION_TEMPLATES = [
    ({ skill }) =>
        `Describe a project where you used ${skill} to solve a production problem.`,
    ({ skill }) =>
        `How do you apply ${skill} when designing or reviewing a solution?`,
    ({ skill }) => `Walk me through a challenge that required strong ${skill}.`,
    ({ skill }) =>
        `What trade-offs do you consider when using ${skill} in a real project?`,
    ({ skill }) =>
        `Give an example of how ${skill} improved the outcome of your work.`,
];

// ML API Server configuration
const ML_API_BASE_URL = env.ML_API_URL || "http://localhost:5001";
const ML_API_TIMEOUT = 60000; // 60 seconds timeout for long-running operations

class MLPipelineService {
    /**
     * Initialize directories
     */
    static async initializeDirs() {
        try {
            await fs.mkdir(USER_RESUMES_DIR, { recursive: true });
        } catch (error) {
            console.error("Error initializing directories:", error);
        }
    }

    /**
     * Save resume buffer to file
     * @param {Buffer} pdfBuffer - PDF file buffer
     * @param {string} userId - User ID for organization
     * @returns {Promise<string>} - Path to saved resume
     */
    static async saveResumeFile(pdfBuffer, userId) {
        try {
            const userDir = path.join(USER_RESUMES_DIR, userId);
            await fs.mkdir(userDir, { recursive: true });

            const resumePath = path.join(userDir, "resume.pdf");
            await fs.writeFile(resumePath, pdfBuffer);

            return resumePath;
        } catch (error) {
            throw new ApiError(500, `Failed to save resume: ${error.message}`);
        }
    }

    static _isMLUnavailableError(error) {
        const message = error?.message || "";
        return (
            error?.statusCode === 503 ||
            error?.statusCode === 504 ||
            /fetch failed|ML API unavailable|ECONNREFUSED|timeout/i.test(
                message,
            )
        );
    }

    static _buildFallbackQuestions(skills, questionCount) {
        const normalizedSkills = [
            ...new Set(
                (skills || []).map((skill) => skill.trim()).filter(Boolean),
            ),
        ];
        const selectedSkills =
            normalizedSkills.length > 0
                ? normalizedSkills
                : FALLBACK_SKILLS.slice();

        return Array.from({ length: questionCount }, (_value, index) => {
            const skill = selectedSkills[index % selectedSkills.length];
            const template =
                FALLBACK_QUESTION_TEMPLATES[
                    index % FALLBACK_QUESTION_TEMPLATES.length
                ];
            const baseScore = Math.max(0.35, 0.92 - index * 0.02);
            const difficulty =
                index % 3 === 0 ? "Easy" : index % 3 === 1 ? "Medium" : "Hard";
            const question = template({ skill });

            return {
                question,
                questionText: question,
                topic: skill,
                difficulty,
                tags: [skill.toLowerCase()],
                similarity_score: Number(baseScore.toFixed(4)),
                original_score: Number(baseScore.toFixed(4)),
                tag_overlap: 0.25,
                combined_score: Number(
                    Math.min(0.99, baseScore + 0.03).toFixed(4),
                ),
            };
        });
    }

    static async _processResumeLocally(resumePath, topK = 30) {
        const pdfBuffer = await fs.readFile(resumePath);
        const parser = new PDFParse({ data: pdfBuffer });

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

        const rawSkills = extractSkillsFromResumeText(resumeText);
        const expandedSkills = [
            ...new Set(rawSkills.length > 0 ? rawSkills : FALLBACK_SKILLS),
        ];
        const profileString =
            rawSkills.length > 0
                ? `Technical skills and expertise: ${rawSkills.join(", ")}.`
                : "Technical skills and expertise: problem solving, communication, ownership, system design, collaboration.";

        return {
            profileString,
            rawSkills,
            expandedSkills,
            extractedData: {
                resume_excerpt: resumeText.slice(0, 500),
            },
            sectionsFound: [],
            questions: this._buildFallbackQuestions(expandedSkills, topK),
            processingTime: 0,
            fallback: true,
            fallbackReason: "ML API unavailable",
        };
    }

    /**
     * Make HTTP request to ML API with timeout
     * @private
     */
    static async _makeMLAPIRequest(endpoint, method = "GET", data = null) {
        try {
            const url = `${ML_API_BASE_URL}${endpoint}`;
            const options = {
                method,
                headers: { "Content-Type": "application/json" },
                timeout: ML_API_TIMEOUT,
            };

            if (data && (method === "POST" || method === "PUT")) {
                options.body = JSON.stringify(data);
            }

            const response = await fetch(url, options);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(
                    errorData.error || `ML API error: ${response.statusText}`,
                );
            }

            return await response.json();
        } catch (error) {
            if (error.name === "AbortError") {
                throw new ApiError(504, "ML API request timeout");
            }
            console.error(`ML API request failed (${endpoint}):`, error);
            throw new ApiError(503, `ML API unavailable: ${error.message}`);
        }
    }

    /**
     * Check if ML API is healthy
     * @returns {Promise<boolean>}
     */
    static async healthCheck() {
        try {
            const response = await this._makeMLAPIRequest("/health");
            return response.success === true;
        } catch (error) {
            console.warn("ML API health check failed:", error.message);
            return false;
        }
    }

    /**
     * Process resume using ML API
     * Extract skills and build semantic profile
     *
     * @param {string} resumePath - Path to resume PDF
     * @returns {Promise<Object>} - { profileString, rawSkills, expandedSkills, ... }
     */
    static async processResume(resumePath) {
        try {
            console.log("[MLPipelineService] Processing resume:", resumePath);

            // Read PDF file as buffer
            const pdfBuffer = await fs.readFile(resumePath);
            const base64Data = pdfBuffer.toString("base64");

            // Call ML API /extract endpoint
            const response = await this._makeMLAPIRequest(
                "/api/extract",
                "POST",
                {
                    resume_base64: base64Data,
                    filename: path.basename(resumePath),
                },
            );

            if (!response.success) {
                throw new Error(response.error || "Resume processing failed");
            }

            console.log("[MLPipelineService] ✅ Resume processed successfully");
            console.log(
                `   - Found ${response.data.expanded_skills?.length || 0} expanded skills`,
            );
            console.log(
                `   - Found ${response.data.sections_found?.length || 0} resume sections`,
            );

            // Return in expected format
            return {
                profileString: response.data.profile_string,
                rawSkills: response.data.raw_skills || [],
                expandedSkills: response.data.expanded_skills || [],
                extractedData: response.data.extracted_data || {},
                sectionsFound: response.data.sections_found || [],
            };
        } catch (error) {
            if (this._isMLUnavailableError(error)) {
                console.warn(
                    "[MLPipelineService] ML API unavailable, using local fallback for resume extraction",
                );
                const fallbackResult = await this._processResumeLocally(
                    resumePath,
                    30,
                );
                return {
                    profileString: fallbackResult.profileString,
                    rawSkills: fallbackResult.rawSkills,
                    expandedSkills: fallbackResult.expandedSkills,
                    extractedData: fallbackResult.extractedData,
                    sectionsFound: fallbackResult.sectionsFound,
                };
            }

            console.error("Resume processing error:", error);
            throw new ApiError(
                500,
                error.message || "Failed to process resume",
            );
        }
    }

    /**
     * Search for interview questions using ML API
     *
     * @param {string} profileString - User's semantic profile
     * @param {Array<string>} userSkills - Expanded user skills
     * @param {number} topK - Number of results to return
     * @param {number} minScore - Minimum similarity threshold
     * @returns {Promise<Array>} - Array of relevant questions
     */
    static async searchQuestions(
        profileString,
        userSkills = [],
        topK = 30,
        minScore = 0.25,
    ) {
        try {
            if (!profileString) {
                throw new ApiError(400, "Profile string is required");
            }

            if (topK < 1 || topK > 100) {
                throw new ApiError(400, "topK must be between 1 and 100");
            }

            console.log("[MLPipelineService] Searching for questions");
            console.log(`   - top_k: ${topK}`);
            console.log(`   - min_score: ${minScore}`);
            console.log(`   - user_skills: ${userSkills.length}`);

            // Call ML API /search endpoint
            const response = await this._makeMLAPIRequest(
                "/api/search",
                "POST",
                {
                    profile_string: profileString,
                    user_skills: userSkills,
                    top_k: topK,
                    min_score: minScore,
                    use_tag_boosting: true,
                    with_explanations: false,
                },
            );

            if (!response.success) {
                throw new Error(response.error || "Question search failed");
            }

            console.log(
                `[MLPipelineService] ✅ Found ${response.data.questions?.length || 0} questions in ${response.data.processing_time_ms}ms`,
            );

            return response.data.questions || [];
        } catch (error) {
            console.error("Question search error:", error);
            throw new ApiError(
                500,
                error.message || "Failed to search questions",
            );
        }
    }

    /**
     * End-to-end resume processing and question generation
     *
     * @param {string} resumePath - Path to resume PDF
     * @param {number} topK - Number of questions to generate
     * @param {number} minScore - Minimum similarity threshold
     * @returns {Promise<Object>} - Complete processing result
     */
    static async processResumeEndToEnd(resumePath, topK = 30, minScore = 0.25) {
        try {
            console.log(
                "[MLPipelineService] Starting end-to-end processing...",
            );

            // Read PDF file as buffer
            const pdfBuffer = await fs.readFile(resumePath);
            const base64Data = pdfBuffer.toString("base64");

            // Call ML API /process endpoint (single call for efficiency)
            const response = await this._makeMLAPIRequest(
                "/api/process",
                "POST",
                {
                    resume_base64: base64Data,
                    filename: path.basename(resumePath),
                    top_k: topK,
                    min_score: minScore,
                },
            );

            if (!response.success) {
                throw new Error(response.error || "Processing failed");
            }

            console.log(
                `[MLPipelineService] ✅ End-to-end processing completed in ${response.data.processing_time_ms}ms`,
            );
            console.log(
                `   - Extracted ${response.data.expanded_skills?.length || 0} skills`,
            );
            console.log(
                `   - Generated ${response.data.questions?.length || 0} questions`,
            );

            // Return in expected format
            return {
                profileString: response.data.profile_string,
                rawSkills: response.data.raw_skills || [],
                expandedSkills: response.data.expanded_skills || [],
                extractedData: response.data.extracted_data || {},
                sectionsFound: response.data.sections_found || [],
                questions: response.data.questions || [],
                processingTime: response.data.processing_time_ms || 0,
            };
        } catch (error) {
            if (this._isMLUnavailableError(error)) {
                console.warn(
                    "[MLPipelineService] ML API unavailable, using local fallback for end-to-end processing",
                );
                return await this._processResumeLocally(resumePath, topK);
            }

            console.error("End-to-end processing error:", error);
            throw new ApiError(
                500,
                error.message || "Failed to process resume",
            );
        }
    }

    /**
     * Expand a list of skills using ontology
     *
     * @param {Array<string>} skills - Skills to expand
     * @returns {Promise<Object>} - { inputSkills, expandedSkills, newSkills }
     */
    static async expandSkills(skills) {
        try {
            if (!Array.isArray(skills) || skills.length === 0) {
                throw new ApiError(400, "Skills must be a non-empty array");
            }

            const response = await this._makeMLAPIRequest(
                "/api/expand-skills",
                "POST",
                {
                    skills,
                },
            );

            if (!response.success) {
                throw new Error(response.error || "Skill expansion failed");
            }

            return response.data;
        } catch (error) {
            console.error("Skill expansion error:", error);
            throw new ApiError(500, error.message || "Failed to expand skills");
        }
    }

    /**
     * Load questions index into memory for faster access
     * @returns {Promise<Array>} - Array of all questions
     */
    static async loadQuestionsIndex() {
        try {
            const questionsPath = path.join(
                ML_SCRIPTS_DIR,
                "data/questions.json",
            );
            const data = await fs.readFile(questionsPath, "utf-8");
            return JSON.parse(data);
        } catch (error) {
            throw new ApiError(
                500,
                `Failed to load questions index: ${error.message}`,
            );
        }
    }

    /**
     * Validate that ML pipeline is properly set up
     * @returns {Promise<boolean>}
     */
    static async validateSetup() {
        try {
            // Check if data files exist
            const questionsPath = path.join(
                ML_SCRIPTS_DIR,
                "data/questions.json",
            );
            const indexPath = path.join(ML_SCRIPTS_DIR, "data/questions.index");

            const questionsExists = await fs
                .access(questionsPath)
                .then(() => true)
                .catch(() => false);
            const indexExists = await fs
                .access(indexPath)
                .then(() => true)
                .catch(() => false);

            // Also check if ML API is healthy
            const apiHealthy = await this.healthCheck();

            return questionsExists && indexExists && apiHealthy;
        } catch (error) {
            console.error("ML pipeline validation failed:", error);
            return false;
        }
    }
}

// Initialize on import
MLPipelineService.initializeDirs();

export default MLPipelineService;
