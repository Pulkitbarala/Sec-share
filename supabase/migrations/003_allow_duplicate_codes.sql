-- Drop unique index on code to allow multiple files to share the same code
DROP INDEX IF EXISTS public.files_code_idx;

-- Create a non-unique index on code for fast lookups
CREATE INDEX IF NOT EXISTS files_code_idx ON public.files (code);
