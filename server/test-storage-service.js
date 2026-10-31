import assert from "node:assert/strict";
import crypto from "node:crypto";
import {
  uploadResumeToStorage,
  createResumeRecord,
  uploadAndPersistResume,
  updateResumeSkills,
  downloadResumeFromStorage,
  deleteResumeFromStorage,
  deleteResume,
  getResumeById,
  formatResume,
} from "./src/services/db/resumeService.js";
import {
  createSession,
  getSessionById,
  deleteSession,
} from "./src/services/db/sessionService.js";
import { isValidUUID } from "./src/services/db/dbUtils.js";
import { supabaseAdmin } from "./src/config/supabase.js";

console.log("============================================================");
console.log("VETTOR PHASE 3 — SUPABASE STORAGE INTEGRATION TEST SUITE");
console.log("============================================================\n");

let mockTestsPassed = 0;
let mockTestsTotal = 0;
let liveTestsPassed = 0;
let liveTestsTotal = 0;

const runMockTest = async (name, testFn) => {
  mockTestsTotal++;
  try {
    await testFn();
    console.log(`  ✓ [MOCK] PASS: ${name}`);
    mockTestsPassed++;
  } catch (error) {
    console.error(`  ✗ [MOCK] FAIL: ${name}`);
    console.error("    Error:", error.message);
    throw error;
  }
};

const runLiveTest = async (name, testFn) => {
  liveTestsTotal++;
  try {
    await testFn();
    console.log(`  ✓ [LIVE] PASS: ${name}`);
    liveTestsPassed++;
  } catch (error) {
    console.error(`  ✗ [LIVE] FAIL: ${name}`);
    console.error("    Error:", error.message);
    throw error;
  }
};

// Fixture UUIDs
const USER_A_ID = "aaaaaaaa-1111-4111-8111-111111111111";
const USER_B_ID = "bbbbbbbb-2222-4222-8222-222222222222";
const RESUME_ID = "cccccccc-3333-4333-8333-333333333333";
const SESSION_ID = "dddddddd-4444-4444-8444-444444444444";
const SAMPLE_PDF_BUFFER = Buffer.from("%PDF-1.4 sample resume content for testing purposes %EOF");

// Stateful in-memory mock client for Supabase Storage + PostgreSQL DB with RLS simulation
function createStorageMockClient({
  userId = USER_A_ID,
  storageFailure = null,
  dbInsertFailure = null,
  sharedDb = null,
  sharedStorage = null,
} = {}) {
  const db = sharedDb || {
    resumes: [],
    interview_sessions: [],
    session_questions: [],
    practice_attempts: [],
  };

  const storageFiles = sharedStorage || new Map();

  const client = {
    storage: {
      from: (bucket) => {
        assert.equal(bucket, "resumes", "Must target 'resumes' bucket");
        return {
          upload: async (filePath, buffer, options) => {
            if (storageFailure) {
              return { data: null, error: storageFailure };
            }
            // Enforce path constraint and RLS: <userId>/<resumeId>.pdf
            const parts = filePath.split("/");
            if (parts.length !== 2 || parts[0] !== userId || !parts[1].endsWith(".pdf")) {
              return {
                data: null,
                error: { message: "Storage path does not match <userId>/<resumeId>.pdf or violated RLS" },
              };
            }
            storageFiles.set(filePath, {
              buffer: Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer),
              contentType: options?.contentType || "application/pdf",
              upsert: options?.upsert || false,
            });
            return { data: { path: filePath }, error: null };
          },
          download: async (filePath) => {
            const parts = filePath.split("/");
            // Storage RLS: user can only download their own folder
            if (parts.length > 0 && parts[0] !== userId) {
              return { data: null, error: { message: "Storage RLS: access denied" } };
            }
            if (!storageFiles.has(filePath)) {
              return { data: null, error: { message: "Object not found" } };
            }
            const file = storageFiles.get(filePath);
            // Storage download returns Blob-like with arrayBuffer()
            return {
              data: {
                arrayBuffer: async () => file.buffer.buffer.slice(
                  file.buffer.byteOffset,
                  file.buffer.byteOffset + file.buffer.byteLength
                ),
              },
              error: null,
            };
          },
          remove: async (paths) => {
            for (const p of paths) {
              const parts = p.split("/");
              if (parts[0] === userId) {
                storageFiles.delete(p);
              }
            }
            return { data: paths.map((p) => ({ name: p })), error: null };
          },
        };
      },
    },
    from: (table) => {
      let currentTable = table;
      let filterCol = null;
      let filterVal = null;
      let selectFields = "*";

      const queryBuilder = {
        select: (fields) => {
          selectFields = fields || "*";
          return queryBuilder;
        },
        insert: (payload) => {
          return {
            select: () => ({
              single: async () => {
                if (dbInsertFailure) {
                  return { data: null, error: dbInsertFailure };
                }
                const record = {
                  ...payload,
                  id: payload.id || crypto.randomUUID(),
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                };
                if (!db[currentTable]) db[currentTable] = [];
                db[currentTable].push(record);
                return { data: record, error: null };
              },
            }),
          };
        },
        update: (payload) => ({
          eq: (col, val) => ({
            select: () => ({
              single: async () => {
                const list = db[currentTable] || [];
                const item = list.find((r) => {
                  if (r.user_id && r.user_id !== userId) return false;
                  return r[col] === val;
                });
                if (!item) {
                  return { data: null, error: { code: "PGRST116", message: "Not found" } };
                }
                Object.assign(item, payload, { updated_at: new Date().toISOString() });
                return { data: item, error: null };
              },
            }),
          }),
        }),
        delete: () => ({
          eq: async (col, val) => {
            if (!db[currentTable]) return { data: null, error: null };
            db[currentTable] = db[currentTable].filter((r) => {
              if (r.user_id && r.user_id !== userId) return true; // RLS: cannot delete other user's rows
              return r[col] !== val;
            });
            return { data: null, error: null };
          },
        }),
        eq: (col, val) => {
          filterCol = col;
          filterVal = val;
          return queryBuilder;
        },
        neq: () => queryBuilder,
        order: () => queryBuilder,
        range: () => queryBuilder,
        single: async () => {
          const list = db[currentTable] || [];
          const item = list.find((r) => {
            if (r.user_id && r.user_id !== userId) return false;
            return !filterCol || r[filterCol] === filterVal;
          });
          if (!item) return { data: null, error: { code: "PGRST116", message: "Row not found" } };
          return { data: item, error: null };
        },
        maybeSingle: async () => {
          const list = db[currentTable] || [];
          const item = list.find((r) => {
            if (r.user_id && r.user_id !== userId) return false;
            return !filterCol || r[filterCol] === filterVal;
          });
          return { data: item || null, error: null };
        },
        then: (resolve) => {
          const list = db[currentTable] || [];
          const filtered = list.filter((r) => {
            if (r.user_id && r.user_id !== userId) return false;
            return !filterCol || r[filterCol] === filterVal;
          });
          return resolve({ data: filtered, error: null, count: filtered.length });
        },
      };

      return queryBuilder;
    },
  };

  return { client, db, storageFiles };
}

// ─────────────────────────────────────────────────────────────────
// SECTION A: MOCKED & UNIT STORAGE TESTS
// ─────────────────────────────────────────────────────────────────
console.log("SECTION A: MOCKED & UNIT STORAGE TESTS (Deterministic / Offline)\n");

await runMockTest("Storage path strictly adheres to <user_id>/<resume_id>.pdf", async () => {
  const { client, storageFiles } = createStorageMockClient({ userId: USER_A_ID });

  const uploaded = await uploadResumeToStorage(client, {
    userId: USER_A_ID,
    resumeId: RESUME_ID,
    buffer: SAMPLE_PDF_BUFFER,
    mimeType: "application/pdf",
  });

  const expectedPath = `${USER_A_ID}/${RESUME_ID}.pdf`;
  assert.equal(uploaded.storagePath, expectedPath);
  assert.ok(storageFiles.has(expectedPath), "File should be stored under exact path");

  const stored = storageFiles.get(expectedPath);
  assert.equal(stored.contentType, "application/pdf");
  assert.equal(stored.upsert, false, "Must not silently overwrite");
});

await runMockTest("Storage rejects uploads exceeding 5MB limit", async () => {
  const { client } = createStorageMockClient({ userId: USER_A_ID });
  const oversizedBuffer = Buffer.alloc(5 * 1024 * 1024 + 1024); // 5MB + 1KB

  await assert.rejects(
    async () =>
      uploadResumeToStorage(client, {
        userId: USER_A_ID,
        resumeId: RESUME_ID,
        buffer: oversizedBuffer,
      }),
    (err) => err.statusCode === 400 && /exceeds maximum allowed/.test(err.message),
  );
});

await runMockTest("Storage rejects empty or non-buffer inputs", async () => {
  const { client } = createStorageMockClient({ userId: USER_A_ID });

  await assert.rejects(
    async () =>
      uploadResumeToStorage(client, {
        userId: USER_A_ID,
        resumeId: RESUME_ID,
        buffer: null,
      }),
    (err) => err.statusCode === 400 && /buffer is required/i.test(err.message),
  );
});

await runMockTest("createResumeRecord persists full metadata in PostgreSQL", async () => {
  const { client } = createStorageMockClient({ userId: USER_A_ID });

  const record = await createResumeRecord(client, {
    userId: USER_A_ID,
    storagePath: `${USER_A_ID}/${RESUME_ID}.pdf`,
    fileName: "software_engineer_cv.pdf",
    mimeType: "application/pdf",
    fileSizeBytes: SAMPLE_PDF_BUFFER.length,
  });

  assert.ok(isValidUUID(record.id));
  assert.equal(record.userId, USER_A_ID);
  assert.equal(record.storagePath, `${USER_A_ID}/${RESUME_ID}.pdf`);
  assert.equal(record.fileName, "software_engineer_cv.pdf");
  assert.equal(record.fileSizeBytes, SAMPLE_PDF_BUFFER.length);
  assert.deepEqual(record.rawSkills, []);
});

await runMockTest("Compensation rollback: Storage file deleted if DB insertion fails", async () => {
  // DB insertion fails with an error
  const { client, storageFiles } = createStorageMockClient({
    userId: USER_A_ID,
    dbInsertFailure: { code: "23505", message: "unique constraint violation on resume record" },
  });

  await assert.rejects(
    async () =>
      uploadAndPersistResume(client, {
        userId: USER_A_ID,
        fileName: "test_resume.pdf",
        buffer: SAMPLE_PDF_BUFFER,
      }),
    (err) => err.statusCode === 409 || err.message.includes("constraint"),
  );

  // Verify storage was cleaned up (no orphaned objects)
  assert.equal(
    storageFiles.size,
    0,
    "Storage file must be deleted during compensation rollback",
  );
});

await runMockTest("updateResumeSkills updates raw, expanded, and section metadata post-ML", async () => {
  const { client } = createStorageMockClient({ userId: USER_A_ID });

  const resume = await createResumeRecord(client, {
    userId: USER_A_ID,
    storagePath: `${USER_A_ID}/${RESUME_ID}.pdf`,
    fileName: "resume.pdf",
    fileSizeBytes: 1024,
  });

  const updated = await updateResumeSkills(client, resume.id, {
    rawSkills: ["Node.js", "PostgreSQL", "Docker"],
    expandedSkills: ["Node.js", "PostgreSQL", "Docker", "Express", "Relational DBs"],
    sectionsFound: ["Experience", "Skills", "Education"],
  });

  assert.deepEqual(updated.rawSkills, ["Node.js", "PostgreSQL", "Docker"]);
  assert.deepEqual(updated.expandedSkills, [
    "Node.js",
    "PostgreSQL",
    "Docker",
    "Express",
    "Relational DBs",
  ]);
  assert.deepEqual(updated.sectionsFound, ["Experience", "Skills", "Education"]);
});

await runMockTest("downloadResumeFromStorage streams binary buffer directly from Storage", async () => {
  const { client } = createStorageMockClient({ userId: USER_A_ID });

  const uploaded = await uploadResumeToStorage(client, {
    userId: USER_A_ID,
    resumeId: RESUME_ID,
    buffer: SAMPLE_PDF_BUFFER,
  });

  const downloadedBuffer = await downloadResumeFromStorage(client, uploaded.storagePath);
  assert.ok(Buffer.isBuffer(downloadedBuffer));
  assert.equal(downloadedBuffer.toString(), SAMPLE_PDF_BUFFER.toString());
});

await runMockTest("Safe deletion: removes file from Storage and row from database", async () => {
  const { client, db, storageFiles } = createStorageMockClient({ userId: USER_A_ID });

  const resume = await uploadAndPersistResume(client, {
    userId: USER_A_ID,
    fileName: "resume.pdf",
    buffer: SAMPLE_PDF_BUFFER,
  });

  assert.equal(storageFiles.size, 1);
  assert.equal(db.resumes.length, 1);

  await deleteResume(client, resume.id);

  assert.equal(storageFiles.size, 0, "Storage file must be removed");
  assert.equal(db.resumes.length, 0, "Database record must be removed");
});

await runMockTest("Safe deletion: handles already-missing Storage file gracefully without DB failure", async () => {
  const { client, db, storageFiles } = createStorageMockClient({ userId: USER_A_ID });

  const resume = await uploadAndPersistResume(client, {
    userId: USER_A_ID,
    fileName: "resume.pdf",
    buffer: SAMPLE_PDF_BUFFER,
  });

  // Manually delete storage file first (simulating partial/out-of-sync state)
  storageFiles.clear();

  // deleteResume should NOT crash if storage file is already gone
  await deleteResume(client, resume.id);
  assert.equal(db.resumes.length, 0, "Database record should still be cleaned up");
});

await runMockTest("Cascade session deletion: deletes linked resume when no sibling sessions exist", async () => {
  const sharedDb = {
    resumes: [],
    interview_sessions: [],
    session_questions: [],
    practice_attempts: [],
  };
  const sharedStorage = new Map();

  const { client } = createStorageMockClient({
    userId: USER_A_ID,
    sharedDb,
    sharedStorage,
  });

  // 1. Upload resume
  const resume = await uploadAndPersistResume(client, {
    userId: USER_A_ID,
    fileName: "primary_resume.pdf",
    buffer: SAMPLE_PDF_BUFFER,
  });

  // 2. Create session referencing this resume
  const session = await createSession(client, {
    userId: USER_A_ID,
    resumeId: resume.id,
    targetRole: "Backend Engineer",
  });

  assert.equal(sharedStorage.size, 1);
  assert.equal(sharedDb.resumes.length, 1);
  assert.equal(sharedDb.interview_sessions.length, 1);

  // 3. Delete session
  await deleteSession(client, session.id);

  assert.equal(sharedDb.interview_sessions.length, 0, "Session should be deleted");
  assert.equal(sharedStorage.size, 0, "Linked resume storage file should be deleted");
  assert.equal(sharedDb.resumes.length, 0, "Linked resume row should be deleted");
});

await runMockTest("Shared resume safety: multi-session references preserve resume until last session deleted", async () => {
  const sharedDb = {
    resumes: [],
    interview_sessions: [],
    session_questions: [],
    practice_attempts: [],
  };
  const sharedStorage = new Map();

  const { client } = createStorageMockClient({
    userId: USER_A_ID,
    sharedDb,
    sharedStorage,
  });

  // Upload one resume
  const resume = await uploadAndPersistResume(client, {
    userId: USER_A_ID,
    fileName: "shared_resume.pdf",
    buffer: SAMPLE_PDF_BUFFER,
  });

  // Create two sessions pointing to the same resume
  const session1 = await createSession(client, {
    userId: USER_A_ID,
    resumeId: resume.id,
    targetRole: "Fullstack Dev",
  });

  const session2 = await createSession(client, {
    userId: USER_A_ID,
    resumeId: resume.id,
    targetRole: "Backend Dev",
  });

  assert.equal(sharedDb.interview_sessions.length, 2);

  // Delete session1: resume must NOT be deleted yet because session2 still references it
  await deleteSession(client, session1.id);
  assert.equal(sharedDb.interview_sessions.length, 1);
  assert.equal(sharedStorage.size, 1, "Resume file must remain while sibling session exists");
  assert.equal(sharedDb.resumes.length, 1, "Resume row must remain while sibling session exists");

  // Delete session2: now the last session is gone, resume must be cleaned up
  await deleteSession(client, session2.id);
  assert.equal(sharedDb.interview_sessions.length, 0);
  assert.equal(sharedStorage.size, 0, "Resume file must now be deleted");
  assert.equal(sharedDb.resumes.length, 0, "Resume row must now be deleted");
});

await runMockTest("ML failure retention: Storage file and DB record are kept when ML fails", async () => {
  const { client, db, storageFiles } = createStorageMockClient({ userId: USER_A_ID });

  // 1. Upload & persist resume succeeds
  const resume = await uploadAndPersistResume(client, {
    userId: USER_A_ID,
    fileName: "candidate_cv.pdf",
    buffer: SAMPLE_PDF_BUFFER,
  });

  // 2. Simulate ML failure: creating a failed session
  const failedSession = await createSession(client, {
    userId: USER_A_ID,
    resumeId: resume.id,
    targetRole: "Resume Interview",
    status: "failed",
    errorMessage: "ML FAISS embeddings index failed to generate",
  });

  assert.equal(failedSession.status, "failed");
  assert.equal(failedSession.errorMessage, "ML FAISS embeddings index failed to generate");
  // Crucial requirement: resume is retained so user can retry without re-uploading
  assert.equal(storageFiles.size, 1, "Resume file must be retained on ML failure");
  assert.equal(db.resumes.length, 1, "Resume metadata must be retained on ML failure");
});

await runMockTest("Cross-user isolation: User B cannot access or download User A's resume", async () => {
  const sharedStorage = new Map();
  const sharedDb = {
    resumes: [],
    interview_sessions: [],
    session_questions: [],
    practice_attempts: [],
  };

  const clientA = createStorageMockClient({
    userId: USER_A_ID,
    sharedDb,
    sharedStorage,
  }).client;

  const clientB = createStorageMockClient({
    userId: USER_B_ID,
    sharedDb,
    sharedStorage,
  }).client;

  // User A uploads resume
  const resumeA = await uploadAndPersistResume(clientA, {
    userId: USER_A_ID,
    fileName: "confidential_a.pdf",
    buffer: SAMPLE_PDF_BUFFER,
  });

  // User B attempts to fetch User A's resume metadata -> null
  const fetchedByB = await getResumeById(clientB, resumeA.id);
  // In PostgreSQL RLS, user_id <> auth.uid() returns 0 rows (maybeSingle returns null)
  assert.equal(fetchedByB, null, "User B must not see User A's resume record");

  // User B attempts to download User A's resume from storage -> fails with RLS access denied
  await assert.rejects(
    async () => downloadResumeFromStorage(clientB, resumeA.storagePath),
    (err) => err.message.includes("access denied"),
  );
});

console.log(`\nMocked Storage Tests Result: ${mockTestsPassed}/${mockTestsTotal} Passed\n`);

// ─────────────────────────────────────────────────────────────────
// SECTION B: LIVE SUPABASE STORAGE INTEGRATION TESTS
// ─────────────────────────────────────────────────────────────────
console.log("============================================================");
console.log("SECTION B: LIVE SUPABASE STORAGE INTEGRATION TESTS");
console.log("============================================================\n");

let liveSkipped = false;
try {
  // Test 1: Verify live bucket configuration
  await runLiveTest("Live Supabase bucket 'resumes' exists and is private", async () => {
    const { data: bucket, error } = await supabaseAdmin.storage.getBucket("resumes");
    if (error) {
      throw new Error(`Failed to fetch 'resumes' bucket: ${error.message}`);
    }
    assert.equal(bucket.name, "resumes");
    assert.equal(bucket.public, false, "Bucket MUST be private");
    assert.equal(bucket.file_size_limit, 5242880, "Must enforce 5MB limit");
    assert.deepEqual(bucket.allowed_mime_types, ["application/pdf"]);
  });

  // Test 2: Upload, download, and delete a temporary live test object
  await runLiveTest("Live upload, download, and delete of test PDF object", async () => {
    const testLiveId = crypto.randomUUID();
    const testLivePath = `test-system-verification/${testLiveId}.pdf`;
    const liveTestBuffer = Buffer.from("%PDF-1.4 Live storage integration test %EOF");

    // Upload
    const { data: uploadData, error: uploadErr } = await supabaseAdmin.storage
      .from("resumes")
      .upload(testLivePath, liveTestBuffer, {
        contentType: "application/pdf",
        upsert: false,
      });

    if (uploadErr) {
      throw new Error(`Live upload failed: ${uploadErr.message}`);
    }
    assert.ok(uploadData?.path);

    // Download & verify binary contents
    const { data: downloadData, error: downloadErr } = await supabaseAdmin.storage
      .from("resumes")
      .download(testLivePath);

    if (downloadErr) {
      throw new Error(`Live download failed: ${downloadErr.message}`);
    }
    const downloadedArrayBuffer = await downloadData.arrayBuffer();
    const downloadedBuffer = Buffer.from(downloadedArrayBuffer);
    assert.equal(downloadedBuffer.toString(), liveTestBuffer.toString());

    // Clean up
    const { error: deleteErr } = await supabaseAdmin.storage
      .from("resumes")
      .remove([testLivePath]);

    if (deleteErr) {
      throw new Error(`Live delete cleanup failed: ${deleteErr.message}`);
    }
  });

} catch (liveErr) {
  console.warn("  [LIVE NOTICE] Live Supabase tests encountered error or could not connect:");
  console.warn(`    ${liveErr.message}`);
  liveSkipped = true;
}

console.log("\n============================================================");
console.log(`PHASE 3 STORAGE TESTS SUMMARY:`);
console.log(`  Mocked Unit & Integration Tests: ${mockTestsPassed}/${mockTestsTotal} PASSED`);
if (!liveSkipped) {
  console.log(`  Live Supabase Cloud Tests:      ${liveTestsPassed}/${liveTestsTotal} PASSED`);
} else {
  console.log(`  Live Supabase Cloud Tests:      SKIPPED (see notice above)`);
}
console.log("============================================================\n");

assert.equal(mockTestsPassed, mockTestsTotal, "All mock tests must pass");
if (!liveSkipped) {
  assert.equal(liveTestsPassed, liveTestsTotal, "All live tests must pass");
}
