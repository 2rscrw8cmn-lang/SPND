import { addDays, formatISO } from "date-fns";

const today = new Date();

export const demoCategories = [
  { id: "paycheck", name: "Paycheck", color: "#63D9A2", icon: "Banknote", categoryGroup: "Income", isActive: true, isExcluded: false, showInBudget: false, budgetedCents: 0, spentCents: 0, pendingCents: 0 },
  { id: "housing", name: "Housing", color: "#9B6CFF", icon: "House", categoryGroup: "Essentials", isActive: true, isExcluded: false, showInBudget: true, budgetedCents: 187500, spentCents: 187500, pendingCents: 0 },
  { id: "groceries", name: "Groceries", color: "#45D9E1", icon: "ShoppingCart", categoryGroup: "Essentials", isActive: true, isExcluded: false, showInBudget: true, budgetedCents: 80000, spentCents: 38800, pendingCents: 7421 },
  { id: "transport", name: "Transportation", color: "#58A6FF", icon: "Car", categoryGroup: "Essentials", isActive: true, isExcluded: false, showInBudget: true, budgetedCents: 35000, spentCents: 17200, pendingCents: 0 },
  { id: "dining", name: "Dining", color: "#FF705B", icon: "Utensils", categoryGroup: "Lifestyle", isActive: true, isExcluded: false, showInBudget: true, budgetedCents: 45000, spentCents: 26600, pendingCents: 0 },
  { id: "family", name: "Family & Kids", color: "#9B6CFF", icon: "Users", categoryGroup: "Lifestyle", isActive: true, isExcluded: false, showInBudget: true, budgetedCents: 60000, spentCents: 29400, pendingCents: 0 },
  { id: "entertainment", name: "Entertainment", color: "#C9FF4A", icon: "Clapperboard", categoryGroup: "Lifestyle", isActive: true, isExcluded: false, showInBudget: true, budgetedCents: 20000, spentCents: 8700, pendingCents: 0 },
  { id: "savings", name: "Savings", color: "#C9FF4A", icon: "PiggyBank", categoryGroup: "Goals", isActive: true, isExcluded: false, showInBudget: true, budgetedCents: 50000, spentCents: 50000, pendingCents: 0 },
];

export const demoTransactions = [
  { id: "t1", merchant: "Publix", categoryId: "groceries", category: "Groceries", amountCents: -8642, date: "Today", isoDate: new Date().toISOString(), status: "posted" as const, color: "#45D9E1", accountId: "demo-card", accountName: "Rewards card", rawDescription: "PUBLIX #1234", note: "", excluded: false, isTransfer: false, isRecurring: false, reviewStatus: "needs_review" as const, reviewedAt: null, allocations: [{ categoryId: "groceries", category: "Groceries", amountCents: -8642 }] },
  { id: "t2", merchant: "Netflix", categoryId: "entertainment", category: "Entertainment", amountCents: -2299, date: "Yesterday", isoDate: new Date(Date.now() - 86400000).toISOString(), status: "posted" as const, color: "#C9FF4A", accountId: "demo-card", accountName: "Rewards card", rawDescription: "NETFLIX.COM", note: "Family plan", excluded: false, isTransfer: false, isRecurring: true, reviewStatus: "reviewed" as const, reviewedAt: new Date().toISOString(), allocations: [{ categoryId: "entertainment", category: "Entertainment", amountCents: -2299 }] },
  { id: "t3", merchant: "Target", categoryId: "", category: "Unsorted", amountCents: -7421, date: "Jul 12", isoDate: new Date(Date.now() - 172800000).toISOString(), status: "pending" as const, color: "#A6ACB8", accountId: "demo-card", accountName: "Rewards card", rawDescription: "TARGET 000123", note: "", excluded: false, isTransfer: false, isRecurring: false, reviewStatus: "needs_review" as const, reviewedAt: null, allocations: [] },
  { id: "t4", merchant: "SunRail", categoryId: "transport", category: "Transportation", amountCents: -500, date: "Jul 11", isoDate: new Date(Date.now() - 259200000).toISOString(), status: "posted" as const, color: "#58A6FF", accountId: "demo-checking", accountName: "Household checking", rawDescription: "SUNRAIL TICKET", note: "", excluded: false, isTransfer: false, isRecurring: false, reviewStatus: "reviewed" as const, reviewedAt: new Date().toISOString(), allocations: [{ categoryId: "transport", category: "Transportation", amountCents: -500 }] },
  { id: "t5", merchant: "Payroll", categoryId: "paycheck", category: "Paycheck", amountCents: 342500, date: "Jul 10", isoDate: new Date(Date.now() - 345600000).toISOString(), status: "posted" as const, color: "#63D9A2", accountId: "demo-checking", accountName: "Household checking", rawDescription: "DIRECT DEP PAYROLL", note: "", excluded: false, isTransfer: false, isRecurring: true, reviewStatus: "reviewed" as const, reviewedAt: new Date().toISOString(), allocations: [{ categoryId: "paycheck", category: "Paycheck", amountCents: 342500 }] },
];

export const demoPlan = [
  { id: "p1", name: "Next income", date: formatISO(addDays(today, 8), { representation: "date" }), amountCents: 342500, type: "income" as const },
  { id: "p2", name: "Mortgage", date: formatISO(addDays(today, 2), { representation: "date" }), amountCents: 187500, type: "expense" as const },
  { id: "p3", name: "Electric", date: formatISO(addDays(today, 5), { representation: "date" }), amountCents: 14600, type: "expense" as const },
];

export const demoSafeBreakdown = {
  availableCashCents: 492500,
  billsDueCents: 201600,
  categoryReserveCents: 72500,
  pendingExpenseCents: 7421,
  minimumBufferCents: 75000,
  safeCents: 135979,
  nextIncomeDate: demoPlan[0]!.date,
  needsReview: false,
};
