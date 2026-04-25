-- ================================================================
-- 002_storage_policies.sql
-- Fixes issue where anonymous users couldn't download files
-- ================================================================

-- Enable RLS on storage objects if not already enabled
-- Note: 'alter table storage.objects enable row level security;' may throw a permissions error.
-- Storage objects have RLS enabled by default in Supabase.

-- Policy 1: Allow authenticated users to upload files to 'secure_files' bucket
create policy "Allow authenticated uploads"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'secure_files'
);

-- Policy 2: Allow public downloads via signed URL or direct download if file is valid
-- This checks the `files` table to enforce max_downloads and expiry_time limits
create policy "Allow public downloads"
on storage.objects for select
to public
using (
  bucket_id = 'secure_files'
  and exists (
    select 1 from public.files
    where storage_path = storage.objects.name
      and current_downloads < max_downloads
      and expiry_time > now()
  )
);
