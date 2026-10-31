-- ============================================================================
-- VETTOR PLATFORM MIGRATION - FILE 02: FUNCTIONS AND TRIGGERS
-- Description: Automates timestamp maintenance, safe profile provisioning,
--              role protection, admin verification, and atomic question approval workflows.
-- Target: Supabase PostgreSQL 15+ / 17+
-- ============================================================================

-- ============================================================================
-- 1. REUSABLE UPDATED_AT TRIGGER FUNCTION
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

-- Attach updated_at triggers to all mutable tables (idempotent trigger creation)
CREATE OR REPLACE TRIGGER trg_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE OR REPLACE TRIGGER trg_interview_sessions_updated_at
    BEFORE UPDATE ON public.interview_sessions
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE OR REPLACE TRIGGER trg_submissions_updated_at
    BEFORE UPDATE ON public.community_question_submissions
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE OR REPLACE TRIGGER trg_questions_updated_at
    BEFORE UPDATE ON public.questions
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================================
-- 2. SAFE PROFILE CREATION TRIGGER (AUTH HOOK)
-- Securely creates a profile row upon Supabase Auth registration.
-- Hardcodes role = 'user' to eliminate any possibility of client metadata injection.
-- Uses SECURITY DEFINER with fixed search_path to prevent path hijacking.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, role)
    VALUES (
        NEW.id,
        COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'full_name'), ''), 'Vettor Candidate'),
        'user' -- Strictly force 'user'. Never trust client metadata for roles!
    );
    RETURN NEW;
END;
$$;

-- Trigger firing on every new Supabase Auth user creation
CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- 3. ADMIN HELPER FUNCTION
-- Checks whether the current caller has role = 'admin' in public.profiles.
-- SECURITY DEFINER and STABLE with fixed search_path avoids RLS recursion.
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

COMMENT ON FUNCTION public.is_admin IS 'Returns true if the authenticated caller has the admin role in public.profiles.';

-- ============================================================================
-- 4. ROLE PROTECTION & PRIVILEGE ESCALATION PREVENTION
-- Prevents ordinary users from elevating themselves to admin via client updates.
-- Synchronizes role changes to Supabase Auth app_metadata for JWT claims.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.protect_profile_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    is_caller_admin BOOLEAN;
BEGIN
    -- Only evaluate if the role column is actually changing
    IF NEW.role IS DISTINCT FROM OLD.role THEN
        -- Check if caller is service_role or an existing admin.
        -- Explicit COALESCE and IS TRUE ensure NULL can never result in authorization being granted.
        is_caller_admin := (
            COALESCE(auth.role(), '') = 'service_role' OR
            (public.is_admin() IS TRUE)
        );

        IF is_caller_admin IS NOT TRUE THEN
            RAISE EXCEPTION 'Access Denied: Only administrators can modify user roles.'
                USING ERRCODE = '42501';
        END IF;

        -- Synchronize the new role to auth.users.raw_app_meta_data so it appears in future JWTs
        UPDATE auth.users
        SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', NEW.role)
        WHERE id = NEW.id;
    END IF;

    RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_protect_profile_role
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.protect_profile_role();

-- ============================================================================
-- 5. ATOMIC QUESTION APPROVAL WITH ADMIN EDITING SUPPORT
-- Implements Decision #2: Admins can polish/edit questions prior to approval.
-- Strictly authorizes authenticated callers via public.is_admin() and binds
-- the reviewer to auth.uid(). Trusted backend service-role calls can optionally
-- provide p_service_reviewer_id.
-- Executes within an atomic database transaction.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.approve_community_submission(
    p_submission_id UUID,
    p_question_text TEXT DEFAULT NULL,
    p_topic VARCHAR DEFAULT NULL,
    p_tags TEXT[] DEFAULT NULL,
    p_company VARCHAR DEFAULT NULL,
    p_difficulty VARCHAR DEFAULT NULL,
    p_admin_note TEXT DEFAULT '',
    p_service_reviewer_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_reviewer_id UUID;
    v_sub RECORD;
    v_new_question_id UUID;
    v_final_question_text TEXT;
    v_final_topic VARCHAR;
    v_final_tags TEXT[];
    v_final_company VARCHAR;
    v_final_difficulty VARCHAR;
BEGIN
    -- 1. Authorization Check:
    -- If caller is service_role (trusted backend code/scripts), allow p_service_reviewer_id.
    -- If caller is authenticated user, verify caller is admin using public.is_admin() IS TRUE
    -- and strictly bind reviewer ID to auth.uid(). An ordinary user cannot spoof or authorize themselves.
    IF COALESCE(auth.role(), '') = 'service_role' THEN
        v_reviewer_id := p_service_reviewer_id;
    ELSIF (public.is_admin() IS TRUE) THEN
        v_reviewer_id := auth.uid();
    ELSE
        RAISE EXCEPTION 'Access Denied: Only administrators can approve submissions.'
            USING ERRCODE = '42501';
    END IF;

    -- 2. Fetch and lock the submission row
    SELECT * INTO v_sub
    FROM public.community_question_submissions
    WHERE id = p_submission_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Submission % not found', p_submission_id
            USING ERRCODE = 'P0002';
    END IF;

    IF v_sub.status != 'pending' THEN
        RAISE EXCEPTION 'Submission % has already been reviewed (status: %)', p_submission_id, v_sub.status
            USING ERRCODE = '23505';
    END IF;

    -- 3. Resolve final values (use admin overrides if provided, otherwise original submission values)
    v_final_question_text := COALESCE(NULLIF(trim(p_question_text), ''), v_sub.question_text);
    v_final_topic         := COALESCE(NULLIF(trim(p_topic), ''), 'General');
    v_final_tags          := COALESCE(p_tags, v_sub.tags);
    v_final_company       := COALESCE(p_company, v_sub.company);
    v_final_difficulty    := p_difficulty; -- Can be null or 'Easy', 'Medium', 'Hard'

    -- 4. Insert into the master curated question bank
    INSERT INTO public.questions (
        question_text,
        topic,
        tags,
        company,
        seen_in_interview,
        difficulty,
        source_type,
        source_submission_id,
        approved_by,
        is_active
    ) VALUES (
        v_final_question_text,
        v_final_topic,
        v_final_tags,
        v_final_company,
        v_sub.seen_in_interview,
        v_final_difficulty,
        'community_approved',
        v_sub.id,
        v_reviewer_id,
        true
    )
    RETURNING id INTO v_new_question_id;

    -- 5. Mark the submission as approved
    UPDATE public.community_question_submissions
    SET status = 'approved',
        reviewed_by = v_reviewer_id,
        reviewed_at = now(),
        admin_note = COALESCE(p_admin_note, '')
    WHERE id = p_submission_id;

    RETURN v_new_question_id;
END;
$$;

-- Explicitly revoke execution from public/anon and grant only to authenticated and service_role
REVOKE ALL ON FUNCTION public.approve_community_submission(UUID, TEXT, VARCHAR, TEXT[], VARCHAR, VARCHAR, TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_community_submission(UUID, TEXT, VARCHAR, TEXT[], VARCHAR, VARCHAR, TEXT, UUID) TO authenticated, service_role;

COMMENT ON FUNCTION public.approve_community_submission IS 'Atomically approves a community question submission, applies optional admin edits, and publishes it to the master question bank.';
