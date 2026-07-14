import { addDays, formatISO } from "date-fns";

const today = new Date();

export const demoCategories = [
  { id: "groceries", name: "Groceries", color: "#45D9E1", icon: "cart", budgetedCents: 80000, spentCents: 38800 },
  { id: "dining", name: "Dining", color: "#FF705B", icon: "utensils", budgetedCents: 45000, spentCents: 26600 },
  { id: "family", name: "Kids & Family", color: "#9B6CFF", icon: "users", budgetedCents: 60000, spentCents: 29400 },
  { id: "transport", name: "Transportation", color: "#58A6FF", icon: "car", budgetedCents: 35000, spentCents: 17200 },
  { id: "entertainment", name: "Entertainment", color: "#C9FF4A", icon: "play", budgetedCents: 20000, spentCents: 8700 },
];

export const demoTransactions = [
  { id: "t1", merchant: "Publix", categoryId: "groceries", category: "Groceries", amountCents: -8642, date: "Today", status: "posted" as const, color: "#45D9E1" },
  { id: "t2", merchant: "Netflix", categoryId: "entertainment", category: "Entertainment", amountCents: -2299, date: "Yesterday", status: "posted" as const, color: "#C9FF4A" },
  { id: "t3", merchant: "Target", categoryId: "shopping", category: "Shopping", amountCents: -7421, date: "Jul 12", status: "pending" as const, color: "#F79AD3" },
  { id: "t4", merchant: "SunRail", categoryId: "transport", category: "Transportation", amountCents: -500, date: "Jul 11", status: "posted" as const, color: "#58A6FF" },
  { id: "t5", merchant: "Payroll", categoryId: "income", category: "Income", amountCents: 342500, date: "Jul 10", status: "posted" as const, color: "#C9FF4A" },
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
