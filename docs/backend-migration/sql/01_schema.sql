-- ============================================================================
-- VETTOR PLATFORM MIGRATION - FILE 01: CORE SCHEMA
-- Description: Creates extensions, core tables, constraints, foreign keys, and indexes.
-- Target: Supabase PostgreSQL 15+
-- ============================================================================

-- Enable required cryptographic extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. PROFILES TABLE
-- Extends Supabase auth.users with application-specific metadata.
-- ============================================================================
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name VARCHAR(100) NOT NULL CHECK (length(trim(full_name)) >= 2),
    role VARCHAR(20) NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    avatar_url TEXT CHECK (avatar_url IS NULL OR avatar_url ~* '^https?://'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Partial index for high-speed admin resolution
CREATE INDEX idx_profiles_admin ON public.profiles(id) WHERE role = 'admin';

COMMENT ON TABLE public.profiles IS 'Application user profiles extending Supabase auth.users';
COMMENT ON COLUMN public.profiles.role IS 'User authorization level: user or admin';

-- ============================================================================
-- 2. RESUMES TABLE
-- Stores metadata and Supabase Storage paths for uploaded resume PDFs.
-- Multiple resumes per candidate are supported.
-- ============================================================================
CREATE TABLE public.resumes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL CHECK (length(trim(file_name)) > 0),
    storage_path TEXT NOT NULL UNIQUE CHECK (storage_path ~* '^[a-f0-9-]+/[a-f0-9-]+\\.pdf$'),
    file_size_bytes INTEGER NOT NULL CHECK (file_size_bytes > 0 AND file_size_bytes <= 5242880),
    mime_type VARCHAR(50) NOT NULL DEFAULT 'application/pdf' CHECK (mime_type = 'application/pdf'),
    raw_skills TEXT[] NOT NULL DEFAULT '{}',
    expanded_skills TEXT[] NOT NULL DEFAULT '{}',
    sections_found TEXT[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_resumes_user_id ON public.resumes(user_id);
CREATE INDEX idx_resumes_expanded_skills ON public.resumes USING GIN(expanded_skills);

COMMENT ON TABLE public.resumes IS 'Candidate uploaded resume documents and extracted skills';
COMMENT ON COLUMN public.resumes.storage_path IS 'S3 storage path in private resumes bucket: <user_id>/<resume_id>.pdf';

-- ============================================================================
-- 3. INTERVIEW SESSIONS TABLE
-- Central container for interview preparation sessions (unifies UserSession and
-- QuestionGenerationSession). Each session references its selected resume.
-- ============================================================================
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
    
    -- Composite unique constraint required for cross-user isolation in practice attempts
    CONSTRAINT uq_interview_sessions_id_user UNIQUE (id, user_id),
    
    -- Schema validation for skill gap analytical snapshot
    CONSTRAINT ck_interview_sessions_skill_gap CHECK (
        jsonb_typeof(skill_gap) = 'object' AND
        skill_gap ? 'matchedSkills' AND
        skill_gap ? 'missingSkills' AND
        skill_gap ? 'prioritizedLearningPlan'
    )
);

CREATE INDEX idx_sessions_user_accessed ON public.interview_sessions(user_id, last_accessed_at DESC);
CREATE INDEX idx_sessions_resume_id ON public.interview_sessions(resume_id);
CREATE INDEX idx_sessions_skills ON public.interview_sessions USING GIN(resume_skills);

COMMENT ON TABLE public.interview_sessions IS 'Interview preparation sessions configured for target roles and resumes';

-- ============================================================================
-- 4. SESSION QUESTIONS TABLE
-- Normalized list of questions generated for or attached to an interview session.
-- ============================================================================
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
    
    -- Composite unique constraints for relational integrity and display sequence
    CONSTRAINT uq_session_questions_id_session UNIQUE (id, session_id),
    CONSTRAINT uq_session_questions_order UNIQUE (session_id, order_index)
);

CREATE INDEX idx_session_questions_session_id ON public.session_questions(session_id);
CREATE INDEX idx_session_questions_tags ON public.session_questions USING GIN(tags);

COMMENT ON TABLE public.session_questions IS 'Specific questions generated for an interview session';

-- ============================================================================
-- 5. PRACTICE ATTEMPTS TABLE
-- Stores candidate responses, Gemini AI analysis, and 4-factor scoring rubrics.
-- Guarantees user isolation via composite foreign keys.
-- ============================================================================
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

    -- Enforce that session_id strictly belongs to the same user_id
    CONSTRAINT fk_practice_session FOREIGN KEY (session_id, user_id)
        REFERENCES public.interview_sessions(id, user_id) ON DELETE CASCADE,

    -- Enforce that question_id strictly belongs to the same session_id.
    -- In PostgreSQL 15+, ON DELETE SET NULL (question_id) specifically nullifies ONLY
    -- the question_id column when a session question is deleted, preserving the session_id and user linkage.
    CONSTRAINT fk_practice_question FOREIGN KEY (question_id, session_id)
        REFERENCES public.session_questions(id, session_id) ON DELETE SET NULL (question_id)
);

CREATE INDEX idx_practice_user_created ON public.practice_attempts(user_id, created_at DESC);
CREATE INDEX idx_practice_session_id ON public.practice_attempts(session_id);

COMMENT ON TABLE public.practice_attempts IS 'Candidate practice answers and AI evaluation feedback';

-- ============================================================================
-- 6. COMMUNITY QUESTION SUBMISSIONS TABLE
-- Crowdsourced questions submitted by candidates pending admin review.
-- ============================================================================
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

-- Optimized partial index for pending moderation queue
CREATE INDEX idx_submissions_pending ON public.community_question_submissions(created_at DESC) WHERE status = 'pending';
CREATE INDEX idx_submissions_submitted_by ON public.community_question_submissions(submitted_by, created_at DESC);
CREATE INDEX idx_submissions_tags ON public.community_question_submissions USING GIN(tags);

COMMENT ON TABLE public.community_question_submissions IS 'Crowdsourced interview questions awaiting admin moderation';

-- ============================================================================
-- 7. QUESTIONS TABLE (MASTER CURATED QUESTION BANK)
-- Verified question repository. Combines initial dataset, admin-authored questions,
-- and approved community questions.
-- ============================================================================
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

COMMENT ON TABLE public.questions IS 'Master curated interview question bank';
