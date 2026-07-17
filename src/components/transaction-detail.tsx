"use client";

import { format } from "date-fns";
import {
  ArrowLeftRight,
  BadgeCheck,
  Check,
  CreditCard,
  EyeOff,
  FileText,
  MessageSquareText,
  MoreHorizontal,
  Pencil,
  Plus,
  Repeat2,
  RotateCcw,
  Scissors,
  Sparkles,
  Store,
  Tag,
  Trash2,
  X,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import { BottomSheet } from "@/components/bottom-sheet";
import { CategoryPickerSheet } from "@/components/category-picker";
import { CategoryIcon } from "@/components/icons";
import { RecurringSetupSheet } from "@/components/recurring-setup-sheet";
import { categoryVisualStyle } from "@/lib/category-style";
import type { ActivityTransaction, BudgetCategory } from "@/lib/data";
import { formatCurrency } from "@/lib/utils";

type Split = { categoryId: string; rawAmount: string };
type PickerTarget = { type: "main" } | { type: "split"; index: number };

export function TransactionDetail({
  transaction,
  categories,
  onClose,
  onUpdated,
}: {
  transaction: ActivityTransaction;
  categories: BudgetCategory[];
  onClose: () => void;
  onUpdated: (transaction: ActivityTransaction) => void;
}) {
  const [categoryId, setCategoryId] = useState(transaction.categoryId);
  const [displayName, setDisplayName] = useState(transaction.merchant);
  const [editingName, setEditingName] = useState(false);
  const [note, setNote] = useState(transaction.note);
  const [excluded, setExcluded] = useState(transaction.excluded);
  const [isTransfer, setIsTransfer] = useState(transaction.isTransfer);
  const [isRecurring, setIsRecurring] = useState(transaction.isRecurring);
  const [always, setAlways] = useState(false);
  const [reviewed, setReviewed] = useState(
    transaction.reviewStatus === "reviewed",
  );
  const [splitting, setSplitting] = useState(
    transaction.allocations.length > 1,
  );
  const [pickerTarget, setPickerTarget] = useState<PickerTarget | null>(null);
  const [recurringSetup, setRecurringSetup] = useState(false);
  const absoluteCents = Math.abs(transaction.amountCents);
  const firstSplitCents = Math.floor(absoluteCents / 2);
  const [splits, setSplits] = useState<Split[]>(
    transaction.allocations.length > 1
      ? transaction.allocations.map((item) => ({
          categoryId: item.categoryId,
          rawAmount: formatSplitAmount(Math.abs(item.amountCents)),
        }))
      : [
          {
            categoryId: transaction.categoryId || categories[0]?.id || "",
            rawAmount: formatSplitAmount(firstSplitCents),
          },
          {
            categoryId:
              categories.find((item) => item.id !== transaction.categoryId)
                ?.id ?? "",
            rawAmount: formatSplitAmount(absoluteCents - firstSplitCents),
          },
        ],
  );
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const splitAmounts = splits.map((item) => parseSplitAmount(item.rawAmount));
  const splitCents = splitAmounts.reduce<number>((sum, cents) => sum + (cents ?? 0), 0);
  const splitHasInvalidAmount = splitAmounts.some((cents) => cents === null);
  const remainingSplitCents = absoluteCents - splitCents;
  const selectedCategory =
    categories.find((category) => category.id === categoryId) ?? null;
  const dirty =
    categoryId !== transaction.categoryId ||
    displayName !== transaction.merchant ||
    note !== transaction.note ||
    excluded !== transaction.excluded ||
    isTransfer !== transaction.isTransfer ||
    isRecurring !== transaction.isRecurring ||
    reviewed !== (transaction.reviewStatus === "reviewed") ||
    splitting !== transaction.allocations.length > 1 ||
    always;

  function close() {
    if (dirty && !window.confirm("Discard unsaved transaction changes?"))
      return;
    onClose();
  }

  function splitEvenly() {
    const base = Math.floor(absoluteCents / splits.length);
    const remainder = absoluteCents - base * splits.length;
    setSplits(
      splits.map((split, index) => ({
        ...split,
        rawAmount: formatSplitAmount(base + (index < remainder ? 1 : 0)),
      })),
    );
  }

  function updateSplitAmount(index: number, rawValue: string) {
    if (!/^\d*(?:[.,]\d{0,2})?$/.test(rawValue)) return;
    const cents = parseSplitAmount(rawValue);
    if (cents === null || rawValue.endsWith(".") || rawValue.endsWith(",")) {
      setSplits(splits.map((item, itemIndex) => itemIndex === index ? { ...item, rawAmount: rawValue } : item));
      return;
    }
    const balanceIndex =
      index === splits.length - 1 ? Math.max(0, index - 1) : splits.length - 1;
    const fixedCents = splits.reduce(
      (sum, item, itemIndex) =>
        itemIndex === index || itemIndex === balanceIndex
          ? sum
          : sum + (parseSplitAmount(item.rawAmount) ?? 0),
      0,
    );
    const balanceCents = Math.max(0, absoluteCents - fixedCents - cents);
    setSplits(
      splits.map((item, itemIndex) =>
        itemIndex === index
          ? { ...item, rawAmount: rawValue }
          : itemIndex === balanceIndex
            ? { ...item, rawAmount: formatSplitAmount(balanceCents) }
            : item,
      ),
    );
  }

  function selectCategory(category: BudgetCategory | null) {
    if (!pickerTarget) return;
    if (pickerTarget.type === "main") setCategoryId(category?.id ?? "");
    else
      setSplits(
        splits.map((split, index) =>
          index === pickerTarget.index
            ? { ...split, categoryId: category?.id ?? "" }
            : split,
        ),
      );
  }

  async function save(forceReviewed = false) {
    if (
      splitting &&
      (splitHasInvalidAmount || splitCents !== absoluteCents ||
        splits.some(
          (item) => !item.categoryId || (parseSplitAmount(item.rawAmount) ?? 0) <= 0,
        ))
    ) {
      setMessage(
        `Each split needs a category and positive amount, totaling ${formatCurrency(absoluteCents)} exactly.`,
      );
      return false;
    }
    setSaving(true);
    setMessage("");
    const sign = transaction.amountCents < 0 ? -1 : 1;
    const effectivelyReviewed = forceReviewed || reviewed || excluded || isTransfer;
    const payload = {
      displayName:
        displayName === transaction.importedMerchant ? null : displayName,
      categoryId: splitting ? undefined : categoryId || null,
      allocations: splitting
        ? splits.map((item) => ({
            categoryId: item.categoryId,
            amountCents: (parseSplitAmount(item.rawAmount) ?? 0) * sign,
          }))
        : undefined,
      note,
      excluded,
      isTransfer,
      isRecurring,
      alwaysCategorize: always && !splitting && Boolean(categoryId),
      reviewed: effectivelyReviewed,
      expectedUpdatedAt: transaction.updatedAt,
    };
    let response: Response;
    try {
      response = await fetch(`/api/transactions/${transaction.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch {
      setSaving(false);
      setMessage("Transaction could not be saved. Check your connection and try again.");
      return false;
    }
    const body = (await response.json()) as {
      message?: string;
      transaction?: { updated_at?: string };
    };
    setSaving(false);
    setMessage(body.message ?? "");
    if (!response.ok) return false;
    const category = categories.find((item) => item.id === categoryId);
    onUpdated({
      ...transaction,
      updatedAt: body.transaction?.updated_at ?? transaction.updatedAt,
      merchant: displayName,
      categoryId: splitting ? splits[0]!.categoryId : categoryId,
      category: splitting ? "Split" : (category?.name ?? "Unsorted"),
      color: splitting ? "#A6ACB8" : (category?.color ?? "#A6ACB8"),
      allocationSource: always
        ? "merchant_rule"
        : splitting || categoryId !== transaction.categoryId
          ? "manual"
          : transaction.allocationSource,
      note,
      excluded: isTransfer || excluded,
      isTransfer,
      isRecurring,
      reviewStatus: effectivelyReviewed ? "reviewed" : "needs_review",
      reviewedAt: effectivelyReviewed ? new Date().toISOString() : null,
      allocations: splitting
        ? splits.map((item) => ({
            categoryId: item.categoryId,
            category:
              categories.find((candidate) => candidate.id === item.categoryId)
                ?.name ?? "Unsorted",
            amountCents: (parseSplitAmount(item.rawAmount) ?? 0) * sign,
          }))
        : categoryId
          ? [
              {
                categoryId,
                category: category?.name ?? "Unsorted",
                amountCents: transaction.amountCents,
              },
            ]
          : [],
    });
    return true;
  }

  async function undo() {
    setSaving(true);
    const response = await fetch(`/api/transactions/${transaction.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ undo: true }),
    });
    const body = (await response.json()) as {
      message?: string;
      updatedAt?: string;
      restored?: {
        displayName: string | null;
        note: string | null;
        excluded: boolean;
        isTransfer: boolean;
        isRecurring: boolean;
        reviewStatus: string;
        reviewedAt: string | null;
        allocations: Array<{ categoryId: string; amountCents: number }>;
      };
    };
    setSaving(false);
    setMessage(body.message ?? "");
    if (response.ok && body.restored) {
      const category = categories.find(
        (item) => item.id === body.restored!.allocations[0]?.categoryId,
      );
      onUpdated({
        ...transaction,
        updatedAt: body.updatedAt ?? transaction.updatedAt,
        merchant: body.restored.displayName || transaction.importedMerchant,
        note: body.restored.note ?? "",
        excluded: body.restored.excluded,
        isTransfer: body.restored.isTransfer,
        isRecurring: body.restored.isRecurring,
        reviewStatus: body.restored.reviewStatus as "reviewed" | "needs_review",
        reviewedAt: body.restored.reviewedAt,
        categoryId:
          body.restored.allocations.length === 1
            ? body.restored.allocations[0]!.categoryId
            : (body.restored.allocations[0]?.categoryId ?? ""),
        category:
          body.restored.allocations.length > 1
            ? "Split"
            : (category?.name ?? "Unsorted"),
        color:
          body.restored.allocations.length > 1
            ? "#A6ACB8"
            : (category?.color ?? "#A6ACB8"),
        allocations: body.restored.allocations.map((item) => ({
          ...item,
          category:
            categories.find((candidate) => candidate.id === item.categoryId)
              ?.name ?? "Unsorted",
        })),
      });
    }
  }

  const pickerCategoryId =
    pickerTarget?.type === "split"
      ? (splits[pickerTarget.index]?.categoryId ?? "")
      : categoryId;
  const pickerTitle =
    pickerTarget?.type === "split"
      ? `Split ${pickerTarget.index + 1}`
      : displayName;

  return (
    <>
      <BottomSheet
        className="transaction-sheet"
        label={`${transaction.merchant} transaction details`}
        onClose={close}
        handleLabel="Swipe down to close transaction"
      >
        <div className="transaction-detail-header">
          <button
            className="icon-button"
            onClick={close}
            aria-label="Close transaction"
          >
            <X />
          </button>
          <span className={`status-badge ${transaction.status}`}>
            {transaction.status}
          </span>
          {transaction.auditHistory.some((event) => event.undoable) ? (
            <button className="undo-button" disabled={saving} onClick={undo}>
              <RotateCcw size={16} /> Undo
            </button>
          ) : (
            <span />
          )}
        </div>

        <div className="transaction-hero">
          <span
            className={`transaction-merchant-icon ${reviewed ? "reviewed" : "needs-review"}`}
            aria-hidden="true"
          >
            <Store size={23} />
          </span>
          {editingName ? (
            <input
              className="transaction-inline-name"
              aria-label="Merchant display name"
              autoFocus
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") setEditingName(false);
            }}
            />
          ) : (
            <button
              className="transaction-name-button"
              onClick={() => setEditingName(true)}
            >
              <h2>{displayName}</h2>
              <Pencil size={13} />
            </button>
          )}
          <strong className={transaction.amountCents > 0 ? "income" : ""}>
            {formatCurrency(transaction.amountCents, { signed: true })}
          </strong>
          <p>{format(new Date(transaction.isoDate), "EEEE, MMMM d, yyyy")}</p>
        </div>

        <div className="transaction-primary-controls">
          <button
            className={`transaction-review-button ${reviewed ? "active" : ""}`}
            disabled={saving || reviewed}
            onClick={() => void save(true)}
          >
            <BadgeCheck size={19} />
            <span>
              <strong>{reviewed ? "Reviewed" : "Review transaction"}</strong>
              <small>{reviewed ? "This transaction is complete" : "Save changes and continue"}</small>
            </span>
            {reviewed ? <Check size={18} /> : <span aria-hidden="true">›</span>}
          </button>
          <details className="transaction-more-controls">
            <summary><MoreHorizontal size={18} /> More controls</summary>
            <div className="transaction-control-strip" role="group" aria-label="Secondary transaction controls">
              <QuickControl active={always} disabled={!categoryId || splitting} icon={Sparkles} label="Remember" onClick={() => setAlways(!always)} />
              <QuickControl active={isRecurring} icon={Repeat2} label="Recurring" onClick={() => setRecurringSetup(true)} />
              <QuickControl active={isTransfer} icon={ArrowLeftRight} label="Transfer" onClick={() => {
                const next = !isTransfer;
                setIsTransfer(next);
                if (next) { setExcluded(true); setReviewed(true); }
              }} />
              <QuickControl active={excluded || isTransfer} disabled={isTransfer} icon={EyeOff} label="Exclude" onClick={() => {
                const next = !excluded;
                setExcluded(next);
                if (next) setReviewed(true);
              }} />
            </div>
          </details>
        </div>

        <dl className="transaction-facts">
          <div>
            <dt>
              <CreditCard size={15} /> Account
            </dt>
            <dd>{transaction.accountName}</dd>
          </div>
          <div>
            <dt>
              <FileText size={15} /> Description
            </dt>
            <dd>{transaction.rawDescription || "No provider description"}</dd>
          </div>
        </dl>

        <section className="transaction-section">
          <div className="transaction-section-heading">
            <span>
              <Tag size={16} />{" "}
              {transaction.amountCents > 0 ? "Income category" : "Category"}
            </span>
            {splitting ? <small>Managed by split</small> : null}
          </div>
          <button
            className="category-select-trigger"
            disabled={splitting}
            onClick={() => setPickerTarget({ type: "main" })}
          >
            {selectedCategory ? (
              <span
                className="category-select-icon"
                style={
                  categoryVisualStyle(selectedCategory) as React.CSSProperties
                }
              >
                <CategoryIcon name={selectedCategory.icon} size={19} />
              </span>
            ) : (
              <span className="category-select-icon unsorted">
                <Tag size={18} />
              </span>
            )}
            <span>
              <strong>
                {splitting
                  ? `${splits.length} split categories`
                  : (selectedCategory?.name ?? "Unsorted")}
              </strong>
              <small>
                {splitting
                  ? "Turn off split to choose one category"
                  : "Tap to change"}
              </small>
            </span>
            <span aria-hidden="true">›</span>
          </button>
        </section>

        <section className="transaction-section split-section">
          <button
            className={`split-control ${splitting ? "active" : ""}`}
            aria-pressed={splitting}
            onClick={() => setSplitting(!splitting)}
          >
            <span className="split-control-icon">
              <Scissors size={19} />
            </span>
            <span>
              <strong>Split transaction</strong>
              <small>
                {splitting
                  ? `${splits.length} categories · ${formatCurrency(splitCents)} assigned`
                  : "Divide this charge across categories"}
              </small>
            </span>
            {splitting ? <Check size={18} /> : <Plus size={18} />}
          </button>
          {splitting ? (
            <div className="split-editor">
              <div className="split-editor-heading">
                <span>Allocations</span>
                <button onClick={splitEvenly}>Split evenly</button>
              </div>
              {splits.map((split, index) => {
                const category = categories.find(
                  (candidate) => candidate.id === split.categoryId,
                );
                return (
                  <div className="split-row split-allocation" key={index}>
                    <span className="split-index">{index + 1}</span>
                    <button
                      className="split-category-trigger"
                      onClick={() => setPickerTarget({ type: "split", index })}
                    >
                      {category ? (
                        <span
                          className="category-select-icon"
                          style={
                            categoryVisualStyle(category) as React.CSSProperties
                          }
                        >
                          <CategoryIcon name={category.icon} size={17} />
                        </span>
                      ) : (
                        <span className="category-select-icon unsorted">
                          <Tag size={16} />
                        </span>
                      )}
                      <span>{category?.name ?? "Choose category"}</span>
                    </button>
                    <label className="split-money-input">
                      <span>$</span>
                      <input
                        aria-label={`Split ${index + 1} amount`}
                        inputMode="decimal"
                        type="text"
                        pattern="[0-9]*[.,]?[0-9]*"
                        value={split.rawAmount}
                        onChange={(event) =>
                          updateSplitAmount(index, event.target.value)
                        }
                        onBlur={(event) => {
                          const cents = parseSplitAmount(event.target.value);
                          if (cents !== null) setSplits((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, rawAmount: formatSplitAmount(cents) } : item));
                        }}
                      />
                    </label>
                    {splits.length > 2 ? (
                      <button
                        className="split-remove"
                        aria-label={`Remove split ${index + 1}`}
                        onClick={() =>
                          setSplits(
                            splits.filter(
                              (_, itemIndex) => itemIndex !== index,
                            ),
                          )
                        }
                      >
                        <Trash2 size={16} />
                      </button>
                    ) : (
                      <span />
                    )}
                  </div>
                );
              })}
              <div
                className={
                  splitCents === absoluteCents
                    ? "split-total valid"
                    : "split-total"
                }
              >
                <span>
                  {splitCents === absoluteCents
                    ? "Fully allocated"
                    : remainingSplitCents > 0
                      ? "Left to allocate"
                      : "Over allocated"}
                </span>
                <strong>{formatCurrency(Math.abs(remainingSplitCents))}</strong>
              </div>
              <button
                className="add-split-button"
                onClick={() =>
                  setSplits([...splits, { categoryId: "", rawAmount: "" }])
                }
              >
                <Plus size={16} /> Add split
              </button>
            </div>
          ) : null}
        </section>

        <label className="transaction-note-row">
          <MessageSquareText size={17} />
          <span>Note</span>
          <input
            aria-label="Household note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Add a household note"
          />
        </label>

        <details className="transaction-audit">
          <summary>
            Change history <span aria-hidden="true">›</span>
          </summary>
          {transaction.auditHistory.length ? (
            <ol>
              {transaction.auditHistory.map((event) => (
                <li key={event.id}>
                  <span>{event.action}</span>
                  <time>
                    {format(new Date(event.createdAt), "MMM d, h:mm a")}
                  </time>
                </li>
              ))}
            </ol>
          ) : (
            <p>No household edits yet.</p>
          )}
        </details>
        {dirty ? (
          <div className="transaction-save-bar">
            <button
              className="primary-button transaction-save"
              disabled={saving}
              onClick={() => void save()}
            >
              {reviewed ? <Check size={18} /> : null}
              {saving ? "Saving…" : "Save changes"}
            </button>
            <p className="form-message" role="status">
              {message}
            </p>
          </div>
        ) : message ? (
          <p className="form-message" role="status">
            {message}
          </p>
        ) : null}
      </BottomSheet>
      {pickerTarget ? (
        <CategoryPickerSheet
          categories={categories.filter((category) =>
            transaction.amountCents > 0
              ? category.behaviorType === "income"
              : category.behaviorType !== "income",
          )}
          eyebrow={
            pickerTarget.type === "split"
              ? "Split category"
              : "Transaction category"
          }
          label={`Choose category for ${pickerTitle}`}
          onClose={() => setPickerTarget(null)}
          onSelect={selectCategory}
          selectedId={pickerCategoryId}
          title={pickerTitle}
        />
      ) : null}
      {recurringSetup ? (
        <RecurringSetupSheet
          transaction={transaction}
          onClose={() => setRecurringSetup(false)}
          onSaved={() => {
            setIsRecurring(true);
            setRecurringSetup(false);
          }}
        />
      ) : null}
    </>
  );
}

function parseSplitAmount(value: string) {
  const normalized = value.trim().replace(",", ".");
  if (!normalized || !/^\d+(?:\.\d{0,2})?$/.test(normalized)) return null;
  const cents = Math.round(Number(normalized) * 100);
  return Number.isFinite(cents) && cents >= 0 ? cents : null;
}

function formatSplitAmount(cents: number) {
  return (cents / 100).toFixed(2).replace(/\.00$/, "");
}

function QuickControl({
  active,
  disabled = false,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  disabled?: boolean;
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={active ? "active" : ""}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
    >
      <Icon size={18} />
      <span>{label}</span>
    </button>
  );
}
