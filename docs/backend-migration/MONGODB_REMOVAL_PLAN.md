# MongoDB Removal & Migration Plan: Vettor Platform

**Date:** October 2026  
**Auditor:** Antigravity AI Assistant  
**Repository:** `Vettor` (Resume-based AI Interview Question Finder)  
**Execution Status:** UNDERSTANDING & PLANNING ONLY (No code modified yet)

---

## 1. Scope & Strategy

This document provides an exhaustive inventory of every file, NPM package, environment variable, Docker service, and configuration that must be modified or removed to completely eliminate MongoDB and Mongoose from Vettor in favor of Supabase PostgreSQL and Supabase Auth.

Because there are no production records or user data to preserve, the migration will be executed as a **clean-slate architecture swap** rather than an ETL data pipeline.

---

## 2. Complete Inventory of Components to Change

### 2.1 Dependencies & Packages
| Dependency | Location | Action | Reason |
|---|---|---|---|
| `mongoose` (`^8.19.2`) | `server/package.json` | **Uninstall** | Replaced by Supabase client / PostgreSQL driver. |
| `mongodb` | `server/package-lock.json` | **Remove** | Transitive dependency of Mongoose. |
| `bcryptjs` (`^3.0.2`) | `server/package.json` | **Uninstall** | Password hashing is handled internally by Supabase Auth. |
| `@supabase/supabase-js` | `server/package.json` | **Install** | Database operations and administrative auth queries. |
| `@supabase/supabase-js` | `client/package.json` | **Install** | Client authentication and session management. |

---

### 2.2 Files to Delete or Replace Entirely
| File Path | Action | Description / Replacement |
|---|---|---|
| `server/src/config/database.js` | **Replace / Delete** | Replace Mongoose connection logic with Supabase client initialization (`server/src/config/supabase.js`). |
| `server/src/models/User.js` | **Delete** | Replaced by Supabase `auth.users` and `public.profiles`. |
| `server/src/models/Question.js` | **Delete** | Replaced by `public.community_questions`. |
| `server/src/models/QuestionSubmission.js` | **Delete** | Replaced by `public.community_question_submissions`. |
| `server/src/models/QuestionGenerationSession.js` | **Delete** | Replaced by `public.interview_sessions` and `public.session_questions`. |
| `server/src/models/QuestionPracticeAttempt.js` | **Delete** | Replaced by `public.practice_attempts`. |
| `server/src/models/UserSession.js` | **Delete** | Retired; unified into `public.interview_sessions`. |

---

### 2.3 Files to Refactor
| File Path | Required Modifications |
|---|---|
| `server/src/config/env.js` | Remove `MONGODB_URI`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `RESET_TOKEN_EXPIRY_MINUTES`. Add `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`. |
| `server/src/index.js` | Remove `connectDatabase(process.env.MONGODB_URI)`. Initialize or verify Supabase connectivity during bootstrap. |
| `server/src/middleware/authenticate.js` | Verify Supabase access JWT using `SUPABASE_JWT_SECRET` (or Supabase client). Populate `req.user = { id: sub, email, role }`. |
| `server/src/controllers/authController.js` | Strip out custom token cookies, bcrypt, and user registration/login. Delegate to Supabase Auth or retain lightweight user profile endpoints (`/me`). |
| `server/src/controllers/questionController.js` | Replace Mongoose model calls (`QuestionGenerationSession`, `QuestionPracticeAttempt`, `QuestionSubmission`) with Supabase SQL queries. |
| `server/src/controllers/adminController.js` | Replace Mongoose moderation queries with Supabase queries on `community_question_submissions` and `community_questions`. |
| `server/src/controllers/resumeController.js` | Refactor to query `public.interview_sessions` and use Supabase Storage for resume file uploads. |
| `server/src/routes/mlRoutes.js` | Remove `import mongoose from "mongoose"` and `mongoose.Types.ObjectId.isValid()`. Replace with UUID validation. Replace `UserSession` queries with `interview_sessions`. |
| `client/src/lib/auth.js` | Replace localStorage token logic and cookie handling with `@supabase/supabase-js`. |
| `client/src/pages/AuthPage.jsx` | Wire form submission directly to `supabase.auth.signInWithPassword` and `supabase.auth.signUp`. |
| `client/src/pages/ResetPasswordPage.jsx` | Wire password reset to `supabase.auth.updateUser`. |
| `docker-compose.yml` | Remove `mongo` service container, `mongo_data` and `mongo_config` volumes. |
| `server/.gitignore` | Remove `.mongodb-data`. |
| `server/integration-tests.js` & `server/test-integration.js` | Update test assertions expecting MongoDB `_id` to expect UUID `id`. |

---

### 2.4 Environment Variables to Remove & Add

#### Remove:
- `MONGODB_URI`
- `JWT_ACCESS_SECRET`
- `JWT_ACCESS_EXPIRY`
- `JWT_REFRESH_SECRET`
- `EMAIL_TOKEN_EXPIRY_MINUTES`
- `RESET_TOKEN_EXPIRY_MINUTES`

#### Add:
- **Backend (`server/.env`):**
  - `SUPABASE_URL=https://<project-ref>.supabase.co`
  - `SUPABASE_SERVICE_ROLE_KEY=<service-role-secret>`
  - `SUPABASE_JWT_SECRET=<jwt-secret>`
- **Frontend (`client/.env`):**
  - `VITE_SUPABASE_URL=https://<project-ref>.supabase.co`
  - `VITE_SUPABASE_ANON_KEY=<anon-public-key>`

---

### 2.5 Docker Compose Changes
In `docker-compose.yml`:
1. Delete the `mongo` container block (lines 4-25).
2. Remove `mongo` from `backend.depends_on`.
3. Remove `MONGODB_URI` from `backend.environment`.
4. Delete `mongo_data` and `mongo_config` from root `volumes:`.

---

## 3. Step-by-Step Phased Execution Plan

```
Phase 1: Supabase Setup ──► Phase 2: Express Backend ──► Phase 3: Client Auth ──► Phase 4: Final Cleanup
- Run DDL in Supabase      - Install Supabase SDK       - Update auth.js         - Uninstall Mongoose
- Configure Auth Hooks     - Refactor Middleware        - Update AuthPage.jsx    - Remove Mongo Docker
- Create 'resumes' Bucket  - Refactor Controllers       - Test Full UI Flow      - Update Docs
```

### Phase 1: Database & Storage Provisioning
1. Execute the DDL script from `DATABASE_SCHEMA_PROPOSAL.md` in the Supabase SQL Editor.
2. Enable the `on_auth_user_created` trigger to auto-create `public.profiles`.
3. Create a private bucket in Supabase Storage named `resumes` with Row Level Security (RLS) restricting file access to the uploading candidate.

### Phase 2: Express Backend Modernization
1. Update `server/src/config/env.js` with new Supabase environment variables.
2. Create `server/src/config/supabase.js` initializing `@supabase/supabase-js`.
3. Update `server/src/middleware/authenticate.js` to verify Supabase JWTs.
4. Refactor controllers:
   - `questionController.js`: Replace Mongoose CRUD with Supabase queries.
   - `adminController.js`: Replace Mongoose moderation queries with Supabase queries.
   - `authController.js`: Retain `/me` endpoint reading from `public.profiles`.
5. Remove MongoDB connection from `server/src/index.js`.
6. Remove all 6 Mongoose model files in `server/src/models/`.

### Phase 3: Frontend Client Integration
1. Install `@supabase/supabase-js` in `client/`.
2. Configure `client/src/lib/supabaseClient.js`.
3. Update `client/src/lib/auth.js` to utilize Supabase Auth methods (`signInWithPassword`, `signUp`, `signOut`, `getSession`).
4. Update `client/src/pages/AuthPage.jsx` and `ResetPasswordPage.jsx`.
5. Verify `authFetch` passes Supabase access tokens seamlessly in `Dashboard.jsx`.

### Phase 4: Teardown, Cleanup & Testing
1. Run `npm uninstall mongoose bcryptjs` in `server/`.
2. Clean `docker-compose.yml` (remove `mongo` service and volumes).
3. Update test scripts (`server/integration-tests.js`).
4. Update developer and deployment documentation.

---

## 4. Potential Breaking Changes & Migration Risks

| Risk Area | Description | Mitigation Strategy |
|---|---|---|
| **ID Format Mismatch (ObjectId vs UUID)** | MongoDB uses 24-character hex strings (`ObjectId`), whereas PostgreSQL uses 36-character UUIDs (`gen_random_uuid()`). Any frontend code or ML route validating `ObjectId.isValid()` will fail. | Update all ID validations in Express validators (`z.string().uuid()`) and replace regex checks across the client and server. |
| **Field Naming (`_id` vs `id`)** | MongoDB documents return `_id`. PostgreSQL returns `id`. Frontend components accessing `session._id` would break if not handled. | Return `id` from PostgreSQL and alias `_id: row.id` in response mappers if needed for backward compatibility with React components during initial rollout. |
| **Array & Subdocument Mutations** | MongoDB allows in-place array pushing (`session.mlDatasetQuestions.push(...)`). Relational tables require explicit SQL `INSERT INTO session_questions`. | Re-implement collection mutations as distinct SQL insert statements. |
| **Resume File Storage Location** | Currently resumes are written to local disk `ML_Preprocessor_scripts/user_resumes/`. | Transition to Supabase Storage. For Python ML processing, Express can download the file stream or provide a signed URL/temporary buffer. |
| **Duplicate Session Heuristic** | `questionController.js` performs an in-memory comparison of 50 past sessions to detect duplicates. | Replace in-memory filtering with a targeted SQL query checking `target_role`, `target_company`, and `resume_id`. |
