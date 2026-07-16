"use client";

import { X } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";
import { BottomSheet } from "@/components/bottom-sheet";
import { CategoryActivity } from "@/components/category-activity";
import { CategoryIcon } from "@/components/icons";
import { TransactionDetail } from "@/components/transaction-detail";
import { categoryVisualStyle } from "@/lib/category-style";
import type { ActivityTransaction, BudgetCategory } from "@/lib/data";
import { formatCurrency } from "@/lib/utils";

export function CategoryDetail({
  actions,
  allCategories,
  category,
  children,
  icon,
  message,
  month,
  onClose,
  title,
  budget,
}: {
  actions?: ReactNode;
  allCategories: BudgetCategory[];
  category: BudgetCategory;
  children?: ReactNode;
  icon?: ReactNode;
  message?: string;
  month?: string;
  onClose: () => void;
  title?: ReactNode;
  budget?: ReactNode;
}) {
  const [detail, setDetail] = useState<ActivityTransaction | null>(null);
  const [spentDelta, setSpentDelta] = useState(0);
  const [pendingDelta, setPendingDelta] = useState(0);
  const spent = category.spentCents + spentDelta;
  const pending = category.pendingCents + pendingDelta;
  const available = category.budgetedCents - spent - pending;
  const status =
    category.budgetedCents === 0
      ? "Not budgeted"
      : available < 0
        ? `${formatCurrency(Math.abs(available))} over`
        : `${formatCurrency(available)} available`;
  async function openTransaction(id: string) {
    const response = await fetch(`/api/activity?transaction=${id}`);
    const body = (await response.json()) as {
      transactions?: ActivityTransaction[];
    };
    if (response.ok && body.transactions?.[0]) setDetail(body.transactions[0]);
  }

  return (
    <>
      <BottomSheet
        className="category-sheet category-detail-sheet"
        label={`${category.name} category detail`}
        onClose={onClose}
        handleLabel="Swipe down to close category"
      >
        <div
          className="category-detail-hero"
          style={categoryVisualStyle(category) as React.CSSProperties}
        >
          <div className="category-detail-header">
            <button
              className="icon-button"
              onClick={onClose}
              aria-label="Close category"
            >
              <X />
            </button>
            <strong>Category</strong>
            <span />
          </div>
          <div className="category-detail-title">
            {icon ?? (
              <span className="category-disc">
                <CategoryIcon name={category.icon} />
              </span>
            )}
            <div>
              <p className={`eyebrow ${available < 0 ? "negative" : ""}`}>
                {status}
              </p>
              {title ?? <h2>{category.name}</h2>}
            </div>
          </div>
          <div className="category-detail-progress">
            <span
              style={{
                width: `${Math.min(100, ((spent + pending) / Math.max(1, category.budgetedCents)) * 100)}%`,
              }}
            />
          </div>
          <dl className="category-metrics">
            <div>
              <dt>Budget</dt>
              <dd>{budget ?? formatCurrency(category.budgetedCents)}</dd>
            </div>
            <div>
              <dt>Spent</dt>
              <dd>{formatCurrency(spent)}</dd>
            </div>
            <div>
              <dt>Pending</dt>
              <dd>{formatCurrency(pending)}</dd>
            </div>
          </dl>
        </div>
        <CategoryActivity
          allCategories={allCategories}
          category={category}
          month={month}
          onAggregateDelta={(transactionStatus, delta) =>
            transactionStatus === "pending"
              ? setPendingDelta((value) => value + delta)
              : setSpentDelta((value) => value + delta)
          }
          onTransaction={(transaction) => void openTransaction(transaction.id)}
        />
        {actions ? (
          <div className="category-primary-actions">{actions}</div>
        ) : null}
        {children}
        {message ? (
          <p className="form-message" role="status">
            {message}
          </p>
        ) : null}
      </BottomSheet>
      {detail ? (
        <TransactionDetail
          transaction={detail}
          categories={allCategories}
          onClose={() => setDetail(null)}
          onUpdated={setDetail}
        />
      ) : null}
    </>
  );
}
