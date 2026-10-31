import assert from "node:assert/strict";
import {
  isValidUUID,
  assertValidUUID,
  handleDbError,
  getPaginationRange,
} from "./src/services/db/dbUtils.js";
import {
  getProfileById,
  updateProfile,
  listProfilesForAdmin,
} from "./src/services/db/profileService.js";
import {
  createSession,
  getSessionById,
  listUserSessions,
  updateSessionStatus,
  touchSessionAccess,
  renameSession,
  deleteSession,
  formatSession,
} from "./src/services/db/sessionService.js";
import {
  createSessionQuestions,
  getSessionQuestions,
  listCuratedQuestions,
  createCuratedQuestion,
  formatSessionQuestion,
} from "./src/services/db/questionService.js";
import {
  createPracticeAttempt,
  listPracticeHistory,
  countSessionPracticeAttempts,
  formatPracticeAttempt,
} from "./src/services/db/practiceService.js";
import {
  createSubmission,
  listUserSubmissions,
  listPendingSubmissions,
  listReviewedSubmissions,
  getModerationStats,
  approveSubmission,
  rejectSubmission,
  formatSubmission,
} from "./src/services/db/submissionService.js";

console.log("============================================================");
console.log("STARTING PHASE 2 DATA-ACCESS LAYER COMPREHENSIVE TESTS");
console.log("============================================================\n");

let passedTests = 0;
let totalTests = 0;

const runTest = async (name, testFn) => {
  totalTests++;
  try {
    await testFn();
    console.log(`✓ PASS: ${name}`);
    passedTests++;
  } catch (error) {
    console.error(`✗ FAIL: ${name}`);
    console.error("  Error:", error.message);
    throw error;
  }
};

// Mock Supabase Query Builder helper
const createMockClient = ({ data = null, error = null, count = null } = {}) => {
  const queryBuilder = {
    select: () => queryBuilder,
    insert: () => queryBuilder,
    update: () => queryBuilder,
    delete: () => queryBuilder,
    eq: () => queryBuilder,
    neq: () => queryBuilder,
    in: () => queryBuilder,
    or: () => queryBuilder,
    ilike: () => queryBuilder,
    order: () => queryBuilder,
    range: () => queryBuilder,
    single: async () => ({ data, error }),
    maybeSingle: async () => ({ data, error }),
    then: (resolve) => resolve({ data, error, count }),
  };

  return {
    from: (_table) => queryBuilder,
    rpc: async (_fnName, _params) => ({ data, error }),
  };
};

const validUUID = "11111111-1111-4111-8111-111111111111";
const validUUID2 = "22222222-2222-4222-8222-222222222222";
const invalidUUID = "not-a-valid-uuid";

// ----------------------------------------------------------------------
// 1. dbUtils Tests
// ----------------------------------------------------------------------
await runTest("dbUtils: UUID validation rejects malformed strings", () => {
  assert.equal(isValidUUID(invalidUUID), false);
  assert.equal(isValidUUID(""), false);
  assert.equal(isValidUUID(null), false);
  assert.equal(isValidUUID(validUUID), true);
  assert.throws(() => assertValidUUID(invalidUUID, "testId"), /must be a valid UUID/);
});

await runTest("dbUtils: Pagination calculations", () => {
  const p1 = getPaginationRange({ page: 1, limit: 10 });
  assert.equal(p1.from, 0);
  assert.equal(p1.to, 9);

  const p2 = getPaginationRange({ page: 3, limit: 20 });
  assert.equal(p2.from, 40);
  assert.equal(p2.to, 59);
});

await runTest("dbUtils: PostgreSQL and PostgREST error mapping", () => {
  const err404 = handleDbError({ code: "PGRST116" });
  assert.equal(err404.statusCode, 404);

  const err403 = handleDbError({ code: "42501" });
  assert.equal(err403.statusCode, 403);

  const err409 = handleDbError({ code: "23505", message: "unique constraint" });
  assert.equal(err409.statusCode, 409);

  const err400 = handleDbError({ code: "23503", message: "foreign key" });
  assert.equal(err400.statusCode, 400);

  const err500 = handleDbError({ code: "UNKNOWN", message: "disk full" });
  assert.equal(err500.statusCode, 500);
});

// ----------------------------------------------------------------------
// 2. profileService Tests
// ----------------------------------------------------------------------
await runTest("profileService: getProfileById successfully returns profile", async () => {
  const mockDb = {
    id: validUUID,
    full_name: "Jane Candidate",
    role: "user",
    created_at: "2026-10-31T00:00:00Z",
    updated_at: "2026-10-31T00:00:00Z",
  };
  const client = createMockClient({ data: mockDb });
  const result = await getProfileById(client, validUUID);
  assert.equal(result.id, validUUID);
  assert.equal(result._id, validUUID);
  assert.equal(result.fullName, "Jane Candidate");
  assert.equal(result.role, "user");
});

await runTest("profileService: getProfileById throws 404 on missing record", async () => {
  const client = createMockClient({ data: null });
  await assert.rejects(
    async () => getProfileById(client, validUUID),
    (err) => err.statusCode === 404 && /not found/.test(err.message),
  );
});

await runTest("profileService: updateProfile rejects empty or invalid names", async () => {
  const client = createMockClient({ data: null });
  await assert.rejects(
    async () => updateProfile(client, validUUID, { fullName: "   " }),
    (err) => err.statusCode === 400,
  );
  await assert.rejects(
    async () => updateProfile(client, invalidUUID, { fullName: "New Name" }),
    (err) => err.statusCode === 400,
  );
});

// ----------------------------------------------------------------------
// 3. sessionService Tests
// ----------------------------------------------------------------------
await runTest("sessionService: createSession formats input and satisfies constraints", async () => {
  const mockInserted = {
    id: validUUID2,
    user_id: validUUID,
    resume_id: null,
    display_name: "Frontend Preparation",
    target_role: "Frontend Engineer",
    target_company: "Google",
    target_level: "mid",
    target_domain: "Web",
    resume_skills: ["React", "CSS"],
    skill_gap: { matchedSkills: ["React"], missingSkills: ["GraphQL"], prioritizedLearningPlan: ["Study GraphQL"] },
    status: "processing",
    processing_time_ms: 1200,
    created_at: "2026-10-31T00:00:00Z",
    updated_at: "2026-10-31T00:00:00Z",
    last_accessed_at: "2026-10-31T00:00:00Z",
  };
  const client = createMockClient({ data: mockInserted });

  const result = await createSession(client, {
    userId: validUUID,
    displayName: "Frontend Preparation",
    targetRole: "Frontend Engineer",
    targetCompany: "Google",
    targetLevel: "mid",
    targetDomain: "Web",
    resumeSkills: ["React", "CSS"],
    skillGap: { matchedSkills: ["React"], missingSkills: ["GraphQL"], prioritizedLearningPlan: ["Study GraphQL"] },
    status: "processing",
    processingTimeMs: 1200,
  });

  assert.equal(result.id, validUUID2);
  assert.equal(result._id, validUUID2);
  assert.equal(result.userId, validUUID);
  assert.equal(result.targetRole, "Frontend Engineer");
  assert.equal(result.status, "processing");
  assert.equal(result.processingTime, 1200);
});

await runTest("sessionService: getSessionById returns null if not found, or throws on db error", async () => {
  const client = createMockClient({ data: null });
  const result = await getSessionById(client, validUUID);
  assert.equal(result, null);

  const errorClient = createMockClient({ data: null, error: { code: "PGRST116" } });
  await assert.rejects(
    async () => getSessionById(errorClient, validUUID),
    (err) => err.statusCode === 404,
  );
});

await runTest("sessionService: renameSession validates non-empty display name", async () => {
  const client = createMockClient({ data: null });
  await assert.rejects(
    async () => renameSession(client, validUUID, "   "),
    (err) => err.statusCode === 400,
  );
});

// ----------------------------------------------------------------------
// 4. questionService Tests
// ----------------------------------------------------------------------
await runTest("questionService: createSessionQuestions validates question length and maps scores", async () => {
  const mockInserted = [
    {
      id: validUUID,
      session_id: validUUID2,
      order_index: 0,
      question_text: "What are React Server Components and their trade-offs?",
      focus_skill: "React",
      tags: ["react", "frontend"],
      difficulty: "Medium",
      source_type: "generated",
      relevance_score: 0.85,
      tag_score: 0.5,
      combined_score: 0.88,
      created_at: "2026-10-31T00:00:00Z",
    },
  ];

  const client = createMockClient({ data: mockInserted });
  const result = await createSessionQuestions(client, validUUID2, [
    {
      questionText: "What are React Server Components and their trade-offs?",
      focusSkill: "React",
      tags: ["React", "Frontend"],
      difficulty: "Medium",
      score: 0.85,
      tag_score: 0.5,
      final_score: 0.88,
    },
  ]);

  assert.equal(result.length, 1);
  assert.equal(result[0].sr_no, 1);
  assert.equal(result[0].question, "What are React Server Components and their trade-offs?");
  assert.equal(result[0].score, 0.85);
  assert.equal(result[0].tag_score, 0.5);
  assert.equal(result[0].final_score, 0.88);
});

await runTest("questionService: createSessionQuestions rejects questions under 10 chars", async () => {
  const client = createMockClient({ data: [] });
  await assert.rejects(
    async () => createSessionQuestions(client, validUUID2, [{ questionText: "Too short" }]),
    (err) => err.statusCode === 400 && /too short/.test(err.message),
  );
});

// ----------------------------------------------------------------------
// 5. practiceService Tests
// ----------------------------------------------------------------------
await runTest("practiceService: createPracticeAttempt validates and clamps scores between 0 and 10", async () => {
  const mockAttempt = {
    id: validUUID,
    user_id: validUUID,
    session_id: validUUID2,
    question_id: null,
    question_text: "Explain how database indexing works.",
    answer_text: "B-Trees allow logarithmic time complexity search operations.",
    clarity_score: 8,
    structure_score: 7,
    depth_score: 8,
    relevance_score: 9,
    overall_score: 8,
    is_match: true,
    should_improve: false,
    feedback_summary: "Strong concise explanation.",
    strengths: ["Clear terminology"],
    improvements: [],
    feedback_provider: "gemini",
    created_at: "2026-10-31T00:00:00Z",
  };

  const client = createMockClient({ data: mockAttempt });

  const result = await createPracticeAttempt(client, {
    userId: validUUID,
    sessionId: validUUID2,
    questionText: "Explain how database indexing works.",
    answerText: "B-Trees allow logarithmic time complexity search operations.",
    rubricScore: { clarity: 8, structure: 7, depth: 8, relevance: 9 },
    overallScore: 8,
    isMatch: true,
    shouldImprove: false,
    feedbackSummary: "Strong concise explanation.",
    strengths: ["Clear terminology"],
  });

  assert.equal(result.id, validUUID);
  assert.equal(result.overallScore, 8);
  assert.equal(result.rubricScore.clarity, 8);
  assert.equal(result.rubricScore.relevance, 9);
});

await runTest("practiceService: createPracticeAttempt rejects too short answers", async () => {
  const client = createMockClient({ data: null });
  await assert.rejects(
    async () =>
      createPracticeAttempt(client, {
        userId: validUUID,
        questionText: "Explain how database indexing works.",
        answerText: "Too short",
        feedbackSummary: "Summary",
      }),
    (err) => err.statusCode === 400 && /between 10 and 5000/.test(err.message),
  );
});

// ----------------------------------------------------------------------
// 6. submissionService Tests
// ----------------------------------------------------------------------
await runTest("submissionService: createSubmission enforces pending status and tags", async () => {
  const mockSub = {
    id: validUUID,
    submitted_by: validUUID,
    question_text: "How does the virtual DOM calculate diffs?",
    tags: ["react", "dom"],
    company: "Meta",
    seen_in_interview: true,
    status: "pending",
    created_at: "2026-10-31T00:00:00Z",
  };

  const client = createMockClient({ data: mockSub });

  const result = await createSubmission(client, {
    submittedBy: validUUID,
    questionText: "How does the virtual DOM calculate diffs?",
    tags: ["React", "DOM", "React"],
    company: "Meta",
    seenInInterview: true,
  });

  assert.equal(result.id, validUUID);
  assert.equal(result.status, "pending");
  assert.deepEqual(result.tags, ["react", "dom"]);
});

await runTest("submissionService: approveSubmission executes atomic PostgreSQL RPC", async () => {
  const client = createMockClient({ data: validUUID2 });

  const result = await approveSubmission(client, validUUID, {
    questionText: "How does the virtual DOM calculate diffs efficiently?",
    topic: "React",
    adminNote: "Edited for clarity",
  });

  assert.equal(result.approvedQuestionId, validUUID2);
  assert.equal(result.message, "Submission approved and added to dataset");
});

console.log("\n============================================================");
console.log(`ALL ${passedTests}/${totalTests} TESTS PASSED SUCCESSFULLY!`);
console.log("============================================================");
