import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, ".env") });

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL;

const logFile = join(__dirname, "gemini-monitoring.log");

const log = (message) => {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${message}`;
    console.log(logEntry);
    fs.appendFileSync(logFile, logEntry + "\n");
};

const clampScore = (value) => {
    const n = Number(value);
    if (Number.isNaN(n)) return 0;
    return Math.min(10, Math.max(0, Math.round(n)));
};

const extractJson = (rawText) => {
    const text = String(rawText || "").trim();
    if (!text) return null;

    const fencedMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    const candidate = fencedMatch?.[1] || text;

    const firstBrace = candidate.indexOf("{");
    const lastBrace = candidate.lastIndexOf("}");

    if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
        return null;
    }

    const jsonText = candidate.slice(firstBrace, lastBrace + 1);
    return JSON.parse(jsonText);
};

const testGeminiAPI = async () => {
    log("====== GEMINI API HEALTH CHECK ======");
    log(`Model: ${GEMINI_MODEL}`);
    log(`API Key: ${GEMINI_API_KEY.slice(0, 10)}...${GEMINI_API_KEY.slice(-5)}`);

    // Simple health check
    const testQuestion = "What is 2+2?";
    const testAnswer = "The answer is 4.";

    try {
        const prompt = `You are an interview answer evaluator. Analyze whether the answer matches the question intent.
Return ONLY valid JSON in this exact shape:
{
  "rubricScore": {
    "clarity": 5,
    "structure": 5,
    "depth": 5,
    "relevance": 5
  },
  "overallScore": 5,
  "isMatch": true,
  "shouldImprove": false,
  "strengths": ["Correct answer"],
  "improvements": [],
  "feedbackSummary": "Correct"
}
Question: ${testQuestion}
Answer: ${testAnswer}`;

        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
            GEMINI_MODEL
        )}:generateContent?key=${GEMINI_API_KEY}`;

        const startTime = Date.now();
        const response = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [
                    {
                        role: "user",
                        parts: [{ text: prompt }],
                    },
                ],
                generationConfig: {
                    temperature: 0.2,
                    topP: 0.9,
                },
            }),
        });
        const duration = Date.now() - startTime;

        if (!response.ok) {
            log(`❌ API FAILED - Status: ${response.status} (${duration}ms)`);

            if (response.status === 429) {
                log(`⚠️  Quota Exceeded`);
            } else if (response.status === 503) {
                log(`⚠️  Service Unavailable`);
            } else if (response.status === 401 || response.status === 403) {
                log(`❌ Invalid API Key`);
            }

            return { status: response.status, success: false, duration };
        }

        const data = await response.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

        const parsed = extractJson(text);
        if (!parsed) {
            log(`❌ Invalid JSON Response`);
            return { status: response.status, success: false, duration };
        }

        log(`✅ API HEALTHY - Status: ${response.status} (${duration}ms)`);
        log(`   Overall Score: ${parsed.overallScore}`);
        log(`   Response Time: ${duration}ms`);

        return { status: 200, success: true, duration, score: parsed.overallScore };
    } catch (error) {
        log(`❌ ERROR: ${error.message}`);
        return { success: false, error: error.message };
    }
};

const displayStats = () => {
    log("\n====== API STATISTICS ======");
    log(`Model: ${GEMINI_MODEL}`);
    log(`Monitoring Period: Check logs in ${logFile}`);
    log(`Commands:`);
    log(`  View logs: tail -f ${logFile}`);
    log(`  Clear logs: rm ${logFile}`);
};

// Run test
await testGeminiAPI();
displayStats();

log("====== END CHECK ======\n");
