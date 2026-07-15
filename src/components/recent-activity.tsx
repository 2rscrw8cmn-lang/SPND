"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { TransactionDetail } from "@/components/transaction-detail";
import { TransactionRow } from "@/components/transaction-row";
import type { ActivityTransaction, BudgetCategory } from "@/lib/data";

export function RecentActivity({ initialTransactions, categories }: { initialTransactions: ActivityTransaction[]; categories: BudgetCategory[] }) {
  const router = useRouter(); const [transactions, setTransactions] = useState(initialTransactions); const [selected, setSelected] = useState<ActivityTransaction | null>(null);
  return <><div className="activity-card card">{transactions.slice(0, 4).map((transaction) => <TransactionRow transaction={transaction} key={transaction.id} onSelect={() => setSelected(transaction)} />)}</div>{selected ? <TransactionDetail transaction={selected} categories={categories} onClose={() => setSelected(null)} onUpdated={(updated) => { setTransactions(transactions.map((item) => item.id === updated.id ? updated : item)); setSelected(updated); router.refresh(); }} /> : null}</>;
}
