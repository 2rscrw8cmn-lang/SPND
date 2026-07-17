import { createClient } from "@supabase/supabase-js";

// Usage: npm run set-password -- <email> <password>
// Sets a password for an existing Supabase user, or creates the user if missing.
// Runs entirely through the admin API — no confirmation email is sent.

const email = process.argv[2]?.trim().toLowerCase();
const password = process.argv[3];
if (!email || !password) {
  process.stderr.write("Usage: npm run set-password -- <email> <password>\n");
  process.exit(1);
}
if (password.length < 8) {
  process.stderr.write("Choose a password of at least 8 characters.\n");
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) throw new Error("Add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to .env.local first.");

async function main() {
  const supabase = createClient(url!, serviceKey!, { auth: { persistSession: false, autoRefreshToken: false } });

  // Find the user by email across paginated results.
  let existingId: string | undefined;
  for (let page = 1; !existingId; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    existingId = data.users.find((user) => user.email?.toLowerCase() === email)?.id;
    if (data.users.length < 200) break;
  }

  if (existingId) {
    const { error } = await supabase.auth.admin.updateUserById(existingId, { password });
    if (error) throw error;
    process.stdout.write(`Updated password for ${email}.\n`);
  } else {
    const { error } = await supabase.auth.admin.createUser({ email, password, email_confirm: true });
    if (error) throw error;
    process.stdout.write(`Created ${email} with a password. Note: a brand-new user still needs a household_members row to see any data.\n`);
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : JSON.stringify(error)}\n`);
  process.exitCode = 1;
});
