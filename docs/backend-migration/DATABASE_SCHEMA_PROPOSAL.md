# Revised PostgreSQL Database Schema Proposal: Vettor Platform

**Date:** October 2026 (Revised Architecture Review)  
**Target Engine:** PostgreSQL 15+ (via Supabase)  
**Status:** Approved Architecture Draft for Implementation Review

---

## 1. Architectural Principles & Normalization Strategy

Following the architecture review, the database design has been refined to enforce multi-tenant isolation, data integrity, and strict referential constraints at the PostgreSQL level:

1. **Strict Multi-Tenant User Isolation via Composite Foreign Keys:**
   - In MongoDB, practice attempts could theoretically point to arbitrary session IDs.
   - In this schema, `interview_sessions` enforces a unique constraint on `(id, user_id)`. `practice_attempts` enforces a composite foreign key `(session_id, user_id) REFERENCES interview_sessions(id, user_id)`.
   - **Result:** It is mathematically impossible for a practice attempt to reference another user's session.
2. **Unified Question Repository (`public.questions`):**
   - Eliminates the artificial split between ML dataset questions, admin-created questions, and approved community questions.
   - The master question bank holds curated questions (from `questions.json`), admin-created questions, and approved community submissions under a single schema, differentiated by `source_type`.
3. **Decoupled Moderation Queue (`public.community_question_submissions`):**
   - Crowdsourced questions live in a dedicated moderation queue.
   - When approved, a question is inserted into `public.questions` with `source_type = 'community_approved'` and `source_submission_id` pointing back to the submission. A unique constraint ensures a submission cannot be approved multiple times.
4. **Structured JSONB with Check Constraints for Skill Gaps:**
   - `skill_gap` is retained as JSONB on `interview_sessions` because it represents a static, immutable snapshot calculated for a specific session.
   - Strict `CHECK` constraints validate the presence and structure of `matchedSkills`, `missingSkills`, and `prioritizedLearningPlan`.
5. **Private Cloud Object Storage for Resumes:**
   - PDF binaries are stored in Supabase Storage (`resumes` bucket), completely decoupling heavy file storage from the database. Only metadata, text parsing results, and storage object paths reside in `public.resumes`.
6. **Automated `updated_at` Triggers:**
   - Dedicated `moddatetime`-style trigger functions automatically keep `updated_at` timestamps accurate on all mutable tables.

---

## 2. Entity-Relationship Diagram

```
┌─────────────────────────────────┐
│     auth.users (Supabase)       │
└────────────────┬────────────────┘
                 │ 1:1
                 ▼
┌─────────────────────────────────┐
│         public.profiles         │
│  id UUID PK                     │
│  full_name TEXT                 │
│  role user_role ('user'|'admin')│
└────────┬───────────────┬────────┘
         │ 1:N           │ 1:N
         │               ▼
         │       ┌────────────────────────────────────────────────────────┐
         │       │               public.interview_sessions                │
         │       │  id UUID PK                                            │
         │       │  user_id UUID FK                                       │
         │       │  resume_id UUID FK                                     │
         │       │  target_role, target_company, target_level             │
         │       │  skill_gap JSONB                                       │
         │       │  UNIQUE (id, user_id) ◄──────────────────────┐         │
         │       └───────┬───────────────────────────────┬──────┼─────────┘
         │               │ 1:N                           │      │
         │               ▼                               │      │ Composite FK
         │       ┌────────────────────────┐              │      │ (session_id, user_id)
         │       │public.session_questions│              │      │
         │       │  id UUID PK            │              │      │
         │       │  session_id UUID FK    │              │      │
         │       │  question_text TEXT    │              │      │
         │       │  UNIQUE (id,session_id)│◄─────┐       │      │
         │       └────────────────────────┘      │       │      │
         │                                       │       ▼      │
         │                                1:N    │ ┌──────────────────────┐
         │                                       └─┤public.practice_attempts│
         │                                         │  id UUID PK          │
         │                                         │  user_id UUID FK     │
         │                                         │  session_id UUID FK  │
         │                                         │  question_id UUID FK │
         │                                         │  rubric scores (0-10)│
         │                                         └──────────────────────┘
         │ 1:N (submitted_by / reviewed_by)
         ▼
┌────────────────────────────────────────┐         ┌──────────────────────┐
│ public.community_question_submissions  │ 1:1     │   public.questions   │
│  id UUID PK                            ├────────►│  id UUID PK          │
│  question_text TEXT                    │(approved│  source_submission_id│
│  status ('pending'|'approved'|'reject')│ only)   │  approved_by UUID FK │
└────────────────────────────────────────┘         │  source_type ENUM    │
                                                   └──────────────────────┘
```

---

## 3. Detailed Table Specifications

### 3.1 `public.profiles`
- **Purpose:** Application user profiles extending Supabase `auth.users`.
- **Columns:**
  | Column | Data Type | Constraints | Description |
  |---|---|---|---|
  | `id` | `UUID` | Primary Key, `REFERENCES auth.users(id) ON DELETE CASCADE` | Matches Supabase Auth user ID |
  | `full_name` | `VARCHAR(100)` | Not Null, Check `length(trim(full_name)) >= 2` | Candidate display name |
  | `role` | `VARCHAR(20)` | Not Null, Default `'user'`, Check `role IN ('user', 'admin')` | Authorization role |
  | `avatar_url` | `TEXT` | Nullable, Check `avatar_url IS NULL OR avatar_url ~* '^https?://'` | Profile picture URL |
  | `created_at` | `TIMESTAMPTZ` | Not Null, Default `now()` | Account profile creation date |
  | `updated_at` | `TIMESTAMPTZ` | Not Null, Default `now()` | Last profile update date |
- **Indexes:**
  - `CREATE INDEX idx_profiles_admin ON public.profiles(id) WHERE role = 'admin';` (Partial index for fast admin lookup).

---

### 3.2 `public.resumes`
- **Purpose:** Tracks candidate resume PDFs stored in the Supabase Storage `resumes` bucket.
- **Columns:**
  | Column | Data Type | Constraints | Description |
  |---|---|---|---|
  | `id` | `UUID` | Primary Key, Default `gen_random_uuid()` | Unique resume record ID |
  | `user_id` | `UUID` | Not Null, `REFERENCES public.profiles(id) ON DELETE CASCADE` | Candidate who uploaded the resume |
  | `file_name` | `VARCHAR(255)` | Not Null, Check `length(trim(file_name)) > 0` | Original uploaded filename |
  | `storage_path` | `TEXT` | Not Null, Unique, Check `storage_path ~* '^[a-f0-9-]+/[a-f0-9-]+\.pdf$'` | Supabase Storage key (`<user_id>/<resume_id>.pdf`) |
  | `file_size_bytes` | `INTEGER` | Not Null, Check `file_size_bytes > 0 AND file_size_bytes <= 5242880` | File size (capped at 5MB limit) |
  | `mime_type` | `VARCHAR(50)` | Not Null, Default `'application/pdf'`, Check `mime_type = 'application/pdf'` | Strictly PDF MIME type |
  | `raw_skills` | `TEXT[]` | Not Null, Default `'{}'` | Raw skills extracted by parser/ML |
  | `expanded_skills` | `TEXT[]` | Not Null, Default `'{}'` | Ontology-expanded skills |
  | `sections_found` | `TEXT[]` | Not Null, Default `'{}'` | Resume sections identified |
  | `created_at` | `TIMESTAMPTZ` | Not Null, Default `now()` | Upload timestamp |
- **Indexes:**
  - `CREATE INDEX idx_resumes_user_id ON public.resumes(user_id);`
  - `CREATE INDEX idx_resumes_expanded_skills ON public.resumes USING GIN(expanded_skills);`

---

### 3.3 `public.interview_sessions`
- **Purpose:** Central session container unifying `QuestionGenerationSession` and `UserSession`.
- **Columns:**
  | Column | Data Type | Constraints | Description |
  |---|---|---|---|
  | `id` | `UUID` | Primary Key, Default `gen_random_uuid()` | Unique session ID |
  | `user_id` | `UUID` | Not Null, `REFERENCES public.profiles(id) ON DELETE CASCADE` | Session owner |
  | `resume_id` | `UUID` | Nullable, `REFERENCES public.resumes(id) ON DELETE SET NULL` | Linked resume |
  | `display_name` | `VARCHAR(255)` | Nullable, Check `display_name IS NULL OR length(trim(display_name)) > 0` | Custom session title |
  | `target_role` | `VARCHAR(120)` | Not Null, Default `''` | Target job title (e.g. "Backend Engineer") |
  | `target_company` | `VARCHAR(100)` | Not Null, Default `''` | Target company (e.g. "Stripe") |
  | `target_level` | `VARCHAR(20)` | Not Null, Default `'mid'`, Check `target_level IN ('intern', 'junior', 'mid', 'senior', 'lead')` | Seniority level |
  | `target_domain` | `VARCHAR(80)` | Not Null, Default `''` | Target domain (e.g. "Fintech") |
  | `resume_skills` | `TEXT[]` | Not Null, Default `'{}'` | Skills considered during generation |
  | `skill_gap` | `JSONB` | Not Null, Default `'{"matchedSkills":[], "missingSkills":[], "prioritizedLearningPlan":[]}'::jsonb` | Skill gap analysis snapshot |
  | `status` | `VARCHAR(20)` | Not Null, Default `'completed'`, Check `status IN ('pending', 'processing', 'completed', 'failed')` | Session processing state |
  | `processing_time_ms`| `INTEGER` | Not Null, Default 0, Check `processing_time_ms >= 0` | Execution duration in ms |
  | `last_accessed_at` | `TIMESTAMPTZ` | Not Null, Default `now()` | Timestamp for MRU sorting |
  | `created_at` | `TIMESTAMPTZ` | Not Null, Default `now()` | Creation timestamp |
  | `updated_at` | `TIMESTAMPTZ` | Not Null, Default `now()` | Modification timestamp |
- **Table Constraints:**
  - `CONSTRAINT uq_sessions_id_user UNIQUE (id, user_id)` (Required for composite FK from `practice_attempts`).
  - `CONSTRAINT ck_skill_gap_shape CHECK (jsonb_typeof(skill_gap) = 'object' AND skill_gap ? 'matchedSkills' AND skill_gap ? 'missingSkills' AND skill_gap ? 'prioritizedLearningPlan')`
- **Indexes:**
  - `CREATE INDEX idx_sessions_user_accessed ON public.interview_sessions(user_id, last_accessed_at DESC);`
  - `CREATE INDEX idx_sessions_resume_id ON public.interview_sessions(resume_id);`
  - `CREATE INDEX idx_sessions_skills ON public.interview_sessions USING GIN(resume_skills);`

---

### 3.4 `public.session_questions`
- **Purpose:** Normalized individual questions generated for or attached to an interview session.
- **Columns:**
  | Column | Data Type | Constraints | Description |
  |---|---|---|---|
  | `id` | `UUID` | Primary Key, Default `gen_random_uuid()` | Unique session question ID |
  | `session_id` | `UUID` | Not Null, `REFERENCES public.interview_sessions(id) ON DELETE CASCADE` | Parent session |
  | `order_index` | `SMALLINT` | Not Null, Check `order_index >= 0` | Display sequence number |
  | `question_text` | `TEXT` | Not Null, Check `length(trim(question_text)) BETWEEN 10 AND 1000` | Question prompt |
  | `focus_skill` | `VARCHAR(80)` | Not Null, Default `''` | Primary skill tested |
  | `tags` | `TEXT[]` | Not Null, Default `'{}'` | Descriptive tags |
  | `difficulty` | `VARCHAR(20)` | Nullable, Check `difficulty IS NULL OR difficulty IN ('Easy', 'Medium', 'Hard', 'Unknown')` | Difficulty rating |
  | `source_type` | `VARCHAR(20)` | Not Null, Default `'generated'`, Check `source_type IN ('generated', 'ml_dataset', 'fallback')` | Generation origin |
  | `relevance_score` | `NUMERIC(4,3)` | Nullable, Check `relevance_score IS NULL OR (relevance_score >= 0.000 AND relevance_score <= 1.000)` | Vector similarity score |
  | `created_at` | `TIMESTAMPTZ` | Not Null, Default `now()` | Generation timestamp |
- **Table Constraints:**
  - `CONSTRAINT uq_session_questions_id_session UNIQUE (id, session_id)` (Required for composite FK from `practice_attempts`).
  - `CONSTRAINT uq_session_questions_order UNIQUE (session_id, order_index)` (Prevents duplicate ordering).
- **Indexes:**
  - `CREATE INDEX idx_session_questions_session_id ON public.session_questions(session_id);`
  - `CREATE INDEX idx_session_questions_tags ON public.session_questions USING GIN(tags);`

---

### 3.5 `public.practice_attempts`
- **Purpose:** Stores candidate practice answers, Gemini AI evaluation, and 4-factor rubric scores.
- **Columns:**
  | Column | Data Type | Constraints | Description |
  |---|---|---|---|
  | `id` | `UUID` | Primary Key, Default `gen_random_uuid()` | Unique attempt ID |
  | `user_id` | `UUID` | Not Null, `REFERENCES public.profiles(id) ON DELETE CASCADE` | Candidate |
  | `session_id` | `UUID` | Nullable | Associated interview session |
  | `question_id` | `UUID` | Nullable | Linked question in session |
  | `question_text` | `TEXT` | Not Null, Check `length(trim(question_text)) >= 10` | The prompt being answered |
  | `answer_text` | `TEXT` | Not Null, Check `length(trim(answer_text)) BETWEEN 10 AND 5000` | Candidate response |
  | `clarity_score` | `SMALLINT` | Not Null, Check `clarity_score BETWEEN 0 AND 10` | Rubric: Clarity |
  | `structure_score` | `SMALLINT` | Not Null, Check `structure_score BETWEEN 0 AND 10` | Rubric: Structure |
  | `depth_score` | `SMALLINT` | Not Null, Check `depth_score BETWEEN 0 AND 10` | Rubric: Technical Depth |
  | `relevance_score` | `SMALLINT` | Not Null, Check `relevance_score BETWEEN 0 AND 10` | Rubric: Relevance |
  | `overall_score` | `SMALLINT` | Not Null, Check `overall_score BETWEEN 0 AND 10` | Composite integer score |
  | `is_match` | `BOOLEAN` | Not Null, Default `false` | True if answer matches question intent |
  | `should_improve` | `BOOLEAN` | Not Null, Default `true` | True if overall score < 8 |
  | `feedback_summary`| `TEXT` | Not Null, Check `length(trim(feedback_summary)) > 0` | Synthesis feedback |
  | `strengths` | `TEXT[]` | Not Null, Default `'{}'` | Bulleted strengths (2-4 items) |
  | `improvements` | `TEXT[]` | Not Null, Default `'{}'` | Bulleted improvements (2-4 items) |
  | `feedback_provider`| `VARCHAR(20)`| Not Null, Default `'gemini'`, Check `feedback_provider IN ('gemini', 'heuristic')` | Scoring engine |
  | `created_at` | `TIMESTAMPTZ` | Not Null, Default `now()` | Attempt timestamp |
- **Table Constraints:**
  - **Multi-Tenant Session Integrity:**  
    `CONSTRAINT fk_practice_session FOREIGN KEY (session_id, user_id) REFERENCES public.interview_sessions(id, user_id) ON DELETE CASCADE`
  - **Question-Session Integrity:**  
    `CONSTRAINT fk_practice_question FOREIGN KEY (question_id, session_id) REFERENCES public.session_questions(id, session_id) ON DELETE SET NULL (question_id)`
- **Indexes:**
  - `CREATE INDEX idx_practice_user_created ON public.practice_attempts(user_id, created_at DESC);`
  - `CREATE INDEX idx_practice_session_id ON public.practice_attempts(session_id);`

---

### 3.6 `public.community_question_submissions`
- **Purpose:** Crowdsourced interview question moderation queue.
- **Columns:**
  | Column | Data Type | Constraints | Description |
  |---|---|---|---|
  | `id` | `UUID` | Primary Key, Default `gen_random_uuid()` | Unique submission ID |
  | `question_text` | `TEXT` | Not Null, Check `length(trim(question_text)) BETWEEN 10 AND 500` | Candidate submitted question |
  | `tags` | `TEXT[]` | Not Null, Default `'{}'` | Topic tags |
  | `company` | `VARCHAR(100)` | Not Null, Default `''` | Company attribution |
  | `seen_in_interview`| `BOOLEAN` | Not Null, Default `false` | Sighting flag |
  | `status` | `VARCHAR(20)` | Not Null, Default `'pending'`, Check `status IN ('pending', 'approved', 'rejected')` | Moderation state |
  | `submitted_by` | `UUID` | Not Null, `REFERENCES public.profiles(id) ON DELETE CASCADE` | Submitter candidate |
  | `reviewed_by` | `UUID` | Nullable, `REFERENCES public.profiles(id) ON DELETE SET NULL` | Reviewing admin |
  | `reviewed_at` | `TIMESTAMPTZ` | Nullable | Moderation timestamp |
  | `admin_note` | `TEXT` | Not Null, Default `''`, Check `length(admin_note) <= 500` | Review note |
  | `created_at` | `TIMESTAMPTZ` | Not Null, Default `now()` | Submission timestamp |
  | `updated_at` | `TIMESTAMPTZ` | Not Null, Default `now()` | Update timestamp |
- **Indexes:**
  - `CREATE INDEX idx_submissions_pending ON public.community_question_submissions(created_at DESC) WHERE status = 'pending';` (Optimized partial index for admin moderation queue).
  - `CREATE INDEX idx_submissions_submitted_by ON public.community_question_submissions(submitted_by, created_at DESC);`
  - `CREATE INDEX idx_submissions_tags ON public.community_question_submissions USING GIN(tags);`

---

### 3.7 `public.questions` (Unified Master Question Bank)
- **Purpose:** Official repository of verified interview questions (including pre-loaded dataset questions, admin-authored questions, and approved community submissions).
- **Columns:**
  | Column | Data Type | Constraints | Description |
  |---|---|---|---|
  | `id` | `UUID` | Primary Key, Default `gen_random_uuid()` | Unique question ID |
  | `question_text` | `TEXT` | Not Null, Check `length(trim(question_text)) BETWEEN 10 AND 500` | Verified interview question text |
  | `topic` | `VARCHAR(80)` | Not Null, Default `'General'` | High-level topic (e.g. "DSA", "OS") |
  | `tags` | `TEXT[]` | Not Null, Default `'{}'` | Granular topic tags |
  | `company` | `VARCHAR(100)` | Not Null, Default `''` | Company attribution |
  | `seen_in_interview`| `BOOLEAN` | Not Null, Default `false` | True if verified interview question |
  | `difficulty` | `VARCHAR(20)` | Nullable, Check `difficulty IS NULL OR difficulty IN ('Easy', 'Medium', 'Hard')` | Difficulty rating |
  | `source_type` | `VARCHAR(30)` | Not Null, Default `'curated_dataset'`, Check `source_type IN ('curated_dataset', 'admin_created', 'community_approved')` | Provenance of question |
  | `source_submission_id`| `UUID` | Nullable, Unique, `REFERENCES public.community_question_submissions(id) ON DELETE SET NULL` | Backlink if approved from community |
  | `approved_by` | `UUID` | Nullable, `REFERENCES public.profiles(id) ON DELETE SET NULL` | Admin who approved or authored |
  | `is_active` | `BOOLEAN` | Not Null, Default `true` | Visibility flag for soft deletion |
  | `created_at` | `TIMESTAMPTZ` | Not Null, Default `now()` | Publication timestamp |
  | `updated_at` | `TIMESTAMPTZ` | Not Null, Default `now()` | Update timestamp |
- **Indexes:**
  - `CREATE INDEX idx_questions_tags ON public.questions USING GIN(tags);`
  - `CREATE INDEX idx_questions_topic_diff ON public.questions(topic, difficulty) WHERE is_active = true;`
  - `CREATE INDEX idx_questions_company ON public.questions(company) WHERE company != '';`

---

## 4. Production-Ready DDL Migration Script

```sql
-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Clean schema namespace
DROP TABLE IF EXISTS public.practice_attempts CASCADE;
DROP TABLE IF EXISTS public.session_questions CASCADE;
DROP TABLE IF EXISTS public.interview_sessions CASCADE;
DROP TABLE IF EXISTS public.resumes CASCADE;
DROP TABLE IF EXISTS public.questions CASCADE;
DROP TABLE IF EXISTS public.community_question_submissions CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- 1. Reusable Trigger Function for updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

-- 2. Profiles Table
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name VARCHAR(100) NOT NULL CHECK (length(trim(full_name)) >= 2),
    role VARCHAR(20) NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    avatar_url TEXT CHECK (avatar_url IS NULL OR avatar_url ~* '^https?://'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_profiles_admin ON public.profiles(id) WHERE role = 'admin';

CREATE TRIGGER trg_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 3. Resumes Table
CREATE TABLE public.resumes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL CHECK (length(trim(file_name)) > 0),
    storage_path TEXT NOT NULL UNIQUE CHECK (storage_path ~* '^[a-f0-9-]+/[a-f0-9-]+\.pdf$'),
    file_size_bytes INTEGER NOT NULL CHECK (file_size_bytes > 0 AND file_size_bytes <= 5242880),
    mime_type VARCHAR(50) NOT NULL DEFAULT 'application/pdf' CHECK (mime_type = 'application/pdf'),
    raw_skills TEXT[] NOT NULL DEFAULT '{}',
    expanded_skills TEXT[] NOT NULL DEFAULT '{}',
    sections_found TEXT[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_resumes_user_id ON public.resumes(user_id);
CREATE INDEX idx_resumes_expanded_skills ON public.resumes USING GIN(expanded_skills);

-- 4. Interview Sessions Table
CREATE TABLE public.interview_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    resume_id UUID REFERENCES public.resumes(id) ON DELETE SET NULL,
    display_name VARCHAR(255) CHECK (display_name IS NULL OR length(trim(display_name)) > 0),
    target_role VARCHAR(120) NOT NULL DEFAULT '',
    target_company VARCHAR(100) NOT NULL DEFAULT '',
    target_level VARCHAR(20) NOT NULL DEFAULT 'mid' CHECK (target_level IN ('intern', 'junior', 'mid', 'senior', 'lead')),
    target_domain VARCHAR(80) NOT NULL DEFAULT '',
    resume_skills TEXT[] NOT NULL DEFAULT '{}',
    skill_gap JSONB NOT NULL DEFAULT '{"matchedSkills":[], "missingSkills":[], "prioritizedLearningPlan":[]}'::jsonb,
    status VARCHAR(20) NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    processing_time_ms INTEGER NOT NULL DEFAULT 0 CHECK (processing_time_ms >= 0),
    last_accessed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_sessions_id_user UNIQUE (id, user_id),
    CONSTRAINT ck_skill_gap_shape CHECK (
        jsonb_typeof(skill_gap) = 'object' AND
        skill_gap ? 'matchedSkills' AND
        skill_gap ? 'missingSkills' AND
        skill_gap ? 'prioritizedLearningPlan'
    )
);
CREATE INDEX idx_sessions_user_accessed ON public.interview_sessions(user_id, last_accessed_at DESC);
CREATE INDEX idx_sessions_resume_id ON public.interview_sessions(resume_id);
CREATE INDEX idx_sessions_skills ON public.interview_sessions USING GIN(resume_skills);

CREATE TRIGGER trg_sessions_updated_at
    BEFORE UPDATE ON public.interview_sessions
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 5. Session Questions Table
CREATE TABLE public.session_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.interview_sessions(id) ON DELETE CASCADE,
    order_index SMALLINT NOT NULL CHECK (order_index >= 0),
    question_text TEXT NOT NULL CHECK (length(trim(question_text)) BETWEEN 10 AND 1000),
    focus_skill VARCHAR(80) NOT NULL DEFAULT '',
    tags TEXT[] NOT NULL DEFAULT '{}',
    difficulty VARCHAR(20) CHECK (difficulty IS NULL OR difficulty IN ('Easy', 'Medium', 'Hard', 'Unknown')),
    source_type VARCHAR(20) NOT NULL DEFAULT 'generated' CHECK (source_type IN ('generated', 'ml_dataset', 'fallback')),
    relevance_score NUMERIC(4,3) CHECK (relevance_score IS NULL OR (relevance_score >= 0.000 AND relevance_score <= 1.000)),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_session_questions_id_session UNIQUE (id, session_id),
    CONSTRAINT uq_session_questions_order UNIQUE (session_id, order_index)
);
CREATE INDEX idx_session_questions_session_id ON public.session_questions(session_id);
CREATE INDEX idx_session_questions_tags ON public.session_questions USING GIN(tags);

-- 6. Practice Attempts Table
CREATE TABLE public.practice_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    session_id UUID,
    question_id UUID,
    question_text TEXT NOT NULL CHECK (length(trim(question_text)) >= 10),
    answer_text TEXT NOT NULL CHECK (length(trim(answer_text)) BETWEEN 10 AND 5000),
    clarity_score SMALLINT NOT NULL CHECK (clarity_score BETWEEN 0 AND 10),
    structure_score SMALLINT NOT NULL CHECK (structure_score BETWEEN 0 AND 10),
    depth_score SMALLINT NOT NULL CHECK (depth_score BETWEEN 0 AND 10),
    relevance_score SMALLINT NOT NULL CHECK (relevance_score BETWEEN 0 AND 10),
    overall_score SMALLINT NOT NULL CHECK (overall_score BETWEEN 0 AND 10),
    is_match BOOLEAN NOT NULL DEFAULT false,
    should_improve BOOLEAN NOT NULL DEFAULT true,
    feedback_summary TEXT NOT NULL CHECK (length(trim(feedback_summary)) > 0),
    strengths TEXT[] NOT NULL DEFAULT '{}',
    improvements TEXT[] NOT NULL DEFAULT '{}',
    feedback_provider VARCHAR(20) NOT NULL DEFAULT 'gemini' CHECK (feedback_provider IN ('gemini', 'heuristic')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_practice_session FOREIGN KEY (session_id, user_id)
        REFERENCES public.interview_sessions(id, user_id) ON DELETE CASCADE,
    CONSTRAINT fk_practice_question FOREIGN KEY (question_id, session_id)
        REFERENCES public.session_questions(id, session_id) ON DELETE SET NULL (question_id)
);
CREATE INDEX idx_practice_user_created ON public.practice_attempts(user_id, created_at DESC);
CREATE INDEX idx_practice_session_id ON public.practice_attempts(session_id);

-- 7. Community Question Submissions Table
CREATE TABLE public.community_question_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_text TEXT NOT NULL CHECK (length(trim(question_text)) BETWEEN 10 AND 500),
    tags TEXT[] NOT NULL DEFAULT '{}',
    company VARCHAR(100) NOT NULL DEFAULT '',
    seen_in_interview BOOLEAN NOT NULL DEFAULT false,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    submitted_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    admin_note TEXT NOT NULL DEFAULT '' CHECK (length(admin_note) <= 500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_submissions_pending ON public.community_question_submissions(created_at DESC) WHERE status = 'pending';
CREATE INDEX idx_submissions_submitted_by ON public.community_question_submissions(submitted_by, created_at DESC);
CREATE INDEX idx_submissions_tags ON public.community_question_submissions USING GIN(tags);

CREATE TRIGGER trg_submissions_updated_at
    BEFORE UPDATE ON public.community_question_submissions
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 8. Unified Questions (Master Question Bank) Table
CREATE TABLE public.questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_text TEXT NOT NULL CHECK (length(trim(question_text)) BETWEEN 10 AND 500),
    topic VARCHAR(80) NOT NULL DEFAULT 'General',
    tags TEXT[] NOT NULL DEFAULT '{}',
    company VARCHAR(100) NOT NULL DEFAULT '',
    seen_in_interview BOOLEAN NOT NULL DEFAULT false,
    difficulty VARCHAR(20) CHECK (difficulty IS NULL OR difficulty IN ('Easy', 'Medium', 'Hard')),
    source_type VARCHAR(30) NOT NULL DEFAULT 'curated_dataset'
        CHECK (source_type IN ('curated_dataset', 'admin_created', 'community_approved')),
    source_submission_id UUID UNIQUE REFERENCES public.community_question_submissions(id) ON DELETE SET NULL,
    approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_questions_tags ON public.questions USING GIN(tags);
CREATE INDEX idx_questions_topic_diff ON public.questions(topic, difficulty) WHERE is_active = true;
CREATE INDEX idx_questions_company ON public.questions(company) WHERE company != '';

CREATE TRIGGER trg_questions_updated_at
    BEFORE UPDATE ON public.questions
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
```
