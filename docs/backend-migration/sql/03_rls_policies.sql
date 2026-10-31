-- ============================================================================
-- VETTOR PLATFORM MIGRATION - FILE 03: ROW LEVEL SECURITY POLICIES
-- Description: Enables RLS on all 7 application tables and establishes strict
--              ownership and administrative access policies.
-- Target: Supabase PostgreSQL 15+ / 17+
-- ============================================================================

-- ============================================================================
-- 0. ADMIN HELPER FUNCTION
-- ============================================================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(
    (SELECT role = 'admin' FROM public.profiles WHERE id = auth.uid()),
    false
  );
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;

-- ============================================================================
-- 1. PROFILES RLS
-- ============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_own_or_admin" ON public.profiles;
CREATE POLICY "profiles_select_own_or_admin"
    ON public.profiles FOR SELECT
    TO authenticated
    USING (id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own"
    ON public.profiles FOR UPDATE
    TO authenticated
    USING (id = auth.uid() OR public.is_admin())
    WITH CHECK (id = auth.uid() OR public.is_admin());

-- Profile insertion is managed exclusively by on_auth_user_created trigger
DROP POLICY IF EXISTS "profiles_insert_deny" ON public.profiles;
CREATE POLICY "profiles_insert_deny"
    ON public.profiles FOR INSERT
    TO authenticated
    WITH CHECK (false);

DROP POLICY IF EXISTS "profiles_delete_admin_only" ON public.profiles;
CREATE POLICY "profiles_delete_admin_only"
    ON public.profiles FOR DELETE
    TO authenticated
    USING (public.is_admin());

-- ============================================================================
-- 2. RESUMES RLS
-- ============================================================================
ALTER TABLE public.resumes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "resumes_select_own_or_admin" ON public.resumes;
CREATE POLICY "resumes_select_own_or_admin"
    ON public.resumes FOR SELECT
    TO authenticated
    USING (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "resumes_insert_own" ON public.resumes;
CREATE POLICY "resumes_insert_own"
    ON public.resumes FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "resumes_update_own" ON public.resumes;
CREATE POLICY "resumes_update_own"
    ON public.resumes FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "resumes_delete_own_or_admin" ON public.resumes;
CREATE POLICY "resumes_delete_own_or_admin"
    ON public.resumes FOR DELETE
    TO authenticated
    USING (user_id = auth.uid() OR public.is_admin());

-- ============================================================================
-- 3. INTERVIEW SESSIONS RLS
-- ============================================================================
ALTER TABLE public.interview_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sessions_select_own_or_admin" ON public.interview_sessions;
CREATE POLICY "sessions_select_own_or_admin"
    ON public.interview_sessions FOR SELECT
    TO authenticated
    USING (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "sessions_insert_own" ON public.interview_sessions;
CREATE POLICY "sessions_insert_own"
    ON public.interview_sessions FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "sessions_update_own" ON public.interview_sessions;
CREATE POLICY "sessions_update_own"
    ON public.interview_sessions FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "sessions_delete_own_or_admin" ON public.interview_sessions;
CREATE POLICY "sessions_delete_own_or_admin"
    ON public.interview_sessions FOR DELETE
    TO authenticated
    USING (user_id = auth.uid() OR public.is_admin());

-- ============================================================================
-- 4. SESSION QUESTIONS RLS
-- ============================================================================
ALTER TABLE public.session_questions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "session_questions_select_parent_owner_or_admin" ON public.session_questions;
CREATE POLICY "session_questions_select_parent_owner_or_admin"
    ON public.session_questions FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.interview_sessions s
            WHERE s.id = session_id AND s.user_id = auth.uid()
        ) OR public.is_admin()
    );

DROP POLICY IF EXISTS "session_questions_insert_parent_owner" ON public.session_questions;
CREATE POLICY "session_questions_insert_parent_owner"
    ON public.session_questions FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.interview_sessions s
            WHERE s.id = session_id AND s.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "session_questions_update_parent_owner" ON public.session_questions;
CREATE POLICY "session_questions_update_parent_owner"
    ON public.session_questions FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.interview_sessions s
            WHERE s.id = session_id AND s.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.interview_sessions s
            WHERE s.id = session_id AND s.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "session_questions_delete_parent_owner_or_admin" ON public.session_questions;
CREATE POLICY "session_questions_delete_parent_owner_or_admin"
    ON public.session_questions FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.interview_sessions s
            WHERE s.id = session_id AND s.user_id = auth.uid()
        ) OR public.is_admin()
    );

-- ============================================================================
-- 5. PRACTICE ATTEMPTS RLS
-- ============================================================================
ALTER TABLE public.practice_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "practice_select_own_or_admin" ON public.practice_attempts;
CREATE POLICY "practice_select_own_or_admin"
    ON public.practice_attempts FOR SELECT
    TO authenticated
    USING (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "practice_insert_own" ON public.practice_attempts;
CREATE POLICY "practice_insert_own"
    ON public.practice_attempts FOR INSERT
    TO authenticated
    WITH CHECK (
        user_id = auth.uid() AND (
            session_id IS NULL OR EXISTS (
                SELECT 1 FROM public.interview_sessions s
                WHERE s.id = session_id AND s.user_id = auth.uid()
            )
        )
    );

DROP POLICY IF EXISTS "practice_update_own" ON public.practice_attempts;
CREATE POLICY "practice_update_own"
    ON public.practice_attempts FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "practice_delete_own_or_admin" ON public.practice_attempts;
CREATE POLICY "practice_delete_own_or_admin"
    ON public.practice_attempts FOR DELETE
    TO authenticated
    USING (user_id = auth.uid() OR public.is_admin());

-- ============================================================================
-- 6. COMMUNITY QUESTION SUBMISSIONS RLS
-- ============================================================================
ALTER TABLE public.community_question_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "submissions_select_own_or_admin" ON public.community_question_submissions;
CREATE POLICY "submissions_select_own_or_admin"
    ON public.community_question_submissions FOR SELECT
    TO authenticated
    USING (submitted_by = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "submissions_insert_own" ON public.community_question_submissions;
CREATE POLICY "submissions_insert_own"
    ON public.community_question_submissions FOR INSERT
    TO authenticated
    WITH CHECK (submitted_by = auth.uid() AND status = 'pending');

DROP POLICY IF EXISTS "submissions_update_own_pending_or_admin" ON public.community_question_submissions;
CREATE POLICY "submissions_update_own_pending_or_admin"
    ON public.community_question_submissions FOR UPDATE
    TO authenticated
    USING (
        (submitted_by = auth.uid() AND status = 'pending') OR public.is_admin()
    )
    WITH CHECK (
        (submitted_by = auth.uid() AND status = 'pending') OR public.is_admin()
    );

DROP POLICY IF EXISTS "submissions_delete_own_pending_or_admin" ON public.community_question_submissions;
CREATE POLICY "submissions_delete_own_pending_or_admin"
    ON public.community_question_submissions FOR DELETE
    TO authenticated
    USING (
        (submitted_by = auth.uid() AND status = 'pending') OR public.is_admin()
    );

-- ============================================================================
-- 7. QUESTIONS (MASTER QUESTION BANK) RLS
-- ============================================================================
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;

-- Candidates can view all active questions
DROP POLICY IF EXISTS "questions_select_active_or_admin" ON public.questions;
CREATE POLICY "questions_select_active_or_admin"
    ON public.questions FOR SELECT
    TO authenticated
    USING (is_active = true OR public.is_admin());

DROP POLICY IF EXISTS "questions_insert_admin_only" ON public.questions;
CREATE POLICY "questions_insert_admin_only"
    ON public.questions FOR INSERT
    TO authenticated
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "questions_update_admin_only" ON public.questions;
CREATE POLICY "questions_update_admin_only"
    ON public.questions FOR UPDATE
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "questions_delete_admin_only" ON public.questions;
CREATE POLICY "questions_delete_admin_only"
    ON public.questions FOR DELETE
    TO authenticated
    USING (public.is_admin());
