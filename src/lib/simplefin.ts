import "server-only";

import { subDays } from "date-fns";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptSecret } from "@/lib/crypto";
import { findPendingMatch, pendingMatchKey, reconcileAllocationAmounts, sourceFingerprint, type ImportedTransaction } from "@/lib/reconcile";
import { shouldReopenAfterPendingChange } from "@/lib/remembered-rules";
import { normalizeMerchant } from "@/lib/utils";
import { buildSyncWindows, connectionNames, sanitizeProviderIssues, transactionDate, type SimpleFinResponse } from "@/lib/simplefin-core";

function cents(amount: string) {
  const parsed = Number(amount);
  if (!Number.isFinite(parsed)) throw new Error("Provider returned an invalid money value.");
  return Math.round(parsed * 100);
}

function accountsUrl(accessUrl: string, start: Date, end: Date) {
  const access = new URL(accessUrl);
  const username = decodeURIComponent(access.username);
  const password = decodeURIComponent(access.password);
  access.username = "";
  access.password = "";
  access.pathname = `${access.pathname.replace(/\/$/, "")}/accounts`;
  const url = access;
  url.searchParams.set("version", "2");
  url.searchParams.set("pending", "1");
  url.searchParams.set("start-date", String(Math.floor(start.getTime() / 1000)));
  url.searchParams.set("end-date", String(Math.floor(end.getTime() / 1000)));
  return {
    url,
    authorization: `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`,
  };
}

async function fetchWindow(accessUrl: string, start: Date, end: Date) {
  const request = accountsUrl(accessUrl, start, end);
  try {
    const response = await fetch(request.url, {
      headers: { accept: "application/json", authorization: request.authorization },
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error(`SimpleFIN request failed with status ${response.status}.`);
    return (await response.json()) as SimpleFinResponse;
  } catch (error) {
    if (error instanceof Error && /^SimpleFIN request failed with status \d+\.$/.test(error.message)) throw error;
    throw new Error("SimpleFIN request could not be completed without exposing connection credentials.");
  }
}

export async function syncConnection(connectionId: string, initial = false) {
  const admin = createAdminClient();
  const { data: connection, error: connectionError } = await admin
    .from("financial_connections")
    .select("id, household_id, encrypted_access_url, encryption_iv, encryption_auth_tag")
    .eq("id", connectionId)
    .single();
  if (connectionError || !connection?.encrypted_access_url || !connection.encryption_iv || !connection.encryption_auth_tag) {
    throw new Error("Connection is unavailable.");
  }

  const accessUrl = decryptSecret({
    ciphertext: connection.encrypted_access_url,
    iv: connection.encryption_iv,
    authTag: connection.encryption_auth_tag,
  });
  const { data: run } = await admin.from("sync_runs").insert({
    household_id: connection.household_id,
    connection_id: connection.id,
    status: "running",
  }).select("id").single();

  let accountCount = 0;
  const syncedAccountIds = new Set<string>();
  const receivedTransactionKeys = new Set<string>();
  const createdTransactionKeys = new Set<string>();
  const updatedTransactionKeys = new Set<string>();
  const reconciledTransactionIds = new Set<string>();
  const knownFingerprintsByAccount = new Map<string, Set<string>>();
  const providerWarnings = new Set<string>();
  try {
    const now = new Date();
    const windows = buildSyncWindows(now, initial);

    const [{ data: rules }, { data: categories }] = await Promise.all([
      admin.from("merchant_rules").select("normalized_merchant,category_id").eq("household_id", connection.household_id).eq("active", true).order("priority", { ascending: false }),
      admin.from("categories").select("id,name").eq("household_id", connection.household_id),
    ]);
    const ruleMap = new Map((rules ?? []).map((rule) => [rule.normalized_merchant as string, rule.category_id as string]));
    const unsortedId = (categories ?? []).find((category) => category.name === "Unsorted")?.id as string | undefined;

    for (const { start, endExclusive } of windows) {
      const payload = await fetchWindow(accessUrl, start, endExclusive);
      if (payload.errors?.length || payload.errlist?.length) {
        const issues = sanitizeProviderIssues(payload);
        for (const issue of issues) providerWarnings.add(issue);
        if (!(payload.accounts?.length)) throw new Error(issues.length ? issues.join(" ") : "SimpleFIN reported an account connection issue.");
      }
      const institutionNames = connectionNames(payload);
      for (const providerAccount of payload.accounts ?? []) {
        const providerConnectionId = providerAccount.conn_id ?? "";
        if (providerConnectionId) {
          const { data: legacyAccount } = await admin.from("accounts").select("id").eq("household_id", connection.household_id).eq("provider_account_id", providerAccount.id).eq("provider_connection_id", "").maybeSingle();
          if (legacyAccount) await admin.from("accounts").update({ provider_connection_id: providerConnectionId }).eq("id", legacyAccount.id);
        }
        const { data: account, error: accountError } = await admin.from("accounts").upsert({
          household_id: connection.household_id,
          connection_id: connection.id,
          provider_connection_id: providerConnectionId,
          provider_account_id: providerAccount.id,
          institution_name: (providerConnectionId ? institutionNames.get(providerConnectionId) : undefined) ?? providerAccount.conn_name ?? null,
          name: providerAccount.name,
          currency: providerAccount.currency ?? "USD",
          current_balance_cents: cents(providerAccount.balance),
          available_balance_cents: providerAccount["available-balance"] ? cents(providerAccount["available-balance"]) : null,
          balance_as_of: providerAccount["balance-date"] ? new Date(providerAccount["balance-date"] * 1000).toISOString() : now.toISOString(),
          updated_at: now.toISOString(),
        }, { onConflict: "household_id,provider_connection_id,provider_account_id" }).select("id").single();
        if (accountError || !account) throw new Error("Unable to save an imported account.");
        syncedAccountIds.add(account.id as string);
        accountCount = syncedAccountIds.size;

        const { data: existingPending } = await admin.from("transactions")
          .select("id, account_id, provider_transaction_id, transacted_at, amount_cents, merchant, display_name, status, note, excluded, is_transfer, is_recurring, review_status, reviewed_at, reviewed_by")
          .eq("account_id", account.id).eq("status", "pending").is("superseded_by_transaction_id", null);
        const pending = (existingPending ?? []).map((item) => ({
          accountId: item.account_id as string,
          providerId: item.provider_transaction_id ?? undefined,
          date: item.transacted_at as string,
          amountCents: Number(item.amount_cents),
          merchant: item.merchant as string,
          status: "pending" as const,
          databaseId: item.id as string,
        }));

        let knownFingerprints = knownFingerprintsByAccount.get(account.id as string);
        if (!knownFingerprints) {
          const { data: existingTransactions } = await admin.from("transactions").select("source_fingerprint").eq("account_id", account.id);
          knownFingerprints = new Set((existingTransactions ?? []).map((item) => item.source_fingerprint as string));
          knownFingerprintsByAccount.set(account.id as string, knownFingerprints);
        }

        for (const providerTransaction of providerAccount.transactions ?? []) {
          const date = transactionDate(providerTransaction);
          if (!date) {
            providerWarnings.add("SimpleFIN returned a pending transaction without a usable transaction date; it was skipped for review.");
            continue;
          }
          const transaction: ImportedTransaction = {
            accountId: account.id,
            providerId: providerTransaction.id,
            date,
            amountCents: cents(providerTransaction.amount),
            merchant: providerTransaction.description.trim() || "Unknown merchant",
            status: providerTransaction.pending ? "pending" : "posted",
          };
          const fingerprint = sourceFingerprint(transaction);
          const receivedKey = `${account.id}:${fingerprint}`;
          receivedTransactionKeys.add(receivedKey);
          const existedBeforeSync = knownFingerprints.has(fingerprint);
          const match = transaction.status === "posted" ? findPendingMatch(transaction, pending.filter((candidate) => candidate.providerId !== transaction.providerId)) : undefined;
          const matchId = match && "databaseId" in match ? String(match.databaseId) : null;
          const normalized = normalizeMerchant(transaction.merchant);
          const { data: savedTransaction, error: transactionError } = await admin.from("transactions").upsert({
            household_id: connection.household_id,
            account_id: account.id,
            provider_transaction_id: providerTransaction.id ?? null,
            source_fingerprint: fingerprint,
            pending_match_key: pendingMatchKey(transaction),
            replaces_pending_transaction_id: matchId,
            transacted_at: transaction.date,
            posted_at: transaction.status === "posted" ? transaction.date : null,
            amount_cents: transaction.amountCents,
            merchant: transaction.merchant,
            normalized_merchant: normalized,
            raw_description: providerTransaction.description,
            status: transaction.status,
            raw_payload: providerTransaction,
            updated_at: now.toISOString(),
          }, { onConflict: "account_id,source_fingerprint", ignoreDuplicates: false }).select("id").single();
          if (transactionError || !savedTransaction) throw new Error("Unable to save an imported transaction.");
          knownFingerprints.add(fingerprint);
          if (!createdTransactionKeys.has(receivedKey)) {
            (existedBeforeSync ? updatedTransactionKeys : createdTransactionKeys).add(receivedKey);
          }

          let { data: existingAllocation } = await admin.from("transaction_allocations").select("id").eq("transaction_id", savedTransaction.id).limit(1).maybeSingle();
          if (matchId) {
            const pendingSource = (existingPending ?? []).find((item) => item.id === matchId);
            const { data: pendingAllocations } = await admin.from("transaction_allocations").select("category_id,amount_cents,source").eq("transaction_id", matchId);
            if (pendingSource) {
              const reopenReview = shouldReopenAfterPendingChange({ reviewed: pendingSource.review_status === "reviewed", pendingAmountCents: Number(pendingSource.amount_cents), postedAmountCents: transaction.amountCents, split: (pendingAllocations?.length ?? 0) > 1 });
              await admin.from("transactions").update({ display_name: pendingSource.display_name, note: pendingSource.note, excluded: pendingSource.excluded, is_transfer: pendingSource.is_transfer, is_recurring: pendingSource.is_recurring, review_status: reopenReview ? "needs_review" : pendingSource.review_status, reviewed_at: reopenReview ? null : pendingSource.reviewed_at, reviewed_by: reopenReview ? null : pendingSource.reviewed_by, updated_at: now.toISOString() }).eq("id", savedTransaction.id);
            }
            if (!existingAllocation) {
              if (pendingAllocations?.length) {
                const reconciledAllocations = reconcileAllocationAmounts(pendingAllocations.map((allocation) => ({ category_id: allocation.category_id, amountCents: Number(allocation.amount_cents), source: allocation.source })), transaction.amountCents);
                await admin.from("transaction_allocations").insert(reconciledAllocations.map((allocation) => ({ household_id: connection.household_id, transaction_id: savedTransaction.id, category_id: allocation.category_id, amount_cents: allocation.amountCents, source: allocation.source })));
                existingAllocation = { id: "copied-from-pending" };
              }
            }
          }
          if (!existingAllocation) {
            let categoryId = ruleMap.get(normalized);
            let source: "merchant_rule" | "merchant_history" | "unsorted" = categoryId ? "merchant_rule" : "unsorted";
            if (!categoryId && transaction.amountCents < 0) {
              const { data: priorTransactions } = await admin.from("transactions").select("id").eq("household_id", connection.household_id).eq("normalized_merchant", normalized).neq("id", savedTransaction.id).eq("status", "posted").order("transacted_at", { ascending: false }).limit(10);
              const priorIds = (priorTransactions ?? []).map((item) => item.id as string);
              if (priorIds.length) {
                const { data: priorAllocation } = await admin.from("transaction_allocations").select("category_id").in("transaction_id", priorIds).order("created_at", { ascending: false }).limit(1).maybeSingle();
                if (priorAllocation) { categoryId = priorAllocation.category_id as string; source = "merchant_history"; }
              }
            }
            categoryId ??= unsortedId;
            if (categoryId) await admin.from("transaction_allocations").insert({ household_id: connection.household_id, transaction_id: savedTransaction.id, category_id: categoryId, amount_cents: transaction.amountCents, source });
          }
          if (matchId) {
            await admin.from("transactions").update({ excluded: true, superseded_by_transaction_id: savedTransaction.id, updated_at: now.toISOString() }).eq("id", matchId).eq("status", "pending");
            await admin.from("audit_events").insert({ household_id: connection.household_id, entity_type: "transaction", entity_id: savedTransaction.id, action: "pending_reconciled", metadata: { pendingTransactionId: matchId } });
            reconciledTransactionIds.add(savedTransaction.id as string);
          }
        }
      }
    }
    await detectRecurringCandidates(connection.household_id as string);
    const finishedAt = new Date().toISOString();
    const warnings = [...providerWarnings];
    const partial = warnings.length > 0;
    const summary = {
      accountCount,
      transactionCount: receivedTransactionKeys.size,
      receivedCount: receivedTransactionKeys.size,
      createdCount: createdTransactionKeys.size,
      updatedCount: updatedTransactionKeys.size,
      reconciledCount: reconciledTransactionIds.size,
      partial,
      warnings,
    };
    const connectionUpdate: Record<string, unknown> = { status: partial ? "error" : "active", last_error: partial ? warnings.join(" ") : null, updated_at: finishedAt };
    if (!partial) connectionUpdate.last_synced_at = finishedAt;
    await admin.from("financial_connections").update(connectionUpdate).eq("id", connection.id);
    if (run) await admin.from("sync_runs").update({ status: partial ? "error" : "success", finished_at: finishedAt, summary, sanitized_error: partial ? warnings.join(" ") : null }).eq("id", run.id);
    return summary;
  } catch (error) {
    const message = error instanceof Error && !/https?:\/\//i.test(error.message) ? error.message : "SimpleFIN sync failed.";
    const finishedAt = new Date().toISOString();
    await admin.from("financial_connections").update({ status: "error", last_error: message, updated_at: finishedAt }).eq("id", connection.id);
    if (run) await admin.from("sync_runs").update({ status: "error", finished_at: finishedAt, sanitized_error: message }).eq("id", run.id);
    throw error;
  }
}

async function detectRecurringCandidates(householdId: string) {
  const admin = createAdminClient();
  const since = subDays(new Date(), 190).toISOString();
  const { data } = await admin.from("transactions").select("normalized_merchant,merchant,amount_cents,transacted_at")
    .eq("household_id", householdId).eq("status", "posted").eq("excluded", false).gte("transacted_at", since).order("transacted_at");
  const groups = new Map<string, Array<{ merchant: string; amount: number; date: Date }>>();
  for (const item of data ?? []) {
    const key = item.normalized_merchant as string;
    const items = groups.get(key) ?? [];
    items.push({ merchant: item.merchant as string, amount: Number(item.amount_cents), date: new Date(item.transacted_at as string) });
    groups.set(key, items);
  }
  for (const [pattern, items] of groups) {
    if (items.length < 3 || !pattern) continue;
    const recent = items.slice(-4);
    const intervals = recent.slice(1).map((item, index) => (item.date.getTime() - recent[index]!.date.getTime()) / 86_400_000);
    const monthly = intervals.length >= 2 && intervals.every((days) => days >= 25 && days <= 35);
    const average = recent.reduce((sum, item) => sum + Math.abs(item.amount), 0) / recent.length;
    const stableAmount = recent.every((item) => Math.abs(Math.abs(item.amount) - average) / Math.max(1, average) <= 0.12);
    if (!monthly || !stableAmount) continue;
    const last = recent.at(-1)!;
    const nextDue = new Date(last.date); nextDue.setMonth(nextDue.getMonth() + 1);
    const type = last.amount >= 0 ? "income" : "expense";
    const inference = {
      name: last.merchant,
      amount_cents: Math.round(Math.abs(average)),
      cadence: "monthly",
      next_due_date: nextDue.toISOString().slice(0, 10),
      updated_at: new Date().toISOString(),
    };
    const { data: existing } = await admin.from("recurring_items").select("id").eq("household_id", householdId).eq("type", type).eq("merchant_pattern", pattern).maybeSingle();
    if (existing) {
      await admin.from("recurring_items").update(inference).eq("id", existing.id);
    } else {
      await admin.from("recurring_items").insert({ household_id: householdId, type, merchant_pattern: pattern, ...inference, is_confirmed: false, active: true });
    }
  }
}

export function suggestedCategory(merchant: string, rules: Array<{ normalizedMerchant: string; categoryId: string }>) {
  const normalized = normalizeMerchant(merchant);
  return rules.find((rule) => rule.normalizedMerchant === normalized)?.categoryId;
}
