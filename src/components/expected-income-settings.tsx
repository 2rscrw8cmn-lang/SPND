"use client";

import { CalendarClock, Pencil, Plus, Trash2, X } from "lucide-react";
import { format, parseISO } from "date-fns";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BottomSheet } from "@/components/bottom-sheet";
import type { ExpectedIncomeSource } from "@/lib/data";
import { formatCurrency } from "@/lib/utils";

const blankSource: ExpectedIncomeSource = {
  id: "new",
  name: "",
  expectedAmountCents: 0,
  cadence: "monthly",
  nextExpectedDate: "",
  explicitDates: [],
  active: true,
  sourceType: "recurring",
  acceptableVarianceCents: null,
  normalizedMerchant: null,
  autoMatchEnabled: true,
};

export function ExpectedIncomeSettings({ initialSources }: { initialSources: ExpectedIncomeSource[] }) {
  const router = useRouter();
  const [sources, setSources] = useState(initialSources);
  const [editing, setEditing] = useState<ExpectedIncomeSource | null>(null);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function save(source: ExpectedIncomeSource) {
    const isNew = source.id === "new";
    setSaving(true);
    setMessage("");
    const response = await fetch(isNew ? "/api/income-sources" : `/api/income-sources/${source.id}`, { method: isNew ? "POST" : "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(source) });
    const body = await response.json() as { message?: string; id?: string };
    setSaving(false);
    setMessage(body.message ?? "");
    if (!response.ok) return;
    const saved = { ...source, id: body.id ?? source.id };
    setSources((items) => isNew ? [...items, saved] : items.map((item) => item.id === saved.id ? saved : item));
    setEditing(null);
    router.refresh();
  }

  async function archive(source: ExpectedIncomeSource) {
    setSaving(true);
    const response = await fetch(`/api/income-sources/${source.id}`, { method: "DELETE" });
    const body = await response.json() as { message?: string };
    setSaving(false);
    setMessage(body.message ?? "");
    if (response.ok) {
      setSources((items) => items.map((item) => item.id === source.id ? { ...item, active: false } : item));
      setEditing(null);
      router.refresh();
    }
  }

  return <section className="income-source-manager">
    <div className="section-line"><h3>Income schedules</h3><button className="secondary-button compact-button" onClick={() => setEditing({ ...blankSource })}><Plus size={16} /> Add income</button></div>
    <div className="income-source-list">
      {sources.map((source) => <button className={`income-source-row ${source.active ? "" : "inactive"}`} key={source.id} onClick={() => setEditing(source)}>
        <span className="income-source-icon"><CalendarClock size={18} /></span>
        <span><strong>{source.name}</strong><small>{source.sourceType === "one_time" ? "One time" : cadenceLabel(source.cadence)} · next {source.nextExpectedDate ? format(parseISO(source.nextExpectedDate), "MMM d, yyyy") : "scheduled date"}{source.active ? "" : " · archived"}</small></span>
        <strong>{formatCurrency(source.expectedAmountCents)}</strong><Pencil size={15} />
      </button>)}
      {!sources.length ? <button className="income-source-empty" onClick={() => setEditing({ ...blankSource })}><Plus /><strong>Plan your income</strong><span>Add a paycheck or one-time deposit so Budget and Safe to SPND can plan against it.</span></button> : null}
    </div>
    <p className="form-message" role="status">{message}</p>
    {editing ? <IncomeSourceSheet source={editing} saving={saving} onArchive={editing.id === "new" ? undefined : () => void archive(editing)} onClose={() => setEditing(null)} onSave={(source) => void save(source)} /> : null}
  </section>;
}

function IncomeSourceSheet({ source, saving, onArchive, onClose, onSave }: { source: ExpectedIncomeSource; saving: boolean; onArchive?: () => void; onClose: () => void; onSave: (source: ExpectedIncomeSource) => void }) {
  const [draft, setDraft] = useState(source);
  return <BottomSheet className="income-source-sheet" label={`${source.id === "new" ? "Add" : "Edit"} expected income`} onClose={onClose}>
    <div className="sheet-title"><div><p className="eyebrow">Expected income</p><h2>{source.id === "new" ? "Plan your income" : source.name}</h2></div><button className="icon-button" aria-label="Close income editor" onClick={onClose}><X /></button></div>
    <div className="field"><label htmlFor="income-source-name">Name</label><input id="income-source-name" value={draft.name} placeholder="Paycheck, pension, rental income…" onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></div>
    <div className="expected-income-grid">
      <div className="field"><label htmlFor="income-source-amount">Expected amount</label><input id="income-source-amount" type="number" inputMode="decimal" min="0.01" step="0.01" value={draft.expectedAmountCents ? draft.expectedAmountCents / 100 : ""} onChange={(event) => setDraft({ ...draft, expectedAmountCents: Math.round(Number(event.target.value) * 100) })} /></div>
      <div className="field"><label htmlFor="income-source-type">Type</label><select id="income-source-type" value={draft.sourceType} onChange={(event) => setDraft({ ...draft, sourceType: event.target.value as ExpectedIncomeSource["sourceType"], cadence: event.target.value === "one_time" ? null : draft.cadence ?? "monthly" })}><option value="recurring">Recurring</option><option value="one_time">One time</option></select></div>
      <div className="field"><label htmlFor="income-source-date">{draft.sourceType === "recurring" ? "Next expected date" : "Expected date"}</label><input id="income-source-date" type="date" value={draft.nextExpectedDate ?? ""} onChange={(event) => setDraft({ ...draft, nextExpectedDate: event.target.value || null, explicitDates: draft.sourceType === "one_time" && event.target.value ? [event.target.value] : draft.explicitDates })} /></div>
      {draft.sourceType === "recurring" ? <div className="field"><label htmlFor="income-source-cadence">Cadence</label><select id="income-source-cadence" value={draft.cadence ?? "monthly"} onChange={(event) => setDraft({ ...draft, cadence: event.target.value })}><option value="weekly">Weekly</option><option value="biweekly">Every two weeks</option><option value="semimonthly">Twice monthly</option><option value="monthly">Monthly</option><option value="annual">Annual</option></select></div> : null}
      <div className="field"><label htmlFor="income-source-variance">Amount variance</label><input id="income-source-variance" type="number" inputMode="decimal" min="0" step="0.01" placeholder="Exact amount" value={draft.acceptableVarianceCents === null ? "" : draft.acceptableVarianceCents / 100} onChange={(event) => setDraft({ ...draft, acceptableVarianceCents: event.target.value === "" ? null : Math.round(Number(event.target.value) * 100) })} /></div>
      <div className="field"><label htmlFor="income-source-merchant">Matching merchant</label><input id="income-source-merchant" value={draft.normalizedMerchant ?? ""} placeholder="Learned after first match" onChange={(event) => setDraft({ ...draft, normalizedMerchant: event.target.value || null })} /></div>
    </div>
    <label className="account-checkbox"><input type="checkbox" checked={draft.autoMatchEnabled} onChange={(event) => setDraft({ ...draft, autoMatchEnabled: event.target.checked })} /> Automatically match confident deposits</label>
    <button className="primary-button income-source-save" disabled={saving || !draft.name.trim() || draft.expectedAmountCents <= 0 || !draft.nextExpectedDate} onClick={() => onSave(draft)}>{saving ? "Saving…" : "Save income schedule"}</button>
    {onArchive ? <button className="text-button danger-text income-source-archive" disabled={saving} onClick={onArchive}><Trash2 size={16} /> Archive schedule</button> : null}
  </BottomSheet>;
}

function cadenceLabel(cadence: string | null) {
  if (cadence === "weekly") return "Weekly";
  if (cadence === "biweekly") return "Every two weeks";
  if (cadence === "semimonthly") return "Twice monthly";
  if (cadence === "annual") return "Annual";
  return "Monthly";
}
