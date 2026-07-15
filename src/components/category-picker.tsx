"use client";

import { Check, CircleHelp, X } from "lucide-react";
import { BottomSheet } from "@/components/bottom-sheet";
import { CategoryIcon } from "@/components/icons";
import type { BudgetCategory } from "@/lib/data";

const groupOrder = ["Essentials", "Lifestyle", "Goals", "Excluded"];

export function orderedPickerCategories(categories: BudgetCategory[]) {
  return categories
    .filter((category) => category.isActive && !category.isExcluded)
    .map((category, index) => ({ category, index }))
    .sort((a, b) => {
      const aGroup = groupOrder.indexOf(a.category.categoryGroup);
      const bGroup = groupOrder.indexOf(b.category.categoryGroup);
      const groupDifference = (aGroup < 0 ? groupOrder.length : aGroup) - (bGroup < 0 ? groupOrder.length : bGroup);
      return groupDifference || a.index - b.index;
    })
    .map(({ category }) => category);
}

export function CategoryPickerSheet({ allowUnsorted = true, categories, eyebrow = "Choose category", label, onClose, onSelect, selectedId, title }: { allowUnsorted?: boolean; categories: BudgetCategory[]; eyebrow?: string; label: string; onClose: () => void; onSelect: (category: BudgetCategory | null) => void; selectedId: string; title: string }) {
  const ordered = orderedPickerCategories(categories);
  const grouped = ordered.reduce<Array<{ name: string; categories: BudgetCategory[] }>>((items, category) => {
    const current = items.at(-1);
    if (!current || current.name !== category.categoryGroup) items.push({ name: category.categoryGroup, categories: [category] });
    else current.categories.push(category);
    return items;
  }, []);

  function choose(category: BudgetCategory | null) {
    onSelect(category);
    onClose();
  }

  return <BottomSheet backdropClassName="category-picker-backdrop" className="category-picker-sheet" label={label} onClose={onClose} handleLabel="Swipe category list down to dismiss">
    <div className="sheet-title category-picker-title"><div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2></div><button className="icon-button" aria-label="Close category picker" onClick={onClose}><X /></button></div>
    <div className="category-picker-list">
      {allowUnsorted ? <button className={`category-picker-item ${selectedId ? "" : "selected"}`} aria-pressed={!selectedId} onClick={() => choose(null)}><span className="category-picker-icon unsorted"><CircleHelp size={19} /></span><span><strong>Unsorted</strong><small>No budget category</small></span>{!selectedId ? <Check size={18} /> : null}</button> : null}
      {grouped.map((group) => <section className="category-picker-group" key={group.name} aria-labelledby={`picker-group-${group.name}`}><h3 id={`picker-group-${group.name}`}>{group.name}</h3>{group.categories.map((category) => <button className={`category-picker-item ${selectedId === category.id ? "selected" : ""}`} aria-pressed={selectedId === category.id} key={category.id} onClick={() => choose(category)}><span className="category-picker-icon" style={{ "--category": category.color } as React.CSSProperties}><CategoryIcon name={category.icon} size={19} /></span><span><strong>{category.name}</strong><small>{category.categoryGroup}</small></span>{selectedId === category.id ? <Check size={18} /> : null}</button>)}</section>)}
    </div>
  </BottomSheet>;
}
