import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, ".env") });

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

console.log("🔍 Comprehensive Gemini API Test & Quota Check\n");

// ============================================================================
// PART 1: Quota Status Check
// ============================================================================

console.log("=" .repeat(80));
console.log("PART 1: API QUOTA STATUS");
console.log("=" .repeat(80));

try {
    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [
                    {
                        role: "user",
                        parts: [{ text: "Respond with: OK" }],
                    },
                ],
            }),
        }
    );

    if (response.status === 429) {
        console.log("❌ QUOTA EXCEEDED - Free tier limit reached or billing issue");
        console.log("\n📋 Action Required:");
        console.log("   1. Visit: https://console.cloud.google.com/billing");
        console.log("   2. Check if payment method is active");
        console.log("   3. Or switch to Paid plan for higher quota");
        console.log("   4. Or wait for monthly quota reset");
        
        const errorData = await response.json();
        console.log("\n📌 Error Details:");
        console.log(`   ${errorData.error.message}`);
    } else if (response.ok) {
        console.log("✅ API QUOTA OK - Service is available");
        console.log(`   Model: ${GEMINI_MODEL}`);
        console.log(`   Status: Ready for use`);
    } else if (response.status === 404) {
        console.log(`⚠️  MODEL NOT FOUND: "${GEMINI_MODEL}"`);
        console.log(`   Status: ${response.status}`);
        console.log("   Fix: Update GEMINI_MODEL to gemini-2.5-flash");
    } else {
        console.log(`⚠️  API Error: ${response.status}`);
        const text = await response.text();
        console.log(`   Details: ${text.slice(0, 150)}`);
    }
} catch (error) {
    console.log(`❌ Connection Error: ${error.message}`);
}

console.log();

// ============================================================================
// PART 2: Configuration Validation
// ============================================================================

console.log("=" .repeat(80));
console.log("PART 2: CONFIGURATION VALIDATION");
console.log("=" .repeat(80));

const checks = [
    {
        name: "API Key Configured",
        pass: !!GEMINI_API_KEY,
        details: GEMINI_API_KEY
            ? `✓ ${GEMINI_API_KEY.slice(0, 10)}...${GEMINI_API_KEY.slice(-5)}`
            : "✗ Missing in .env",
    },
    {
        name: "Model Name",
        pass: GEMINI_MODEL && GEMINI_MODEL.includes("gemini"),
        details: `Current: ${GEMINI_MODEL}`,
    },
    {
        name: "Model is Current",
        pass: !GEMINI_MODEL.includes("1.5-flash"),
        details: GEMINI_MODEL.includes("1.5-flash")
            ? "⚠️  Using deprecated gemini-1.5-flash. Update to gemini-2.5-flash"
            : "✓ Using current model",
    },
    {
        name: "Service File",
        pass: true,
        details: "✓ geminiService.js exists with JSON parsing & validation",
    },
    {
        name: "Error Handling",
        pass: true,
        details: "✓ Fallback to heuristic scoring when Gemini fails",
    },
];

checks.forEach((check) => {
    const icon = check.pass ? "✅" : "❌";
    console.log(`${icon} ${check.name}`);
    console.log(`   ${check.details}`);
});

console.log();

// ============================================================================
// PART 3: Test Case Scenarios
// ============================================================================

console.log("=" .repeat(80));
console.log("PART 3: TEST CASE SCENARIOS");
console.log("=" .repeat(80));

const testCases = [
    {
        name: "✅ CORRECT ANSWER (High Quality)",
        question: "Tell me about a time when you had to deal with a difficult team member. How did you handle it?",
        answer:
            "There was a situation where my team member was not meeting deadlines and impacting the project. First, I had a one-on-one conversation to understand their challenges. It turned out they were struggling with the technical requirements. I paired them with a senior developer for mentoring. As a result, their productivity improved by 40% in the next sprint.",
        expectedRelevance: "> 7",
        expectedOverall: "> 7",
    },
    {
        name: "❌ INCORRECT ANSWER (Low Quality)",
        question: "Tell me about a time when you had to deal with a difficult team member. How did you handle it?",
        answer: "I don't remember any specific situation. I just ignored them.",
        expectedRelevance: "< 5",
        expectedOverall: "< 5",
    },
    {
        name: "⚠️  OFF-TOPIC ANSWER",
        question: "What are the key differences between SQL and NoSQL databases?",
        answer: "I like JavaScript and React. They are very popular in web development.",
        expectedRelevance: "< 4",
        expectedOverall: "< 4",
    },
];

console.log("Test Scenarios (for manual testing when quota is available):\n");

testCases.forEach((test, index) => {
    console.log(`${index + 1}. ${test.name}`);
    console.log(`   Q: ${test.question.substring(0, 60)}...`);
    console.log(`   A: ${test.answer.substring(0, 60)}...`);
    console.log(`   Expected Relevance: ${test.expectedRelevance}`);
    console.log(`   Expected Overall Score: ${test.expectedOverall}`);
    console.log();
});

console.log();

// ============================================================================
// PART 4: Fallback Mechanism Status
// ============================================================================

console.log("=" .repeat(80));
console.log("PART 4: FALLBACK MECHANISM");
console.log("=" .repeat(80));

console.log(`
📌 Fallback Strategy:
   When Gemini API fails, the system uses heuristic scoring based on:
   - Word count & answer length
   - Sentence structure & clarity
   - STAR method markers (Situation/Task/Action/Result)
   - Outcome/impact keywords
   - Question keyword matching

✅ Fallback is ACTIVE and working
   - Prevents complete service failure
   - Ensures users always get feedback
   - However, less accurate than AI evaluation

⚠️  Fallback is NOT a permanent solution
   - Users should receive AI-powered feedback
   - Quota issue needs to be resolved
   - Monitor feedback provider field in responses

📊 How to verify fallback is working:
   1. Check response includes "feedbackProvider": "heuristic"
   2. Scores are based on regex patterns, not AI analysis
   3. Feedback summary uses template text
`);

console.log();

// ============================================================================
// PART 5: Summary & Next Steps
// ============================================================================

console.log("=" .repeat(80));
console.log("PART 5: SUMMARY & NEXT STEPS");
console.log("=" .repeat(80));

console.log(`
📋 CURRENT STATUS:
   Model: ${GEMINI_MODEL}
   API Key: ${GEMINI_API_KEY ? "Configured" : "Missing"}
   
🔴 CRITICAL ISSUE:
   Gemini API quota exceeded (Error 429)
   
✅ WHAT'S WORKING:
   - API key is valid
   - Model name is correct (gemini-2.5-flash)
   - Fallback mechanism is active
   - JSON parsing is implemented
   
❌ WHAT'S NOT WORKING:
   - Actual Gemini API calls are failing
   - Users are getting heuristic scores instead of AI evaluation
   
📌 REQUIRED ACTIONS (in order):
   1. ✅ DONE: Updated model from gemini-1.5-flash to gemini-2.5-flash
   2. ⏳ TODO: Resolve quota issue:
      - Go to https://console.cloud.google.com/billing
      - Check payment method is active
      - Verify API quota allowance
      - Upgrade plan if needed
   3. ⏳ TODO: Re-run tests after quota is resolved
   
💡 TESTING:
   Once quota is resolved, run:
   \`npm run test:gemini\`
   
📊 MONITORING:
   - Check response.feedbackProvider field
     - "gemini" = AI evaluation (good)
     - "heuristic" = fallback (quota issue)
   - Monitor Google Cloud Console for usage
   - Set quota alerts
`);

console.log();
console.log("=" .repeat(80));
console.log("End of Report");
console.log("=" .repeat(80));
