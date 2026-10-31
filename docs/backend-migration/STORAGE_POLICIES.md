# Supabase Storage Security & Policies: Vettor Resumes

**Date:** October 2026 (Revised Architecture Review)  
**Target:** Supabase Storage (S3-compatible Object Storage)  
**Bucket Name:** `resumes`  
**Access Tier:** Private (Non-Public)

---

## 1. Storage Configuration Overview

In the existing MongoDB architecture, resume files are written directly to local server disk at:  
`ML_Preprocessor_scripts/user_resumes/<userId>/resume.pdf`

In PostgreSQL/Supabase:
1. Candidate resume PDF binaries are stored in a **private Supabase Storage bucket** named `resumes`.
2. The database table `public.resumes` stores the reference path (`storage_path`), file metadata, and extracted skills.
3. Access is strictly controlled via Storage Row Level Security (RLS) policies on `storage.objects`.
4. `storage.objects` is managed by Supabase under the `supabase_storage_admin` role with RLS enabled by default (`relrowsecurity = true`). Do not run `ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY`.

---

## 2. Bucket Creation & Configuration

```sql
-- 1. Create the private 'resumes' bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'resumes',
    'resumes',
    false,              -- Non-public: requires signed URLs or authenticated RLS access
    5242880,            -- 5 MB size limit (matching uploadResume.js)
    ARRAY['application/pdf']::text[] -- Strictly PDF files only
)
ON CONFLICT (id) DO UPDATE SET
    public = false,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['application/pdf']::text[];
```

---

## 3. Storage Folder Hierarchy & Path Convention

All files must follow the strict path structure:  
`<user_id>/<resume_id>.pdf`

- The first path segment **must** be the user's Supabase UUID (`auth.uid()`).
- Supabase provides the SQL helper `storage.foldername(name)` which returns an array of folder path segments (e.g., `(storage.foldername(name))[1]` returns `<user_id>`).

---

## 4. Storage Row Level Security (RLS) Policies

All policies apply directly to `storage.objects` for `bucket_id = 'resumes'`.

### SQL Definition

```sql
-- 1. UPLOAD (INSERT) Policy
-- Candidates can only upload to their own user directory, ensuring file size and MIME constraints
DROP POLICY IF EXISTS "resumes_storage_insert_policy" ON storage.objects;
CREATE POLICY "resumes_storage_insert_policy"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'resumes' AND
    auth.uid()::text = (storage.foldername(name))[1] AND
    lower(storage.extension(name)) = 'pdf'
);

-- 2. VIEW / DOWNLOAD (SELECT) Policy
-- Candidates can download only their own files. Admins can view any resume for diagnostic/audit purposes.
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

-- 3. UPDATE / OVERWRITE Policy
-- Candidates can only overwrite/update files within their own directory.
-- Checks both source folder ownership (USING) and destination folder + PDF format (WITH CHECK).
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

-- 4. DELETE Policy
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
```

### Dashboard UI Alternative (Recommended if SQL Editor role is not table owner)

If the SQL Editor returns `ERROR: 42501: must be owner of table objects` on `CREATE POLICY`, configure the policies directly in the Supabase Dashboard:
1. Navigate to **Storage** -> **Policies**.
2. Under the **`resumes`** bucket (or `storage.objects`), click **New Policy**.
3. For each policy, select the matching operation and paste the corresponding expression:
   - **INSERT:**
     - Target Role: `authenticated`
     - WITH CHECK expression: `bucket_id = 'resumes' AND auth.uid()::text = (storage.foldername(name))[1] AND lower(storage.extension(name)) = 'pdf'`
   - **SELECT:**
     - Target Role: `authenticated`
     - USING expression: `bucket_id = 'resumes' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.is_admin())`
   - **UPDATE:**
     - Target Role: `authenticated`
     - USING expression: `bucket_id = 'resumes' AND auth.uid()::text = (storage.foldername(name))[1]`
     - WITH CHECK expression: `bucket_id = 'resumes' AND auth.uid()::text = (storage.foldername(name))[1] AND lower(storage.extension(name)) = 'pdf'`
   - **DELETE:**
     - Target Role: `authenticated`
     - USING expression: `bucket_id = 'resumes' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.is_admin())`

---

## 5. Integration Workflow: Express, Storage, and Python ML

Currently, `MLPipelineService.saveResumeFile()` writes the PDF to local disk so that Python can read it. With Supabase Storage, the flow becomes clean and decoupled:

```
[Candidate Browser]
       │
       │ 1. Uploads multipart/form-data PDF
       ▼
[Express Backend: uploadResume.js (multer)]
       │
       ├─────────────────────────────────────────┐
       │ 2. Sends Buffer (in-memory)             │ 3. Uploads PDF to Supabase Storage
       ▼                                         ▼
[Python ML API: /api/extract]             [Supabase Storage: resumes/<user_id>/<resume_id>.pdf]
- Extracts text & profile                 - Stores permanent PDF asset
- Returns raw & expanded skills           - Returns storage_path
       │                                         │
       └────────────────────┬────────────────────┘
                            │
                            │ 4. Inserts metadata, skills, and storage_path
                            ▼
               [PostgreSQL: public.resumes]
```

### Express Storage Upload Code Example

```javascript
import { supabaseAdmin } from "../config/supabase.js";

export const uploadResumeToStorage = async (fileBuffer, userId, resumeId) => {
  const storagePath = `${userId}/${resumeId}.pdf`;

  const { data, error } = await supabaseAdmin.storage
    .from("resumes")
    .upload(storagePath, fileBuffer, {
      contentType: "application/pdf",
      upsert: true,
    });

  if (error) {
    throw new Error(`Failed to upload resume to Supabase Storage: ${error.message}`);
  }

  return storagePath;
};
```

---

## 6. Accessing Resumes for ML Reprocessing or Viewing

When the Python ML service or a candidate needs to view a previously uploaded resume:
1. **Candidate UI Download:** Express generates a short-lived signed URL (e.g., 60 seconds) via:
   ```javascript
   const { data } = await supabase.storage
     .from("resumes")
     .createSignedUrl(storagePath, 60);
   ```
2. **Backend Streaming to Python:** Express downloads the binary stream via `supabaseAdmin.storage.from('resumes').download(storagePath)` and transmits the base64 or stream to the Python service.
