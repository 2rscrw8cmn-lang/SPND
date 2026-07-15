import "server-only";

import { addMonths, endOfMonth, format, isValid, parseISO, startOfMonth } from "date-fns";
import { demoCategories, demoPlan, demoSafeBreakdown, demoTransactions } from "@/lib/demo-data";
import { isDemoMode } from "@/lib/env";
import { calculateSafeToSpnd } from "@/lib/safe-to-spnd";
import { createClient } from "@/lib/supabase/server";

export type BudgetCategory = {
  id: string; name: string; color: string; icon: string; categoryGroup: string;
  isActive: boolean; isExcluded: boolean; showInBudget: boolean;
  budgetedCents: number; spentCents: number; pendingCents: number;
};

export type BudgetWorkspace = {
  month: string; categories: BudgetCategory[]; unsortedCount: number; unsortedCents: number;
  totals: { budgetedCents: number; spentCents: number; pendingCents: number; remainingCents: number };
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
    const categories = demoCategories;
    const budgetedCents = categories.reduce((sum, item) => sum + item.budgetedCents, 0);
    const spentCents = categories.reduce((sum, item) => sum + item.spentCents, 0);
    const pendingCents = categories.reduce((sum, item) => sum + item.pendingCents, 0);
    return { month, categories, unsortedCount: 1, unsortedCents: 7421, totals: { budgetedCents, spentCents, pendingCents, remainingCents: budgetedCents - spentCents } };
  }
  const context = await householdContext();
  if (!context) return { month, categories: [], unsortedCount: 0, unsortedCents: 0, totals: { budgetedCents: 0, spentCents: 0, pendingCents: 0, remainingCents: 0 } };
  const monthStart = monthDate.toISOString();
  const nextMonthStart = addMonths(monthDate, 1).toISOString();
  const [{ data: budgets }, { data: categoryRows }] = await Promise.all([
    context.supabase.from("monthly_budgets")
      .select("category_id,budgeted_cents")
      .eq("household_id", context.householdId).eq("month", month),
    context.supabase.from("categories").select("id,name,color,icon,category_group,is_active,is_excluded,show_in_budget").eq("household_id", context.householdId).order("sort_order"),
  ]);
  const { data: transactions } = await context.supabase.from("transactions")
    .select("id,status,amount_cents").eq("household_id", context.householdId).eq("excluded", false).lt("amount_cents", 0)
    .or(`and(status.eq.posted,posted_at.gte.${monthStart},posted_at.lt.${nextMonthStart}),and(status.eq.pending,transacted_at.gte.${monthStart},transacted_at.lt.${nextMonthStart})`);
  const transactionIds = (transactions ?? []).map((transaction) => transaction.id as string);
  const { data: allocations } = transactionIds.length
    ? await context.supabase.from("transaction_allocations").select("transaction_id,category_id,amount_cents").in("transaction_id", transactionIds)
    : { data: [] };
  const spent = new Map<string, number>();
  const pending = new Map<string, number>();
  const statusById = new Map((transactions ?? []).map((transaction) => [transaction.id as string, transaction.status as string]));
  const allocatedIds = new Set<string>();
  for (const allocation of allocations ?? []) {
    allocatedIds.add(allocation.transaction_id as string);
    const amount = Math.abs(Number(allocation.amount_cents));
    const target = statusById.get(allocation.transaction_id as string) === "pending" ? pending : spent;
    target.set(allocation.category_id as string, (target.get(allocation.category_id as string) ?? 0) + amount);
  }
  const budgetByCategory = new Map((budgets ?? []).map((budget) => [budget.category_id as string, Number(budget.budgeted_cents)]));
  const unsorted = (transactions ?? []).filter((transaction) => Number(transaction.amount_cents) < 0 && !allocatedIds.has(transaction.id as string));
  const categories = (categoryRows ?? []).filter((category) => category.name !== "Unsorted").map((category) => ({
      id: category.id as string,
      name: category.name as string,
      color: category.color as string,
      icon: category.icon as string,
      categoryGroup: category.category_group as string,
      isActive: Boolean(category.is_active),
      isExcluded: Boolean(category.is_excluded),
      showInBudget: Boolean(category.show_in_budget),
      budgetedCents: budgetByCategory.get(category.id as string) ?? 0,
      spentCents: spent.get(category.id as string) ?? 0,
      pendingCents: pending.get(category.id as string) ?? 0,
  }));
  const visible = categories.filter((category) => category.isActive && category.showInBudget && !category.isExcluded);
  const budgetedCents = visible.reduce((sum, item) => sum + item.budgetedCents, 0);
  const spentCents = visible.reduce((sum, item) => sum + item.spentCents, 0);
  const pendingCents = visible.reduce((sum, item) => sum + item.pendingCents, 0);
  return { month, categories, unsortedCount: unsorted.length, unsortedCents: unsorted.reduce((sum, item) => sum + Math.abs(Number(item.amount_cents)), 0), totals: { budgetedCents, spentCents, pendingCents, remainingCents: budgetedCents - spentCents } };
}

export async function getBudgetData(monthValue?: string) {
  return (await getBudgetWorkspace(monthValue)).categories.filter((category) => category.isActive && category.showInBudget && !category.isExcluded);
}

export async function getAccountsData() {
  if (isDemoMode) return [
    { id: "demo-checking", name: "Household checking", institutionName: "Demo bank", balanceCents: 492500, mode: "cash" as const },
    { id: "demo-card", name: "Rewards card", institutionName: "Demo bank", balanceCents: -126400, mode: "net_worth" as const },
  ];
  const context = await householdContext();
  if (!context) return [];
  const { data } = await context.supabase.from("accounts").select("id,name,institution_name,current_balance_cents,cash_flow_mode").eq("household_id", context.householdId).order("name");
  return (data ?? []).map((account) => ({ id: account.id as string, name: account.name as string, institutionName: (account.institution_name as string | null) ?? "Imported account", balanceCents: Number(account.current_balance_cents), mode: account.cash_flow_mode as "cash" | "net_worth" | "excluded" }));
}

export async function getActivityData(limit = 100) {
  if (isDemoMode) return demoTransactions;
  const context = await householdContext();
  if (!context) return [];
  const { data } = await context.supabase.from("transactions")
    .select("id,merchant,amount_cents,status,transacted_at,transaction_allocations(category_id,categories(name,color))")
    .eq("household_id", context.householdId).order("transacted_at", { ascending: false }).limit(limit);
  return (data ?? []).map((transaction) => {
    const allocations = transaction.transaction_allocations as unknown as Array<{ categories: { name: string; color: string } | null }>;
    const category = allocations?.[0]?.categories;
    return {
      id: transaction.id as string,
      merchant: transaction.merchant as string,
      categoryId: ((transaction.transaction_allocations as unknown as Array<{ category_id?: string }>)?.[0]?.category_id ?? "") as string,
      category: category?.name ?? "Unsorted",
      amountCents: Number(transaction.amount_cents),
      date: format(new Date(transaction.transacted_at as string), "MMM d"),
      status: transaction.status as "pending" | "posted",
      color: category?.color ?? "#A6ACB8",
    };
  });
}

export async function getPlanData() {
  if (isDemoMode) return demoPlan;
  const context = await householdContext();
  if (!context) return [];
  const today = format(new Date(), "yyyy-MM-dd");
  const [{ data: recurring }, { data: planned }] = await Promise.all([
    context.supabase.from("recurring_items").select("id,name,next_due_date,amount_cents,type").eq("household_id", context.householdId).eq("active", true).eq("is_confirmed", true).gte("next_due_date", today),
    context.supabase.from("planned_items").select("id,name,date,amount_cents,type").eq("household_id", context.householdId).gte("date", today),
  ]);
  return [
    ...(recurring ?? []).map((item) => ({ id: item.id as string, name: item.name as string, date: item.next_due_date as string, amountCents: Number(item.amount_cents), type: item.type as "income" | "expense" })),
    ...(planned ?? []).map((item) => ({ id: item.id as string, name: item.name as string, date: item.date as string, amountCents: Number(item.amount_cents), type: item.type as "income" | "expense" })),
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
  if (!context) return { availableCashCents: 0, billsDueCents: 0, categoryReserveCents: 0, pendingExpenseCents: 0, minimumBufferCents: 0, safeCents: 0, nextIncomeDate: format(new Date(), "yyyy-MM-dd"), needsReview: true };
  const [categories, plan, accountsResult, pendingResult, householdResult] = await Promise.all([
    getBudgetData(),
    getPlanData(),
    context.supabase.from("accounts").select("current_balance_cents").eq("household_id", context.householdId).eq("cash_flow_mode", "cash"),
    context.supabase.from("transactions").select("amount_cents").eq("household_id", context.householdId).eq("status", "pending").eq("excluded", false).lt("amount_cents", 0),
    context.supabase.from("households").select("minimum_cash_buffer_cents").eq("id", context.householdId).single(),
  ]);
  const nextIncome = plan.find((item) => item.type === "income");
  const nextIncomeDate = nextIncome?.date ?? format(endOfMonth(new Date()), "yyyy-MM-dd");
  const incomeTime = new Date(`${nextIncomeDate}T23:59:59`).getTime();
  const daysUntilIncome = Math.max(0, Math.ceil((incomeTime - Date.now()) / 86_400_000));
  const billsDueCents = plan.filter((item) => item.type === "expense" && new Date(item.date).getTime() <= incomeTime).reduce((sum, item) => sum + Math.abs(item.amountCents), 0);
  const availableCashCents = (accountsResult.data ?? []).reduce((sum, account) => sum + Number(account.current_balance_cents), 0);
  const pendingExpenseCents = (pendingResult.data ?? []).reduce((sum, transaction) => sum + Math.abs(Number(transaction.amount_cents)), 0);
  const minimumBufferCents = Number(householdResult.data?.minimum_cash_buffer_cents ?? 0);
  const result = calculateSafeToSpnd({
    availableCashCents,
    billsDueCents,
    pendingExpenseCents,
    minimumBufferCents,
    daysUntilIncome,
    daysInMonth: endOfMonth(new Date()).getDate(),
    categories: categories.map((category) => ({ id: category.id, name: category.name, monthlyBudgetCents: category.budgetedCents, postedSpentCents: category.spentCents })),
    inputsComplete: Boolean(nextIncome && accountsResult.data?.length && categories.length),
  });
  return { availableCashCents, billsDueCents, categoryReserveCents: result.categoryReserveCents, pendingExpenseCents, minimumBufferCents, safeCents: result.safeCents, nextIncomeDate, needsReview: result.needsReview };
}
