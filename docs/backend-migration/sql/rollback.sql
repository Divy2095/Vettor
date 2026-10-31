-- ============================================================================
-- VETTOR PLATFORM MIGRATION - FILE: ROLLBACK SCRIPT
-- Description: Completely reverses the Supabase PostgreSQL migration by dropping
--              all created storage policies, RLS policies, triggers, functions,
--              and public application tables in safe reverse-dependency order.
--
-- IMPORTANT STORAGE NOTE:
-- Do NOT execute 'DELETE FROM storage.objects' via SQL. Raw database deletions
-- orphan physical files in the underlying S3/cloud storage backend.
-- Resumes bucket objects must be removed via the Supabase Storage API.
-- See docs/backend-migration/STORAGE_CLEANUP_PROCEDURE.md for the complete
-- 4-step Storage API purge script and instructions.
--
-- Target: Supabase PostgreSQL 15+
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. DROP STORAGE POLICIES & BUCKET
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "resumes_storage_insert_policy" ON storage.objects;
DROP POLICY IF EXISTS "resumes_storage_select_policy" ON storage.objects;
DROP POLICY IF EXISTS "resumes_storage_update_policy" ON storage.objects;
DROP POLICY IF EXISTS "resumes_storage_delete_policy" ON storage.objects;

-- Only delete the resumes bucket record if it is already completely empty.
-- If it still contains objects, leave the bucket intact and warn the operator
-- to purge it via the Supabase Storage API.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'resumes') THEN
        IF NOT EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id = 'resumes') THEN
            DELETE FROM storage.buckets WHERE id = 'resumes';
            RAISE NOTICE 'Storage bucket "resumes" was empty and was deleted successfully.';
        ELSE
            RAISE WARNING 'Storage bucket "resumes" still contains files and was NOT deleted through SQL. Run the Storage API cleanup procedure (docs/backend-migration/STORAGE_CLEANUP_PROCEDURE.md) to purge objects and delete the bucket.';
        END IF;
    END IF;
END;
$$;

-- ----------------------------------------------------------------------------
-- 2. DROP RLS POLICIES ACROSS ALL APPLICATION TABLES
-- ----------------------------------------------------------------------------
-- Profiles
DROP POLICY IF EXISTS "profiles_select_own_or_admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_deny" ON public.profiles;
DROP POLICY IF EXISTS "profiles_delete_admin_only" ON public.profiles;

-- Resumes
DROP POLICY IF EXISTS "resumes_select_own_or_admin" ON public.resumes;
DROP POLICY IF EXISTS "resumes_insert_own" ON public.resumes;
DROP POLICY IF EXISTS "resumes_update_own" ON public.resumes;
DROP POLICY IF EXISTS "resumes_delete_own_or_admin" ON public.resumes;

-- Interview Sessions
DROP POLICY IF EXISTS "sessions_select_own_or_admin" ON public.interview_sessions;
DROP POLICY IF EXISTS "sessions_insert_own" ON public.interview_sessions;
DROP POLICY IF EXISTS "sessions_update_own" ON public.interview_sessions;
DROP POLICY IF EXISTS "sessions_delete_own_or_admin" ON public.interview_sessions;

-- Session Questions
DROP POLICY IF EXISTS "session_questions_select_parent_owner_or_admin" ON public.session_questions;
DROP POLICY IF EXISTS "session_questions_insert_parent_owner" ON public.session_questions;
DROP POLICY IF EXISTS "session_questions_update_parent_owner" ON public.session_questions;
DROP POLICY IF EXISTS "session_questions_delete_parent_owner_or_admin" ON public.session_questions;

-- Practice Attempts
DROP POLICY IF EXISTS "practice_select_own_or_admin" ON public.practice_attempts;
DROP POLICY IF EXISTS "practice_insert_own" ON public.practice_attempts;
DROP POLICY IF EXISTS "practice_update_own" ON public.practice_attempts;
DROP POLICY IF EXISTS "practice_delete_own_or_admin" ON public.practice_attempts;

-- Community Submissions
DROP POLICY IF EXISTS "submissions_select_own_or_admin" ON public.community_question_submissions;
DROP POLICY IF EXISTS "submissions_insert_own" ON public.community_question_submissions;
DROP POLICY IF EXISTS "submissions_update_own_pending_or_admin" ON public.community_question_submissions;
DROP POLICY IF EXISTS "submissions_delete_own_pending_or_admin" ON public.community_question_submissions;

-- Questions (Curated)
DROP POLICY IF EXISTS "questions_select_active_or_admin" ON public.questions;
DROP POLICY IF EXISTS "questions_insert_admin_only" ON public.questions;
DROP POLICY IF EXISTS "questions_update_admin_only" ON public.questions;
DROP POLICY IF EXISTS "questions_delete_admin_only" ON public.questions;

-- ----------------------------------------------------------------------------
-- 3. DROP TRIGGERS
-- ----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
DROP TRIGGER IF EXISTS trg_interview_sessions_updated_at ON public.interview_sessions;
DROP TRIGGER IF EXISTS trg_submissions_updated_at ON public.community_question_submissions;
DROP TRIGGER IF EXISTS trg_questions_updated_at ON public.questions;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS trg_protect_profile_role ON public.profiles;

-- ----------------------------------------------------------------------------
-- 4. DROP FUNCTIONS
-- ----------------------------------------------------------------------------
-- Drop both updated and legacy function signatures for clean idempotence
DROP FUNCTION IF EXISTS public.approve_community_submission(UUID, TEXT, VARCHAR, TEXT[], VARCHAR, VARCHAR, TEXT, UUID);
DROP FUNCTION IF EXISTS public.approve_community_submission(UUID, UUID, TEXT, VARCHAR, TEXT[], VARCHAR, VARCHAR, TEXT);
DROP FUNCTION IF EXISTS public.protect_profile_role();
DROP FUNCTION IF EXISTS public.handle_new_user();
DROP FUNCTION IF EXISTS public.handle_updated_at();
DROP FUNCTION IF EXISTS public.is_admin();

-- ----------------------------------------------------------------------------
-- 5. DROP TABLES IN REVERSE DEPENDENCY ORDER
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS public.practice_attempts CASCADE;
DROP TABLE IF EXISTS public.session_questions CASCADE;
DROP TABLE IF EXISTS public.interview_sessions CASCADE;
DROP TABLE IF EXISTS public.resumes CASCADE;
DROP TABLE IF EXISTS public.questions CASCADE;
DROP TABLE IF EXISTS public.community_question_submissions CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- Notice of completion
DO $$
BEGIN
    RAISE NOTICE 'Rollback complete: All Vettor Supabase tables, policies, triggers, and functions dropped.';
END;
$$;
