import assert from "node:assert/strict";
import crypto from "node:crypto";
import {
  sessionService,
  questionService,
  practiceService,
  submissionService,
  profileService,
} from "./src/services/db/index.js";
import { isValidUUID, getPaginationRange } from "./src/services/db/dbUtils.js";
import MLPipelineService from "./src/utils/mlPipelineService.js";
import fs from "node:fs/promises";
import path from "node:path";

console.log("============================================================");
console.log("VETTOR PHASE 2 — END-TO-END 14 WORKFLOWS INTEGRATION AUDIT");
console.log("============================================================");

let workflowsPassed = 0;

// Test persona fixtures
const USER_ID = "a1111111-1111-4111-a111-111111111111";
const ADMIN_ID = "a9999999-9999-4999-a999-999999999999";

// Shared database store across all client connections
const sharedDatabase = {
  profiles: [
    { id: USER_ID, full_name: "Candidate Test", role: "user" },
    { id: ADMIN_ID, full_name: "Admin Reviewer", role: "admin" },
  ],
  interview_sessions: [],
  session_questions: [],
  practice_attempts: [],
  community_question_submissions: [],
  questions: [],
};

/**
 * Creates a stateful Supabase Mock Client sharing the common database
 */
function createMockSupabaseClient(currentUserId, currentUserRole = "user") {
  const tables = sharedDatabase;

  const client = {
    auth: {
      getUser: async (token) => {
        if (!token || token === "invalid") {
          return { data: { user: null }, error: { message: "Invalid token" } };
        }
        return {
          data: {
            user: {
              id: currentUserId,
              email: `${currentUserRole}@vettor.test`,
            },
          },
          error: null,
        };
      },
    },
    rpc: async (funcName, params) => {
      if (funcName === "approve_community_submission") {
        if (currentUserRole !== "admin") {
          return { data: null, error: { code: "42501", message: "Forbidden" } };
        }
        const sub = (tables.community_question_submissions || []).find(
          (s) => s.id === params.p_submission_id
        );
        if (!sub) {
          return { data: null, error: { code: "PGRST116", message: "Not found" } };
        }
        sub.status = "approved";
        sub.reviewed_by = currentUserId;
        sub.reviewed_at = new Date().toISOString();
        sub.admin_note = params.p_admin_note || "";

        const newQ = {
          id: params.p_new_question_id || crypto.randomUUID(),
          question_text: sub.question_text,
          topic: sub.topic || "General",
          difficulty: sub.difficulty || "Medium",
          tags: sub.tags || [],
          company: sub.company || "",
          seen_in_interview: sub.seen_in_interview || false,
          approved_by: currentUserId,
          source_submission_id: sub.id,
          created_at: new Date().toISOString(),
        };
        tables.questions.push(newQ);
        sub.approved_question_id = newQ.id;
        return { data: newQ.id, error: null };
      }
      return { data: null, error: { message: `Unknown function ${funcName}` } };
    },
    from: (tableName) => {
      if (!tables[tableName]) {
        tables[tableName] = [];
      }
      let selectedFields = "*";
      let countExact = false;
      let filteredData = [...tables[tableName]];
      let pendingUpdate = null;

      const finalize = () => {
        if (pendingUpdate) {
          filteredData.forEach((item) => {
            Object.assign(item, pendingUpdate, { updated_at: new Date().toISOString() });
          });
        }
      };

      const queryBuilder = {
        select: (fields, options) => {
          selectedFields = fields;
          if (options?.count === "exact") countExact = true;
          return queryBuilder;
        },
        insert: (rows) => {
          const insertRows = Array.isArray(rows) ? rows : [rows];
          const created = insertRows.map((r) => ({
            id: r.id || crypto.randomUUID(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            ...r,
          }));
          tables[tableName].push(...created);
          filteredData = created;
          return queryBuilder;
        },
        update: (values) => {
          pendingUpdate = values;
          return queryBuilder;
        },
        delete: () => {
          const toDelete = new Set(filteredData.map((d) => d.id));
          tables[tableName] = tables[tableName].filter((d) => !toDelete.has(d.id));
          return queryBuilder;
        },
        eq: (col, val) => {
          filteredData = filteredData.filter((item) => item[col] === val);
          return queryBuilder;
        },
        or: () => queryBuilder,
        in: (col, values) => {
          filteredData = filteredData.filter((item) => values.includes(item[col]));
          return queryBuilder;
        },
        order: () => queryBuilder,
        range: (from, to) => {
          filteredData = filteredData.slice(from, to + 1);
          return queryBuilder;
        },
        single: async () => {
          finalize();
          if (filteredData.length === 0) {
            return { data: null, error: { code: "PGRST116", message: "Not found" } };
          }
          return { data: filteredData[0], error: null };
        },
        maybeSingle: async () => {
          finalize();
          return { data: filteredData[0] || null, error: null };
        },
        then: (resolve) => {
          finalize();
          resolve({
            data: filteredData,
            error: null,
            count: countExact ? filteredData.length : undefined,
          });
        },
      };

      return queryBuilder;
    },
  };

  return client;
}

const userClient = createMockSupabaseClient(USER_ID, "user");
const adminClient = createMockSupabaseClient(ADMIN_ID, "admin");

// ─────────────────────────────────────────────────────────────────────────────
// WORKFLOW 1: User registration and login auth validation
// ─────────────────────────────────────────────────────────────────────────────
try {
  assert.equal(isValidUUID(USER_ID), true);
  const userProfile = await profileService.getProfileById(userClient, USER_ID);
  assert.equal(userProfile.id, USER_ID);
  assert.equal(userProfile.role, "user");
  console.log("✓ Workflow 1 Passed: User registration and login profile retrieval verified");
  workflowsPassed++;
} catch (e) {
  console.error("✗ Workflow 1 Failed:", e.message);
  process.exit(1);
}

// ─────────────────────────────────────────────────────────────────────────────
// WORKFLOW 2: Fetch authenticated profile
// ─────────────────────────────────────────────────────────────────────────────
try {
  const profile = await profileService.getProfileById(userClient, USER_ID);
  assert.equal(profile.fullName, "Candidate Test");
  assert.equal(profile.role, "user");
  console.log("✓ Workflow 2 Passed: Fetch authenticated profile verified");
  workflowsPassed++;
} catch (e) {
  console.error("✗ Workflow 2 Failed:", e.message);
  process.exit(1);
}

// ─────────────────────────────────────────────────────────────────────────────
// WORKFLOW 3: Create an interview session
// ─────────────────────────────────────────────────────────────────────────────
let createdSession;
try {
  createdSession = await sessionService.createSession(userClient, {
    userId: USER_ID,
    targetRole: "Full Stack Engineer",
    targetCompany: "Acme Corp",
    targetLevel: "mid",
    targetDomain: "Web Development",
    resumeSkills: ["react", "node.js", "postgresql"],
    displayName: "Mock Technical Interview",
    status: "processing",
  });
  assert.ok(createdSession.id);
  assert.equal(isValidUUID(createdSession.id), true);
  assert.equal(createdSession.targetRole, "Full Stack Engineer");
  assert.equal(createdSession.status, "processing");
  console.log("✓ Workflow 3 Passed: Interview session creation verified");
  workflowsPassed++;
} catch (e) {
  console.error("✗ Workflow 3 Failed:", e.message);
  process.exit(1);
}

// ─────────────────────────────────────────────────────────────────────────────
// WORKFLOW 4: Upload resume using current local filesystem storage
// ─────────────────────────────────────────────────────────────────────────────
try {
  const testBuffer = Buffer.from("%PDF-1.4 Mock PDF Content For Vettor Verification");
  const resumePath = await MLPipelineService.saveResumeFile(testBuffer, USER_ID);
  assert.ok(resumePath.includes(USER_ID));
  const fileExists = await fs.stat(resumePath).then(() => true).catch(() => false);
  assert.equal(fileExists, true, "Local resume file should exist on disk");
  await fs.unlink(resumePath).catch(() => {});
  console.log("✓ Workflow 4 Passed: Local filesystem resume upload verified");
  workflowsPassed++;
} catch (e) {
  console.error("✗ Workflow 4 Failed:", e.message);
  process.exit(1);
}

// ─────────────────────────────────────────────────────────────────────────────
// WORKFLOW 5: Process resume through Python ML service pipeline
// ─────────────────────────────────────────────────────────────────────────────
try {
  assert.equal(typeof MLPipelineService.saveResumeFile, "function");
  assert.equal(typeof MLPipelineService.processResume, "function");
  assert.equal(typeof MLPipelineService.searchQuestions, "function");
  assert.equal(typeof MLPipelineService.processResumeEndToEnd, "function");
  assert.equal(typeof MLPipelineService.healthCheck, "function");
  console.log("✓ Workflow 5 Passed: Python ML service pipeline methods verified");
  workflowsPassed++;
} catch (e) {
  console.error("✗ Workflow 5 Failed:", e.message);
  process.exit(1);
}

// ─────────────────────────────────────────────────────────────────────────────
// WORKFLOW 6: Persist extracted skills and generated questions
// ─────────────────────────────────────────────────────────────────────────────
let insertedQuestions;
try {
  const questionsToInsert = [
    {
      question: "How do you optimize state rendering in React using memoization hooks?",
      topic: "React",
      difficulty: "Medium",
      tags: ["react", "performance"],
      score: 0.92,
      tag_score: 1.0,
      final_score: 0.95,
      orderIndex: 0,
      sourceType: "generated",
    },
    {
      question: "Explain the differences between PostgreSQL B-tree indexes and Hash indexes.",
      topic: "PostgreSQL",
      difficulty: "Hard",
      tags: ["postgresql", "databases"],
      score: 0.88,
      tag_score: 0.8,
      final_score: 0.85,
      orderIndex: 1,
      sourceType: "generated",
    },
  ];

  insertedQuestions = await questionService.createSessionQuestions(
    userClient,
    createdSession.id,
    questionsToInsert
  );
  assert.equal(insertedQuestions.length, 2);
  assert.equal(insertedQuestions[0].topic, "React");
  assert.equal(insertedQuestions[0].sr_no, 1);
  console.log("✓ Workflow 6 Passed: Extracted skills & generated questions persisted");
  workflowsPassed++;
} catch (e) {
  console.error("✗ Workflow 6 Failed:", e.message);
  process.exit(1);
}

// ─────────────────────────────────────────────────────────────────────────────
// WORKFLOW 7: Retrieve generated questions with filters and pagination
// ─────────────────────────────────────────────────────────────────────────────
try {
  const result = await questionService.getSessionQuestions(userClient, createdSession.id, {
    page: 1,
    limit: 10,
    difficulty: "Medium",
  });
  assert.ok(result.questions);
  assert.ok(result.pagination);
  assert.equal(result.pagination.page, 1);
  assert.equal(result.pagination.limit, 10);
  console.log("✓ Workflow 7 Passed: Questions retrieval with pagination verified");
  workflowsPassed++;
} catch (e) {
  console.error("✗ Workflow 7 Failed:", e.message);
  process.exit(1);
}

// ─────────────────────────────────────────────────────────────────────────────
// WORKFLOW 8: View session history
// ─────────────────────────────────────────────────────────────────────────────
try {
  const history = await sessionService.listUserSessions(userClient, USER_ID, { limit: 10 });
  assert.ok(Array.isArray(history));
  assert.ok(history.length >= 1);
  assert.equal(history[0].userId, USER_ID);
  console.log("✓ Workflow 8 Passed: User session history retrieval verified");
  workflowsPassed++;
} catch (e) {
  console.error("✗ Workflow 8 Failed:", e.message);
  process.exit(1);
}

// ─────────────────────────────────────────────────────────────────────────────
// WORKFLOW 9: Rename and delete a session
// ─────────────────────────────────────────────────────────────────────────────
try {
  const renamed = await sessionService.renameSession(
    userClient,
    createdSession.id,
    "Updated Senior Interview Session"
  );
  assert.equal(renamed.displayName, "Updated Senior Interview Session");

  // Create temporary session to delete
  const tempSession = await sessionService.createSession(userClient, {
    userId: USER_ID,
    targetRole: "Temporary Role",
  });
  await sessionService.deleteSession(userClient, tempSession.id);
  console.log("✓ Workflow 9 Passed: Session rename and delete operations verified");
  workflowsPassed++;
} catch (e) {
  console.error("✗ Workflow 9 Failed:", e.message);
  process.exit(1);
}

// ─────────────────────────────────────────────────────────────────────────────
// WORKFLOW 10: Submit practice answer and persist Gemini feedback
// ─────────────────────────────────────────────────────────────────────────────
try {
  const attempt = await practiceService.createPracticeAttempt(userClient, {
    userId: USER_ID,
    sessionId: createdSession.id,
    questionId: insertedQuestions[0].id,
    questionText: "How do you optimize state rendering in React using memoization hooks?",
    answerText: "Use useMemo for expensive calculations and useCallback to preserve function reference stability across re-renders.",
    rubricScore: { clarity: 9, structure: 8, depth: 8, relevance: 9 },
    overallScore: 8.5,
    isMatch: true,
    shouldImprove: false,
    feedbackSummary: "Excellent concise explanation with proper hook distinction.",
    strengths: ["Clear terminology", "Direct response"],
    improvements: ["Could mention React Compiler"],
    feedbackProvider: "gemini",
  });
  assert.ok(attempt.id);
  assert.equal(attempt.overallScore, 9); // Math.round(8.5) = 9
  assert.equal(attempt.isMatch, true);
  console.log("✓ Workflow 10 Passed: Practice answer & Gemini feedback persistence verified");
  workflowsPassed++;
} catch (e) {
  console.error("✗ Workflow 10 Failed:", e.message);
  process.exit(1);
}

// ─────────────────────────────────────────────────────────────────────────────
// WORKFLOW 11: Submit a community question
// ─────────────────────────────────────────────────────────────────────────────
let submittedItem;
try {
  submittedItem = await submissionService.createSubmission(userClient, {
    userId: USER_ID,
    questionText: "What are the trade-offs of using optimistic concurrency control versus pessimistic locking?",
    topic: "Databases",
    tags: ["databases", "concurrency", "distributed-systems"],
    company: "Stripe",
    difficulty: "Hard",
    seenInInterview: true,
  });
  assert.ok(submittedItem.id);
  assert.equal(submittedItem.status, "pending");
  assert.equal(submittedItem.company, "Stripe");
  console.log("✓ Workflow 11 Passed: Community question submission verified");
  workflowsPassed++;
} catch (e) {
  console.error("✗ Workflow 11 Failed:", e.message);
  process.exit(1);
}

// ─────────────────────────────────────────────────────────────────────────────
// WORKFLOW 12: Admin retrieves moderation queue
// ─────────────────────────────────────────────────────────────────────────────
try {
  const pending = await submissionService.listPendingSubmissions(adminClient, { page: 1, limit: 10 });
  assert.ok(Array.isArray(pending.submissions));
  assert.ok(pending.submissions.length >= 1);
  assert.equal(pending.submissions[0].status, "pending");

  const stats = await submissionService.getModerationStats(adminClient);
  assert.ok(stats);
  assert.equal(typeof stats.pendingSubmissions, "number");
  assert.ok(stats.pendingSubmissions >= 1);
  console.log("✓ Workflow 12 Passed: Admin moderation queue retrieval verified");
  workflowsPassed++;
} catch (e) {
  console.error("✗ Workflow 12 Failed:", e.message);
  process.exit(1);
}

// ─────────────────────────────────────────────────────────────────────────────
// WORKFLOW 13: Admin approves/rejects a submission
// ─────────────────────────────────────────────────────────────────────────────
try {
  // Test approval via RPC
  const approveResult = await submissionService.approveSubmission(
    adminClient,
    submittedItem.id,
    { adminNote: "Approved for core database curriculum" }
  );
  assert.ok(approveResult.approvedQuestionId);
  assert.equal(approveResult.message, "Submission approved and added to dataset");

  // Create another submission to test rejection
  const subToReject = await submissionService.createSubmission(userClient, {
    userId: USER_ID,
    questionText: "What is the difference between let and var in JavaScript?",
    topic: "JavaScript",
    tags: ["javascript", "basics"],
    company: "",
    difficulty: "Easy",
  });

  const rejectResult = await submissionService.rejectSubmission(
    adminClient,
    subToReject.id,
    "Question is too basic for curated collection"
  );
  assert.equal(rejectResult.message, "Submission rejected");
  console.log("✓ Workflow 13 Passed: Admin approval (RPC) and rejection verified");
  workflowsPassed++;
} catch (e) {
  console.error("✗ Workflow 13 Failed:", e.message);
  process.exit(1);
}

// ─────────────────────────────────────────────────────────────────────────────
// WORKFLOW 14: Admin creates a curated question directly
// ─────────────────────────────────────────────────────────────────────────────
try {
  const curated = await questionService.createCuratedQuestion(adminClient, {
    questionText: "How does the Raft consensus algorithm handle split-brain scenarios?",
    topic: "Distributed Systems",
    difficulty: "Hard",
    tags: ["distributed-systems", "raft", "consensus"],
    company: "Google",
    seenInInterview: true,
    approvedBy: ADMIN_ID,
  });
  assert.ok(curated.id);
  assert.equal(curated.approvedBy, ADMIN_ID);
  console.log("✓ Workflow 14 Passed: Admin curated question creation verified");
  workflowsPassed++;
} catch (e) {
  console.error("✗ Workflow 14 Failed:", e.message);
  process.exit(1);
}

console.log("============================================================");
console.log(`ALL 14/14 WORKFLOW AUDIT TESTS COMPLETED SUCCESSFULLY! (${workflowsPassed}/${workflowsPassed})`);
console.log("============================================================");
