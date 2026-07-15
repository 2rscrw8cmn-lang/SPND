"use client";

import { format } from "date-fns";
import { CalendarPlus, Check, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function PlanEditor() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/plan", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: data.get("name"), date: data.get("date"), type: data.get("type"), amountCents: Math.round(Number(data.get("amount")) * 100) }) });
      const body = await response.json() as { message?: string };
      if (!response.ok) {
        setMessage(response.status === 401 ? "Preview only. Sign in to save planned items." : body.message ?? "The planned item could not be saved.");
        return;
      }
      form.reset();
      setOpen(false);
      router.refresh();
    } catch {
      setMessage("The planned item could not be saved. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  return <section className="plan-add-section">
    <button className="secondary-button plan-add-button" onClick={() => { setOpen(!open); setMessage(""); }}>{open ? <><X size={17} /> Cancel</> : <><CalendarPlus size={17} /> Add upcoming item</>}</button>
    {open ? <form className="plan-editor card" onSubmit={submit}>
      <div className="plan-editor-heading"><p className="eyebrow">One-time cash flow</p><h2>Add an upcoming item</h2></div>
      <div className="field"><label htmlFor="plan-name">What is it?</label><input id="plan-name" name="name" required maxLength={120} placeholder="Car insurance, paycheck, school fee…" /></div>
      <div className="plan-editor-grid"><div className="field"><label htmlFor="plan-date">Expected date</label><input id="plan-date" name="date" type="date" min={format(new Date(), "yyyy-MM-dd")} required /></div><div className="field"><label htmlFor="plan-type">Money direction</label><select id="plan-type" name="type"><option value="expense">Money going out</option><option value="income">Money coming in</option></select></div></div>
      <div className="field"><label htmlFor="plan-amount">Expected amount</label><input id="plan-amount" name="amount" type="number" inputMode="decimal" min="0.01" step="0.01" placeholder="0.00" required /></div>
      <button className="primary-button" disabled={saving}><Check size={17} /> {saving ? "Saving…" : "Add to cash-flow plan"}</button>
      <p className="form-message" role="status">{message}</p>
    </form> : null}
  </section>;
}
