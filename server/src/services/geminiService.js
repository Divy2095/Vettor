import { env } from "../config/env.js";

const clampScore = (value) => {
  const n = Number(value);
  if (Number.isNaN(n)) return 0;
  return Math.min(10, Math.max(0, Math.round(n)));
};

const cleanString = (value, max = 240) => String(value || "").trim().replace(/\s+/g, " ").slice(0, max);

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

  const average = Math.round((rubricScore.clarity + rubricScore.structure + rubricScore.depth + rubricScore.relevance) / 4);

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

export const evaluateAnswerWithGemini = async ({ questionText, answerText }) => {
  if (!env.GEMINI_API_KEY) {
    return null;
  }

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

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(env.GEMINI_MODEL)}:generateContent?key=${env.GEMINI_API_KEY}`;

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
    
    // Provide specific error messages for common issues
    if (response.status === 429) {
      errorMessage = `Gemini quota exceeded. Free tier limit reached or billing issue. Status: 429`;
    } else if (response.status === 401 || response.status === 403) {
      errorMessage = `Gemini API key invalid or unauthorized. Status: ${response.status}`;
    } else if (response.status === 404) {
      errorMessage = `Gemini model "${env.GEMINI_MODEL}" not found. Check model name is current. Status: 404`;
    } else if (response.status >= 500) {
      errorMessage = `Gemini API server error. Status: ${response.status}. Try again later.`;
    }
    
    console.warn(`[Gemini Service] ${errorMessage}`);
    console.warn(`[Gemini Service] Response: ${errorText.slice(0, 300)}`);
    
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
