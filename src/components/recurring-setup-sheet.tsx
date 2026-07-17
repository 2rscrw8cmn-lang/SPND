"use client";

import { addMonths, format } from "date-fns";
import { CalendarClock, Check, Repeat2, X } from "lucide-react";
import { useState } from "react";
import { BottomSheet } from "@/components/bottom-sheet";
import type { ActivityTransaction } from "@/lib/data";

export function RecurringSetupSheet({ transaction, onClose, onSaved }: { transaction: ActivityTransaction; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(transaction.merchant);
  const [amount, setAmount] = useState((Math.abs(transaction.amountCents) / 100).toFixed(2));
  const [cadence, setCadence] = useState("monthly");
  const [nextDate, setNextDate] = useState(format(addMonths(new Date(transaction.isoDate), 1), "yyyy-MM-dd"));
  const [variance, setVariance] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function save() {
    setSaving(true);
    setMessage("");
    const response = await fetch("/api/recurring", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        transactionId: transaction.id,
        name,
        expectedAmountCents: Math.round(Number(amount) * 100),
        cadence,
        nextDate,
        acceptableVarianceCents: variance === "" ? null : Math.round(Number(variance) * 100),
      }),
    });
    const body = await response.json() as { message?: string };
    setSaving(false);
    setMessage(body.message ?? "");
    if (response.ok) onSaved();
  }

  return <BottomSheet className="recurring-setup-sheet" label={`Set up recurring ${transaction.merchant}`} onClose={onClose}>
    <div className="sheet-title"><div><p className="eyebrow">Recurring cash flow</p><h2><Repeat2 size={20} /> Set up schedule</h2></div><button className="icon-button" aria-label="Close recurring setup" onClick={onClose}><X /></button></div>
    <p className="page-subtitle">Use a real schedule so this item appears meaningfully in Plan.</p>
    <div className="field"><label htmlFor="recurring-name">Name</label><input id="recurring-name" value={name} onChange={(event) => setName(event.target.value)} /></div>
    <div className="expected-income-grid">
      <div className="field"><label htmlFor="recurring-amount">Expected amount</label><input id="recurring-amount" inputMode="decimal" type="number" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} /></div>
      <div className="field"><label htmlFor="recurring-cadence">Cadence</label><select id="recurring-cadence" value={cadence} onChange={(event) => setCadence(event.target.value)}><option value="weekly">Weekly</option><option value="biweekly">Every two weeks</option><option value="semimonthly">Twice monthly</option><option value="monthly">Monthly</option><option value="annual">Annual</option></select></div>
      <div className="field"><label htmlFor="recurring-next-date">Next date</label><input id="recurring-next-date" type="date" value={nextDate} onChange={(event) => setNextDate(event.target.value)} /></div>
      <div className="field"><label htmlFor="recurring-variance">Amount variance</label><input id="recurring-variance" inputMode="decimal" type="number" min="0" step="0.01" placeholder="Exact amount" value={variance} onChange={(event) => setVariance(event.target.value)} /></div>
    </div>
    <button className="primary-button recurring-save" disabled={saving || !name.trim() || Number(amount) <= 0 || !nextDate} onClick={() => void save()}><CalendarClock size={18} /> {saving ? "Saving…" : "Save recurring schedule"}<Check size={17} /></button>
    <p className="form-message" role="status">{message}</p>
  </BottomSheet>;
}
