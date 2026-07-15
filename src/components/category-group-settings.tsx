"use client";

import { Check, ChevronDown, Layers3, LockKeyhole, Pencil, Plus, Trash2, X } from "lucide-react";
import { useState, type FormEvent } from "react";
import type { CategoryGroup } from "@/lib/data";

type ApiResponse = { message?: string; group?: Partial<CategoryGroup> & { id: string; name: string } };

async function categoryGroupRequest(url: string, init: RequestInit): Promise<{ ok: boolean; body: ApiResponse }> {
  try {
    const response = await fetch(url, init);
    return { ok: response.ok, body: await response.json() as ApiResponse };
  } catch {
    return { ok: false, body: { message: "The category group could not be updated. Check your connection and try again." } };
  }
}

export function CategoryGroupSettings({ initialGroups, categoryCounts }: { initialGroups: CategoryGroup[]; categoryCounts: Record<string, number> }) {
  const [groups, setGroups] = useState(() => [...initialGroups].sort((a, b) => a.sortOrder - b.sortOrder));
  const [counts, setCounts] = useState(categoryCounts);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  async function addGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = newName.trim();
    if (!name) return;
    setBusyId("new");
    setMessage("");
    const { ok, body } = await categoryGroupRequest("/api/category-groups", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name }) });
    if (ok && body.group) {
      const group: CategoryGroup = { id: body.group.id, name: body.group.name, sortOrder: body.group.sortOrder ?? Math.max(0, ...groups.map((item) => item.sortOrder)) + 10, isSystem: false };
      setGroups((items) => [...items, group].sort((a, b) => a.sortOrder - b.sortOrder));
      setCounts((items) => ({ ...items, [group.name]: 0 }));
      setNewName("");
    }
    setMessage(body.message ?? (ok ? "Category group added." : "Category group could not be added."));
    setBusyId(null);
  }

  async function renameGroup(group: CategoryGroup) {
    const name = editingName.trim();
    if (!name || name === group.name) { setEditingId(null); return; }
    setBusyId(group.id);
    setMessage("");
    const { ok, body } = await categoryGroupRequest(`/api/category-groups/${group.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ name }) });
    if (ok) {
      setGroups((items) => items.map((item) => item.id === group.id ? { ...item, name } : item));
      setCounts((items) => { const next = { ...items, [name]: items[group.name] ?? 0 }; delete next[group.name]; return next; });
      setEditingId(null);
    }
    setMessage(body.message ?? (ok ? "Category group renamed." : "Category group could not be renamed."));
    setBusyId(null);
  }

  async function deleteGroup(group: CategoryGroup) {
    if ((counts[group.name] ?? 0) > 0) {
      setMessage(`Move the categories in ${group.name} before deleting the group.`);
      return;
    }
    setBusyId(group.id);
    setMessage("");
    const { ok, body } = await categoryGroupRequest(`/api/category-groups/${group.id}`, { method: "DELETE" });
    if (ok) setGroups((items) => items.filter((item) => item.id !== group.id));
    setMessage(body.message ?? (ok ? "Category group deleted." : "Category group could not be deleted."));
    setBusyId(null);
  }

  return <details className="category-group-settings card">
    <summary className="category-group-settings-heading">
      <span className="settings-feature-icon"><Layers3 size={20} /></span>
      <div><h3 id="category-groups-title">Category groups</h3><p>Organize related categories into collapsible budget sections.</p></div>
      <span className="category-group-summary-count">{groups.length} groups <ChevronDown size={17} /></span>
    </summary>
    <div className="category-group-list">
      {groups.map((group) => {
        const count = counts[group.name] ?? 0;
        const editing = editingId === group.id;
        return <div className="category-group-row" key={group.id}>
          <span className="category-group-row-icon"><Layers3 size={17} /></span>
          {editing ? <form className="category-group-edit" onSubmit={(event) => { event.preventDefault(); void renameGroup(group); }}>
            <label className="sr-only" htmlFor={`group-${group.id}`}>Category group name</label>
            <input id={`group-${group.id}`} autoFocus maxLength={40} value={editingName} onChange={(event) => setEditingName(event.target.value)} />
            <button type="submit" className="group-icon-button confirm" aria-label={`Save ${group.name}`} disabled={busyId === group.id}><Check size={18} /></button>
            <button type="button" className="group-icon-button" aria-label={`Cancel renaming ${group.name}`} onClick={() => setEditingId(null)}><X size={18} /></button>
          </form> : <>
            <div className="category-group-copy"><strong>{group.name}</strong><span>{count} categor{count === 1 ? "y" : "ies"}</span></div>
            {group.isSystem ? <span className="category-group-system"><LockKeyhole size={13} /> Built in</span> : <div className="category-group-actions">
              <button className="group-icon-button" aria-label={`Rename ${group.name}`} onClick={() => { setEditingId(group.id); setEditingName(group.name); setMessage(""); }}><Pencil size={17} /></button>
              <button className="group-icon-button danger" aria-label={`Delete ${group.name}`} disabled={busyId === group.id} onClick={() => void deleteGroup(group)}><Trash2 size={17} /></button>
            </div>}
          </>}
        </div>;
      })}
    </div>
    <form className="category-group-add" onSubmit={(event) => void addGroup(event)}>
      <label htmlFor="new-category-group">New category group</label>
      <div><input id="new-category-group" maxLength={40} placeholder="For example: Giving" value={newName} onChange={(event) => setNewName(event.target.value)} /><button className="secondary-button" disabled={busyId === "new" || !newName.trim()}><Plus size={17} /> Add group</button></div>
    </form>
    <p className="category-group-note">To delete a group, move its categories to another group first. Built-in groups stay available for a predictable budget structure.</p>
    <p className="form-message" role="status">{message}</p>
  </details>;
}
