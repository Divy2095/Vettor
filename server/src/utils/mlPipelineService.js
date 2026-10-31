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
     * Helper to resolve a PDF buffer from either an in-memory Buffer or a file path string.
     * @param {Buffer|string} bufferOrPath
     * @returns {Promise<Buffer>}
     */
    static async _resolveBuffer(bufferOrPath) {
        if (Buffer.isBuffer(bufferOrPath)) {
            return bufferOrPath;
        }
        if (typeof bufferOrPath === "string") {
            return await fs.readFile(bufferOrPath);
        }
        throw new ApiError(400, "Invalid resume input: expected Buffer or file path string");
    }

    /**
     * Save resume buffer to local file (maintained for legacy compatibility if required)
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

    static async _processResumeLocally(bufferOrPath, topK = 30) {
        const pdfBuffer = await this._resolveBuffer(bufferOrPath);
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
     * @param {Buffer|string} bufferOrPath - PDF Buffer or path to resume PDF
     * @param {string} [filename="resume.pdf"]
     * @returns {Promise<Object>} - { profileString, rawSkills, expandedSkills, ... }
     */
    static async processResume(bufferOrPath, filename = "resume.pdf") {
        try {
            const pdfBuffer = await this._resolveBuffer(bufferOrPath);
            const resolvedFilename = typeof bufferOrPath === "string" ? path.basename(bufferOrPath) : filename;

            console.log("[MLPipelineService] Processing resume:", resolvedFilename);

            const base64Data = pdfBuffer.toString("base64");

            // Call ML API /extract endpoint
            const response = await this._makeMLAPIRequest(
                "/api/extract",
                "POST",
                {
                    resume_base64: base64Data,
                    filename: resolvedFilename,
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
                processingTime: response.data.processing_time_ms || 0,
            };
        } catch (error) {
            if (this._isMLUnavailableError(error)) {
                console.warn(
                    "[MLPipelineService] ML API unavailable, using local fallback for resume processing",
                );
                return await this._processResumeLocally(bufferOrPath);
            }

            console.error("Resume processing error:", error);
            throw new ApiError(
                500,
                error.message || "Failed to process resume",
            );
        }
    }

    /**
     * Search for questions matching a profile using FAISS
     *
     * @param {string} profileString - Search query profile
     * @param {Array<string>} skills - Expanded skills for tag matching
     * @param {number} topK - Number of questions to return
     * @param {number} minScore - Minimum similarity threshold
     * @returns {Promise<Array>} - List of ranked questions
     */
    static async searchQuestions(
        profileString,
        skills = [],
        topK = 30,
        minScore = 0.25,
    ) {
        try {
            console.log(
                `[MLPipelineService] Searching questions (top_k=${topK}, min_score=${minScore})...`,
            );

            // Call ML API /search endpoint
            const response = await this._makeMLAPIRequest(
                "/api/search",
                "POST",
                {
                    profile_string: profileString,
                    skills,
                    top_k: topK,
                    min_score: minScore,
                },
            );

            if (!response.success) {
                throw new Error(response.error || "Question search failed");
            }

            console.log(
                `[MLPipelineService] ✅ Found ${response.data.questions?.length || 0} questions`,
            );

            return response.data.questions || [];
        } catch (error) {
            if (this._isMLUnavailableError(error)) {
                console.warn(
                    "[MLPipelineService] ML API unavailable, using local fallback questions",
                );
                return this._buildFallbackQuestions(skills, topK);
            }

            console.error("Question search error:", error);
            throw new ApiError(
                500,
                error.message || "Failed to search questions",
            );
        }
    }

    /**
     * Complete end-to-end processing (extract + search) in a single step
     *
     * @param {Buffer|string} bufferOrPath - Resume PDF Buffer or path
     * @param {number} topK - Number of questions to return
     * @param {number} minScore - Minimum similarity threshold
     * @param {string} [filename="resume.pdf"]
     * @returns {Promise<Object>} - Complete processing result
     */
    static async processResumeEndToEnd(bufferOrPath, topK = 30, minScore = 0.25, filename = "resume.pdf") {
        try {
            const pdfBuffer = await this._resolveBuffer(bufferOrPath);
            const resolvedFilename = typeof bufferOrPath === "string" ? path.basename(bufferOrPath) : filename;

            console.log(
                "[MLPipelineService] Starting end-to-end processing...",
            );

            const base64Data = pdfBuffer.toString("base64");

            // Call ML API /process endpoint (single call for efficiency)
            const response = await this._makeMLAPIRequest(
                "/api/process",
                "POST",
                {
                    resume_base64: base64Data,
                    filename: resolvedFilename,
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
                return await this._processResumeLocally(bufferOrPath, topK);
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
            console.log(
                `[MLPipelineService] Expanding ${skills.length} skills...`,
            );

            const response = await this._makeMLAPIRequest(
                "/api/expand-skills",
                "POST",
                { skills },
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
     * Clean and prepare text for ML processing
     *
     * @param {string} text - Raw text to clean
     * @returns {Promise<string>} - Cleaned text
     */
    static async cleanText(text) {
        try {
            const response = await this._makeMLAPIRequest(
                "/api/clean-text",
                "POST",
                { text },
            );

            if (!response.success) {
                throw new Error(response.error || "Text cleaning failed");
            }

            return response.data.cleaned_text;
        } catch (error) {
            console.error("Text cleaning error:", error);
            throw new ApiError(500, error.message || "Failed to clean text");
        }
    }

    /**
     * Extract sections from resume text
     *
     * @param {string} text - Resume text
     * @returns {Promise<Object>} - Sections found
     */
    static async extractSections(text) {
        try {
            const response = await this._makeMLAPIRequest(
                "/api/extract-sections",
                "POST",
                { text },
            );

            if (!response.success) {
                throw new Error(
                    response.error || "Section extraction failed",
                );
            }

            return response.data;
        } catch (error) {
            console.error("Section extraction error:", error);
            throw new ApiError(
                500,
                error.message || "Failed to extract sections",
            );
        }
    }
}

export default MLPipelineService;
