# Row Level Security (RLS) Policies: Vettor Platform

**Date:** October 2026 (Revised Architecture Review)  
**Target Engine:** PostgreSQL 15+ (via Supabase)  
**Status:** Complete Security Specification & DDL

---

## 1. Security Architecture & Threat Model

Row Level Security (RLS) is PostgreSQL's built-in defense mechanism that ensures database queries only return or modify rows that the requesting user is cryptographically authorized to see.

In Vettor:
- **Defense in Depth:** Even if client code is manipulated or an Express endpoint fails to validate an ownership parameter, RLS enforces multi-tenant boundaries at the database engine level.
- **Service Role Bypass:** Backend operations performed with `SUPABASE_SERVICE_ROLE_KEY` bypass RLS automatically. However, standard API calls using the user's JWT (`auth.uid()`) will execute under strict RLS constraints.
- **Admin Privilege Control:** Admin status is determined via a `SECURITY DEFINER` helper function `is_admin()` that checks `public.profiles.role = 'admin'` or JWT claims.

---

## 2. Helper Functions

```sql
-- Secure admin check function
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
```

---

## 3. Comprehensive Table-by-Table RLS Policies

### 3.1 `public.profiles`

Every user can read their own profile. Admins can read all profiles. Only the user themselves can update their personal information, but they **cannot** alter their own `role`.

```sql
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- SELECT: Users can view their own profile; admins can view all profiles
CREATE POLICY "profiles_select_policy"
ON public.profiles FOR SELECT
TO authenticated
USING (
    id = auth.uid() OR public.is_admin()
);

-- INSERT: Denied to authenticated users directly (handled exclusively by on_auth_user_created trigger)
CREATE POLICY "profiles_insert_policy"
ON public.profiles FOR INSERT
TO authenticated
WITH CHECK (false);

-- UPDATE: Users can update their own profile; admins can update any profile
-- Note: A database trigger (trg_protect_profile_role) additionally prevents non-admins from changing the role column
CREATE POLICY "profiles_update_policy"
ON public.profiles FOR UPDATE
TO authenticated
USING (
    id = auth.uid() OR public.is_admin()
)
WITH CHECK (
    id = auth.uid() OR public.is_admin()
);

-- DELETE: Denied directly (accounts are deleted via Supabase auth.users cascade)
CREATE POLICY "profiles_delete_policy"
ON public.profiles FOR DELETE
TO authenticated
USING (public.is_admin());
```

---

### 3.2 `public.resumes`

Candidates can only view, upload, update, and delete their own resume metadata. Admins have read access for moderation and diagnostic inspection.

```sql
ALTER TABLE public.resumes ENABLE ROW LEVEL SECURITY;

-- SELECT: Owner or Admin
CREATE POLICY "resumes_select_policy"
ON public.resumes FOR SELECT
TO authenticated
USING (
    user_id = auth.uid() OR public.is_admin()
);

-- INSERT: Only owner can insert their own resume record
CREATE POLICY "resumes_insert_policy"
ON public.resumes FOR INSERT
TO authenticated
WITH CHECK (
    user_id = auth.uid()
);

-- UPDATE: Owner only
CREATE POLICY "resumes_update_policy"
ON public.resumes FOR UPDATE
TO authenticated
USING (
    user_id = auth.uid()
)
WITH CHECK (
    user_id = auth.uid()
);

-- DELETE: Owner or Admin
CREATE POLICY "resumes_delete_policy"
ON public.resumes FOR DELETE
TO authenticated
USING (
    user_id = auth.uid() OR public.is_admin()
);
```

---

### 3.3 `public.interview_sessions`

Interview preparation sessions are strictly private to the candidate who created them. Admins have read access for moderation and diagnostic inspection.

```sql
ALTER TABLE public.interview_sessions ENABLE ROW LEVEL SECURITY;

-- SELECT: Owner or Admin
CREATE POLICY "sessions_select_policy"
ON public.interview_sessions FOR SELECT
TO authenticated
USING (
    user_id = auth.uid() OR public.is_admin()
);

-- INSERT: Owner only
CREATE POLICY "sessions_insert_policy"
ON public.interview_sessions FOR INSERT
TO authenticated
WITH CHECK (
    user_id = auth.uid()
);

-- UPDATE: Owner can update their session (e.g. rename, touch last_accessed_at)
CREATE POLICY "sessions_update_policy"
ON public.interview_sessions FOR UPDATE
TO authenticated
USING (
    user_id = auth.uid()
)
WITH CHECK (
    user_id = auth.uid()
);

-- DELETE: Owner or Admin
CREATE POLICY "sessions_delete_policy"
ON public.interview_sessions FOR DELETE
TO authenticated
USING (
    user_id = auth.uid() OR public.is_admin()
);
```

---

### 3.4 `public.session_questions`

Session questions inherit their authorization from the parent `interview_sessions` record.

```sql
ALTER TABLE public.session_questions ENABLE ROW LEVEL SECURITY;

-- SELECT: Permitted if the parent session belongs to the user or if user is admin
CREATE POLICY "session_questions_select_policy"
ON public.session_questions FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.interview_sessions s
        WHERE s.id = session_id AND s.user_id = auth.uid()
    ) OR public.is_admin()
);

-- INSERT: Permitted only into sessions belonging to the candidate
CREATE POLICY "session_questions_insert_policy"
ON public.session_questions FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.interview_sessions s
        WHERE s.id = session_id AND s.user_id = auth.uid()
    )
);

-- UPDATE: Owner of parent session
CREATE POLICY "session_questions_update_policy"
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

-- DELETE: Owner of parent session or Admin
CREATE POLICY "session_questions_delete_policy"
ON public.session_questions FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.interview_sessions s
        WHERE s.id = session_id AND s.user_id = auth.uid()
    ) OR public.is_admin()
);
```

---

### 3.5 `public.practice_attempts`

Attempts contain candidate answers and private feedback. They are visible only to the candidate who made the attempt and administrators.

```sql
ALTER TABLE public.practice_attempts ENABLE ROW LEVEL SECURITY;

-- SELECT: Owner or Admin
CREATE POLICY "practice_attempts_select_policy"
ON public.practice_attempts FOR SELECT
TO authenticated
USING (
    user_id = auth.uid() OR public.is_admin()
);

-- INSERT: Candidate can only insert their own attempt.
-- If linked to a session, the session must belong to the user.
CREATE POLICY "practice_attempts_insert_policy"
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

-- UPDATE: Candidate can update their own attempt
CREATE POLICY "practice_attempts_update_policy"
ON public.practice_attempts FOR UPDATE
TO authenticated
USING (
    user_id = auth.uid()
)
WITH CHECK (
    user_id = auth.uid()
);

-- DELETE: Candidate or Admin
CREATE POLICY "practice_attempts_delete_policy"
ON public.practice_attempts FOR DELETE
TO authenticated
USING (
    user_id = auth.uid() OR public.is_admin()
);
```

---

### 3.6 `public.community_question_submissions`

Candidates can submit questions and monitor their own submissions. Admins can view all submissions and update their status (`approved` / `rejected`).

```sql
ALTER TABLE public.community_question_submissions ENABLE ROW LEVEL SECURITY;

-- SELECT: Submitter can view their submissions; Admins can view all submissions
CREATE POLICY "submissions_select_policy"
ON public.community_question_submissions FOR SELECT
TO authenticated
USING (
    submitted_by = auth.uid() OR public.is_admin()
);

-- INSERT: Any authenticated user can submit a question under their own user ID
CREATE POLICY "submissions_insert_policy"
ON public.community_question_submissions FOR INSERT
TO authenticated
WITH CHECK (
    submitted_by = auth.uid() AND status = 'pending'
);

-- UPDATE:
-- Submitter can edit questionText while status is 'pending'
-- Admins can update status, admin_note, reviewed_by, reviewed_at
CREATE POLICY "submissions_update_policy"
ON public.community_question_submissions FOR UPDATE
TO authenticated
USING (
    (submitted_by = auth.uid() AND status = 'pending') OR public.is_admin()
)
WITH CHECK (
    (submitted_by = auth.uid() AND status = 'pending') OR public.is_admin()
);

-- DELETE: Submitter can cancel pending submission; Admins can delete any submission
CREATE POLICY "submissions_delete_policy"
ON public.community_question_submissions FOR DELETE
TO authenticated
USING (
    (submitted_by = auth.uid() AND status = 'pending') OR public.is_admin()
);
```

---

### 3.7 `public.questions` (Master Question Bank)

The curated question bank is readable by all authenticated users for practice and exploration, but writable only by administrators.

```sql
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;

-- SELECT: All authenticated users can view active questions
CREATE POLICY "questions_select_policy"
ON public.questions FOR SELECT
TO authenticated
USING (
    is_active = true OR public.is_admin()
);

-- INSERT: Admins only
CREATE POLICY "questions_insert_policy"
ON public.questions FOR INSERT
TO authenticated
WITH CHECK (
    public.is_admin()
);

-- UPDATE: Admins only
CREATE POLICY "questions_update_policy"
ON public.questions FOR UPDATE
TO authenticated
USING (
    public.is_admin()
)
WITH CHECK (
    public.is_admin()
);

-- DELETE: Admins only
CREATE POLICY "questions_delete_policy"
ON public.questions FOR DELETE
TO authenticated
USING (
    public.is_admin()
);
```
