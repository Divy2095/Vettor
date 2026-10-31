# MongoDB Architecture Audit: Vettor Platform

**Date:** October 2026  
**Auditor:** Antigravity AI Assistant  
**Repository:** `Vettor` (Resume-based AI Interview Question Finder)  
**Scope:** Express backend (`server/`), Python ML pipeline (`ML_Preprocessor_scripts/`), React client (`client/`), and root configuration files.

---

## Executive Summary

Vettor currently utilizes MongoDB as its primary persistence engine via the Mongoose ODM (`mongoose@^8.19.2`). The database stores user credentials and authentication metadata, interview generation sessions, AI-generated questions, practice attempts with rubric scores, and community question submissions.

A critical finding from this audit is that **the Python ML service (`ML_Preprocessor_scripts/`) does NOT connect to MongoDB directly**. The ML service operates strictly in-memory and on disk (using FAISS indexes, JSON files, spaCy, and local PDFs). MongoDB is exclusively accessed by the Node.js/Express backend (`server/`).

Furthermore, the codebase contains an architectural bifurcation between two distinct session models:
1. `UserSession` (`server/src/models/UserSession.js`): An early/pipeline-oriented model for asynchronous resume-to-FAISS question search.
2. `QuestionGenerationSession` (`server/src/models/QuestionGenerationSession.js`): The active model used by the frontend dashboard for multi-session question generation, Gemini practice attempts, and interview preparation.

---

## 1. MongoDB Connection & Configuration

### 1.1 Connection Setup
- **Config File:** [`server/src/config/database.js`](file:///home/divy/Desktop/Vettor/server/src/config/database.js)
  ```javascript
  import mongoose from "mongoose";

  const connectDatabase = async (mongoUri) => {
    mongoose.set("strictQuery", true);
    await mongoose.connect(mongoUri);
    console.log("MongoDB connected");
  };

  export default connectDatabase;
  ```
- **Bootstrap Initialization:** [`server/src/index.js`](file:///home/divy/Desktop/Vettor/server/src/index.js#L25-L51)
  ```javascript
  import app from "./app.js";
  import dotenv from "dotenv";
  import connectDatabase from "./config/database.js";

  dotenv.config();
  const PORT = process.env.PORT || 5000;

  const bootstrap = async () => {
    try {
      if (!process.env.MONGODB_URI) {
        throw new Error("MONGODB_URI is missing in environment variables");
      }
      await connectDatabase(process.env.MONGODB_URI);
      app.listen(PORT, () => {
        console.log(`🚀 Server running on port ${PORT}`);
      });
    } catch (error) {
      console.error("❌ Server failed to start:", error.message);
      process.exit(1);
    }
  };
  bootstrap();
  ```
- **Environment Validation:** [`server/src/config/env.js`](file:///home/divy/Desktop/Vettor/server/src/config/env.js#L6-L31)
  Zod validates `MONGODB_URI: z.string().min(1)`. If missing, the process terminates immediately at startup.

### 1.2 Docker & Local Deployment
- **Docker Compose:** [`docker-compose.yml`](file:///home/divy/Desktop/Vettor/docker-compose.yml#L4-L25)
  - Image: `mongo:7.0`
  - Container name: `resumeiq-mongo`
  - Port: `27017:27017`
  - Default Credentials: `admin:changeme`
  - Database: `resumeiq`
  - Volume: `mongo_data:/data/db`
  - Healthcheck: `CMD mongosh --eval "db.adminCommand('ping')"`

---

## 2. Comprehensive Model & Schema Inventory

There are **6 Mongoose models** declared across the application.

```
                           ┌───────────────────┐
                           │       User        │
                           └─────────┬─────────┘
                                     │
         ┌───────────────────────────┼───────────────────────────┐
         │ 1:N                       │ 1:N                       │ 1:N
         ▼                           ▼                           ▼
┌──────────────────┐    ┌───────────────────────────┐    ┌─────────────────┐
│   UserSession    │    │ QuestionGenerationSession │    │QuestionSubmission│
│ (ML Async Search)│    └─────────────┬─────────────┘    └────────┬────────┘
└──────────────────┘                  │ 1:N                       │
                                      ▼                           │ 1:1
                        ┌───────────────────────────┐             │ (approved)
                        │  QuestionPracticeAttempt  │             ▼
                        └───────────────────────────┘    ┌─────────────────┐
                                                         │    Question     │
                                                         │ (Dataset Bank)  │
                                                         └─────────────────┘
```

---

### Model 1: `User`
- **File:** [`server/src/models/User.js`](file:///home/divy/Desktop/Vettor/server/src/models/User.js)
- **Collection Name:** `users`
- **Purpose:** Stores user authentication identities, hashed passwords, roles, verification states, and session token hashes.
- **Fields:**
  | Field | Type | Validation / Constraints | Default | Description |
  |---|---|---|---|---|
  | `fullName` | `String` | Required, trim, min 2, max 80 | — | User's display name |
  | `email` | `String` | Required, unique, lowercase, trim, indexed | — | Login identifier |
  | `passwordHash` | `String` | Required | — | Bcrypt hash (12 salt rounds) |
  | `role` | `String` | Enum: `["user", "admin"]`, default: `"user"` | `"user"` | Authorization role |
  | `isEmailVerified` | `Boolean` | — | `false` | Email confirmation flag (hardcoded `true` at registration) |
  | `emailVerificationTokenHash` | `String` | — | `null` | Unused SHA-256 token hash |
  | `emailVerificationTokenExpiresAt`| `Date` | — | `null` | Unused token expiry date |
  | `passwordResetTokenHash` | `String` | — | `null` | SHA-256 hash of password reset token |
  | `passwordResetTokenExpiresAt` | `Date` | — | `null` | Expiry timestamp (30 mins from issue) |
  | `refreshTokenHash` | `String` | — | `null` | SHA-256 hash of current active refresh token |
  | `refreshTokenExpiresAt` | `Date` | — | `null` | Refresh token expiration timestamp |
  | `lastLoginAt` | `Date` | — | `null` | Timestamp of last successful login |
  | `createdAt` / `updatedAt` | `Date` | Automatic Mongoose timestamps | Current Date | Audit timestamps |
- **Indexes:**
  - `{ email: 1 }` (unique, auto-generated from `unique: true, index: true`)
- **Relationships:**
  - One-to-Many with `QuestionGenerationSession.user`
  - One-to-Many with `QuestionPracticeAttempt.user`
  - One-to-Many with `QuestionSubmission.submittedBy`
  - One-to-Many with `QuestionSubmission.reviewedBy`
  - One-to-Many with `Question.approvedBy`
  - One-to-Many with `UserSession.userId`
- **Dependent Features:** User registration, login, JWT refresh token rotation, password reset, admin role-based authorization.

---

### Model 2: `QuestionGenerationSession`
- **File:** [`server/src/models/QuestionGenerationSession.js`](file:///home/divy/Desktop/Vettor/server/src/models/QuestionGenerationSession.js)
- **Collection Name:** `questiongenerationsessions`
- **Purpose:** Central entity for the frontend workspace. Tracks an interview preparation session configured for a specific resume, target job role, target company, seniority level, and domain. Holds generated interview questions and skill gap analysis.
- **Fields:**
  | Field | Type | Validation / Constraints | Default | Description |
  |---|---|---|---|---|
  | `user` | `ObjectId` | Ref: `User`, Required, Indexed | — | Owning user ID |
  | `targetRole` | `String` | Trim, max 120 | `""` | Target role (e.g. "Full Stack Developer") |
  | `targetCompany` | `String` | Trim, max 100 | `""` | Target company (e.g. "Google") |
  | `targetLevel` | `String` | Enum: `["intern", "junior", "mid", "senior", "lead"]`, default: `"mid"` | `"mid"` | Target seniority level |
  | `targetDomain` | `String` | Trim, max 80 | `""` | Domain specialization (e.g. "Fintech") |
  | `resumeSkills` | `[String]` | Array of strings | `[]` | Skills extracted from candidate's resume |
  | `skillGap` | `Object` | Subdocument structure | `{ matchedSkills: [], missingSkills: [], prioritizedLearningPlan: [] }` | Rule-based skill gap evaluation |
  | `skillGap.matchedSkills` | `[String]` | — | `[]` | Resume skills matching target profile |
  | `skillGap.missingSkills` | `[String]` | — | `[]` | Target profile skills absent in resume |
  | `skillGap.prioritizedLearningPlan` | `[String]` | — | `[]` | Actionable learning recommendations |
  | `sourceFileName` | `String` | Trim, max 255 | `""` | Original uploaded resume filename |
  | `generatedQuestions` | `[Subdocument]` | Schema: `generatedQuestionSchema` | `[]` | List of generated questions for practice |
  | `generatedQuestions.questionText` | `String` | Required, min 10, max 500 | — | The interview question prompt |
  | `generatedQuestions.tags` | `[String]` | Array of lowercase tags | `[]` | Descriptive tags |
  | `generatedQuestions.focusSkill` | `String` | Trim | `""` | Specific skill tested by this question |
  | `mlDatasetQuestions` | `[Object]` | Array: `{ question, topic, difficulty }` | `[]` | Questions imported directly from ML dataset |
  | `displayName` | `String` | Trim, max 255 | `null` | User-defined custom session title |
  | `lastAccessedAt` | `Date` | Indexed | Current Date | Last accessed timestamp for sorting recency |
  | `createdAt` / `updatedAt` | `Date` | Automatic timestamps | Current Date | Audit timestamps |
- **Indexes:**
  - `{ user: 1 }`
  - `{ lastAccessedAt: 1 }`
- **Relationships:**
  - Belongs to `User` (`user` -> `User._id`)
  - One-to-Many with `QuestionPracticeAttempt.generationSession`
- **Dependent Features:**
  - Multi-session sidebar in frontend (`useSession` hook in `client/src/lib/sessionManager.js`)
  - Question generation endpoint (`POST /api/questions/generate`)
  - Session history (`GET /api/questions/history`)
  - Session rename (`PATCH /api/questions/:sessionId/rename`)
  - Session deletion (`DELETE /api/questions/:sessionId` — cascades to `QuestionPracticeAttempt`)
  - Session switching (`POST /api/questions/:sessionId/access`)
  - ML question attachment (`POST /api/ml/create-session`, `POST /api/ml/save-questions-to-session`)

---

### Model 3: `QuestionPracticeAttempt`
- **File:** [`server/src/models/QuestionPracticeAttempt.js`](file:///home/divy/Desktop/Vettor/server/src/models/QuestionPracticeAttempt.js)
- **Collection Name:** `questionpracticeattempts`
- **Purpose:** Records candidate responses to interview questions along with AI evaluation scores (Gemini API or fallback heuristics) and detailed feedback rubrics.
- **Fields:**
  | Field | Type | Validation / Constraints | Default | Description |
  |---|---|---|---|---|
  | `user` | `ObjectId` | Ref: `User`, Required, Indexed | — | Candidate who submitted the answer |
  | `generationSession` | `ObjectId` | Ref: `QuestionGenerationSession`, Indexed | `null` | Associated interview session |
  | `questionText` | `String` | Required, min 10, max 500 | — | The question answered |
  | `answerText` | `String` | Required, min 10, max 5000 | — | The candidate's response text |
  | `rubricScore` | `Object` | Subdocument: `rubricScoreSchema` | — | 4-factor scoring rubric (0 to 10 scale) |
  | `rubricScore.clarity` | `Number` | Required, min 0, max 10 | — | Communication clarity score |
  | `rubricScore.structure` | `Number` | Required, min 0, max 10 | — | STAR structure score |
  | `rubricScore.depth` | `Number` | Required, min 0, max 10 | — | Technical depth and detail |
  | `rubricScore.relevance` | `Number` | Required, min 0, max 10 | — | Alignment with question intent |
  | `overallScore` | `Number` | Required, min 0, max 10 | — | Composite integer score |
  | `isMatch` | `Boolean` | Required | `false` | True if answer matches question topic |
  | `shouldImprove` | `Boolean` | Required | `true` | True if overall score < 8 |
  | `feedbackSummary` | `String` | Required, trim, max 1000 | — | High-level synthesis of candidate performance |
  | `strengths` | `[String]` | Array of strings | `[]` | Highlighted positive aspects (2-4 points) |
  | `improvements` | `[String]` | Array of strings | `[]` | Actionable improvement advice (2-4 points) |
  | `createdAt` / `updatedAt` | `Date` | Automatic timestamps | Current Date | Attempt timestamp |
- **Indexes:**
  - `{ user: 1 }`
  - `{ generationSession: 1 }`
- **Relationships:**
  - Belongs to `User` (`user` -> `User._id`)
  - Belongs to `QuestionGenerationSession` (`generationSession` -> `QuestionGenerationSession._id`)
- **Dependent Features:** Practice feedback tab on dashboard (`POST /api/questions/practice`), session progress count (`answeredCount`).

---

### Model 4: `QuestionSubmission`
- **File:** [`server/src/models/QuestionSubmission.js`](file:///home/divy/Desktop/Vettor/server/src/models/QuestionSubmission.js)
- **Collection Name:** `questionsubmissions`
- **Purpose:** Manages crowdsourced interview questions submitted by community users pending administrative moderation (approval/rejection).
- **Fields:**
  | Field | Type | Validation / Constraints | Default | Description |
  |---|---|---|---|---|
  | `questionText` | `String` | Required, min 10, max 500 | — | The submitted interview question |
  | `tags` | `[String]` | Array of strings | `[]` | Associated topic/technology tags |
  | `company` | `String` | Trim, max 100 | `""` | Company where question was asked |
  | `seenInInterview` | `Boolean` | — | `false` | Flag indicating actual interview sighting |
  | `status` | `String` | Enum: `["pending", "approved", "rejected"]`, Indexed | `"pending"` | Moderation workflow state |
  | `submittedBy` | `ObjectId` | Ref: `User`, Required, Indexed | — | Submitter's user ID |
  | `reviewedBy` | `ObjectId` | Ref: `User` | `null` | Admin user ID who moderated |
  | `reviewedAt` | `Date` | — | `null` | Moderation timestamp |
  | `adminNote` | `String` | Trim, max 500 | `""` | Feedback note from admin |
  | `approvedQuestionId` | `ObjectId` | Ref: `Question` | `null` | Pointer to published question in bank |
  | `createdAt` / `updatedAt` | `Date` | Automatic timestamps | Current Date | Submission timestamp |
- **Indexes:**
  - `{ status: 1 }`
  - `{ submittedBy: 1 }`
- **Relationships:**
  - Belongs to `User` (`submittedBy` -> `User._id`)
  - Optional Belongs to `User` (`reviewedBy` -> `User._id`)
  - Optional One-to-One with `Question` (`approvedQuestionId` -> `Question._id`)
- **Dependent Features:**
  - Community question submission (`POST /api/questions/submissions`)
  - Submitter history (`GET /api/questions/submissions/me`)
  - Admin moderation queue (`GET /api/admin/moderation/pending`, `GET /api/admin/moderation/reviewed`)
  - Admin moderation actions (`POST /api/admin/moderation/submissions/:id/approve`, `POST /api/admin/moderation/submissions/:id/reject`)
  - Moderation stats & badge counts (`GET /api/admin/moderation/stats`, `GET /api/admin/moderation/notifications`)

---

### Model 5: `Question`
- **File:** [`server/src/models/Question.js`](file:///home/divy/Desktop/Vettor/server/src/models/Question.js)
- **Collection Name:** `questions`
- **Purpose:** Master repository of officially approved/curated interview questions, created directly by admins or converted from approved community submissions.
- **Fields:**
  | Field | Type | Validation / Constraints | Default | Description |
  |---|---|---|---|---|
  | `questionText` | `String` | Required, min 10, max 500 | — | Verified interview question text |
  | `tags` | `[String]` | Array of strings | `[]` | Normalized lowercase tags |
  | `company` | `String` | Trim, max 100 | `""` | Company attribution |
  | `seenInInterview` | `Boolean` | — | `false` | True if verified from real interview |
  | `sourceSubmissionId`| `ObjectId` | Ref: `QuestionSubmission`, Indexed | `null` | Backlink to originating submission |
  | `approvedBy` | `ObjectId` | Ref: `User`, Required | — | Admin user ID who created or approved |
  | `createdAt` / `updatedAt` | `Date` | Automatic timestamps | Current Date | Creation timestamp |
- **Indexes:**
  - `{ sourceSubmissionId: 1 }`
- **Relationships:**
  - Belongs to `User` (`approvedBy` -> `User._id`)
  - Optional One-to-One with `QuestionSubmission` (`sourceSubmissionId` -> `QuestionSubmission._id`)
- **Dependent Features:**
  - Admin direct question creation (`POST /api/admin/questions`)
  - Admin submission approval (`POST /api/admin/moderation/submissions/:id/approve`)

---

### Model 6: `UserSession`
- **File:** [`server/src/models/UserSession.js`](file:///home/divy/Desktop/Vettor/server/src/models/UserSession.js)
- **Collection Name:** `usersessions`
- **Purpose:** Parallel/Legacy session model dedicated to the asynchronous resume upload pipeline (`/api/resume/*`) and batch ML pipeline execution (`/api/ml/process-resume`).
- **Fields:**
  | Field | Type | Validation / Constraints | Default | Description |
  |---|---|---|---|---|
  | `userId` | `ObjectId` | Ref: `User`, Required, Indexed | — | Owning user ID |
  | `resumePath` | `String` | Required | — | Local filesystem path to stored PDF |
  | `profileString` | `String` | Required | — | Dense semantic profile text |
  | `extractedSkills` | `[String]` | Required | — | Raw skills parsed from PDF |
  | `expandedSkills` | `[String]` | Required | — | Skills expanded through ontology graph |
  | `generatedQuestions`| `[Subdocument]`| Subdocuments | `[]` | FAISS question search results with similarity scores |
  | `totalQuestions` | `Number` | — | `0` | Count of generated questions |
  | `processingTime` | `Number` | Required | — | Execution time in milliseconds |
  | `status` | `String` | Enum: `["pending", "processing", "completed", "failed"]`, default: `"pending"` | `"pending"` | Asynchronous processing state |
  | `errorMessage` | `String` | — | `null` | Failure message if processing failed |
  | `metadata.userAgent`| `String` | — | — | Client User-Agent string |
  | `metadata.ipAddress`| `String` | — | — | Client IP address |
  | `createdAt` / `updatedAt` | `Date` | Automatic timestamps | Current Date | Creation timestamp |
- **Indexes:**
  - Compound: `{ userId: 1, createdAt: -1 }`
  - Single: `{ status: 1 }`
- **Relationships:**
  - Belongs to `User` (`userId` -> `User._id`)
- **Dependent Features:**
  - `/api/resume/upload`, `/api/resume/status/:sessionId`, `/api/resume/questions/:sessionId`, `/api/resume/history`, `/api/resume/session/:sessionId`, `/api/resume/questions/:sessionId/export`
  - `/api/ml/process-resume`, `/api/ml/session/:sessionId`

---

## 3. The Dual-Session Discrepancy

A critical architectural finding is that **the codebase maintains two parallel session implementations**:

| Characteristic | `QuestionGenerationSession` (`server/src/models/QuestionGenerationSession.js`) | `UserSession` (`server/src/models/UserSession.js`) |
|---|---|---|
| **Primary Route** | `/api/questions/*` (`server/src/routes/questionRoutes.js`) | `/api/resume/*` and `/api/ml/*` |
| **Frontend Integration**| **Active** — wired directly to React `useSession` hook (`client/src/lib/sessionManager.js`) and `Dashboard.jsx`. | **Dormant / Standalone** — not wired into the main interactive dashboard tabs. |
| **Role & Domain Context**| Stores `targetRole`, `targetCompany`, `targetLevel`, `targetDomain`, and `skillGap`. | Does not support target roles or skill gap analysis. |
| **Question Storage** | Stores generated questions in `generatedQuestions` and dataset questions in `mlDatasetQuestions`. | Stores FAISS vector search results with float scoring metrics. |
| **Practice Integration** | Direct foreign key relation from `QuestionPracticeAttempt.generationSession`. | Not linked to practice attempts. |
| **ID Field Access Bug** | Handled correctly via `req.user.sub`. | In `resumeController.js`, queries use `req.user._id`, which is `undefined` because `authenticate.js` sets `req.user = decoded` with property `sub`. |

**Recommendation for PostgreSQL Migration:**  
Merge and normalize these two models into a single, cohesive `interview_sessions` relational schema with child tables for questions and skill gaps.

---

## 4. Complete Catalog of Database Queries

All MongoDB queries occur in Express controllers and route handlers. **No MongoDB aggregation pipelines (`.aggregate([...])`) exist in the codebase.** All aggregations are performed via Mongoose helper methods (`countDocuments()`) combined with in-memory JavaScript array transformations.

| File & Line | Method / Operation | Query Filter / Payload | Purpose |
|---|---|---|---|
| [`authController.js:63`](file:///home/divy/Desktop/Vettor/server/src/controllers/authController.js#L63) | `User.findOne` | `{ email: email.toLowerCase() }` | Duplicate check on registration |
| [`authController.js:70`](file:///home/divy/Desktop/Vettor/server/src/controllers/authController.js#L70) | `User.create` | `{ fullName, email, passwordHash, isEmailVerified: true }` | User registration |
| [`authController.js:82`](file:///home/divy/Desktop/Vettor/server/src/controllers/authController.js#L82) | `User.findOne` | `{ email: email.toLowerCase() }` | User login |
| [`authController.js:46`](file:///home/divy/Desktop/Vettor/server/src/controllers/authController.js#L46) | `user.save` | Updates `refreshTokenHash`, `refreshTokenExpiresAt` | Refresh token issuance |
| [`authController.js:123`](file:///home/divy/Desktop/Vettor/server/src/controllers/authController.js#L123) | `User.findById` | `decoded.sub` | Token refresh verification |
| [`authController.js:135`](file:///home/divy/Desktop/Vettor/server/src/controllers/authController.js#L135) | `user.save` | Clears `refreshTokenHash`, `refreshTokenExpiresAt` | Invalidate token on replay/tamper |
| [`authController.js:160`](file:///home/divy/Desktop/Vettor/server/src/controllers/authController.js#L160) | `User.findById` | `decoded.sub` | Invalidate token on logout |
| [`authController.js:177`](file:///home/divy/Desktop/Vettor/server/src/controllers/authController.js#L177) | `User.findOne` | `{ email: email.toLowerCase() }` | Password reset request |
| [`authController.js:190`](file:///home/divy/Desktop/Vettor/server/src/controllers/authController.js#L190) | `user.save` | Updates `passwordResetTokenHash`, expiry | Store reset token |
| [`authController.js:207`](file:///home/divy/Desktop/Vettor/server/src/controllers/authController.js#L207) | `User.findOne` | `{ email: email.toLowerCase() }` | Password reset fulfillment |
| [`authController.js:224`](file:///home/divy/Desktop/Vettor/server/src/controllers/authController.js#L224) | `user.save` | Updates `passwordHash`, clears reset tokens | Apply new password |
| [`authController.js:230`](file:///home/divy/Desktop/Vettor/server/src/controllers/authController.js#L230) | `User.findById` | `req.user.sub` | `/api/auth/me` user profile check |
| [`adminController.js:8`](file:///home/divy/Desktop/Vettor/server/src/controllers/adminController.js#L8) | `User.countDocuments` | `{}` | Admin moderation statistics |
| [`adminController.js:9-11`](file:///home/divy/Desktop/Vettor/server/src/controllers/adminController.js#L9-L11)| `QuestionSubmission.countDocuments` | `{ status: "pending" / "approved" / "rejected" }` | Admin moderation statistics |
| [`adminController.js:49-55`](file:///home/divy/Desktop/Vettor/server/src/controllers/adminController.js#L49-L55)| `QuestionSubmission.find` + `countDocuments` | `{ status: "pending", $or: [...] }`, `populate("submittedBy")`, `.sort().skip().limit()` | List pending submissions with search |
| [`adminController.js:73-80`](file:///home/divy/Desktop/Vettor/server/src/controllers/adminController.js#L73-L80)| `QuestionSubmission.find` + `countDocuments` | `{ status: { $in: ["approved", "rejected"] } }`, `populate("submittedBy", "reviewedBy")` | List reviewed submissions |
| [`adminController.js:96`](file:///home/divy/Desktop/Vettor/server/src/controllers/adminController.js#L96) | `Question.create` | `{ questionText, tags, company, seenInInterview, approvedBy }` | Admin creates question directly |
| [`adminController.js:110`](file:///home/divy/Desktop/Vettor/server/src/controllers/adminController.js#L110)| `QuestionSubmission.findById`| `req.params.id` | Find submission to approve |
| [`adminController.js:120`](file:///home/divy/Desktop/Vettor/server/src/controllers/adminController.js#L120)| `Question.create` | `{ questionText, tags, company, sourceSubmissionId, approvedBy }` | Convert submission to question |
| [`adminController.js:134`](file:///home/divy/Desktop/Vettor/server/src/controllers/adminController.js#L134)| `submission.save` | Updates `status: "approved"`, `reviewedBy`, `approvedQuestionId` | Mark submission approved |
| [`adminController.js:143`](file:///home/divy/Desktop/Vettor/server/src/controllers/adminController.js#L143)| `QuestionSubmission.findById`| `req.params.id` | Find submission to reject |
| [`adminController.js:156`](file:///home/divy/Desktop/Vettor/server/src/controllers/adminController.js#L156)| `submission.save` | Updates `status: "rejected"`, `reviewedBy`, `adminNote` | Mark submission rejected |
| [`questionController.js:67`](file:///home/divy/Desktop/Vettor/server/src/controllers/questionController.js#L67)| `QuestionPracticeAttempt.countDocuments` | `{ generationSession: session._id }` | Calculate answered questions count |
| [`questionController.js:358`](file:///home/divy/Desktop/Vettor/server/src/controllers/questionController.js#L358)| `QuestionSubmission.create` | `{ questionText, tags, company, seenInInterview, submittedBy }` | User submits community question |
| [`questionController.js:377`](file:///home/divy/Desktop/Vettor/server/src/controllers/questionController.js#L377)| `QuestionSubmission.find` | `{ submittedBy: req.user.sub }`, `.sort({ createdAt: -1 })` | User lists their submissions |
| [`questionController.js:486`](file:///home/divy/Desktop/Vettor/server/src/controllers/questionController.js#L486)| `QuestionGenerationSession.find` | `{ user: req.user.sub }`, `.sort().limit(50)` | Duplicate session detection |
| [`questionController.js:615`](file:///home/divy/Desktop/Vettor/server/src/controllers/questionController.js#L615)| `QuestionGenerationSession.create` | `{ user, targetRole, targetCompany, generatedQuestions, ... }` | Create new generation session |
| [`questionController.js:639`](file:///home/divy/Desktop/Vettor/server/src/controllers/questionController.js#L639)| `QuestionGenerationSession.find` | `{ user: req.user.sub }`, `.sort({ lastAccessedAt: -1 }).limit(20)` | List user session history |
| [`questionController.js:696`](file:///home/divy/Desktop/Vettor/server/src/controllers/questionController.js#L696)| `QuestionPracticeAttempt.create` | `{ user, generationSession, questionText, answerText, rubricScore, ... }` | Persist practice attempt feedback |
| [`questionController.js:712`](file:///home/divy/Desktop/Vettor/server/src/controllers/questionController.js#L712)| `QuestionGenerationSession.findByIdAndUpdate` | `generationSessionId`, `{ lastAccessedAt: new Date() }` | Touch session timestamp |
| [`questionController.js:727`](file:///home/divy/Desktop/Vettor/server/src/controllers/questionController.js#L727)| `QuestionGenerationSession.findById` | `sessionId` | Switch session verification |
| [`questionController.js:760`](file:///home/divy/Desktop/Vettor/server/src/controllers/questionController.js#L760)| `QuestionGenerationSession.findById` | `sessionId` | Rename session verification |
| [`questionController.js:781`](file:///home/divy/Desktop/Vettor/server/src/controllers/questionController.js#L781)| `QuestionGenerationSession.findById` | `sessionId` | Delete session verification |
| [`questionController.js:791`](file:///home/divy/Desktop/Vettor/server/src/controllers/questionController.js#L791)| `QuestionPracticeAttempt.deleteMany` | `{ generationSession: sessionId }` | Cascade delete practice attempts |
| [`questionController.js:794`](file:///home/divy/Desktop/Vettor/server/src/controllers/questionController.js#L794)| `QuestionGenerationSession.findByIdAndDelete` | `sessionId` | Delete generation session |
| [`questionController.js:812`](file:///home/divy/Desktop/Vettor/server/src/controllers/questionController.js#L812)| `QuestionGenerationSession.create` | `{ user, targetRole, resumeSkills, displayName, ... }` | Direct empty session creation |
| [`resumeController.js:31`](file:///home/divy/Desktop/Vettor/server/src/controllers/resumeController.js#L31)| `UserSession.create` | `{ userId, resumePath, status: 'processing', ... }` | Create async resume processing session |
| [`resumeController.js:68`](file:///home/divy/Desktop/Vettor/server/src/controllers/resumeController.js#L68)| `UserSession.findById` | `sessionId` | Async pipeline worker status lookup |
| [`resumeController.js:101`](file:///home/divy/Desktop/Vettor/server/src/controllers/resumeController.js#L101)| `UserSession.findByIdAndUpdate` | `sessionId`, `{ status: 'failed', errorMessage }` | Async pipeline error update |
| [`resumeController.js:127`](file:///home/divy/Desktop/Vettor/server/src/controllers/resumeController.js#L127)| `UserSession.findOne` | `{ _id: sessionId, userId: req.user._id }` | Get resume processing status |
| [`resumeController.js:158`](file:///home/divy/Desktop/Vettor/server/src/controllers/resumeController.js#L158)| `UserSession.findOne` | `{ _id: sessionId, userId: req.user._id }` | Get resume session questions |
| [`resumeController.js:218`](file:///home/divy/Desktop/Vettor/server/src/controllers/resumeController.js#L218)| `UserSession.find` | `{ userId: req.user._id }`, `.sort({ createdAt: -1 }).limit(20)` | Get resume session history |
| [`resumeController.js:247`](file:///home/divy/Desktop/Vettor/server/src/controllers/resumeController.js#L247)| `UserSession.findOneAndDelete` | `{ _id: sessionId, userId: req.user._id }` | Delete resume session |
| [`resumeController.js:273`](file:///home/divy/Desktop/Vettor/server/src/controllers/resumeController.js#L273)| `UserSession.findOne` | `{ _id: sessionId, userId: req.user._id }` | Export session questions to JSON |
| [`mlRoutes.js:99`](file:///home/divy/Desktop/Vettor/server/src/routes/mlRoutes.js#L99) | `UserSession.create` | `{ userId, resumePath, profileString, extractedSkills, generatedQuestions, ... }` | Save full end-to-end ML session |
| [`mlRoutes.js:208`](file:///home/divy/Desktop/Vettor/server/src/routes/mlRoutes.js#L208) | `UserSession.findOne` | `{ _id: req.params.sessionId, userId: req.user.sub }` | Retrieve saved ML session |
| [`mlRoutes.js:272`](file:///home/divy/Desktop/Vettor/server/src/routes/mlRoutes.js#L272) | `QuestionGenerationSession.findOne` | `{ _id: sessionId, user: userId }` | Validate session before saving questions |
| [`mlRoutes.js:330`](file:///home/divy/Desktop/Vettor/server/src/routes/mlRoutes.js#L330) | `QuestionGenerationSession.create` | `{ user, targetRole, mlDatasetQuestions, ... }` | Create session with ML questions |

---

## 5. MongoDB Dependency Inventory & Classification

| Occurrence / Artifact | Location / File | Classification | Details & Actions |
|---|---|---|---|
| `mongoose` package | `server/package.json` | **Active Runtime Dependency** | Version `^8.19.2`. Must be removed during PostgreSQL migration. |
| `mongodb` package | `server/package-lock.json` | **Active Runtime Dependency** | Transitive dependency of `mongoose`. Will be removed with `mongoose`. |
| `connectDatabase` function | `server/src/config/database.js` | **Active Runtime Dependency** | Mongoose connection wrapper. Will be replaced by Supabase client initialization. |
| `MONGODB_URI` validation | `server/src/config/env.js` | **Configuration** | Zod environment schema requirement. Will be replaced with Supabase credentials. |
| `bootstrap()` call | `server/src/index.js` | **Configuration / Entrypoint** | Connects to Mongo before listening. Will be updated to verify Supabase connectivity. |
| 6 Mongoose Model Files | `server/src/models/*.js` | **Active Runtime Dependency** | Schemas for `User`, `Question`, `QuestionSubmission`, `QuestionGenerationSession`, `QuestionPracticeAttempt`, `UserSession`. All 6 files will be retired. |
| Model imports in controllers | `server/src/controllers/*.js` | **Active Runtime Dependency** | In `authController.js`, `adminController.js`, `questionController.js`, `resumeController.js`. Must be refactored to use Supabase / SQL queries. |
| `mongoose.Types.ObjectId` validation | `server/src/routes/mlRoutes.js` | **Active Runtime Dependency** | Line 3 and Line 267 validate MongoDB ObjectIds. Must be refactored to UUID validation. |
| `mongo` Docker Service | `docker-compose.yml` | **Configuration** | Runs `mongo:7.0` container on port 27017 with volume `mongo_data`. Must be removed. |
| `.mongodb-data` ignore rule | `server/.gitignore` | **Configuration** | Local database storage ignore pattern. Can be cleaned up. |
| MongoDB Atlas Guide | `AWS_DEPLOYMENT_GUIDE.md` | **Documentation** | References MongoDB Atlas setup (`mongodb+srv://...`). Needs updating. |
| MongoDB Docker Guide | `DOCKER_SETUP_GUIDE.md` | **Documentation** | References MongoDB service troubleshooting. Needs updating. |
| MongoDB Integration Guide | `INTEGRATION_SETUP_GUIDE.md`, `PROJECT_OVERVIEW.md` | **Documentation** | References local Mongo setup. Needs updating. |
| `mongodb` skill string | `server/src/utils/skillExtractor.js`, `ML_Preprocessor_scripts/pipeline/extract_resume_skills.py` | **Domain Vocabulary** | Keyword in tech skill dictionaries. **DO NOT REMOVE** (these represent the skill "MongoDB" on candidate resumes). |

---

## 6. Audit Conclusions & Migration Implications

1. **Clean Separation of ML and Database:** Because Python has zero database couplings, the entire MongoDB replacement can occur safely within the Node.js/Express layer without destabilizing the Python NLP and FAISS services.
2. **Session Consolidation Opportunity:** The legacy `UserSession` model and the active `QuestionGenerationSession` model should be unified into a single relational schema.
3. **No Migration Data Needed:** As confirmed by project requirements, there are no live production records to migrate, enabling a clean break from NoSQL document patterns to relational table design.
