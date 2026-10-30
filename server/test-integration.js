#!/usr/bin/env node

/**
 * Integration Test Suite for ResumeIQ
 * Tests the complete flow from resume upload to question generation
 */

import fetch from 'node-fetch';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';
import assert from 'assert';

const API_BASE_URL = process.env.API_URL || 'http://localhost:3000/api';
let authToken = '';
let userId = '';
let sessionId = '';

// Test configuration
const config = {
  timeout: 30000,
  pollInterval: 2000,
  maxPolls: 60,
};

// Utility functions
const log = (message, type = 'info') => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${type.toUpperCase()}] ${message}`);
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Test 1: User Registration
 */
async function testUserRegistration() {
  log('TEST 1: User Registration');

  const userData = {
    fullName: `Test User ${Date.now()}`,
    email: `test${Date.now()}@resumeiq.com`,
    password: 'TestPassword123!@#',
  };

  const response = await fetch(`${API_BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(userData),
  });

  assert.strictEqual(response.status, 201, 'Registration failed');

  const data = await response.json();
  assert(data.user._id, 'No user ID returned');
  userId = data.user._id;

  log(`PASS: User registered: ${userId}`, 'success');
  return data;
}

/**
 * Test 2: User Login
 */
async function testUserLogin() {
  log('TEST 2: User Login');

  const loginData = {
    email: `test${userId.substring(0, 8)}@resumeiq.com`,
    password: 'TestPassword123!@#',
  };

  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(loginData),
  });

  assert.strictEqual(response.status, 200, 'Login failed');

  const data = await response.json();
  assert(data.token, 'No auth token returned');
  authToken = data.token;

  log(`PASS: User logged in, token: ${authToken.substring(0, 20)}...`, 'success');
  return data;
}

/**
 * Test 3: Resume Upload
 */
async function testResumeUpload() {
  log('TEST 3: Resume Upload');

  const testResumePath = path.join('/tmp', `test-resume-${Date.now()}.pdf`);
  fs.writeFileSync(testResumePath, Buffer.from('%PDF-1.4\n%Test Resume PDF\n'));

  const formData = new FormData();
  formData.append('resume', fs.createReadStream(testResumePath));

  const response = await fetch(`${API_BASE_URL}/resume/upload`, {
    method: 'POST',
    headers: {
      ...formData.getHeaders(),
      Authorization: `Bearer ${authToken}`,
    },
    body: formData,
  });

  assert.strictEqual(response.status, 202, 'Resume upload failed');

  const data = await response.json();
  assert(data.sessionId, 'No session ID returned');
  sessionId = data.sessionId;

  log(`PASS: Resume uploaded, session: ${sessionId}`, 'success');

  fs.unlinkSync(testResumePath);
  return data;
}

/**
 * Test 4: Poll Processing Status
 */
async function testProcessingStatus() {
  log('TEST 4: Poll Processing Status');

  let attempt = 0;
  let completed = false;
  let response;

  while (attempt < config.maxPolls && !completed) {
    response = await fetch(`${API_BASE_URL}/resume/status/${sessionId}`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });

    assert.strictEqual(response.status, 200, 'Status check failed');

    const data = await response.json();
    const status = data.status;

    log(`  Attempt ${attempt + 1}: ${status}, Questions: ${data.totalQuestions}`, 'info');

    if (status === 'completed') {
      completed = true;
      log(`PASS: Processing completed in ${data.processingTime}ms`, 'success');
      return data;
    } else if (status === 'failed') {
      throw new Error(`Processing failed: ${data.errorMessage}`);
    }

    await sleep(config.pollInterval);
    attempt++;
  }

  if (!completed) {
    throw new Error('Processing timeout');
  }
}

/**
 * Test 5: Retrieve Questions
 */
async function testGetQuestions() {
  log('TEST 5: Retrieve Generated Questions');

  const response = await fetch(
    `${API_BASE_URL}/resume/questions/${sessionId}?page=1&limit=10`,
    {
      headers: { Authorization: `Bearer ${authToken}` },
    }
  );

  assert.strictEqual(response.status, 200, 'Question retrieval failed');

  const data = await response.json();
  assert(Array.isArray(data.questions), 'Questions not an array');
  assert(data.questions.length > 0, 'No questions returned');

  const question = data.questions[0];
  assert(question.sr_no, 'Missing sr_no');
  assert(question.topic, 'Missing topic');
  assert(question.question, 'Missing question text');
  assert(question.difficulty, 'Missing difficulty');

  log(`PASS: Retrieved ${data.questions.length} questions`, 'success');
  return data;
}

/**
 * Test 6: Filter by Difficulty
 */
async function testFilterByDifficulty() {
  log('TEST 6: Filter by Difficulty');

  const response = await fetch(
    `${API_BASE_URL}/resume/questions/${sessionId}?difficulty=Hard`,
    {
      headers: { Authorization: `Bearer ${authToken}` },
    }
  );

  assert.strictEqual(response.status, 200, 'Filter failed');

  const data = await response.json();
  assert(
    data.questions.every((q) => q.difficulty === 'Hard'),
    'Difficulty filter not working'
  );

  log(`PASS: Difficulty filter works, ${data.questions.length} questions`, 'success');
  return data;
}

/**
 * Test 7: Export Questions
 */
async function testExportQuestions() {
  log('TEST 7: Export Questions to JSON');

  const response = await fetch(
    `${API_BASE_URL}/resume/questions/${sessionId}/export`,
    {
      headers: { Authorization: `Bearer ${authToken}` },
    }
  );

  assert.strictEqual(response.status, 200, 'Export failed');

  const data = await response.json();
  assert(data.questions, 'No questions in export');
  assert(data.profile, 'No profile in export');

  log(`PASS: Export successful, ${data.questions.length} questions`, 'success');
  return data;
}

/**
 * Test 8: Session History
 */
async function testSessionHistory() {
  log('TEST 8: Get Session History');

  const response = await fetch(`${API_BASE_URL}/resume/history`, {
    headers: { Authorization: `Bearer ${authToken}` },
  });

  assert.strictEqual(response.status, 200, 'History retrieval failed');

  const data = await response.json();
  assert(Array.isArray(data.sessions), 'Sessions not an array');

  log(`PASS: Retrieved ${data.sessions.length} sessions`, 'success');
  return data;
}

/**
 * Test 9: Performance Test
 */
async function testPerformance() {
  log('TEST 9: Performance Test');

  const startTime = Date.now();

  const response = await fetch(
    `${API_BASE_URL}/resume/questions/${sessionId}?page=1&limit=30`,
    {
      headers: { Authorization: `Bearer ${authToken}` },
    }
  );

  const endTime = Date.now();
  const responseTime = endTime - startTime;

  assert.strictEqual(response.status, 200, 'Request failed');
  assert(responseTime < 1000, `Response too slow: ${responseTime}ms`);

  log(`PASS: Response time: ${responseTime}ms`, 'success');
  return { responseTime };
}

/**
 * Test 10: Error Handling
 */
async function testErrorHandling() {
  log('TEST 10: Error Handling');

  const response = await fetch(
    `${API_BASE_URL}/resume/questions/invalid-id`,
    {
      headers: { Authorization: `Bearer ${authToken}` },
    }
  );

  assert.strictEqual(response.status, 404, 'Should return 404 for invalid session');
  log('PASS: Error handling works correctly', 'success');
}

/**
 * Test 11: Authentication
 */
async function testAuthentication() {
  log('TEST 11: Authentication');

  const response = await fetch(`${API_BASE_URL}/resume/history`);

  assert.strictEqual(response.status, 401, 'Should require authentication');
  log('PASS: Authentication enforcement works', 'success');
}

/**
 * Main Test Runner
 */
async function runTests() {
  log('Starting ResumeIQ Integration Tests', 'info');
  log(`API URL: ${API_BASE_URL}`, 'info');
  console.log('');

  const tests = [
    { name: 'User Registration', fn: testUserRegistration },
    { name: 'User Login', fn: testUserLogin },
    { name: 'Resume Upload', fn: testResumeUpload },
    { name: 'Processing Status', fn: testProcessingStatus },
    { name: 'Get Questions', fn: testGetQuestions },
    { name: 'Filter by Difficulty', fn: testFilterByDifficulty },
    { name: 'Export Questions', fn: testExportQuestions },
    { name: 'Session History', fn: testSessionHistory },
    { name: 'Performance', fn: testPerformance },
    { name: 'Error Handling', fn: testErrorHandling },
    { name: 'Authentication', fn: testAuthentication },
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      await test.fn();
      passed++;
    } catch (error) {
      log(`FAIL: ${test.name} - ${error.message}`, 'error');
      failed++;
    }
    console.log('');
  }

  console.log('');
  log('===== TEST SUMMARY =====', 'info');
  log(`Passed: ${passed}/${tests.length}`, 'success');
  if (failed > 0) {
    log(`Failed: ${failed}/${tests.length}`, 'error');
  }
  log('======================', 'info');

  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch((error) => {
  log(`Fatal error: ${error.message}`, 'error');
  process.exit(1);
});
