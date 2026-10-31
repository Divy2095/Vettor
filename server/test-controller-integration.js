import assert from "node:assert/strict";
import * as resumeController from "./src/controllers/resumeController.js";
import * as questionController from "./src/controllers/questionController.js";
import * as adminController from "./src/controllers/adminController.js";
import { isValidUUID } from "./src/services/db/dbUtils.js";

console.log("============================================================");
console.log("STARTING PHASE 2B CONTROLLER INTEGRATION TESTS");
console.log("============================================================");

let testsPassed = 0;

function createMockRes() {
  const res = {
    statusCode: 200,
    headers: {},
    data: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.data = payload;
      return this;
    },
    setHeader(key, val) {
      this.headers[key] = val;
      return this;
    },
    send(content) {
      this.data = content;
      return this;
    },
  };
  return res;
}

const callHandler = async (handler, req, res) => {
  let errorReceived = null;
  const next = (err) => {
    errorReceived = err;
  };
  try {
    await handler(req, res, next);
  } catch (err) {
    errorReceived = err;
  }
  return errorReceived;
};

// ─────────────────────────────────────────────────────────────────────────────
// 1. Resume Controller Tests
// ─────────────────────────────────────────────────────────────────────────────

// Test: getResumeStatus rejects invalid UUID
try {
  const req = {
    params: { sessionId: "invalid-uuid" },
    user: { id: "11111111-1111-1111-1111-111111111111", token: "mock-token" },
  };
  const res = createMockRes();
  const err = await callHandler(resumeController.getResumeStatus, req, res);
  assert.ok(err, "Expected error to be caught");
  assert.equal(err.statusCode, 400, "Should throw 400 for invalid UUID");
  assert.match(err.message, /Invalid sessionId/);
  console.log("✓ PASS: resumeController: getResumeStatus rejects invalid UUID with 400");
  testsPassed++;
} catch (e) {
  console.error("✗ FAIL: resumeController: getResumeStatus invalid UUID test:", e.message);
  process.exit(1);
}

// Test: getSessionQuestions rejects invalid UUID
try {
  const req = {
    params: { sessionId: "invalid-uuid" },
    query: {},
    user: { id: "11111111-1111-1111-1111-111111111111", token: "mock-token" },
  };
  const res = createMockRes();
  const err = await callHandler(resumeController.getSessionQuestions, req, res);
  assert.ok(err, "Expected error to be caught");
  assert.equal(err.statusCode, 400, "Should throw 400 for invalid UUID");
  console.log("✓ PASS: resumeController: getSessionQuestions rejects invalid UUID with 400");
  testsPassed++;
} catch (e) {
  console.error("✗ FAIL: resumeController: getSessionQuestions invalid UUID test:", e.message);
  process.exit(1);
}

// Test: deleteSession rejects invalid UUID
try {
  const req = {
    params: { sessionId: "not-a-uuid" },
    user: { id: "11111111-1111-1111-1111-111111111111", token: "mock-token" },
  };
  const res = createMockRes();
  const err = await callHandler(resumeController.deleteSession, req, res);
  assert.ok(err, "Expected error to be caught");
  assert.equal(err.statusCode, 400);
  console.log("✓ PASS: resumeController: deleteSession rejects invalid UUID with 400");
  testsPassed++;
} catch (e) {
  console.error("✗ FAIL: resumeController: deleteSession invalid UUID test:", e.message);
  process.exit(1);
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Question Controller Tests
// ─────────────────────────────────────────────────────────────────────────────

// Test: practiceAnswerFeedback validates minimum answer length (10 chars)
try {
  const req = {
    body: {
      questionText: "How would you design a scalable microservices architecture?",
      answerText: "short",
    },
    user: { id: "11111111-1111-1111-1111-111111111111", token: "mock-token" },
  };
  const res = createMockRes();
  const err = await callHandler(questionController.practiceAnswerFeedback, req, res);
  assert.ok(err, "Expected error to be caught");
  assert.equal(err.statusCode, 400);
  assert.match(err.message, /between 10 and 5000 characters/);
  console.log("✓ PASS: questionController: practiceAnswerFeedback rejects answer < 10 chars");
  testsPassed++;
} catch (e) {
  console.error("✗ FAIL: questionController: practiceAnswerFeedback validation:", e.message);
  process.exit(1);
}

// Test: createSubmission validates question length and topic
try {
  const req = {
    body: { question: "too short", topic: "" },
    user: { id: "11111111-1111-1111-1111-111111111111", token: "mock-token" },
  };
  const res = createMockRes();
  const err = await callHandler(questionController.createSubmission, req, res);
  assert.ok(err, "Expected error to be caught");
  assert.equal(err.statusCode, 400);
  console.log("✓ PASS: questionController: createSubmission validates question text and topic");
  testsPassed++;
} catch (e) {
  console.error("✗ FAIL: questionController: createSubmission validation:", e.message);
  process.exit(1);
}

// Test: renameSession validates non-empty display name
try {
  const req = {
    params: { sessionId: "550e8400-e29b-41d4-a716-446655440000" },
    body: { displayName: "   " },
    user: { id: "11111111-1111-1111-1111-111111111111", token: "mock-token" },
  };
  const res = createMockRes();
  const err = await callHandler(questionController.renameSession, req, res);
  assert.ok(err, "Expected error to be caught");
  assert.equal(err.statusCode, 400);
  console.log("✓ PASS: questionController: renameSession validates non-empty displayName");
  testsPassed++;
} catch (e) {
  console.error("✗ FAIL: questionController: renameSession validation:", e.message);
  process.exit(1);
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Admin Controller Tests
// ─────────────────────────────────────────────────────────────────────────────

// Test: approveSubmission rejects missing/invalid submission ID
try {
  const req = {
    params: { id: "invalid-submission-id" },
    body: {},
    user: { id: "00000000-0000-0000-0000-000000000000", role: "admin", token: "admin-token" },
  };
  const res = createMockRes();
  const err = await callHandler(adminController.approveSubmission, req, res);
  assert.ok(err, "Expected error to be caught");
  assert.equal(err.statusCode, 400);
  console.log("✓ PASS: adminController: approveSubmission rejects malformed submission UUID");
  testsPassed++;
} catch (e) {
  console.error("✗ FAIL: adminController: approveSubmission validation:", e.message);
  process.exit(1);
}

// Test: rejectSubmission rejects invalid submission ID
try {
  const req = {
    params: { id: "invalid-uuid" },
    body: { adminNote: "Duplicate question" },
    user: { id: "00000000-0000-0000-0000-000000000000", role: "admin", token: "admin-token" },
  };
  const res = createMockRes();
  const err = await callHandler(adminController.rejectSubmission, req, res);
  assert.ok(err, "Expected error to be caught");
  assert.equal(err.statusCode, 400);
  console.log("✓ PASS: adminController: rejectSubmission rejects malformed submission UUID");
  testsPassed++;
} catch (e) {
  console.error("✗ FAIL: adminController: rejectSubmission validation:", e.message);
  process.exit(1);
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. ML Routes UUID Validation Tests
// ─────────────────────────────────────────────────────────────────────────────
assert.equal(isValidUUID("not-a-uuid"), false);
assert.equal(isValidUUID("550e8400-e29b-41d4-a716-446655440000"), true);
assert.equal(isValidUUID("00000000-0000-0000-0000-000000000000"), true);
console.log("✓ PASS: mlRoutes: isValidUUID handles UUID validation consistently");
testsPassed++;

console.log("============================================================");
console.log(`ALL ${testsPassed}/${testsPassed} CONTROLLER INTEGRATION TESTS PASSED!`);
console.log("============================================================");
