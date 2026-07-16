"use client";

import { Check, CircleHelp, Search, X } from "lucide-react";
import { useState } from "react";
import { BottomSheet } from "@/components/bottom-sheet";
import { CategoryIcon } from "@/components/icons";
import { categoryVisualStyle } from "@/lib/category-style";
import type { BudgetCategory } from "@/lib/data";

const groupOrder = ["Essentials", "Lifestyle", "Goals", "Excluded"];

export function orderedPickerCategories(categories: BudgetCategory[]) {
  return categories
    .filter((category) => category.isActive && !category.isExcluded)
    .map((category, index) => ({ category, index }))
    .sort((a, b) => {
      const aGroup = groupOrder.indexOf(a.category.categoryGroup);
      const bGroup = groupOrder.indexOf(b.category.categoryGroup);
      const groupDifference =
        (aGroup < 0 ? groupOrder.length : aGroup) -
        (bGroup < 0 ? groupOrder.length : bGroup);
      return groupDifference || a.index - b.index;
    })
    .map(({ category }) => category);
}

export function CategoryPickerSheet({
  allowUnsorted = true,
  categories,
  eyebrow = "Choose category",
  label,
  onClose,
  onSelect,
  recentIds = [],
  selectedId,
  title,
}: {
  allowUnsorted?: boolean;
  categories: BudgetCategory[];
  eyebrow?: string;
  label: string;
  onClose: () => void;
  onSelect: (category: BudgetCategory | null) => void;
  recentIds?: string[];
  selectedId: string;
  title: string;
}) {
  const [query, setQuery] = useState("");
  const ordered = orderedPickerCategories(categories);
  const term = query.trim().toLowerCase();
  const filtered = term
    ? ordered.filter((category) =>
        `${category.name} ${category.categoryGroup}`
          .toLowerCase()
          .includes(term),
      )
    : ordered;
  const recent = term
    ? []
    : recentIds
        .map((id) => ordered.find((category) => category.id === id))
        .filter((category): category is BudgetCategory => Boolean(category))
        .slice(0, 4);
  const grouped = filtered.reduce<
    Array<{ name: string; categories: BudgetCategory[] }>
  >((items, category) => {
    const current = items.at(-1);
    if (!current || current.name !== category.categoryGroup)
      items.push({ name: category.categoryGroup, categories: [category] });
    else current.categories.push(category);
    return items;
  }, []);

  function choose(category: BudgetCategory | null) {
    onSelect(category);
    onClose();
  }

  function pickerItem(category: BudgetCategory, keyPrefix = "") {
    return (
      <button
        className={`category-picker-item ${selectedId === category.id ? "selected" : ""}`}
        aria-pressed={selectedId === category.id}
        key={`${keyPrefix}${category.id}`}
        onClick={() => choose(category)}
      >
        <span
          className="category-picker-icon"
          style={categoryVisualStyle(category) as React.CSSProperties}
        >
          <CategoryIcon name={category.icon} size={19} />
        </span>
        <span>
          <strong>{category.name}</strong>
          <small>{category.categoryGroup}</small>
        </span>
        {selectedId === category.id ? <Check size={18} /> : null}
      </button>
    );
  }

  return (
    <BottomSheet
      backdropClassName="category-picker-backdrop"
      className="category-picker-sheet"
      label={label}
      onClose={onClose}
      handleLabel="Swipe category list down to dismiss"
    >
      <div className="sheet-title category-picker-title">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h2>{title}</h2>
        </div>
        <button
          className="icon-button"
          aria-label="Close category picker"
          onClick={onClose}
        >
          <X />
        </button>
      </div>
      <div className="activity-search field category-picker-search">
        <label htmlFor="category-picker-search" className="sr-only">
          Search categories
        </label>
        <Search size={18} />
        <input
          id="category-picker-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search categories"
        />
      </div>
      <div className="category-picker-list">
        {allowUnsorted && !term ? (
          <button
            className={`category-picker-item ${selectedId ? "" : "selected"}`}
            aria-pressed={!selectedId}
            onClick={() => choose(null)}
          >
            <span className="category-picker-icon unsorted">
              <CircleHelp size={19} />
            </span>
            <span>
              <strong>Unsorted</strong>
              <small>No budget category</small>
            </span>
            {!selectedId ? <Check size={18} /> : null}
          </button>
        ) : null}
        {recent.length ? (
          <section
            className="category-picker-group"
            aria-labelledby="picker-group-recent"
          >
            <h3 id="picker-group-recent">Recent</h3>
            {recent.map((category) => pickerItem(category, "recent-"))}
          </section>
        ) : null}
        {grouped.map((group) => (
          <section
            className="category-picker-group"
            key={group.name}
            aria-labelledby={`picker-group-${group.name}`}
          >
            <h3 id={`picker-group-${group.name}`}>{group.name}</h3>
            {group.categories.map((category) => pickerItem(category))}
          </section>
        ))}
        {!grouped.length ? (
          <p className="compact-empty">No categories match “{query.trim()}”.</p>
        ) : null}
      </div>
    </BottomSheet>
  );
}
