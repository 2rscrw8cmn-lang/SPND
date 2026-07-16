import "server-only";

import { addMonths, endOfMonth, format, isValid, parseISO, startOfMonth } from "date-fns";
import { demoCategories, demoPlan, demoSafeBreakdown, demoTransactions } from "@/lib/demo-data";
import { isDemoMode } from "@/lib/env";
import { resolveCategoryIcon } from "@/lib/category-style";
import { calculateSafeToSpnd } from "@/lib/safe-to-spnd";
import { incomeOccurrencesForMonth, receivedIncomeTotal, type IncomeSchedule } from "@/lib/expected-income";
import { createClient } from "@/lib/supabase/server";

export type BudgetCategory = {
  id: string; name: string; color: string; icon: string; categoryGroup: string;
  isActive: boolean; isExcluded: boolean; showInBudget: boolean; behaviorType: "spending" | "obligation" | "goal" | "income" | "excluded";
  budgetedCents: number; spentCents: number; pendingCents: number;
  recentTransactions: BudgetTransaction[];
};

export type CategoryGroup = { id: string; name: string; sortOrder: number; isSystem: boolean };

export type HouseholdSummary = { name: string; timezone: string; minimumCashBufferCents: number; memberCount: number };

export type AllocationSource = "manual" | "merchant_rule" | "merchant_history" | "provider" | "default" | "unsorted";

export type BudgetTransaction = { id: string; merchant: string; amountCents: number; isoDate: string; status: "pending" | "posted"; reviewStatus: "needs_review" | "reviewed"; allocationSource?: AllocationSource | null };

export type BudgetWorkspace = {
  month: string; categories: BudgetCategory[]; categoryGroups: CategoryGroup[]; unsortedCount: number; unsortedCents: number;
  totals: { expectedIncomeCents: number; receivedIncomeCents: number; remainingExpectedIncomeCents: number; budgetedCents: number; leftToAssignCents: number; spentCents: number; pendingCents: number; remainingCents: number };
  expectedIncome: Array<{ sourceId: string; name: string; date: string; amountCents: number }>;
  monthSetup: { previousCategoryCount: number; previousTotalCents: number; templateCategoryCount: number; templateTotalCents: number };
};

export type ExpectedIncomeSource = IncomeSchedule & { acceptableVarianceCents: number | null };
export type ReceivedIncomeTransaction = ActivityTransaction & { matchedTo: { plannedItemId: string; name: string } | null };
export type OpenIncomeExpectation = { id: string; name: string; date: string; amountCents: number };
export type IncomeViewData = { month: string; expectedCents: number; receivedCents: number; remainingCents: number; upcoming: BudgetWorkspace["expectedIncome"]; received: ReceivedIncomeTransaction[]; unmatched: ActivityTransaction[]; openExpectations: OpenIncomeExpectation[] };

const emptyBudgetTotals = { expectedIncomeCents: 0, receivedIncomeCents: 0, remainingExpectedIncomeCents: 0, budgetedCents: 0, leftToAssignCents: 0, spentCents: 0, pendingCents: 0, remainingCents: 0 };

const demoCategoryGroups: CategoryGroup[] = [
  { id: "demo-income", name: "Income", sortOrder: 5, isSystem: true },
  { id: "demo-essentials", name: "Essentials", sortOrder: 10, isSystem: true },
  { id: "demo-lifestyle", name: "Lifestyle", sortOrder: 20, isSystem: true },
  { id: "demo-goals", name: "Goals", sortOrder: 30, isSystem: true },
  { id: "demo-excluded", name: "Excluded", sortOrder: 90, isSystem: true },
];

export type ActivityTransaction = {
  id: string; merchant: string; importedMerchant: string; categoryId: string; category: string; amountCents: number;
  date: string; isoDate: string; status: "pending" | "posted"; color: string;
  accountId: string; accountName: string; rawDescription: string; note: string;
  excluded: boolean; isTransfer: boolean; isRecurring: boolean;
  reviewStatus: "needs_review" | "reviewed"; reviewedAt: string | null;
  updatedAt: string;
  allocationSource: AllocationSource | null;
  allocations: Array<{ categoryId: string; category: string; amountCents: number }>;
  auditHistory: Array<{ id: string; action: string; createdAt: string; undoable: boolean }>;
};

export type ConnectionHealth = {
  status: "active" | "error" | "disconnected" | "unconfigured";
  lastSuccessfulSync: string | null; lastAttemptedSync: string | null;
  accountCount: number; transactionCount: number; lastResult: string | null;
  sanitizedError: string | null;
};

export type ImportInboxItem = {
  id: string; fileName: string; importType: string; status: string; createdAt: string;
  acceptedRows: number; duplicateRows: number; reviewRows: number;
  errors: string[];
  rows: Array<{ id: string; rowNumber: number; status: string; normalized: Record<string, unknown>; errors: string[] }>;
};

export function normalizeBudgetMonth(value?: string) {
  const parsed = value ? parseISO(`${value.slice(0, 7)}-01`) : new Date();
  return startOfMonth(isValid(parsed) ? parsed : new Date());
}

async function householdContext() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) return null;
  const { data: membership } = await supabase.from("household_members").select("household_id").eq("user_id", userId).maybeSingle();
  return membership ? { supabase, householdId: membership.household_id as string } : null;
}

export async function getBudgetWorkspace(monthValue?: string): Promise<BudgetWorkspace> {
  const monthDate = normalizeBudgetMonth(monthValue);
  const month = format(monthDate, "yyyy-MM-dd");
  if (isDemoMode) {
    const isCurrentMonth = month === format(startOfMonth(new Date()), "yyyy-MM-dd");
    const categories = demoCategories.map((category) => ({
      ...category,
      budgetedCents: isCurrentMonth ? category.budgetedCents : 0,
      spentCents: isCurrentMonth ? category.spentCents : 0,
      pendingCents: isCurrentMonth ? category.pendingCents : 0,
      recentTransactions: isCurrentMonth ? demoTransactions.filter((transaction) => transaction.categoryId === category.id && transaction.amountCents < 0).map(({ id, merchant, amountCents, isoDate, status, reviewStatus }) => ({ id, merchant, amountCents, isoDate, status, reviewStatus })) : [],
    }));
    const budgetedCents = categories.reduce((sum, item) => sum + item.budgetedCents, 0);
    const spentCents = categories.reduce((sum, item) => sum + item.spentCents, 0);
    const pendingCents = categories.reduce((sum, item) => sum + item.pendingCents, 0);
    const expectedIncomeCents = isCurrentMonth ? 685000 : 0; const receivedIncomeCents = isCurrentMonth ? 342500 : 0;
    return { month, categories, categoryGroups: demoCategoryGroups, unsortedCount: isCurrentMonth ? 1 : 0, unsortedCents: isCurrentMonth ? 7421 : 0, expectedIncome: isCurrentMonth ? [{ sourceId: "demo-income", name: "Paycheck", date: format(new Date(), "yyyy-MM-dd"), amountCents: 342500 }, { sourceId: "demo-income", name: "Paycheck", date: format(addMonths(new Date(), 0), "yyyy-MM-28"), amountCents: 342500 }] : [], monthSetup: { previousCategoryCount: 6, previousTotalCents: 517500, templateCategoryCount: 6, templateTotalCents: 517500 }, totals: { expectedIncomeCents, receivedIncomeCents, remainingExpectedIncomeCents: Math.max(0, expectedIncomeCents - receivedIncomeCents), budgetedCents, leftToAssignCents: expectedIncomeCents - budgetedCents, spentCents, pendingCents, remainingCents: budgetedCents - spentCents - pendingCents } };
  }
  const context = await householdContext();
  if (!context) return { month, categories: [], categoryGroups: [], unsortedCount: 0, unsortedCents: 0, expectedIncome: [], monthSetup: { previousCategoryCount: 0, previousTotalCents: 0, templateCategoryCount: 0, templateTotalCents: 0 }, totals: emptyBudgetTotals };
  const monthStart = monthDate.toISOString();
  const nextMonthStart = addMonths(monthDate, 1).toISOString();
  const previousMonth = format(addMonths(monthDate, -1), "yyyy-MM-dd");
  const [{ data: budgets }, { data: categoryRows }, { data: groupRows }, { data: previousBudgets }, { data: templates }, { data: incomeRows }, { data: matchedPlanItems }] = await Promise.all([
    context.supabase.from("monthly_budgets")
      .select("category_id,budgeted_cents")
      .eq("household_id", context.householdId).eq("month", month),
    context.supabase.from("categories").select("id,name,color,icon,category_group,is_active,is_excluded,show_in_budget,behavior_type").eq("household_id", context.householdId).order("sort_order"),
    context.supabase.from("category_groups").select("id,name,sort_order,is_system").eq("household_id", context.householdId).order("sort_order"),
    context.supabase.from("monthly_budgets").select("category_id,budgeted_cents").eq("household_id", context.householdId).eq("month", previousMonth).gt("budgeted_cents", 0),
    context.supabase.from("budget_templates").select("category_id,budgeted_cents").eq("household_id", context.householdId).gt("budgeted_cents", 0),
    context.supabase.from("expected_income_sources").select("id,name,expected_amount_cents,cadence,explicit_dates,next_expected_date,active,source_type,acceptable_variance_cents").eq("household_id", context.householdId).eq("active", true),
    context.supabase.from("planned_items").select("category_id,amount_cents,matched_transaction_id").eq("household_id", context.householdId).eq("state", "matched").gte("date", format(monthDate, "yyyy-MM-dd")).lt("date", format(addMonths(monthDate, 1), "yyyy-MM-dd")),
  ]);
  const { data: transactions } = await context.supabase.from("transactions")
    .select("id,status,amount_cents,merchant,transacted_at,review_status").eq("household_id", context.householdId).eq("excluded", false)
    .is("superseded_by_transaction_id", null)
    .or(`and(status.eq.posted,posted_at.gte.${monthStart},posted_at.lt.${nextMonthStart}),and(status.eq.pending,transacted_at.gte.${monthStart},transacted_at.lt.${nextMonthStart})`);
  const transactionIds = (transactions ?? []).map((transaction) => transaction.id as string);
  const { data: allocations } = transactionIds.length
    ? await context.supabase.from("transaction_allocations").select("transaction_id,category_id,amount_cents,source").in("transaction_id", transactionIds)
    : { data: [] };
  const spent = new Map<string, number>();
  const pending = new Map<string, number>();
  const statusById = new Map((transactions ?? []).map((transaction) => [transaction.id as string, transaction.status as string]));
  const allocatedIds = new Set<string>();
  const transactionById = new Map((transactions ?? []).map((transaction) => [transaction.id as string, transaction]));
  const recentByCategory = new Map<string, BudgetTransaction[]>();
  for (const allocation of allocations ?? []) {
    allocatedIds.add(allocation.transaction_id as string);
    const transaction = transactionById.get(allocation.transaction_id as string);
    if (transaction && Number(transaction.amount_cents) < 0) {
      const amount = Math.abs(Number(allocation.amount_cents));
      const target = statusById.get(allocation.transaction_id as string) === "pending" ? pending : spent;
      target.set(allocation.category_id as string, (target.get(allocation.category_id as string) ?? 0) + amount);
      const list = recentByCategory.get(allocation.category_id as string) ?? [];
      list.push({ id: transaction.id as string, merchant: transaction.merchant as string, amountCents: Number(allocation.amount_cents), isoDate: transaction.transacted_at as string, status: transaction.status as "pending" | "posted", reviewStatus: transaction.review_status as "needs_review" | "reviewed", allocationSource: (allocation.source ?? null) as AllocationSource | null });
      recentByCategory.set(allocation.category_id as string, list);
    }
  }
  const matchedTransactionIds = (matchedPlanItems ?? []).map((item) => item.matched_transaction_id as string | null).filter((id): id is string => Boolean(id));
  const { data: matchedTransactions } = matchedTransactionIds.length ? await context.supabase.from("transactions").select("id,excluded,is_transfer").in("id", matchedTransactionIds) : { data: [] };
  const matchedTransfers = new Set((matchedTransactions ?? []).filter((transaction) => transaction.excluded || transaction.is_transfer).map((transaction) => transaction.id as string));
  const behaviorByRawCategory = new Map((categoryRows ?? []).map((category) => [category.id as string, category.behavior_type as string]));
  for (const item of matchedPlanItems ?? []) if (item.category_id && item.matched_transaction_id && matchedTransfers.has(item.matched_transaction_id as string) && behaviorByRawCategory.get(item.category_id as string) === "goal") spent.set(item.category_id as string, (spent.get(item.category_id as string) ?? 0) + Math.abs(Number(item.amount_cents)));
  const budgetByCategory = new Map((budgets ?? []).map((budget) => [budget.category_id as string, Number(budget.budgeted_cents)]));
  const unsorted = (transactions ?? []).filter((transaction) => Number(transaction.amount_cents) < 0 && !allocatedIds.has(transaction.id as string));
  const categories = (categoryRows ?? []).filter((category) => category.name !== "Unsorted").map((category) => ({
      id: category.id as string,
      name: category.name as string,
      color: category.color as string,
      icon: resolveCategoryIcon(category.icon as string | null, category.name as string),
      categoryGroup: category.category_group as string,
      isActive: Boolean(category.is_active),
      isExcluded: Boolean(category.is_excluded),
      showInBudget: Boolean(category.show_in_budget),
      behaviorType: category.behavior_type as BudgetCategory["behaviorType"],
      budgetedCents: budgetByCategory.get(category.id as string) ?? 0,
      spentCents: spent.get(category.id as string) ?? 0,
      pendingCents: pending.get(category.id as string) ?? 0,
      recentTransactions: (recentByCategory.get(category.id as string) ?? []).sort((a, b) => b.isoDate.localeCompare(a.isoDate)).slice(0, 8),
  }));
  const fallbackGroupNames = Array.from(new Set(["Income", "Essentials", "Lifestyle", "Goals", ...categories.map((category) => category.categoryGroup), "Excluded"]));
  const categoryGroups = groupRows?.length
    ? groupRows.map((group) => ({ id: group.id as string, name: group.name as string, sortOrder: Number(group.sort_order), isSystem: Boolean(group.is_system) }))
    : fallbackGroupNames.map((name, index) => ({ id: `legacy-${name.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-")}`, name, sortOrder: name === "Excluded" ? 90 : (index + 1) * 10, isSystem: true }));
  const visible = categories.filter((category) => category.isActive && category.showInBudget && !category.isExcluded);
  const budgetedCents = visible.reduce((sum, item) => sum + item.budgetedCents, 0);
  const spentCents = visible.reduce((sum, item) => sum + item.spentCents, 0);
  const pendingCents = visible.reduce((sum, item) => sum + item.pendingCents, 0);
  const behaviorByCategory = new Map(categories.map((category) => [category.id, category.behaviorType]));
  const receivedIncomeCents = receivedIncomeTotal((transactions ?? []).map((transaction) => ({ id: transaction.id as string, amountCents: Number(transaction.amount_cents), status: transaction.status as string })), (allocations ?? []).map((allocation) => ({ transactionId: allocation.transaction_id as string, categoryId: allocation.category_id as string })), behaviorByCategory);
  const incomeSources = (incomeRows ?? []).map((source) => ({ id: source.id as string, name: source.name as string, expectedAmountCents: Number(source.expected_amount_cents), cadence: source.cadence as string | null, explicitDates: (source.explicit_dates as string[] | null) ?? [], nextExpectedDate: source.next_expected_date as string | null, active: Boolean(source.active), sourceType: source.source_type as "recurring" | "one_time" }));
  const expectedIncome = incomeOccurrencesForMonth(incomeSources, month);
  const expectedIncomeCents = expectedIncome.reduce((sum, item) => sum + item.amountCents, 0);
  return { month, categories, categoryGroups, expectedIncome, monthSetup: { previousCategoryCount: previousBudgets?.length ?? 0, previousTotalCents: (previousBudgets ?? []).reduce((sum, item) => sum + Number(item.budgeted_cents), 0), templateCategoryCount: templates?.length ?? 0, templateTotalCents: (templates ?? []).reduce((sum, item) => sum + Number(item.budgeted_cents), 0) }, unsortedCount: unsorted.length, unsortedCents: unsorted.reduce((sum, item) => sum + Math.abs(Number(item.amount_cents)), 0), totals: { expectedIncomeCents, receivedIncomeCents, remainingExpectedIncomeCents: Math.max(0, expectedIncomeCents - receivedIncomeCents), budgetedCents, leftToAssignCents: expectedIncomeCents - budgetedCents, spentCents, pendingCents, remainingCents: budgetedCents - spentCents - pendingCents } };
}

export async function getExpectedIncomeSources(): Promise<ExpectedIncomeSource[]> {
  if (isDemoMode) return [{ id: "demo-income", name: "Paycheck", expectedAmountCents: 342500, cadence: "biweekly", explicitDates: [], nextExpectedDate: format(new Date(), "yyyy-MM-dd"), active: true, sourceType: "recurring", acceptableVarianceCents: 5000 }];
  const context = await householdContext(); if (!context) return [];
  const { data } = await context.supabase.from("expected_income_sources").select("id,name,expected_amount_cents,cadence,explicit_dates,next_expected_date,active,source_type,acceptable_variance_cents").eq("household_id", context.householdId).order("active", { ascending: false }).order("next_expected_date");
  return (data ?? []).map((source) => ({ id: source.id as string, name: source.name as string, expectedAmountCents: Number(source.expected_amount_cents), cadence: source.cadence as string | null, explicitDates: (source.explicit_dates as string[] | null) ?? [], nextExpectedDate: source.next_expected_date as string | null, active: Boolean(source.active), sourceType: source.source_type as "recurring" | "one_time", acceptableVarianceCents: source.acceptable_variance_cents === null ? null : Number(source.acceptable_variance_cents) }));
}

export async function getIncomeView(monthValue?: string): Promise<IncomeViewData> {
  const workspace = await getBudgetWorkspace(monthValue);
  const month = workspace.month.slice(0, 7);
  const deposits = (await getActivityData(500, month, { filter: "income" })).filter((transaction) => transaction.amountCents > 0 && transaction.status === "posted" && !transaction.excluded && !transaction.isTransfer);
  if (isDemoMode) {
    const received = deposits.filter((transaction) => transaction.merchant === "Payroll").map((transaction) => ({ ...transaction, matchedTo: { plannedItemId: demoPlan[0]!.id, name: "Paycheck" } }));
    const unmatched = deposits.filter((transaction) => transaction.merchant !== "Payroll");
    const receivedCents = received.reduce((sum, transaction) => sum + transaction.amountCents, 0);
    return { month: workspace.month, expectedCents: workspace.totals.expectedIncomeCents, receivedCents, remainingCents: Math.max(0, workspace.totals.expectedIncomeCents - receivedCents), upcoming: workspace.expectedIncome, received, unmatched, openExpectations: [] };
  }
  const context = await householdContext();
  if (!context) return { month: workspace.month, expectedCents: 0, receivedCents: 0, remainingCents: 0, upcoming: [], received: [], unmatched: [], openExpectations: [] };
  const start = `${month}-01`; const end = format(addMonths(parseISO(start), 1), "yyyy-MM-dd");
  const [{ data: matches }, { data: openItems }] = await Promise.all([
    context.supabase.from("planned_items").select("id,name,matched_transaction_id").eq("household_id", context.householdId).eq("type", "income").eq("state", "matched").gte("date", start).lt("date", end).not("matched_transaction_id", "is", null),
    context.supabase.from("planned_items").select("id,name,date,amount_cents").eq("household_id", context.householdId).eq("type", "income").eq("state", "confirmed").is("matched_transaction_id", null).gte("date", start).lt("date", end).order("date"),
  ]);
  const matchByTransaction = new Map((matches ?? []).map((item) => [item.matched_transaction_id as string, { plannedItemId: item.id as string, name: item.name as string }]));
  const received = deposits.filter((transaction) => matchByTransaction.has(transaction.id)).map((transaction) => ({ ...transaction, matchedTo: matchByTransaction.get(transaction.id) ?? null }));
  const unmatched = deposits.filter((transaction) => !matchByTransaction.has(transaction.id));
  const receivedCents = received.reduce((sum, transaction) => sum + transaction.amountCents, 0);
  const openExpectations = (openItems ?? []).map((item) => ({ id: item.id as string, name: item.name as string, date: item.date as string, amountCents: Number(item.amount_cents) }));
  return { month: workspace.month, expectedCents: workspace.totals.expectedIncomeCents, receivedCents, remainingCents: Math.max(0, workspace.totals.expectedIncomeCents - receivedCents), upcoming: workspace.expectedIncome, received, unmatched, openExpectations };
}

export async function getNextExpectedIncome(): Promise<{ date: string; amountCents: number; name: string } | null> {
  if (isDemoMode) return { date: demoPlan[0]!.date, amountCents: demoPlan[0]!.amountCents, name: demoPlan[0]!.name };
  const context = await householdContext(); if (!context) return null;
  const { data } = await context.supabase.from("expected_income_sources").select("id,name,expected_amount_cents,cadence,explicit_dates,next_expected_date,active,source_type").eq("household_id", context.householdId).eq("active", true);
  const sources = (data ?? []).map((source) => ({ id: source.id as string, name: source.name as string, expectedAmountCents: Number(source.expected_amount_cents), cadence: source.cadence as string | null, explicitDates: (source.explicit_dates as string[] | null) ?? [], nextExpectedDate: source.next_expected_date as string | null, active: Boolean(source.active), sourceType: source.source_type as "recurring" | "one_time" }));
  const today = format(new Date(), "yyyy-MM-dd");
  const occurrence = [today.slice(0, 7), format(addMonths(new Date(), 1), "yyyy-MM")]
    .flatMap((month) => incomeOccurrencesForMonth(sources, month))
    .find((item) => item.date >= today);
  return occurrence ? { date: occurrence.date, amountCents: occurrence.amountCents, name: occurrence.name } : null;
}

export async function getMerchantRules() { if (isDemoMode) return [{ id:"demo-rule", normalizedMerchant:"netflix", categoryId:"entertainment", active:true }]; const context=await householdContext(); if(!context)return []; const{data}=await context.supabase.from("merchant_rules").select("id,normalized_merchant,category_id,active").eq("household_id",context.householdId).order("normalized_merchant"); return(data??[]).map((item)=>({id:item.id as string,normalizedMerchant:item.normalized_merchant as string,categoryId:item.category_id as string,active:Boolean(item.active)})); }

export async function getHouseholdSummary(): Promise<HouseholdSummary> {
  if (isDemoMode) return { name: "Turco Household", timezone: "America/New_York", minimumCashBufferCents: 75000, memberCount: 2 };
  const context = await householdContext();
  if (!context) return { name: "Household", timezone: "America/New_York", minimumCashBufferCents: 0, memberCount: 0 };
  const [{ data: household }, { count }] = await Promise.all([
    context.supabase.from("households").select("name,timezone,minimum_cash_buffer_cents").eq("id", context.householdId).single(),
    context.supabase.from("household_members").select("user_id", { count: "exact", head: true }).eq("household_id", context.householdId),
  ]);
  return {
    name: (household?.name as string | undefined) ?? "Household",
    timezone: (household?.timezone as string | undefined) ?? "America/New_York",
    minimumCashBufferCents: Number(household?.minimum_cash_buffer_cents ?? 0),
    memberCount: count ?? 0,
  };
}

export async function getBudgetData(monthValue?: string) {
  return (await getBudgetWorkspace(monthValue)).categories.filter((category) => category.isActive && category.showInBudget && !category.isExcluded);
}

export async function getAccountsData() {
  if (isDemoMode) return [
    { id: "demo-checking", name: "Household checking", institutionName: "Demo bank", balanceCents: 492500, availableBalanceCents: 492500, balanceAsOf: new Date().toISOString(), role: "cash" as const, payInFull: false, liabilityBalanceSign: null, balanceBasis: "available" as const, pendingTransactionsInBalance: true, creditCardDueDate: null },
    { id: "demo-card", name: "Rewards card", institutionName: "Demo bank", balanceCents: -126400, availableBalanceCents: null, balanceAsOf: new Date().toISOString(), role: "credit_card" as const, payInFull: true, liabilityBalanceSign: -1 as const, balanceBasis: "current" as const, pendingTransactionsInBalance: true, creditCardDueDate: null },
  ];
  const context = await householdContext();
  if (!context) return [];
  const { data } = await context.supabase.from("accounts").select("id,name,institution_name,current_balance_cents,available_balance_cents,balance_as_of,account_role,credit_card_pay_in_full,liability_balance_sign,balance_basis_state,pending_transactions_in_balance,credit_card_due_date").eq("household_id", context.householdId).order("name");
  return (data ?? []).map((account) => ({ id: account.id as string, name: account.name as string, institutionName: (account.institution_name as string | null) ?? "Imported account", balanceCents: Number(account.current_balance_cents), availableBalanceCents: account.available_balance_cents === null ? null : Number(account.available_balance_cents), balanceAsOf: account.balance_as_of as string | null, role: account.account_role as "cash" | "credit_card" | "investment" | "other_liability" | "excluded", payInFull: Boolean(account.credit_card_pay_in_full), liabilityBalanceSign: account.liability_balance_sign as -1 | 1 | null, balanceBasis: account.balance_basis_state as "needs_review" | "current" | "available", pendingTransactionsInBalance: account.pending_transactions_in_balance as boolean | null, creditCardDueDate: account.credit_card_due_date as string | null }));
}

export async function getConnectionHealth(): Promise<ConnectionHealth> {
  if (isDemoMode) return { status: "active", lastSuccessfulSync: new Date(Date.now() - 18 * 60_000).toISOString(), lastAttemptedSync: new Date(Date.now() - 18 * 60_000).toISOString(), accountCount: 2, transactionCount: 24, lastResult: "success", sanitizedError: null };
  const context = await householdContext();
  if (!context) return { status: "unconfigured", lastSuccessfulSync: null, lastAttemptedSync: null, accountCount: 0, transactionCount: 0, lastResult: null, sanitizedError: null };
  const { data } = await context.supabase.from("connection_health").select("status,last_synced_at,last_attempted_at,account_count,last_transaction_count,last_sync_status,sanitized_error,last_error").eq("household_id", context.householdId).eq("provider", "simplefin").maybeSingle();
  if (!data) return { status: "unconfigured", lastSuccessfulSync: null, lastAttemptedSync: null, accountCount: 0, transactionCount: 0, lastResult: null, sanitizedError: null };
  return { status: data.status as ConnectionHealth["status"], lastSuccessfulSync: data.last_synced_at as string | null, lastAttemptedSync: data.last_attempted_at as string | null, accountCount: Number(data.account_count ?? 0), transactionCount: Number(data.last_transaction_count ?? 0), lastResult: data.last_sync_status as string | null, sanitizedError: (data.sanitized_error ?? data.last_error) as string | null };
}

export async function getImportInbox(): Promise<ImportInboxItem[]> {
  if (isDemoMode) return [{
    id: "00000000-0000-4000-8000-000000000101", fileName: "august-budget.csv", importType: "budget_template", status: "ready", createdAt: new Date().toISOString(), acceptedRows: 2, duplicateRows: 1, reviewRows: 0, errors: [],
    rows: [
      { id: "00000000-0000-4000-8000-000000000102", rowNumber: 2, status: "accepted", normalized: { month: "2026-08-01", category: "Groceries", budgetedCents: 80000 }, errors: [] },
      { id: "00000000-0000-4000-8000-000000000103", rowNumber: 3, status: "accepted", normalized: { month: "2026-08-01", category: "Dining", budgetedCents: 45000 }, errors: [] },
      { id: "00000000-0000-4000-8000-000000000104", rowNumber: 4, status: "duplicate", normalized: { month: "2026-08-01", category: "Housing", budgetedCents: 187500 }, errors: [] },
    ],
  }];
  const context = await householdContext();
  if (!context) return [];
  const { data: imports } = await context.supabase.from("imports").select("id,file_name,import_type,status,created_at,accepted_rows,duplicate_rows,review_rows").eq("household_id", context.householdId).order("created_at", { ascending: false }).limit(25);
  const ids = (imports ?? []).map((item) => item.id as string);
  const [{ data: rows }, { data: errors }] = ids.length ? await Promise.all([
    context.supabase.from("import_rows").select("id,import_id,row_number,status,normalized_data").in("import_id", ids).order("row_number").limit(500),
    context.supabase.from("import_errors").select("import_id,import_row_id,message,resolved_at").in("import_id", ids).is("resolved_at", null),
  ]) : [{ data: [] }, { data: [] }];
  return (imports ?? []).map((item) => ({ id: item.id as string, fileName: item.file_name as string, importType: item.import_type as string, status: item.status as string, createdAt: item.created_at as string, acceptedRows: Number(item.accepted_rows), duplicateRows: Number(item.duplicate_rows), reviewRows: Number(item.review_rows), errors: (errors ?? []).filter((error) => error.import_id === item.id && !error.import_row_id).map((error) => error.message as string), rows: (rows ?? []).filter((row) => row.import_id === item.id).map((row) => ({ id: row.id as string, rowNumber: Number(row.row_number), status: row.status as string, normalized: row.normalized_data as Record<string, unknown>, errors: (errors ?? []).filter((error) => error.import_row_id === row.id).map((error) => error.message as string) })) }));
}

export async function getReconciliationData() {
  if (isDemoMode) return { accounts: 2, staleAccounts: 0, activeTransactions: 5, supersededPending: 0, allocationMismatches: 0, excludedAccounts: 0, checksRunAt: new Date().toISOString() };
  const context = await householdContext();
  if (!context) return { accounts: 0, staleAccounts: 0, activeTransactions: 0, supersededPending: 0, allocationMismatches: 0, excludedAccounts: 0, checksRunAt: new Date().toISOString() };
  const staleBefore = new Date(Date.now() - 48 * 60 * 60_000).toISOString();
  const [{ data: accounts }, { data: transactions }, { data: allocations }] = await Promise.all([
    context.supabase.from("accounts").select("id,balance_as_of,cash_flow_mode").eq("household_id", context.householdId),
    context.supabase.from("transactions").select("id,amount_cents,status,excluded,superseded_by_transaction_id").eq("household_id", context.householdId),
    context.supabase.from("transaction_allocations").select("transaction_id,amount_cents").eq("household_id", context.householdId),
  ]);
  const allocationTotals = new Map<string, number>();
  for (const allocation of allocations ?? []) allocationTotals.set(allocation.transaction_id as string, (allocationTotals.get(allocation.transaction_id as string) ?? 0) + Number(allocation.amount_cents));
  const expenses = (transactions ?? []).filter((transaction) => Number(transaction.amount_cents) < 0 && !transaction.excluded && !transaction.superseded_by_transaction_id);
  return { accounts: accounts?.length ?? 0, staleAccounts: (accounts ?? []).filter((account) => !account.balance_as_of || account.balance_as_of < staleBefore).length, activeTransactions: (transactions ?? []).filter((transaction) => !transaction.superseded_by_transaction_id).length, supersededPending: (transactions ?? []).filter((transaction) => transaction.status === "pending" && transaction.superseded_by_transaction_id).length, allocationMismatches: expenses.filter((transaction) => (allocationTotals.get(transaction.id as string) ?? 0) !== Number(transaction.amount_cents)).length, excludedAccounts: (accounts ?? []).filter((account) => account.cash_flow_mode === "excluded").length, checksRunAt: new Date().toISOString() };
}

export type ActivityQuery = { query?: string; filter?: string; categoryId?: string; accountId?: string; date?: string; before?: string; transactionId?: string };

export async function getReviewCount(): Promise<number> {
  if (isDemoMode) return demoTransactions.filter((transaction) => transaction.reviewStatus === "needs_review" && !transaction.excluded && !transaction.isTransfer).length;
  const context = await householdContext();
  if (!context) return 0;
  const { count } = await context.supabase.from("transactions").select("id", { count: "exact", head: true })
    .eq("household_id", context.householdId).is("superseded_by_transaction_id", null)
    .eq("review_status", "needs_review").eq("excluded", false).eq("is_transfer", false);
  return count ?? 0;
}

export async function getActivityData(limit = 100, monthValue?: string, options: ActivityQuery = {}): Promise<ActivityTransaction[]> {
  const monthDate = monthValue ? normalizeBudgetMonth(monthValue) : null;
  const inSelectedMonth = (isoDate: string) => !monthDate || (new Date(isoDate) >= monthDate && new Date(isoDate) < addMonths(monthDate, 1));
  if (isDemoMode) return demoTransactions.filter((transaction) => inSelectedMonth(transaction.isoDate)).map((transaction) => ({ ...transaction, updatedAt: transaction.isoDate, reviewStatus: transaction.excluded ? "reviewed" as const : transaction.reviewStatus, importedMerchant: transaction.merchant, allocationSource: transaction.id === "t1" ? "merchant_rule" as const : transaction.allocations.length ? "manual" as const : null, auditHistory: transaction.id === "t1" ? [{ id: "demo-audit", action: "Imported from SimpleFIN", createdAt: transaction.isoDate, undoable: false }] : [] }));
  const context = await householdContext();
  if (!context) return [];
  let query = context.supabase.from("transactions")
    .select("id,merchant,display_name,amount_cents,status,transacted_at,posted_at,raw_description,note,excluded,is_transfer,is_recurring,review_status,reviewed_at,updated_at,account_id,accounts(name),transaction_allocations(category_id,amount_cents,source,categories(name,color))")
    .eq("household_id", context.householdId).is("superseded_by_transaction_id", null);
  if (monthDate) query = query.gte("transacted_at", monthDate.toISOString()).lt("transacted_at", addMonths(monthDate, 1).toISOString());
  if (options.before) query = query.lt("transacted_at", options.before);
  if (options.transactionId) query = query.eq("id", options.transactionId);
  if (options.accountId) query = query.eq("account_id", options.accountId);
  if (options.date) query = query.gte("transacted_at", `${options.date}T00:00:00`).lt("transacted_at", `${options.date}T23:59:59.999`);
  if (options.query?.trim()) { const term = options.query.trim().replaceAll(/[,%()]/g, " "); query = query.or(`merchant.ilike.%${term}%,display_name.ilike.%${term}%,raw_description.ilike.%${term}%`); }
  if (options.filter === "needs_review") query = query.eq("review_status", "needs_review").eq("excluded", false);
  if (options.filter === "pending") query = query.eq("status", "pending");
  if (options.filter === "income") query = query.gt("amount_cents", 0);
  if (options.filter === "expenses") query = query.lt("amount_cents", 0);
  if (options.filter === "excluded") query = query.eq("excluded", true);
  if (options.filter === "transfers") query = query.eq("is_transfer", true);
  if (options.categoryId) {
    const { data: categoryAllocations } = await context.supabase.from("transaction_allocations").select("transaction_id").eq("household_id", context.householdId).eq("category_id", options.categoryId).limit(5000);
    const ids = (categoryAllocations ?? []).map((item) => item.transaction_id as string); if (!ids.length) return []; query = query.in("id", ids);
  }
  const { data } = await query.order("transacted_at", { ascending: false }).limit(limit);
  const transactionIds = (data ?? []).map((transaction) => transaction.id as string);
  const { data: auditEvents } = transactionIds.length ? await context.supabase.from("audit_events").select("id,entity_id,action,created_at,metadata").eq("household_id", context.householdId).eq("entity_type", "transaction").in("entity_id", transactionIds).order("created_at", { ascending: false }).limit(300) : { data: [] };
  return (data ?? []).map((transaction) => {
    const allocations = transaction.transaction_allocations as unknown as Array<{ category_id: string; amount_cents: number; source: AllocationSource | null; categories: { name: string; color: string } | null }>;
    const category = allocations?.[0]?.categories;
    const account = transaction.accounts as unknown as { name: string } | null;
    return {
      id: transaction.id as string,
      merchant: (transaction.display_name as string | null) || transaction.merchant as string,
      importedMerchant: transaction.merchant as string,
      categoryId: category?.name === "Unsorted" ? "" : (((transaction.transaction_allocations as unknown as Array<{ category_id?: string }>)?.[0]?.category_id ?? "") as string),
      category: category?.name ?? "Unsorted",
      amountCents: Number(transaction.amount_cents),
      date: format(new Date(transaction.transacted_at as string), "MMM d"),
      isoDate: transaction.transacted_at as string,
      status: transaction.status as "pending" | "posted",
      color: category?.color ?? "#A6ACB8",
      accountId: transaction.account_id as string,
      accountName: account?.name ?? "Imported account",
      rawDescription: (transaction.raw_description as string | null) ?? "",
      note: (transaction.note as string | null) ?? "",
      excluded: Boolean(transaction.excluded),
      isTransfer: Boolean(transaction.is_transfer),
      isRecurring: Boolean(transaction.is_recurring),
      reviewStatus: transaction.excluded ? "reviewed" : transaction.review_status as "needs_review" | "reviewed",
      reviewedAt: transaction.reviewed_at as string | null,
      updatedAt: transaction.updated_at as string,
      allocationSource: allocations?.[0]?.source ?? null,
      allocations: (allocations ?? []).map((allocation) => ({ categoryId: allocation.category_id, category: allocation.categories?.name ?? "Unsorted", amountCents: Number(allocation.amount_cents) })),
      auditHistory: (auditEvents ?? []).filter((event) => event.entity_id === transaction.id).map((event) => ({ id: event.id as string, action: String(event.action).replaceAll("_", " "), createdAt: event.created_at as string, undoable: Boolean((event.metadata as { before?: unknown } | null)?.before) && event.action !== "undone" })),
    };
  });
}

export async function getPlanData() {
  if (isDemoMode) return demoPlan;
  const context = await householdContext();
  if (!context) return [];
  const today = format(new Date(), "yyyy-MM-dd");
  const [{ data: recurring }, { data: planned }] = await Promise.all([
    context.supabase.from("recurring_items").select("id,name,next_due_date,amount_cents,type,state").eq("household_id", context.householdId).in("state", ["confirmed", "matched", "inactive"]).gte("next_due_date", today),
    context.supabase.from("planned_items").select("id,name,date,amount_cents,type,state,matched_transaction_id").eq("household_id", context.householdId).in("state", ["confirmed", "matched"]).gte("date", today),
  ]);
  return [
    ...(recurring ?? []).map((item) => ({ id: item.id as string, name: item.name as string, date: item.next_due_date as string, amountCents: Number(item.amount_cents), type: item.type as "income" | "expense", state: item.state as string, kind: "recurring" as const, matchedTransactionId: null })),
    ...(planned ?? []).map((item) => ({ id: item.id as string, name: item.name as string, date: item.date as string, amountCents: Number(item.amount_cents), type: item.type as "income" | "expense", state: item.state as string, kind: "planned" as const, matchedTransactionId: item.matched_transaction_id as string | null })),
  ].sort((a, b) => a.date.localeCompare(b.date));
}

export async function getRecurringCandidates() {
  if (isDemoMode) return [{ id: "demo-recurring", name: "Netflix", amountCents: 2299, nextDueDate: format(new Date(), "yyyy-MM-dd"), type: "expense" as const }];
  const context = await householdContext();
  if (!context) return [];
  const { data } = await context.supabase.from("recurring_items").select("id,name,amount_cents,next_due_date,type").eq("household_id", context.householdId).eq("is_confirmed", false).eq("active", true).order("next_due_date");
  return (data ?? []).map((item) => ({ id: item.id as string, name: item.name as string, amountCents: Number(item.amount_cents), nextDueDate: item.next_due_date as string, type: item.type as "income" | "expense" }));
}

export async function getSafeBreakdown() {
  if (isDemoMode) return demoSafeBreakdown;
  const context = await householdContext();
  if (!context) return calculateSafeToSpnd({ accounts: [], obligations: [], goals: [], spendingCategories: [], minimumBufferCents: 0, today: format(new Date(), "yyyy-MM-dd"), nextIncomeDate: null, daysInMonth: endOfMonth(new Date()).getDate() });
  const [categories, accountsResult, pendingResult, householdResult, plannedResult, recurringResult, incomeResult] = await Promise.all([
    getBudgetData(),
    context.supabase.from("accounts").select("id,name,account_role,current_balance_cents,available_balance_cents,balance_as_of,balance_basis_state,pending_transactions_in_balance,credit_card_pay_in_full,liability_balance_sign").eq("household_id", context.householdId),
    context.supabase.from("transactions").select("account_id,amount_cents").eq("household_id", context.householdId).eq("status", "pending").eq("excluded", false).eq("is_transfer", false).is("superseded_by_transaction_id", null).lt("amount_cents", 0),
    context.supabase.from("households").select("minimum_cash_buffer_cents,timezone").eq("id", context.householdId).single(),
    context.supabase.from("planned_items").select("id,name,date,amount_cents,type,category_id,state,matched_transaction_id").eq("household_id", context.householdId).in("state", ["confirmed", "matched"]),
    context.supabase.from("recurring_items").select("id,name,next_due_date,amount_cents,type,category_id,state,matched_transaction_id").eq("household_id", context.householdId).in("state", ["confirmed", "matched"]),
    context.supabase.from("expected_income_sources").select("id,name,expected_amount_cents,cadence,next_expected_date,explicit_dates,source_type,active").eq("household_id", context.householdId).eq("active", true),
  ]);
  const timezone = (householdResult.data?.timezone as string | null) ?? "America/New_York";
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const pendingByAccount = new Map<string, number>();
  for (const transaction of pendingResult.data ?? []) pendingByAccount.set(transaction.account_id as string, (pendingByAccount.get(transaction.account_id as string) ?? 0) + Number(transaction.amount_cents));
  const categoryBehavior = new Map(categories.map((category) => [category.id, category.behaviorType]));
  const planItems = [
    ...(plannedResult.data ?? []).map((item) => ({ ...item, dueDate: item.date as string })),
    ...(recurringResult.data ?? []).map((item) => ({ ...item, dueDate: item.next_due_date as string })),
  ];
  const safeIncomeSources = (incomeResult.data ?? []).map((source) => ({ id: source.id as string, name: source.name as string, expectedAmountCents: Number(source.expected_amount_cents), cadence: source.cadence as string | null, nextExpectedDate: source.next_expected_date as string | null, explicitDates: (source.explicit_dates as string[] | null) ?? [], sourceType: source.source_type as "recurring" | "one_time", active: Boolean(source.active) }));
  const scheduleDates = [today.slice(0, 7), format(addMonths(new Date(`${today}T12:00:00Z`), 1), "yyyy-MM")].flatMap((month) => incomeOccurrencesForMonth(safeIncomeSources, month).map((item) => item.date));
  const incomeDates = [
    ...scheduleDates,
    ...planItems.filter((item) => item.type === "income" && item.state === "confirmed").map((item) => item.dueDate),
  ].filter((date): date is string => date !== null && date !== undefined && date >= today).sort();
  const reserves = planItems.filter((item) => item.type === "expense").map((item) => ({ id: item.id as string, name: item.name as string, amountCents: Number(item.amount_cents), dueDate: item.dueDate, fulfilled: item.state === "matched" || Boolean(item.matched_transaction_id), behavior: categoryBehavior.get(item.category_id as string) }));
  return calculateSafeToSpnd({
    accounts: (accountsResult.data ?? []).map((account) => ({ id: account.id as string, name: account.name as string, role: account.account_role as import("@/lib/safe-to-spnd").AccountRole, currentBalanceCents: Number(account.current_balance_cents), availableBalanceCents: account.available_balance_cents === null ? null : Number(account.available_balance_cents), balanceAsOf: account.balance_as_of as string | null, balanceBasis: account.balance_basis_state as import("@/lib/safe-to-spnd").BalanceBasisState, pendingTransactionsInBalance: account.pending_transactions_in_balance as boolean | null, pendingTransactionCents: pendingByAccount.get(account.id as string) ?? 0, payInFull: Boolean(account.credit_card_pay_in_full), liabilityBalanceSign: account.liability_balance_sign as -1 | 1 | null })),
    obligations: reserves.filter((item) => item.behavior !== "goal"),
    goals: reserves.filter((item) => item.behavior === "goal"),
    spendingCategories: categories.filter((category) => category.behaviorType === "spending").map((category) => ({ id: category.id, name: category.name, monthlyBudgetCents: category.budgetedCents, postedSpentCents: category.spentCents, pendingSpentCents: category.pendingCents })),
    minimumBufferCents: Number(householdResult.data?.minimum_cash_buffer_cents ?? 0),
    today,
    nextIncomeDate: incomeDates[0] ?? null,
    daysInMonth: endOfMonth(new Date(`${today}T12:00:00Z`)).getDate(),
  });
}
