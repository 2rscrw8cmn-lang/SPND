"use client";

import { CalendarDays, Pencil, Repeat2, SkipForward, Trash2, X } from "lucide-react";
import { format, parseISO } from "date-fns";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BottomSheet } from "@/components/bottom-sheet";
import { formatCurrency } from "@/lib/utils";

type Item = { id: string; name: string; date: string; amountCents: number; type: "income" | "expense"; state: string; kind: "planned" | "recurring"; matchedTransactionId: string | null };

export function PlanList({ initialItems }: { initialItems: Item[] }) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [editing, setEditing] = useState<Item | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function update(item: Item, payload: Record<string, unknown>) {
    setBusy(true);
    const response = await fetch(`/api/plan/${item.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind: item.kind, ...payload }) });
    const body = await response.json() as { message?: string };
    setBusy(false);
    setMessage(body.message ?? "");
    if (!response.ok) return;
    setItems((values) => values.map((value) => value.id === item.id ? { ...value, ...payload } : value).filter((value) => !["skipped", "inactive"].includes(value.state)));
    setEditing(null);
    router.refresh();
  }

  async function remove(item: Item) {
    if (!window.confirm(`Remove ${item.name}?`)) return;
    setBusy(true);
    const response = await fetch(`/api/plan/${item.id}?kind=${item.kind}`, { method: "DELETE" });
    setBusy(false);
    if (response.ok) {
      setItems((values) => values.filter((value) => value.id !== item.id));
      setEditing(null);
      router.refresh();
    }
  }

  return <>
    <section className="plan-flat-list" aria-label="Upcoming obligations">
      {items.length ? items.map((item) => <button className="plan-flat-row" key={item.id} onClick={() => setEditing(item)}>
        <span className="plan-direction">{item.kind === "recurring" ? <Repeat2 size={17} /> : <CalendarDays size={17} />}</span>
        <span className="plan-meta"><strong>{item.name}</strong><small>{format(parseISO(item.date), "EEE, MMM d")} · {item.kind === "recurring" ? "recurring" : "one time"}</small></span>
        <strong>{formatCurrency(-Math.abs(item.amountCents), { signed: true })}</strong>
        <Pencil size={15} aria-hidden="true" />
      </button>) : <div className="plan-empty"><CalendarDays /><h3>No upcoming obligations</h3><p>Add a bill or one-time expense when you know it is coming.</p></div>}
    </section>
    {editing ? <BottomSheet className="plan-item-sheet" label={`Edit ${editing.name}`} onClose={() => setEditing(null)}>
      <div className="sheet-title"><div><p className="eyebrow">Upcoming obligation</p><h2>{editing.name}</h2></div><button className="icon-button" aria-label="Close obligation editor" onClick={() => setEditing(null)}><X /></button></div>
      <div className="field"><label htmlFor="plan-edit-name">Name</label><input id="plan-edit-name" value={editing.name} onChange={(event) => setEditing({ ...editing, name: event.target.value })} /></div>
      <div className="expected-income-grid"><div className="field"><label htmlFor="plan-edit-date">Due date</label><input id="plan-edit-date" type="date" value={editing.date} onChange={(event) => setEditing({ ...editing, date: event.target.value })} /></div><div className="field"><label htmlFor="plan-edit-amount">Amount</label><input id="plan-edit-amount" inputMode="decimal" type="number" min="0.01" step="0.01" value={editing.amountCents / 100} onChange={(event) => setEditing({ ...editing, amountCents: Math.round(Number(event.target.value) * 100) })} /></div></div>
      <button className="primary-button plan-item-save" disabled={busy || !editing.name.trim() || editing.amountCents <= 0} onClick={() => void update(editing, { name: editing.name, date: editing.date, amountCents: editing.amountCents })}>Save obligation</button>
      <div className="plan-item-secondary-actions"><button className="secondary-button" disabled={busy} onClick={() => void update(editing, { state: editing.kind === "recurring" ? "inactive" : "skipped" })}><SkipForward size={16} /> {editing.kind === "recurring" ? "Pause" : "Skip"}</button><button className="text-button danger-text" disabled={busy} onClick={() => void remove(editing)}><Trash2 size={16} /> Remove</button></div>
      <p className="form-message" role="status">{message}</p>
    </BottomSheet> : null}
  </>;
}
