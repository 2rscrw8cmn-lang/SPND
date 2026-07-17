import { createClient } from "@supabase/supabase-js";

// Usage: npm run review:imports
// Marks every legacy CSV-imported transaction (source_fingerprint like 'csv:%')
// as reviewed, using the service-role key so it runs without a DB password.
// Idempotent — re-running only touches rows still needing review.
// Mirrors migration 202607160001_review_legacy_imports.sql.

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) throw new Error("Add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to .env.local first.");

async function main() {
  const supabase = createClient(url!, serviceKey!, { auth: { persistSession: false, autoRefreshToken: false } });
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("transactions")
    .update({ review_status: "reviewed", reviewed_at: now, updated_at: now })
    .like("source_fingerprint", "csv:%")
    .neq("review_status", "reviewed")
    .select("id");
  if (error) throw error;
  process.stdout.write(`Marked ${data?.length ?? 0} legacy imported transactions as reviewed.\n`);
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : JSON.stringify(error)}\n`);
  process.exitCode = 1;
});
