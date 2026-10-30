import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, ".env") });

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
    console.error("❌ GEMINI_API_KEY not found in .env");
    process.exit(1);
}

console.log("🔍 Gemini API Diagnostic Tool\n");

// Test 1: List available models
console.log("=" .repeat(80));
console.log("TEST 1: Checking Available Models (v1beta)");
console.log("=" .repeat(80));

try {
    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_API_KEY}`
    );

    if (!response.ok) {
        const error = await response.text();
        console.log(`❌ Failed to list models (v1beta): ${response.status}`);
        console.log(error.slice(0, 300));
    } else {
        const data = await response.json();
        console.log(`✅ Available models (v1beta):`);
        if (data.models) {
            data.models.forEach((model) => {
                console.log(`   - ${model.name}`);
            });
        } else {
            console.log("No models found in response");
        }
    }
} catch (error) {
    console.log(`❌ Error: ${error.message}`);
}

console.log();

// Test 2: List available models v1
console.log("=" .repeat(80));
console.log("TEST 2: Checking Available Models (v1)");
console.log("=" .repeat(80));

try {
    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1/models?key=${GEMINI_API_KEY}`
    );

    if (!response.ok) {
        const error = await response.text();
        console.log(`❌ Failed to list models (v1): ${response.status}`);
        console.log(error.slice(0, 300));
    } else {
        const data = await response.json();
        console.log(`✅ Available models (v1):`);
        if (data.models) {
            data.models.forEach((model) => {
                console.log(`   - ${model.name}`);
            });
        } else {
            console.log("No models found in response");
        }
    }
} catch (error) {
    console.log(`❌ Error: ${error.message}`);
}

console.log();

// Test 3: Try gemini-pro (older model)
console.log("=" .repeat(80));
console.log("TEST 3: Testing with gemini-pro model (v1beta)");
console.log("=" .repeat(80));

try {
    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [
                    {
                        role: "user",
                        parts: [{ text: "What is 2+2?" }],
                    },
                ],
            }),
        }
    );

    if (!response.ok) {
        const error = await response.text();
        console.log(`❌ Failed: ${response.status}`);
        console.log(error.slice(0, 300));
    } else {
        const data = await response.json();
        console.log(`✅ gemini-pro works!`);
        console.log(`Response: ${data?.candidates?.[0]?.content?.parts?.[0]?.text}`);
    }
} catch (error) {
    console.log(`❌ Error: ${error.message}`);
}

console.log();

// Test 4: Try gemini-2.0-flash
console.log("=" .repeat(80));
console.log("TEST 4: Testing with gemini-2.0-flash model (v1beta)");
console.log("=" .repeat(80));

try {
    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [
                    {
                        role: "user",
                        parts: [{ text: "What is 2+2?" }],
                    },
                ],
            }),
        }
    );

    if (!response.ok) {
        const error = await response.text();
        console.log(`❌ Failed: ${response.status}`);
        console.log(error.slice(0, 300));
    } else {
        const data = await response.json();
        console.log(`✅ gemini-2.0-flash works!`);
        console.log(`Response: ${data?.candidates?.[0]?.content?.parts?.[0]?.text}`);
    }
} catch (error) {
    console.log(`❌ Error: ${error.message}`);
}

console.log();

// Test 5: Check API Key validity
console.log("=" .repeat(80));
console.log("TEST 5: API Key Validity Check");
console.log("=" .repeat(80));

try {
    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1/models?key=${GEMINI_API_KEY}`,
        { method: "HEAD" }
    );

    if (response.ok || response.status === 400) {
        console.log(`✅ API Key appears to be VALID`);
    } else if (response.status === 401 || response.status === 403) {
        console.log(`❌ API Key is INVALID (${response.status})`);
    } else {
        console.log(`⚠️  Unknown status: ${response.status}`);
    }
} catch (error) {
    console.log(`❌ Error: ${error.message}`);
}
