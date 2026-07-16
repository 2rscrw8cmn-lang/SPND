import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CategoryActivity } from "@/components/category-activity";
import type { ActivityTransaction, BudgetCategory } from "@/lib/data";

const groceries: BudgetCategory = { id: "groceries", name: "Groceries", color: "#45D9E1", icon: "ShoppingCart", categoryGroup: "Essentials", isActive: true, isExcluded: false, showInBudget: true, behaviorType: "spending", budgetedCents: 80000, spentCents: 8642, pendingCents: 0, recentTransactions: [{ id: "t1", merchant: "Publix", amountCents: -8642, isoDate: "2026-07-15T12:00:00Z", status: "posted", reviewStatus: "needs_review" }] };
const dining: BudgetCategory = { ...groceries, id: "dining", name: "Dining", recentTransactions: [] };
const detail: ActivityTransaction = { id: "t1", merchant: "Publix", importedMerchant: "PUBLIX", categoryId: "groceries", category: "Groceries", amountCents: -8642, date: "Jul 15", isoDate: "2026-07-15T12:00:00Z", status: "posted", color: "#45D9E1", accountId: "account", accountName: "Card", rawDescription: "PUBLIX", note: "", excluded: false, isTransfer: false, isRecurring: false, reviewStatus: "needs_review", reviewedAt: null, updatedAt: "2026-07-15T12:00:00Z", allocationSource: "merchant_history", allocations: [{ categoryId: "groceries", category: "Groceries", amountCents: -8642 }], auditHistory: [] };

afterEach(() => vi.unstubAllGlobals());

describe("CategoryActivity move and undo", () => {
  it("removes and restores the row while emitting exact aggregate deltas", async () => {
    const deltas: number[] = [];
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ transactions: [detail] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ transaction: { updated_at: "2026-07-15T12:01:00Z" } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ transaction: { updated_at: "2026-07-15T12:02:00Z" } }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    render(<CategoryActivity allCategories={[groceries, dining]} category={groceries} onAggregateDelta={(_status, delta) => deltas.push(delta)} onTransaction={() => undefined} />);

    fireEvent.click(screen.getByRole("button", { name: "Actions for Publix" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Change category" }));
    fireEvent.click(await screen.findByRole("button", { name: /Dining/ }));

    await waitFor(() => expect(screen.queryByRole("button", { name: /Publix, Groceries/ })).not.toBeInTheDocument());
    expect(deltas).toEqual([-8642]);
    fireEvent.click(await screen.findByRole("button", { name: "Undo" }));
    await waitFor(() => expect(screen.getByRole("button", { name: /Publix, Groceries/ })).toBeInTheDocument());
    expect(deltas).toEqual([-8642, 8642]);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
