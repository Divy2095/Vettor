import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, ".env") });

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-1.5-flash";

if (!GEMINI_API_KEY) {
    console.error("❌ GEMINI_API_KEY not found in .env");
    process.exit(1);
}

console.log("🔍 Gemini API Test Suite");
console.log(`📌 Model: ${GEMINI_MODEL}`);
console.log(`📌 API Key: ${GEMINI_API_KEY.slice(0, 10)}...${GEMINI_API_KEY.slice(-5)}\n`);

// Helper functions (same as geminiService.js)
const clampScore = (value) => {
    const n = Number(value);
    if (Number.isNaN(n)) return 0;
    return Math.min(10, Math.max(0, Math.round(n)));
};

const cleanString = (value, max = 240) =>
    String(value || "").trim().replace(/\s+/g, " ").slice(0, max);

const cleanList = (items, maxItems = 4, maxText = 180) =>
    (Array.isArray(items) ? items : [])
        .map((item) => cleanString(item, maxText))
        .filter(Boolean)
        .slice(0, maxItems);

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

const normalizeGeminiFeedback = (payload) => {
    const rubricScore = {
        clarity: clampScore(payload?.rubricScore?.clarity),
        structure: clampScore(payload?.rubricScore?.structure),
        depth: clampScore(payload?.rubricScore?.depth),
        relevance: clampScore(payload?.rubricScore?.relevance),
    };

    const average = Math.round(
        (rubricScore.clarity + rubricScore.structure + rubricScore.depth + rubricScore.relevance) / 4
    );

    return {
        rubricScore,
        overallScore: clampScore(payload?.overallScore ?? average),
        strengths: cleanList(payload?.strengths, 4, 180),
        improvements: cleanList(payload?.improvements, 4, 180),
        feedbackSummary: cleanString(payload?.feedbackSummary, 600),
        isMatch: Boolean(payload?.isMatch),
        shouldImprove: Boolean(payload?.shouldImprove),
    };
};

// Main API call function
const evaluateAnswerWithGemini = async ({ questionText, answerText }) => {
    const prompt = `You are an interview answer evaluator. Analyze whether the answer matches the question intent and whether it needs improvement.
Return ONLY valid JSON (no markdown, no extra text) in this exact shape:
{
  "rubricScore": {
    "clarity": number,
    "structure": number,
    "depth": number,
    "relevance": number
  },
  "overallScore": number,
  "isMatch": boolean,
  "shouldImprove": boolean,
  "strengths": ["..."],
  "improvements": ["..."],
  "feedbackSummary": "..."
}
Rules:
- scores must be integers from 0 to 10.
- strengths and improvements should each have 2 to 4 concise points.
- feedbackSummary should clearly mention match quality and key improvement advice.
Question: ${questionText}
Answer: ${answerText}`;

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent?key=${GEMINI_API_KEY}`;

    const response = await fetch(endpoint, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
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

    if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `Gemini API error ${response.status}`;

        if (response.status === 429) {
            errorMessage = `Gemini quota exceeded (429)`;
        } else if (response.status === 401 || response.status === 403) {
            errorMessage = `Gemini API key invalid (${response.status})`;
        } else if (response.status === 404) {
            errorMessage = `Gemini model not found (404)`;
        }

        throw new Error(errorMessage);
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    const parsed = extractJson(text);
    if (!parsed) {
        throw new Error("Gemini response did not include parseable JSON");
    }

    return normalizeGeminiFeedback(parsed);
};

// Test cases
const testCases = [
    {
        name: "✅ CORRECT & DETAILED ANSWER",
        question: "Tell me about a time when you had to deal with a difficult team member. How did you handle it?",
        answer: "There was a situation where my team member was not meeting deadlines and impacting the project. First, I had a one-on-one conversation to understand their challenges. It turned out they were struggling with the technical requirements. I paired them with a senior developer for mentoring. As a result, their productivity improved by 40% in the next sprint and the team's delivery timeline improved significantly.",
        expectedIsMatch: true,
        expectedShouldImprove: false,
    },
    {
        name: "❌ INCORRECT & VAGUE ANSWER",
        question: "Tell me about a time when you had to deal with a difficult team member. How did you handle it?",
        answer: "I don't really remember any specific situation. I think I just ignored them.",
        expectedIsMatch: false,
        expectedShouldImprove: true,
    },
    {
        name: "⚠️ PARTIALLY CORRECT ANSWER",
        question: "Explain how you would design a REST API for a social media platform.",
        answer: "I would create endpoints for users and posts. The API would handle CRUD operations. I would use authentication tokens for security.",
        expectedIsMatch: true,
        expectedShouldImprove: true,
    },
    {
        name: "✅ STRONG TECHNICAL ANSWER",
        question: "Describe your experience with React and state management.",
        answer: "I have 3 years of experience with React. I've worked with both Redux and Context API for state management. In my recent project, I implemented a global state using Redux Toolkit which reduced component re-renders by 35%. I also implemented custom hooks for reusable logic across components. I understand the virtual DOM and reconciliation algorithm, which helped optimize performance by implementing memo and useMemo strategically.",
        expectedIsMatch: true,
        expectedShouldImprove: false,
    },
    {
        name: "❌ OFF-TOPIC ANSWER",
        question: "What are the key differences between SQL and NoSQL databases?",
        answer: "I like to code in JavaScript. It's a very popular programming language. I also enjoy working with web development.",
        expectedIsMatch: false,
        expectedShouldImprove: true,
    },
];

// Validation function
const validateResponse = (response, testCase) => {
    const issues = [];

    // Check required fields
    if (!response.rubricScore) issues.push("Missing rubricScore");
    if (response.overallScore === undefined) issues.push("Missing overallScore");
    if (response.isMatch === undefined) issues.push("Missing isMatch");
    if (response.shouldImprove === undefined) issues.push("Missing shouldImprove");
    if (!response.feedbackSummary) issues.push("Missing feedbackSummary");
    if (!Array.isArray(response.strengths)) issues.push("Strengths is not an array");
    if (!Array.isArray(response.improvements)) issues.push("Improvements is not an array");

    // Check score ranges
    if (response.rubricScore) {
        ["clarity", "structure", "depth", "relevance"].forEach((key) => {
            const score = response.rubricScore[key];
            if (score < 0 || score > 10) {
                issues.push(`${key} score ${score} is out of range [0-10]`);
            }
        });
    }

    if (response.overallScore < 0 || response.overallScore > 10) {
        issues.push(`overallScore ${response.overallScore} is out of range [0-10]`);
    }

    // Check expectations
    if (testCase.expectedIsMatch !== undefined && response.isMatch !== testCase.expectedIsMatch) {
        issues.push(`isMatch: expected ${testCase.expectedIsMatch}, got ${response.isMatch}`);
    }

    if (testCase.expectedShouldImprove !== undefined && response.shouldImprove !== testCase.expectedShouldImprove) {
        issues.push(`shouldImprove: expected ${testCase.expectedShouldImprove}, got ${response.shouldImprove}`);
    }

    return issues;
};

// Run tests
(async () => {
    let passCount = 0;
    let failCount = 0;

    for (const testCase of testCases) {
        console.log(`\n${"=".repeat(80)}`);
        console.log(`TEST: ${testCase.name}`);
        console.log(`${"=".repeat(80)}`);

        try {
            console.log(`📝 Question: ${testCase.question}`);
            console.log(`💬 Answer: ${testCase.answer.substring(0, 100)}...`);
            console.log(`\n⏳ Calling Gemini API...`);

            const result = await evaluateAnswerWithGemini({
                questionText: testCase.question,
                answerText: testCase.answer,
            });

            console.log(`\n📊 Response:`);
            console.log(`  Overall Score: ${result.overallScore}/10`);
            console.log(`  Rubric Scores:`);
            console.log(`    - Clarity: ${result.rubricScore.clarity}/10`);
            console.log(`    - Structure: ${result.rubricScore.structure}/10`);
            console.log(`    - Depth: ${result.rubricScore.depth}/10`);
            console.log(`    - Relevance: ${result.rubricScore.relevance}/10`);
            console.log(`  Is Match: ${result.isMatch}`);
            console.log(`  Should Improve: ${result.shouldImprove}`);
            console.log(`  Feedback Summary: ${result.feedbackSummary.substring(0, 120)}...`);
            console.log(`  Strengths: ${result.strengths.join(", ")}`);
            console.log(`  Improvements: ${result.improvements.join(", ")}`);

            const issues = validateResponse(result, testCase);

            if (issues.length === 0) {
                console.log(`\n✅ PASS: All validations passed`);
                passCount++;
            } else {
                console.log(`\n❌ FAIL: Validation issues found:`);
                issues.forEach((issue) => console.log(`   ⚠️  ${issue}`));
                failCount++;
            }
        } catch (error) {
            console.log(`\n❌ ERROR: ${error.message}`);
            failCount++;
        }
    }

    console.log(`\n${"=".repeat(80)}`);
    console.log(`📈 TEST RESULTS`);
    console.log(`${"=".repeat(80)}`);
    console.log(`✅ Passed: ${passCount}/${testCases.length}`);
    console.log(`❌ Failed: ${failCount}/${testCases.length}`);
    console.log(`Success Rate: ${((passCount / testCases.length) * 100).toFixed(1)}%`);

    if (failCount === 0) {
        console.log(`\n🎉 All tests passed! Gemini API is working correctly.`);
        process.exit(0);
    } else {
        console.log(`\n⚠️  Some tests failed. Review the issues above.`);
        process.exit(1);
    }
})();
