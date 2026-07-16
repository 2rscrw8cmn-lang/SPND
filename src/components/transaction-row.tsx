"use client";

import { Check, ChevronRight, Ellipsis, Sparkles, Tags } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { formatCurrency } from "@/lib/utils";

type Point = { x: number; y: number; time: number; axis: "pending" | "horizontal" | "vertical" };

export type TransactionRowModel = { id: string; merchant: string; category: string; amountCents: number; date?: string; status: "pending" | "posted"; color?: string; reviewStatus: "needs_review" | "reviewed"; isTransfer?: boolean; excluded?: boolean; allocationCount?: number; allocations?: unknown[]; allocationSource?: string | null };

export function TransactionRow({ transaction, onSelect, onReview, onChooseCategory, hideDate = false }: { transaction: TransactionRowModel; onSelect?: () => void; onReview?: () => void; onChooseCategory?: () => void; hideDate?: boolean }) {
  const start = useRef<Point | null>(null); const suppressClick = useRef(false); const shellRef = useRef<HTMLDivElement>(null); const actionButtonRef = useRef<HTMLButtonElement>(null); const menuRef = useRef<HTMLDivElement>(null); const [dragX, setDragX] = useState(0); const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    if (!menuOpen) return;
    menuRef.current?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus();
    const closeOnPointer = (event: PointerEvent) => { if (!shellRef.current?.contains(event.target as Node)) setMenuOpen(false); };
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") { setMenuOpen(false); actionButtonRef.current?.focus(); } };
    window.addEventListener("pointerdown", closeOnPointer); window.addEventListener("keydown", closeOnEscape);
    return () => { window.removeEventListener("pointerdown", closeOnPointer); window.removeEventListener("keydown", closeOnEscape); };
  }, [menuOpen]);
  function reset() { start.current = null; setDragX(0); }
  function pointerDown(event: React.PointerEvent) { if (event.button !== 0 || (event.target as HTMLElement).closest("button,a,input,select,textarea")) return; start.current = { x: event.clientX, y: event.clientY, time: performance.now(), axis: "pending" }; suppressClick.current = false; }
  function pointerMove(event: React.PointerEvent) {
    const point = start.current; if (!point) return; const dx = event.clientX - point.x; const dy = event.clientY - point.y;
    if (point.axis === "pending") { if (Math.abs(dy) > 8 && Math.abs(dy) > Math.abs(dx)) { point.axis = "vertical"; suppressClick.current = true; setDragX(0); return; } if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.35) { point.axis = "horizontal"; event.currentTarget.setPointerCapture(event.pointerId); } }
    if (point.axis === "horizontal") { event.preventDefault(); suppressClick.current = true; setDragX(Math.max(-96, Math.min(96, dx))); }
  }
  function pointerUp(event: React.PointerEvent) {
    const point = start.current; if (!point || point.axis !== "horizontal") { reset(); return; }
    const dx = event.clientX - point.x; const velocity = Math.abs(dx) / Math.max(1, performance.now() - point.time); const committed = Math.abs(dx) >= 72 || (Math.abs(dx) >= 32 && velocity >= 0.65);
    if (committed) { navigator.vibrate?.(8); if (dx > 0 && transaction.reviewStatus !== "reviewed") onReview?.(); if (dx < 0) onChooseCategory?.(); }
    reset();
  }
  function activate() { if (suppressClick.current) { suppressClick.current = false; return; } onSelect?.(); }
  const visualStatus = transaction.status === "pending" ? "pending" : transaction.reviewStatus === "reviewed" ? "reviewed" : "needs-review";
  const sourceBadge = transaction.reviewStatus === "needs_review" && transaction.allocationSource === "merchant_rule"
    ? "Remembered"
    : transaction.reviewStatus === "needs_review" && (transaction.allocationSource === "merchant_history" || transaction.allocationSource === "provider")
      ? "Suggested"
      : null;
  return <div ref={shellRef} className={`transaction-swipe-shell ${visualStatus} ${dragX > 8 ? "revealing-review" : dragX < -8 ? "revealing-category" : ""}`}>
    <div className="transaction-swipe-action review" aria-hidden="true"><Check /> Review</div><div className="transaction-swipe-action category" aria-hidden="true">Category <Tags /></div>
    <article className="transaction-row" style={{ transform: `translateX(${dragX}px)` }} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={reset} onClick={activate} onKeyDown={onSelect ? (event) => { if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); onSelect(); } } : undefined} role={onSelect ? "button" : undefined} tabIndex={onSelect ? 0 : undefined} aria-label={onSelect ? `${transaction.merchant}, ${transaction.category}, ${formatCurrency(transaction.amountCents, { signed: true })}` : undefined}>
      <div className="merchant-mark" aria-hidden="true">{transaction.merchant.slice(0, 1)}</div>
      <div className="transaction-main"><strong>{transaction.merchant}</strong><span className="transaction-category-label"><i style={{ "--category": transaction.color ?? "#A6ACB8" } as React.CSSProperties} />{transaction.category}{transaction.isTransfer ? " · Transfer" : ""}{transaction.excluded ? " · Excluded" : ""}{(transaction.allocationCount ?? transaction.allocations?.length ?? 0) > 1 ? " · Split" : ""}</span></div>
      <div className="transaction-amount"><strong className={transaction.amountCents > 0 ? "income" : ""}>{formatCurrency(transaction.amountCents, { signed: true })}</strong><span>{transaction.status === "pending" ? <em>Pending</em> : hideDate ? sourceBadge ? <i className="transaction-source-badge"><Sparkles size={11} /> {sourceBadge}</i> : transaction.reviewStatus === "needs_review" ? "Needs review" : "Reviewed" : transaction.date}</span></div>
      {onReview || onChooseCategory ? <button ref={actionButtonRef} className="row-actions-button" aria-label={`Actions for ${transaction.merchant}`} aria-haspopup="menu" aria-expanded={menuOpen} onClick={(event) => { event.stopPropagation(); setMenuOpen(!menuOpen); }}><Ellipsis /></button> : <ChevronRight className="row-chevron" size={20} />}
    </article>
    {menuOpen ? <div ref={menuRef} className="row-actions-menu" role="menu"><button role="menuitem" disabled={transaction.reviewStatus === "reviewed"} onClick={() => { setMenuOpen(false); onReview?.(); }}><Check /> {transaction.reviewStatus === "reviewed" ? "Reviewed" : "Mark reviewed"}</button><button role="menuitem" onClick={() => { setMenuOpen(false); onChooseCategory?.(); }}><Tags /> Change category</button></div> : null}
  </div>;
}
