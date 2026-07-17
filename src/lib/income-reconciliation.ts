import "server-only";

import { addMonths, format, startOfMonth, subMonths } from "date-fns";
import type { SupabaseClient } from "@supabase/supabase-js";
import { incomeOccurrencesForMonth, type IncomeSchedule } from "@/lib/expected-income";
import { chooseAutomaticIncomeMatch, type MatchableIncomeOccurrence } from "@/lib/income-matching";
import { normalizeMerchant } from "@/lib/utils";

type IncomeSourceRow = {
  id: string;
  name: string;
  expected_amount_cents: number | string;
  cadence: string | null;
  explicit_dates: string[] | null;
  next_expected_date: string | null;
  active: boolean;
  source_type: "recurring" | "one_time";
  acceptable_variance_cents: number | string | null;
  normalized_merchant: string | null;
  auto_match_enabled: boolean;
};

export async function materializeIncomeOccurrences(
  supabase: SupabaseClient,
  householdId: string,
) {
  const { data: sourceData, error: sourceError } = await supabase
    .from("expected_income_sources")
    .select("id,name,expected_amount_cents,cadence,explicit_dates,next_expected_date,active,source_type,acceptable_variance_cents,normalized_merchant,auto_match_enabled")
    .eq("household_id", householdId)
    .eq("active", true);
  if (sourceError) throw sourceError;
  const sources = (sourceData ?? []) as IncomeSourceRow[];
  const start = startOfMonth(new Date());
  const months = Array.from({ length: 12 }, (_, index) => format(addMonths(start, index), "yyyy-MM"));
  const desired = sources.flatMap((source) => {
    const schedule: IncomeSchedule = {
      id: source.id,
      name: source.name,
      expectedAmountCents: Number(source.expected_amount_cents),
      cadence: source.cadence,
      explicitDates: source.explicit_dates ?? [],
      nextExpectedDate: source.next_expected_date,
      active: source.active,
      sourceType: source.source_type,
    };
    return months.flatMap((month) => incomeOccurrencesForMonth([schedule], month));
  });
  const end = format(addMonths(start, 12), "yyyy-MM-dd");
  const { data: existingData, error: existingError } = await supabase
    .from("planned_items")
    .select("id,name,amount_cents,expected_income_source_id,date,state,matched_transaction_id")
    .eq("household_id", householdId)
    .eq("type", "income")
    .not("expected_income_source_id", "is", null)
    .gte("date", format(start, "yyyy-MM-dd"))
    .lt("date", end);
  if (existingError) throw existingError;
  const desiredKeys = new Set(desired.map((item) => `${item.sourceId}:${item.date}`));
  const existing = new Map((existingData ?? []).map((item) => [`${item.expected_income_source_id}:${item.date}`, item]));
  const obsoleteIds = (existingData ?? []).filter((item) => item.state === "confirmed" && !item.matched_transaction_id && !desiredKeys.has(`${item.expected_income_source_id}:${item.date}`)).map((item) => item.id as string);
  if (obsoleteIds.length) {
    const { error: archiveError } = await supabase.from("planned_items").update({ state: "inactive", updated_at: new Date().toISOString() }).in("id", obsoleteIds).eq("household_id", householdId);
    if (archiveError) throw archiveError;
  }
  const upserts = desired.filter((item) => {
    const current = existing.get(`${item.sourceId}:${item.date}`);
    return !current || (!current.matched_transaction_id && ["confirmed", "inactive"].includes(current.state as string) && (current.state !== "confirmed" || current.name !== item.name || Number(current.amount_cents) !== item.amountCents));
  });
  if (!upserts.length) return obsoleteIds.length;
  const { error: insertError } = await supabase.from("planned_items").upsert(
    upserts.map((item) => ({
      household_id: householdId,
      expected_income_source_id: item.sourceId,
      name: item.name,
      date: item.date,
      amount_cents: item.amountCents,
      type: "income",
      state: "confirmed",
      updated_at: new Date().toISOString(),
    })),
    { onConflict: "household_id,expected_income_source_id,date", ignoreDuplicates: true },
  );
  if (insertError) throw insertError;
  return upserts.length + obsoleteIds.length;
}

export async function reconcileIncomeForHousehold(
  supabase: SupabaseClient,
  householdId: string,
  actorUserId?: string,
) {
  await materializeIncomeOccurrences(supabase, householdId);
  const occurrenceStart = format(subMonths(startOfMonth(new Date()), 1), "yyyy-MM-dd");
  const [{ data: occurrenceData, error: occurrenceError }, { data: transactionData, error: transactionError }] = await Promise.all([
    supabase
      .from("planned_items")
      .select("id,date,amount_cents,expected_income_source_id,expected_income_sources(id,normalized_merchant,auto_match_enabled,acceptable_variance_cents)")
      .eq("household_id", householdId)
      .eq("type", "income")
      .eq("state", "confirmed")
      .is("matched_transaction_id", null)
      .not("expected_income_source_id", "is", null)
      .gte("date", occurrenceStart),
    supabase
      .from("transactions")
      .select("id,merchant,normalized_merchant,amount_cents,status,transacted_at,excluded,is_transfer")
      .eq("household_id", householdId)
      .eq("status", "posted")
      .eq("excluded", false)
      .eq("is_transfer", false)
      .is("superseded_by_transaction_id", null)
      .gt("amount_cents", 0)
      .gte("transacted_at", `${occurrenceStart}T00:00:00.000Z`)
      .order("transacted_at"),
  ]);
  if (occurrenceError) throw occurrenceError;
  if (transactionError) throw transactionError;

  const { data: matchedData, error: matchedError } = await supabase
    .from("planned_items")
    .select("matched_transaction_id")
    .eq("household_id", householdId)
    .not("matched_transaction_id", "is", null);
  if (matchedError) throw matchedError;
  const alreadyMatched = new Set((matchedData ?? []).map((item) => item.matched_transaction_id as string));
  const available: MatchableIncomeOccurrence[] = (occurrenceData ?? []).flatMap((item) => {
    const relation = Array.isArray(item.expected_income_sources) ? item.expected_income_sources[0] : item.expected_income_sources;
    if (!relation || !item.expected_income_source_id) return [];
    return [{
      id: item.id as string,
      sourceId: item.expected_income_source_id as string,
      normalizedMerchant: relation.normalized_merchant as string | null,
      autoMatchEnabled: Boolean(relation.auto_match_enabled),
      amountCents: Number(item.amount_cents),
      date: item.date as string,
      acceptableVarianceCents: relation.acceptable_variance_cents === null ? null : Number(relation.acceptable_variance_cents),
    }];
  });
  let matches = 0;
  for (const transaction of transactionData ?? []) {
    if (alreadyMatched.has(transaction.id as string)) continue;
    const decision = chooseAutomaticIncomeMatch({
      id: transaction.id as string,
      normalizedMerchant: (transaction.normalized_merchant as string | null) ?? normalizeMerchant(transaction.merchant as string),
      amountCents: Number(transaction.amount_cents),
      date: (transaction.transacted_at as string).slice(0, 10),
      status: transaction.status as "posted",
      excluded: Boolean(transaction.excluded),
      isTransfer: Boolean(transaction.is_transfer),
    }, available);
    if (decision.kind !== "match") continue;
    const { data: updated, error } = await supabase
      .from("planned_items")
      .update({ state: "matched", matched_transaction_id: transaction.id, match_method: "automatic", updated_at: new Date().toISOString() })
      .eq("id", decision.occurrenceId)
      .eq("household_id", householdId)
      .eq("state", "confirmed")
      .is("matched_transaction_id", null)
      .select("id")
      .maybeSingle();
    if (error || !updated) continue;
    matches += 1;
    available.splice(available.findIndex((item) => item.id === decision.occurrenceId), 1);
    await supabase.from("audit_events").insert({
      household_id: householdId,
      actor_user_id: actorUserId ?? null,
      entity_type: "planned_item",
      entity_id: decision.occurrenceId,
      action: "income_auto_matched",
      metadata: { transactionId: transaction.id, expectedIncomeSourceId: decision.sourceId },
    });
  }
  return matches;
}

export async function attemptIncomeReconciliation(
  supabase: SupabaseClient,
  householdId: string,
  actorUserId?: string,
) {
  try {
    await reconcileIncomeForHousehold(supabase, householdId, actorUserId);
    return true;
  } catch (error) {
    console.error("Income reconciliation will be retried during the next synchronization.", error);
    return false;
  }
}
