-- ============================================================================
-- VETTOR PLATFORM MIGRATION - FILE 04: STORAGE POLICIES
-- Description: Configures the private 'resumes' Supabase Storage bucket and
--              enforces strict user folder isolation via storage.objects RLS.
--
-- NOTE ON TABLE OWNERSHIP & RLS:
-- Supabase manages the 'storage.objects' table under the 'supabase_storage_admin' role
-- and enables Row Level Security by default (relrowsecurity = true).
-- DO NOT execute 'ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY'.
--
-- Target: Supabase Storage / PostgreSQL 15+ / 17+
-- ============================================================================

-- ============================================================================
-- 1. BUCKET PROVISIONING
-- ============================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'resumes',
    'resumes',
    false,                           -- Strictly private: non-public
    5242880,                         -- 5 MB maximum file size limit
    ARRAY['application/pdf']::text[] -- Strictly PDF files only
)
ON CONFLICT (id) DO UPDATE SET
    public = false,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['application/pdf']::text[];

-- ============================================================================
-- 2. STORAGE ROW LEVEL SECURITY POLICIES
-- Path hierarchy requirement: resumes/<user_id>/<resume_id>.pdf
--
-- If your SQL Editor role has been granted 'supabase_storage_admin' membership,
-- the following statements will execute directly.
-- If the SQL Editor returns 42501 (must be owner of table objects) on CREATE POLICY,
-- apply these 4 policies through the Supabase Dashboard (Storage -> Policies)
-- as documented in docs/backend-migration/STORAGE_POLICIES.md.
-- ============================================================================

-- 1. UPLOAD (INSERT) POLICY
-- Authenticated users can only upload files into their own root UUID directory.
-- Enforces that file must have a .pdf extension.
DROP POLICY IF EXISTS "resumes_storage_insert_policy" ON storage.objects;
CREATE POLICY "resumes_storage_insert_policy"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'resumes' AND
    auth.uid()::text = (storage.foldername(name))[1] AND
    lower(storage.extension(name)) = 'pdf'
);

-- 2. VIEW / DOWNLOAD (SELECT) POLICY
-- Candidates can read only their own resumes. Admins can view any resume for auditing.
DROP POLICY IF EXISTS "resumes_storage_select_policy" ON storage.objects;
CREATE POLICY "resumes_storage_select_policy"
ON storage.objects FOR SELECT
TO authenticated
USING (
    bucket_id = 'resumes' AND
    (
        auth.uid()::text = (storage.foldername(name))[1] OR
        public.is_admin()
    )
);

-- 3. UPDATE / OVERWRITE POLICY
-- Candidates can only modify or replace files within their own folder.
-- USING checks that the existing file belongs to the caller.
-- WITH CHECK ensures the updated/destination path remains in the caller's folder
-- and strictly retains a .pdf extension.
DROP POLICY IF EXISTS "resumes_storage_update_policy" ON storage.objects;
CREATE POLICY "resumes_storage_update_policy"
ON storage.objects FOR UPDATE
TO authenticated
USING (
    bucket_id = 'resumes' AND
    auth.uid()::text = (storage.foldername(name))[1]
)
WITH CHECK (
    bucket_id = 'resumes' AND
    auth.uid()::text = (storage.foldername(name))[1] AND
    lower(storage.extension(name)) = 'pdf'
);

-- 4. DELETE POLICY
-- Candidates can delete their own resumes. Admins can delete any resume.
DROP POLICY IF EXISTS "resumes_storage_delete_policy" ON storage.objects;
CREATE POLICY "resumes_storage_delete_policy"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'resumes' AND
    (
        auth.uid()::text = (storage.foldername(name))[1] OR
        public.is_admin()
    )
);
