"use client";

import { useState } from "react";
import { formatCurrency } from "@/lib/utils";

type Candidate = { id: string; name: string; amountCents: number; nextDueDate: string; type: "income" | "expense" };

export function RecurringCandidates({ initialCandidates }: { initialCandidates: Candidate[] }) {
  const [items, setItems] = useState(initialCandidates);
  const [message, setMessage] = useState("");
  async function update(item: Candidate, confirmed: boolean) {
    setItems(items.filter((candidate) => candidate.id !== item.id));
    const response = await fetch(`/api/recurring/${item.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ confirmed }) });
    const body = (await response.json()) as { message?: string };
    setMessage(response.status === 401 || response.status === 400 ? "Preview updated. Production sign-in is required to save." : body.message ?? "Updated.");
  }
  return <section className="form-card card" style={{ marginTop: 28 }}><p className="eyebrow">Needs confirmation</p><h2>Recurring suggestions</h2>{items.length ? items.map((item) => <div className="plan-item" key={item.id}><div className="plan-meta"><strong>{item.name}</strong><span>{formatCurrency(item.amountCents)} · likely monthly</span></div><div style={{ display: "flex", gap: 8 }}><button className="primary-button" style={{ minHeight: 40, padding: "0 12px" }} onClick={() => update(item, true)}>Confirm</button><button className="secondary-button" style={{ minHeight: 40, padding: "0 12px" }} onClick={() => update(item, false)}>Dismiss</button></div></div>) : <p className="page-subtitle" style={{ marginBottom: 0 }}>No suggestions need review. Nothing affects your forecast until you confirm it.</p>}<p className="form-message" role="status">{message}</p></section>;
}

