-- ============================================================================
-- VETTOR PLATFORM — MIGRATION 07: SCHEMA ENHANCEMENTS & COMPATIBILITY
-- Description: Adds error tracking to interview_sessions and enriches session_questions
--              with topic and ML ranking scores (tag_score, combined_score)
--              to preserve full parity with Python ML and React frontend contracts.
-- Idempotent & Non-Destructive.
-- Target: PostgreSQL 17+ (Supabase)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. ENHANCE INTERVIEW SESSIONS WITH ERROR TRACKING
-- Allows asynchronous processing failures in resumeController and ML pipeline
-- to persist human-readable error messages for client status polling.
-- ----------------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'interview_sessions' 
          AND column_name = 'error_message'
    ) THEN
        ALTER TABLE public.interview_sessions 
        ADD COLUMN error_message TEXT DEFAULT NULL;

        COMMENT ON COLUMN public.interview_sessions.error_message IS 
        'Detailed diagnostic message when status = failed during asynchronous processing';
    END IF;
END;
$$;

-- ----------------------------------------------------------------------------
-- 2. ENHANCE SESSION QUESTIONS WITH TOPIC & ML RANKING METRICS
-- Retains domain topic categorisation and full breakdown of ML scoring factors:
-- relevance_score  -> semantic similarity score (cosine distance)
-- tag_score        -> entity tag matching overlap (0.0 to 1.0)
-- combined_score   -> weighted final score used for percentage match display
-- ----------------------------------------------------------------------------
DO $$
BEGIN
    -- Add topic column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'session_questions' 
          AND column_name = 'topic'
    ) THEN
        ALTER TABLE public.session_questions 
        ADD COLUMN topic VARCHAR(100) NOT NULL DEFAULT 'General';

        COMMENT ON COLUMN public.session_questions.topic IS 
        'Technical domain or category (e.g., React, System Design, Networking)';
    END IF;

    -- Add tag_score column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'session_questions' 
          AND column_name = 'tag_score'
    ) THEN
        ALTER TABLE public.session_questions 
        ADD COLUMN tag_score NUMERIC(4,3) DEFAULT NULL
        CHECK (tag_score IS NULL OR (tag_score >= 0.000 AND tag_score <= 1.000));

        COMMENT ON COLUMN public.session_questions.tag_score IS 
        'Proportion of matched entity tags (0.000 to 1.000) from resume skills';
    END IF;

    -- Add combined_score column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'session_questions' 
          AND column_name = 'combined_score'
    ) THEN
        ALTER TABLE public.session_questions 
        ADD COLUMN combined_score NUMERIC(4,3) DEFAULT NULL
        CHECK (combined_score IS NULL OR (combined_score >= 0.000 AND combined_score <= 1.000));

        COMMENT ON COLUMN public.session_questions.combined_score IS 
        'Weighted combination of semantic relevance and tag overlap score';
    END IF;
END;
$$;

-- Create index on topic for faster faceted filtering
CREATE INDEX IF NOT EXISTS idx_session_questions_topic 
ON public.session_questions(session_id, topic);
