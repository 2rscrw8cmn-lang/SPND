import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TransactionGroup } from "@/components/transaction-group";

describe("TransactionGroup", () => {
  it("uses the shared day heading, count, signed total, and row renderer", () => {
    const transactions = [
      { id: "one", amountCents: -1200, reviewStatus: "needs_review" as const },
      { id: "two", amountCents: -350, reviewStatus: "reviewed" as const },
    ];
    render(<TransactionGroup headingId="today" label="Today" transactions={transactions}>{(transaction) => <button key={transaction.id}>{transaction.id}</button>}</TransactionGroup>);
    expect(screen.getByRole("heading", { name: "Today" })).toBeInTheDocument();
    expect(screen.getByText("2 transactions · −$15.50")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "one" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "two" })).toBeInTheDocument();
  });
});
