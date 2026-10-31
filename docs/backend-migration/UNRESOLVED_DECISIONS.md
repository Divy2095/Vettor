# Unresolved Architectural Decisions: Vettor Platform

**Date:** October 2026 (Post-Audit Architecture Review)  
**Status:** Open for User / Team Decision before Phase 1 Execution

---

## 1. Questions Syncing: Database vs Static FAISS Data Files

- **Context:** Currently, the Python ML service reads questions from a static file: `ML_Preprocessor_scripts/data/questions.json` (~338 questions) and builds vector embeddings in `questions.index`.
- **The Proposal:** We created `public.questions` in PostgreSQL to serve as the unified master question bank, which will also receive approved crowdsourced questions.
- **The Options:**
  - **Option A (Recommended):** Seed the existing 338 questions into `public.questions`. Add a simple database export script (`scripts/export-questions-to-json.js` or Python exporter) that dumps active questions to `questions.json` whenever the FAISS index needs rebuilding.
  - **Option B (Direct Database FAISS Build):** Update the Python index builder script (`build_index.py`) to connect directly to PostgreSQL via `psycopg2` or `asyncpg` to pull active questions for embedding generation.
- **Trade-off:** Option A maintains total decoupling between the Python ML service and the database. Option B automates dataset updates at the cost of giving Python direct read access to PostgreSQL.

---

## 2. Admin Moderation: Ability to Edit Questions Upon Approval

- **Context:** In MongoDB [`adminController.js:120`](file:///home/divy/Desktop/Vettor/server/src/controllers/adminController.js#L120), when an admin approves a question, it copies `questionText`, `tags`, `company` verbatim into the `Question` collection without allowing edits.
- **The Question:** Often crowdsourced submissions have typos, poor grammar, or missing tags that an admin would want to polish before publishing to the question bank.
- **The Options:**
  - **Option A (Permit Moderation Edits):** Update `POST /api/admin/moderation/submissions/:id/approve` to accept optional overrides for `questionText`, `tags`, `company`, `topic`, and `difficulty`.
  - **Option B (Strict Verbatim Approval):** Keep approval as an atomic boolean operation that approves verbatim as originally written.

---

## 3. Frontend Identifier Compatibility (`_id` vs `id`)

- **Context:** The React client (`client/src/pages/Dashboard.jsx`, `SessionSidebar.jsx`, `sessionManager.js`) references MongoDB's `_id` convention (e.g. `session._id`, `question._id`). PostgreSQL uses standard `id`.
- **The Options:**
  - **Option A (Dual-Key Mapping during Transition):** In the Express response serializer, return both `id` and `_id: row.id`. This ensures zero frontend breakage when the backend switches to PostgreSQL.
  - **Option B (Simultaneous Client Refactor):** Refactor the React client components in Phase 3 to use `id` exclusively, eliminating legacy MongoDB naming artifacts.

---

## 4. Express JWT Verification Method: Latency vs Revocation Detection

- **Context:** Supabase access tokens are signed JWTs with a 1-hour lifespan.
- **The Options:**
  - **Option A (`supabase.auth.getUser(token)` - Recommended):** Validates the token against the Supabase Auth server. Guarantees immediate revocation detection if a user logs out or is banned, and requires zero local crypto key maintenance. Adds ~25-40ms network latency per request.
  - **Option B (Offline JWKS Verification):** Express caches the public keys from Supabase's `.well-known/jwks.json` and verifies tokens purely in-memory. Near-zero latency (<1ms), but does not detect revoked tokens until the 1-hour access token window expires.

---

## 5. Multiple Resume Storage & Candidate Profiles

- **Context:** In MongoDB, resume paths were tied directly to individual sessions, and older resumes were often overwritten on disk. In our PostgreSQL schema, `public.resumes` supports storing multiple uploaded resumes per candidate.
- **The Options:**
  - **Option A (Per-Session Resume Binding):** Candidates upload a resume per session (or select an existing uploaded resume), and each session permanently links to that specific resume ID.
  - **Option B (Active/Default Resume on Profile):** Add `primary_resume_id UUID` to `public.profiles` so candidates have a default resume automatically selected across sessions until changed.
