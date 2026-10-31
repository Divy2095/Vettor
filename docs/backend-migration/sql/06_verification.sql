-- ============================================================================
-- VETTOR PLATFORM MIGRATION - FILE 06: VERIFICATION & SECURITY TEST SCRIPT
-- Description: Comprehensive verification script testing schema integrity,
--              composite foreign keys, triggers, and multi-tenant RLS boundaries.
--              Explicitly separates Superuser Constraint tests from Authenticated
--              RLS simulation tests (using SET LOCAL ROLE authenticated and JWT claims).
--              Provisions test users dynamically via auth.users to trigger
--              the public.handle_new_user() hook and protect existing accounts.
-- Target: Supabase PostgreSQL 15+ / 17+
-- ============================================================================

-- ============================================================================
-- SECTION A: SUPERUSER SCHEMA, TRIGGER & CONSTRAINT VALIDATION
-- Executed as postgres (superuser) to verify table structure and constraints.
-- Dynamically generates unique test UUIDs and emails to guarantee zero collision
-- with existing accounts, and guarantees complete cleanup on success or failure.
-- ============================================================================
DO $$
DECLARE
    v_count INTEGER;
    -- Generate dynamic run-specific UUIDs to guarantee zero collision with real accounts
    v_user_a UUID := gen_random_uuid();
    v_user_b UUID := gen_random_uuid();
    v_user_a_email VARCHAR := 'test_a_' || replace(v_user_a::text, '-', '') || '@vettor.local';
    v_user_b_email VARCHAR := 'test_b_' || replace(v_user_b::text, '-', '') || '@vettor.local';
    v_session_a UUID := gen_random_uuid();
    v_question_a UUID := gen_random_uuid();
    v_attempt_id UUID := gen_random_uuid();
    v_q_id_after_delete UUID;
    v_s_id_after_delete UUID;
BEGIN
    RAISE NOTICE '============================================================';
    RAISE NOTICE 'STARTING SECTION A: SUPERUSER SCHEMA & CONSTRAINT TESTS';
    RAISE NOTICE '============================================================';

    -- Wrap all Section A tests in an inner block so that cleanup ALWAYS executes,
    -- even if an unexpected assertion or check failure occurs.
    BEGIN
        -- --------------------------------------------------------------------
        -- TEST A.1: VERIFY ALL 7 APPLICATION TABLES HAVE RLS ENABLED
        -- --------------------------------------------------------------------
        SELECT count(*) INTO v_count
        FROM pg_tables t
        JOIN pg_class c ON c.relname = t.tablename
        WHERE t.schemaname = 'public'
          AND t.tablename IN (
              'profiles', 'resumes', 'interview_sessions',
              'session_questions', 'practice_attempts',
              'community_question_submissions', 'questions'
          )
          AND c.relrowsecurity = true;

        IF v_count != 7 THEN
            RAISE EXCEPTION 'TEST A.1 FAILED: Expected 7 tables with RLS enabled, found %', v_count;
        END IF;
        RAISE NOTICE '✓ TEST A.1 PASSED: All 7 application tables have RLS enabled.';

        -- Provision temporary auth user for User A via auth.users.
        -- The on_auth_user_created trigger automatically provisions the profile row in public.profiles.
        INSERT INTO auth.users (
            id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
            raw_app_meta_data, raw_user_meta_data, created_at, updated_at
        ) VALUES (
            v_user_a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
            v_user_a_email, '$2a$10$abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJK', now(),
            '{"provider":"email","providers":["email"]}'::jsonb,
            '{"full_name":"Constraint Test User"}'::jsonb,
            now(), now()
        );

        -- --------------------------------------------------------------------
        -- TEST A.2: VERIFY SKILL GAP CHECK CONSTRAINT REJECTS INVALID JSON
        -- --------------------------------------------------------------------
        BEGIN
            INSERT INTO public.interview_sessions (
                id, user_id, target_role, skill_gap
            ) VALUES (
                gen_random_uuid(), v_user_a, 'Software Engineer', '{"invalidStructure": true}'::jsonb
            );
            RAISE EXCEPTION 'TEST A.2 FAILED: Invalid skill_gap JSON was accepted by CHECK constraint!';
        EXCEPTION
            WHEN check_violation THEN
                RAISE NOTICE '✓ TEST A.2 PASSED: Malformed skill_gap JSON was rejected by CHECK constraint.';
        END;

        -- --------------------------------------------------------------------
        -- TEST A.3: VERIFY COMPOSITE FOREIGN KEY BLOCKS CROSS-USER ATTEMPTS
        -- --------------------------------------------------------------------
        -- Provision temporary auth user for User B (on_auth_user_created trigger provisions profile)
        INSERT INTO auth.users (
            id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
            raw_app_meta_data, raw_user_meta_data, created_at, updated_at
        ) VALUES (
            v_user_b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
            v_user_b_email, '$2a$10$abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJK', now(),
            '{"provider":"email","providers":["email"]}'::jsonb,
            '{"full_name":"Second Test User"}'::jsonb,
            now(), now()
        );

        -- Create valid session for User A
        INSERT INTO public.interview_sessions (
            id, user_id, target_role, skill_gap
        ) VALUES (
            v_session_a, v_user_a, 'Backend Engineer',
            '{"matchedSkills":[], "missingSkills":[], "prioritizedLearningPlan":[]}'::jsonb
        );

        -- Create question inside User A's session
        INSERT INTO public.session_questions (
            id, session_id, order_index, question_text, focus_skill
        ) VALUES (
            v_question_a, v_session_a, 0, 'Explain database indexing mechanisms.', 'PostgreSQL'
        );

        -- User B tries to record practice attempt linking User A's session
        BEGIN
            INSERT INTO public.practice_attempts (
                id, user_id, session_id, question_id, question_text, answer_text,
                clarity_score, structure_score, depth_score, relevance_score, overall_score,
                feedback_summary
            ) VALUES (
                gen_random_uuid(), v_user_b, v_session_a, v_question_a,
                'Explain database indexing mechanisms.', 'B-trees provide logarithmic lookups.',
                8, 8, 8, 8, 8, 'Accurate response.'
            );
            RAISE EXCEPTION 'TEST A.3 FAILED: Cross-user session link was accepted!';
        EXCEPTION
            WHEN foreign_key_violation THEN
                RAISE NOTICE '✓ TEST A.3 PASSED: Cross-user session referencing blocked by composite foreign key.';
        END;

        -- --------------------------------------------------------------------
        -- TEST A.4: VERIFY FK-01 (ON DELETE SET NULL ONLY NULLIFIES question_id)
        -- --------------------------------------------------------------------
        -- Insert legitimate practice attempt for User A
        INSERT INTO public.practice_attempts (
            id, user_id, session_id, question_id, question_text, answer_text,
            clarity_score, structure_score, depth_score, relevance_score, overall_score,
            feedback_summary
        ) VALUES (
            v_attempt_id, v_user_a, v_session_a, v_question_a,
            'Explain database indexing mechanisms.', 'B-trees provide logarithmic lookups.',
            9, 8, 9, 9, 9, 'Great explanation.'
        );

        -- Delete the session question
        DELETE FROM public.session_questions WHERE id = v_question_a;

        -- Verify that question_id is set to NULL while session_id and user_id remain intact
        SELECT question_id, session_id INTO v_q_id_after_delete, v_s_id_after_delete
        FROM public.practice_attempts
        WHERE id = v_attempt_id;

        IF v_q_id_after_delete IS NOT NULL THEN
            RAISE EXCEPTION 'TEST A.4 FAILED: question_id was not set to NULL after question deletion!';
        END IF;

        IF v_s_id_after_delete IS DISTINCT FROM v_session_a THEN
            RAISE EXCEPTION 'TEST A.4 FAILED: session_id was improperly modified or nullified!';
        END IF;
        RAISE NOTICE '✓ TEST A.4 PASSED: FK-01 verified. Deleting session question nullifies question_id and preserves session_id.';

    EXCEPTION WHEN OTHERS THEN
        -- Defensive cleanup on test failure: delete only the temporary records created in this run
        DELETE FROM public.practice_attempts WHERE id = v_attempt_id;
        DELETE FROM public.session_questions WHERE id = v_question_a;
        DELETE FROM public.interview_sessions WHERE id = v_session_a;
        DELETE FROM auth.users WHERE id IN (v_user_a, v_user_b);
        RAISE; -- Re-throw the exception so failure details are reported to operator
    END;

    -- Clean up Section A temporary rows on success (deleting auth.users cascades to public.profiles)
    DELETE FROM public.practice_attempts WHERE id = v_attempt_id;
    DELETE FROM public.session_questions WHERE id = v_question_a;
    DELETE FROM public.interview_sessions WHERE id = v_session_a;
    DELETE FROM auth.users WHERE id IN (v_user_a, v_user_b);

    RAISE NOTICE '✓ SECTION A COMPLETE: All superuser schema and constraint validations passed.';
END;
$$;

-- ============================================================================
-- SECTION B: AUTHENTICATED MULTI-TENANT ROW LEVEL SECURITY SIMULATION
-- Runs inside a transaction simulating actual frontend requests with JWT claims.
-- Uses isolated rollback to ensure complete discarding of all created records.
-- ============================================================================
BEGIN;

-- 1. Setup test identities in auth.users
-- The on_auth_user_created trigger automatically provisions the profile row in public.profiles.
INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES
    ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'alice_verification_test@vettor.local', '$2a$10$abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJK', now(),
     '{"provider":"email","providers":["email"]}'::jsonb,
     '{"full_name":"Candidate Alice"}'::jsonb, now(), now()),
    ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'bob_verification_test@vettor.local', '$2a$10$abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJK', now(),
     '{"provider":"email","providers":["email"]}'::jsonb,
     '{"full_name":"Candidate Bob"}'::jsonb, now(), now()),
    ('33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'charlie_verification_test@vettor.local', '$2a$10$abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJK', now(),
     '{"provider":"email","providers":["email"]}'::jsonb,
     '{"full_name":"Administrator Charlie"}'::jsonb, now(), now());

-- 2. Promote Charlie to admin under simulated service_role context
-- (handle_new_user defaults all roles to 'user' for security; this simulates trusted backend promotion)
SET LOCAL "request.jwt.claim.role" = 'service_role';
UPDATE public.profiles
SET role = 'admin'
WHERE id = '33333333-3333-3333-3333-333333333333';

-- Immediately reset simulated role back to 'authenticated' to prevent permission leakage
SET LOCAL "request.jwt.claim.role" = 'authenticated';

-- 3. Alice's session and question
INSERT INTO public.interview_sessions (id, user_id, target_role, skill_gap)
VALUES (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '11111111-1111-1111-1111-111111111111',
    'Full Stack Engineer',
    '{"matchedSkills":["React"], "missingSkills":["Go"], "prioritizedLearningPlan":["Study Go"]}'::jsonb
);

INSERT INTO public.session_questions (id, session_id, order_index, question_text, focus_skill)
VALUES (
    'aaaaaaaa-aaaa-aaaa-aaaa-111111111111',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    0,
    'Explain React virtual DOM reconciliation.',
    'React'
);

-- 4. Bob's session
INSERT INTO public.interview_sessions (id, user_id, target_role, skill_gap)
VALUES (
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    '22222222-2222-2222-2222-222222222222',
    'Data Engineer',
    '{"matchedSkills":["SQL"], "missingSkills":["Spark"], "prioritizedLearningPlan":["Study Spark"]}'::jsonb
);

-- 5. Alice's pending community submission
INSERT INTO public.community_question_submissions (id, question_text, tags, company, submitted_by, status)
VALUES (
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    'What is the difference between TCP and UDP?',
    ARRAY['networking'],
    'Cisco',
    '11111111-1111-1111-1111-111111111111',
    'pending'
);

-- ----------------------------------------------------------------------------
-- 6. SWITCH ROLE TO AUTHENTICATED AS ALICE (Candidate)
-- ----------------------------------------------------------------------------
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';
SET LOCAL "request.jwt.claim.role" = 'authenticated';

DO $$
DECLARE
    v_alice_sessions_count INTEGER;
    v_bob_sessions_seen INTEGER;
    v_updated_rows INTEGER;
BEGIN
    RAISE NOTICE '============================================================';
    RAISE NOTICE 'STARTING SECTION B: AUTHENTICATED RLS SIMULATION (ALICE)';
    RAISE NOTICE '============================================================';

    -- TEST B.1: Alice can SELECT her own session
    SELECT count(*) INTO v_alice_sessions_count
    FROM public.interview_sessions
    WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

    IF v_alice_sessions_count != 1 THEN
        RAISE EXCEPTION 'TEST B.1 FAILED: Alice cannot select her own session!';
    END IF;
    RAISE NOTICE '✓ TEST B.1 PASSED: Alice can view her own interview session.';

    -- TEST B.2: Alice is isolated from Bob's session by RLS (SELECT returns 0 rows)
    SELECT count(*) INTO v_bob_sessions_seen
    FROM public.interview_sessions
    WHERE id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

    IF v_bob_sessions_seen != 0 THEN
        RAISE EXCEPTION 'TEST B.2 FAILED: Alice was able to view Bob''s session via RLS leak!';
    END IF;
    RAISE NOTICE '✓ TEST B.2 PASSED: Alice cannot see Bob''s session (RLS filtered to 0 rows).';

    -- TEST B.3: Alice cannot UPDATE Bob's session (RLS USING clause filters out Bob's row)
    UPDATE public.interview_sessions
    SET target_role = 'Malicious Update'
    WHERE id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
    GET DIAGNOSTICS v_updated_rows = ROW_COUNT;

    IF v_updated_rows != 0 THEN
        RAISE EXCEPTION 'TEST B.3 FAILED: Alice was able to update Bob''s session!';
    END IF;
    RAISE NOTICE '✓ TEST B.3 PASSED: Alice cannot update Bob''s session (affects 0 rows under RLS).';

    -- TEST B.4: Alice cannot INSERT a practice attempt for Bob's session (blocked by RLS WITH CHECK)
    BEGIN
        INSERT INTO public.practice_attempts (
            id, user_id, session_id, question_text, answer_text,
            clarity_score, structure_score, depth_score, relevance_score, overall_score,
            feedback_summary
        ) VALUES (
            gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
            'Explain TCP handshakes.', 'SYN, SYN-ACK, ACK.',
            8, 8, 8, 8, 8, 'Valid answer.'
        );
        RAISE EXCEPTION 'TEST B.4 FAILED: Alice was able to insert attempt into Bob''s session!';
    EXCEPTION
        WHEN SQLSTATE '42501' THEN
            RAISE NOTICE '✓ TEST B.4 PASSED: Attempt to attach practice attempt to other user''s session blocked by RLS WITH CHECK.';
        WHEN foreign_key_violation THEN
            RAISE NOTICE '✓ TEST B.4 PASSED: Blocked by database integrity constraints.';
        WHEN OTHERS THEN
            IF SQLERRM ~* 'violates row-level security policy' THEN
                RAISE NOTICE '✓ TEST B.4 PASSED: Attempt to attach practice attempt to other user''s session blocked by RLS WITH CHECK.';
            ELSE
                RAISE;
            END IF;
    END;

    -- TEST B.5: Alice cannot self-promote to admin via profile UPDATE
    BEGIN
        UPDATE public.profiles
        SET role = 'admin'
        WHERE id = '11111111-1111-1111-1111-111111111111';

        RAISE EXCEPTION 'TEST B.5 FAILED: Alice successfully self-promoted to admin!';
    EXCEPTION
        WHEN SQLSTATE '42501' THEN
            RAISE NOTICE '✓ TEST B.5 PASSED: Alice''s attempt to self-promote was blocked by protect_profile_role trigger.';
        WHEN OTHERS THEN
            IF SQLERRM ~* 'Only administrators can modify user roles' THEN
                RAISE NOTICE '✓ TEST B.5 PASSED: Alice''s attempt to self-promote was blocked by protect_profile_role trigger.';
            ELSE
                RAISE;
            END IF;
    END;

    -- TEST B.6: Alice (ordinary user) cannot call approve_community_submission
    BEGIN
        PERFORM public.approve_community_submission(
            p_submission_id => 'cccccccc-cccc-cccc-cccc-cccccccccccc',
            p_question_text => 'Hacked approved question'
        );
        RAISE EXCEPTION 'TEST B.6 FAILED: Alice was able to call approve_community_submission!';
    EXCEPTION
        WHEN SQLSTATE '42501' THEN
            RAISE NOTICE '✓ TEST B.6 PASSED: Non-admin execution of approve_community_submission rejected with 42501.';
        WHEN OTHERS THEN
            IF SQLERRM ~* 'Only administrators can approve submissions' THEN
                RAISE NOTICE '✓ TEST B.6 PASSED: Non-admin execution of approve_community_submission rejected with 42501.';
            ELSE
                RAISE;
            END IF;
    END;
END;
$$;

-- ----------------------------------------------------------------------------
-- 7. SWITCH IDENTITY TO BOB (Candidate)
-- ----------------------------------------------------------------------------
SET LOCAL "request.jwt.claim.sub" = '22222222-2222-2222-2222-222222222222';
SET LOCAL "request.jwt.claim.role" = 'authenticated';

DO $$
DECLARE
    v_submissions_seen INTEGER;
    v_bob_session_count INTEGER;
BEGIN
    RAISE NOTICE '============================================================';
    RAISE NOTICE 'CONTINUING SECTION B: AUTHENTICATED RLS SIMULATION (BOB)';
    RAISE NOTICE '============================================================';

    -- TEST B.7: Bob cannot view Alice's pending submission
    SELECT count(*) INTO v_submissions_seen
    FROM public.community_question_submissions
    WHERE id = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

    IF v_submissions_seen != 0 THEN
        RAISE EXCEPTION 'TEST B.7 FAILED: Bob was able to view Alice''s pending submission!';
    END IF;
    RAISE NOTICE '✓ TEST B.7 PASSED: Candidate Bob cannot see Candidate Alice''s pending question submission.';

    -- TEST B.8: Bob CAN view his own session
    SELECT count(*) INTO v_bob_session_count
    FROM public.interview_sessions
    WHERE id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

    IF v_bob_session_count != 1 THEN
        RAISE EXCEPTION 'TEST B.8 FAILED: Bob cannot view his own session!';
    END IF;
    RAISE NOTICE '✓ TEST B.8 PASSED: Candidate Bob can view his own session.';
END;
$$;

-- ----------------------------------------------------------------------------
-- 8. SWITCH IDENTITY TO CHARLIE (Administrator)
-- ----------------------------------------------------------------------------
SET LOCAL "request.jwt.claim.sub" = '33333333-3333-3333-3333-333333333333';
SET LOCAL "request.jwt.claim.role" = 'authenticated';

DO $$
DECLARE
    v_submissions_seen INTEGER;
    v_approved_q_id UUID;
    v_new_q_text TEXT;
    v_new_q_reviewer UUID;
    v_sub_status VARCHAR;
BEGIN
    RAISE NOTICE '============================================================';
    RAISE NOTICE 'CONTINUING SECTION B: AUTHENTICATED RLS SIMULATION (ADMIN CHARLIE)';
    RAISE NOTICE '============================================================';

    -- TEST B.9: Admin Charlie can see Alice's pending submission
    SELECT count(*) INTO v_submissions_seen
    FROM public.community_question_submissions
    WHERE id = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

    IF v_submissions_seen != 1 THEN
        RAISE EXCEPTION 'TEST B.9 FAILED: Admin Charlie could not view pending submission!';
    END IF;
    RAISE NOTICE '✓ TEST B.9 PASSED: Admin Charlie can view candidate submissions for moderation.';

    -- TEST B.10: Admin Charlie successfully approves submission with admin polish
    v_approved_q_id := public.approve_community_submission(
        p_submission_id => 'cccccccc-cccc-cccc-cccc-cccccccccccc',
        p_question_text => 'Compare and contrast TCP and UDP transport protocols.',
        p_topic         => 'Networking',
        p_tags          => ARRAY['networking', 'tcp', 'udp'],
        p_company       => 'Cisco',
        p_difficulty    => 'Medium',
        p_admin_note    => 'Approved with improved phrasing.'
    );

    -- Verify the new question in public.questions
    SELECT question_text, approved_by INTO v_new_q_text, v_new_q_reviewer
    FROM public.questions
    WHERE id = v_approved_q_id;

    IF v_new_q_text != 'Compare and contrast TCP and UDP transport protocols.' THEN
        RAISE EXCEPTION 'TEST B.10 FAILED: Admin text edits were not applied to public.questions!';
    END IF;

    IF v_new_q_reviewer != '33333333-3333-3333-3333-333333333333' THEN
        RAISE EXCEPTION 'TEST B.10 FAILED: Reviewer was not bound to Charlie''s auth.uid()!';
    END IF;

    -- Verify submission status in public.community_question_submissions
    SELECT status INTO v_sub_status
    FROM public.community_question_submissions
    WHERE id = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

    IF v_sub_status != 'approved' THEN
        RAISE EXCEPTION 'TEST B.10 FAILED: Submission status was not updated to approved!';
    END IF;

    RAISE NOTICE '✓ TEST B.10 PASSED: SEC-01 & SEC-02 verified. Admin Charlie approved submission with edits and was bound as reviewer.';
END;
$$;

-- Reset role and rollback transaction to leave database in pristine state
RESET ROLE;
ROLLBACK;

DO $$
BEGIN
    RAISE NOTICE '============================================================';
    RAISE NOTICE 'ALL SECTION A & SECTION B VERIFICATION TESTS COMPLETED SUCCESSFULLY!';
    RAISE NOTICE 'Transaction rolled back cleanly: 0 test rows persisted.';
    RAISE NOTICE '============================================================';
END;
$$;
