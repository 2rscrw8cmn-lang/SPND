import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticatedHousehold } from "@/lib/server-auth";
import { createClient } from "@/lib/supabase/server";
import { normalizeMerchant } from "@/lib/utils";

const schema = z.object({
  canonicalId: z.string().uuid(),
  duplicateIds: z.array(z.string().uuid()).min(1).max(20),
});

export async function POST(request: Request) {
  const auth = await authenticatedHousehold();
  if (!auth) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  const body = schema.safeParse(await request.json());
  if (!body.success || body.data.duplicateIds.includes(body.data.canonicalId)) return NextResponse.json({ message: "Choose one transaction to keep." }, { status: 400 });

  const supabase = await createClient();
  const ids = [body.data.canonicalId, ...new Set(body.data.duplicateIds)];
  const { data: transactions } = await supabase.from("transactions")
    .select("id,account_id,amount_cents,merchant,display_name,transacted_at,superseded_by_transaction_id")
    .eq("household_id", auth.householdId).in("id", ids);
  if (!transactions || transactions.length !== ids.length) return NextResponse.json({ message: "One or more transactions could not be found." }, { status: 404 });

  const canonical = transactions.find((transaction) => transaction.id === body.data.canonicalId)!;
  const canonicalName = normalizeMerchant((canonical.display_name as string | null) || canonical.merchant as string);
  const canonicalTime = new Date(canonical.transacted_at as string).getTime();
  const valid = transactions.every((transaction) =>
    !transaction.superseded_by_transaction_id &&
    transaction.account_id === canonical.account_id &&
    Number(transaction.amount_cents) === Number(canonical.amount_cents) &&
    normalizeMerchant((transaction.display_name as string | null) || transaction.merchant as string) === canonicalName &&
    Math.abs(new Date(transaction.transacted_at as string).getTime() - canonicalTime) <= 3 * 24 * 60 * 60 * 1000
  );
  if (!valid) return NextResponse.json({ message: "These transactions no longer match. Refresh and review them again." }, { status: 409 });

  const now = new Date().toISOString();
  const duplicateIds = ids.filter((id) => id !== canonical.id);
  const { error } = await supabase.from("transactions").update({ superseded_by_transaction_id: canonical.id, excluded: true, review_status: "reviewed", reviewed_at: now, reviewed_by: auth.userId, updated_at: now }).eq("household_id", auth.householdId).in("id", duplicateIds);
  if (error) return NextResponse.json({ message: "The duplicates could not be merged." }, { status: 500 });
  await supabase.from("audit_events").insert({ household_id: auth.householdId, actor_user_id: auth.userId, entity_type: "transaction", entity_id: canonical.id, action: "duplicates_merged", metadata: { duplicateIds } });
  return NextResponse.json({ message: `${duplicateIds.length} duplicate${duplicateIds.length === 1 ? "" : "s"} merged.`, removedIds: duplicateIds });
}
