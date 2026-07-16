import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const enabled = process.env.RUN_SUPABASE_INTEGRATION === "true";
const unquote = (value: string | undefined) => (value ?? "").replace(/^"(.*)"$/, "$1");
const url = unquote(process.env.NEXT_PUBLIC_SUPABASE_URL);
const anonKey = unquote(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const serviceKey = unquote(process.env.SUPABASE_SERVICE_ROLE_KEY);
const suite = enabled ? describe : describe.skip;

suite("disposable Supabase accounting workflows", () => {
  let admin: SupabaseClient;
  let zack: SupabaseClient;
  let stephanie: SupabaseClient;
  let outsider: SupabaseClient;
  const householdId = crypto.randomUUID();
  const zackEmail = `zack-${householdId}@example.test`;
  const stephanieEmail = `stephanie-${householdId}@example.test`;
  const outsiderEmail = `outsider-${householdId}@example.test`;
  const password = "Test-only-password-2026!";
  let zackId = "";
  let stephanieId = "";
  let accountId = "";
  let fromCategoryId = "";
  let toCategoryId = "";
  let transactionId = "";

  beforeAll(async () => {
    if (!url || !anonKey || !serviceKey) throw new Error("Disposable Supabase credentials are required");
    admin = createClient(url, serviceKey, { auth: { persistSession: false } });
    for (const email of [zackEmail, stephanieEmail, outsiderEmail]) {
      const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
      if (error) throw error;
      if (email === zackEmail) zackId = data.user.id;
      if (email === stephanieEmail) stephanieId = data.user.id;
    }
    const insert = await admin.from("households").insert({ id: householdId, name: "S6 test household" });
    if (insert.error) throw insert.error;
    const membership = await admin.from("household_members").insert([
      { household_id: householdId, user_id: zackId, role: "owner" },
      { household_id: householdId, user_id: stephanieId, role: "member" },
    ]);
    if (membership.error) throw membership.error;
    const categories = await admin.from("categories").insert([
      { household_id: householdId, name: "From", color: "#45D9E1", icon: "Wallet", category_group: "Essentials" },
      { household_id: householdId, name: "To", color: "#9B6CFF", icon: "PiggyBank", category_group: "Goals" },
    ]).select("id,name");
    if (categories.error) throw categories.error;
    fromCategoryId = categories.data.find((item) => item.name === "From")!.id;
    toCategoryId = categories.data.find((item) => item.name === "To")!.id;
    const account = await admin.from("accounts").insert({ household_id: householdId, provider_account_id: `test-${householdId}`, name: "Checking", cash_flow_mode: "cash" }).select("id").single();
    if (account.error) throw account.error;
    accountId = account.data.id;
    const transaction = await admin.from("transactions").insert({ household_id: householdId, account_id: accountId, source_fingerprint: `pending-${householdId}`, transacted_at: new Date().toISOString(), amount_cents: -1001, merchant: "Test merchant", normalized_merchant: "test merchant", status: "pending" }).select("id").single();
    if (transaction.error) throw transaction.error;
    transactionId = transaction.data.id;
    await admin.from("monthly_budgets").insert({ household_id: householdId, month: "2026-07-01", category_id: fromCategoryId, budgeted_cents: 10000 });
    const clientFor = async (email: string) => {
      const client = createClient(url, anonKey, { auth: { persistSession: false } });
      const { error } = await client.auth.signInWithPassword({ email, password });
      if (error) throw error;
      return client;
    };
    [zack, stephanie, outsider] = await Promise.all([clientFor(zackEmail), clientFor(stephanieEmail), clientFor(outsiderEmail)]);
  }, 30_000);

  afterAll(async () => {
    if (admin && householdId) await admin.from("households").delete().eq("id", householdId);
    if (admin) await Promise.all([zackId, stephanieId].filter(Boolean).map((id) => admin.auth.admin.deleteUser(id)));
  });

  it("allows Zack and Stephanie but denies an unrelated or anonymous user", async () => {
    expect((await zack.from("households").select("id").eq("id", householdId)).data).toHaveLength(1);
    expect((await stephanie.from("households").select("id").eq("id", householdId)).data).toHaveLength(1);
    expect((await outsider.from("households").select("id").eq("id", householdId)).data).toHaveLength(0);
    expect((await createClient(url, anonKey).from("households").select("id").eq("id", householdId)).data).toHaveLength(0);
  });

  it("edits transaction allocations atomically", async () => {
    const { error } = await zack.rpc("update_transaction_with_allocations", { p_household_id: householdId, p_transaction_id: transactionId, p_updates: { review_status: "reviewed" }, p_allocations: [{ category_id: fromCategoryId, amount_cents: -1001 }] });
    expect(error).toBeNull();
    const allocations = await stephanie.from("transaction_allocations").select("amount_cents").eq("transaction_id", transactionId);
    expect(allocations.data).toEqual([{ amount_cents: -1001 }]);
  });

  it("moves budget money atomically", async () => {
    expect((await stephanie.rpc("move_budget_money", { p_household_id: householdId, p_month: "2026-07-01", p_from_category_id: fromCategoryId, p_to_category_id: toCategoryId, p_amount_cents: 2500 })).error).toBeNull();
    const budgets = await zack.from("monthly_budgets").select("category_id,budgeted_cents").eq("household_id", householdId);
    expect(budgets.data).toEqual(expect.arrayContaining([{ category_id: fromCategoryId, budgeted_cents: 7500 }, { category_id: toCategoryId, budgeted_cents: 2500 }]));
  });

  it("preserves recurring decisions and links pending to posted reconciliation", async () => {
    const recurring = await admin.from("recurring_items").insert({ household_id: householdId, type: "expense", name: "Preserved", merchant_pattern: "preserved", amount_cents: 1001, cadence: "monthly", next_due_date: "2026-08-01", is_confirmed: true, active: false }).select("id").single();
    expect(recurring.error).toBeNull();
    const posted = await admin.from("transactions").insert({ household_id: householdId, account_id: accountId, provider_transaction_id: `posted-${householdId}`, source_fingerprint: `posted-${householdId}`, replaces_pending_transaction_id: transactionId, transacted_at: new Date().toISOString(), posted_at: new Date().toISOString(), amount_cents: -1001, merchant: "Test merchant", normalized_merchant: "test merchant", status: "posted" }).select("replaces_pending_transaction_id").single();
    expect(posted.data?.replaces_pending_transaction_id).toBe(transactionId);
    const decision = await zack.from("recurring_items").select("is_confirmed,active").eq("id", recurring.data!.id).single();
    expect(decision.data).toEqual({ is_confirmed: true, active: false });
  });
});
