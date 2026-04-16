// supabase/functions/cleanup-files/index.ts
// Supabase Edge Function – runs on a cron schedule to:
//   1. Find expired/maxed files in the DB
//   2. Delete their objects from Supabase Storage
//   3. Delete the DB rows
//
// Schedule via Supabase Dashboard → Edge Functions → Schedules
// or run the pg_cron SQL below.
//
// pg_cron SQL (run in Supabase SQL Editor):
//   select cron.schedule(
//     'cleanup-expired-files',
//     '0 * * * *',   -- every hour
//     $$
//       select net.http_post(
//         url := '<YOUR_SUPABASE_URL>/functions/v1/cleanup-files',
//         headers := '{"Authorization": "Bearer <YOUR_SERVICE_ROLE_KEY>"}'::jsonb
//       );
//     $$
//   );

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BUCKET = "secure_files";

serve(async (req: Request): Promise<Response> => {
  // Optional: verify the request has the service role key as Bearer token
  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.includes(SERVICE_ROLE_KEY)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // 1. Find files to delete
  const { data: expiredFiles, error: fetchError } = await supabase
    .from("files")
    .select("id, storage_path")
    .or(`expiry_time.lt.${new Date().toISOString()},current_downloads.gte.max_downloads`)
    // Note: current_downloads >= max_downloads done via filter below
    ;

  // Fallback: also fetch files where current_downloads >= max_downloads
  const { data: maxedFiles, error: maxedError } = await supabase
    .from("files")
    .select("id, storage_path")
    .filter("current_downloads", "gte", "max_downloads");

  if (fetchError || maxedError) {
    return new Response(
      JSON.stringify({ error: fetchError?.message || maxedError?.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  // Merge and deduplicate
  const allFiles = [...(expiredFiles || []), ...(maxedFiles || [])];
  const uniqueFiles = Array.from(
    new Map(allFiles.map((f) => [f.id, f])).values()
  );

  if (uniqueFiles.length === 0) {
    return new Response(
      JSON.stringify({ deleted: 0, message: "Nothing to clean up" }),
      { headers: { "Content-Type": "application/json" } }
    );
  }

  const storagePaths = uniqueFiles.map((f) => f.storage_path);
  const fileIds = uniqueFiles.map((f) => f.id);

  // 2. Delete from storage
  const { error: storageError } = await supabase.storage
    .from(BUCKET)
    .remove(storagePaths);

  if (storageError) {
    console.error("Storage deletion error:", storageError.message);
    // Continue to delete DB rows even if some storage deletions fail
  }

  // 3. Delete DB rows
  const { error: dbError } = await supabase
    .from("files")
    .delete()
    .in("id", fileIds);

  if (dbError) {
    return new Response(
      JSON.stringify({ error: "DB deletion failed: " + dbError.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  return new Response(
    JSON.stringify({
      deleted: uniqueFiles.length,
      files: storagePaths,
    }),
    { headers: { "Content-Type": "application/json" } }
  );
});
