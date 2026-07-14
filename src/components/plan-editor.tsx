"use client";

import { useState } from "react";

export function PlanEditor() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  return (
    <>
      <button className="secondary-button" style={{ width: "100%", marginTop: 18 }} onClick={() => setOpen(!open)}>{open ? "Close" : "+ Add planned item"}</button>
      {open ? <form className="form-card card" style={{ marginTop: 18 }} onSubmit={async (event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const response = await fetch("/api/plan", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: data.get("name"), date: data.get("date"), type: data.get("type"), amountCents: Math.round(Number(data.get("amount")) * 100) }) });
        const body = (await response.json()) as { message?: string };
        setMessage(response.status === 401 ? "Preview only. Production sign-in is required to save." : body.message ?? "Saved.");
      }}>
        <h2 style={{ marginTop: 0 }}>Add to the plan</h2>
        <div className="field"><label htmlFor="plan-name">Name</label><input id="plan-name" name="name" required placeholder="Car insurance" /></div>
        <div className="field"><label htmlFor="plan-date">Date</label><input id="plan-date" name="date" type="date" required /></div>
        <div className="field"><label htmlFor="plan-amount">Amount</label><input id="plan-amount" name="amount" type="number" min="0.01" step="0.01" required /></div>
        <div className="field"><label htmlFor="plan-type">Type</label><select id="plan-type" name="type"><option value="expense">Expense</option><option value="income">Income</option></select></div>
        <button className="primary-button">Save planned item</button>
        <p className="form-message" role="status">{message}</p>
      </form> : null}
    </>
  );
}

