import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticatedHousehold } from "@/lib/server-auth";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  role: z.enum(["cash", "credit_card", "investment", "other_liability", "excluded"]),
  payInFull: z.boolean(),
  liabilityBalanceSign: z.union([z.literal(-1), z.literal(1), z.null()]),
  balanceBasis: z.enum(["needs_review", "current", "available"]),
  pendingTransactionsInBalance: z.boolean().nullable(),
  creditCardDueDate: z.string().date().nullable(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticatedHousehold();
  if (!auth) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  const body = schema.safeParse(await request.json());
  const { id } = await params;
  if (!body.success || !z.string().uuid().safeParse(id).success) return NextResponse.json({ message: "Invalid account setting." }, { status: 400 });
  if (body.data.balanceBasis === "available" && body.data.role !== "cash") return NextResponse.json({ message: "Available balance is only a cash-account basis." }, { status: 400 });
  const supabase = await createClient();
  const updates = {
    account_role: body.data.role,
    credit_card_pay_in_full: body.data.role === "credit_card" && body.data.payInFull,
    liability_balance_sign: body.data.role === "credit_card" || body.data.role === "other_liability" ? body.data.liabilityBalanceSign : null,
    balance_basis_state: body.data.balanceBasis,
    pending_transactions_in_balance: body.data.pendingTransactionsInBalance,
    credit_card_due_date: body.data.role === "credit_card" ? body.data.creditCardDueDate : null,
    cash_flow_mode: body.data.role === "cash" ? "cash" : body.data.role === "excluded" ? "excluded" : "net_worth",
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase.from("accounts").update(updates).eq("id", id).eq("household_id", auth.householdId);
  if (!error) await supabase.from("audit_events").insert({ household_id: auth.householdId, actor_user_id: auth.userId, entity_type: "account", entity_id: id, action: "account_treatment_updated", metadata: body.data });
  return NextResponse.json({ message: error ? "Account setting could not be saved." : "Account treatment saved." }, { status: error ? 500 : 200 });
}
