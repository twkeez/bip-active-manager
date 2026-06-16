"use client";

import { useState } from "react";
import {
  CheckSquare,
  FileText,
  BookOpen,
  Plus,
  Pencil,
  Trash2,
  X,
  Check,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import type { PlaybookItem, PlaybookItemType, ServiceTier } from "@/lib/playbook/types";

const TYPE_META: Record<PlaybookItemType, { label: string; icon: React.ElementType; color: string }> = {
  checklist: { label: "Checklist", icon: CheckSquare, color: "#00c9a7" },
  deliverable: { label: "Deliverable", icon: FileText, color: "#60a5fa" },
  guideline: { label: "Guideline", icon: BookOpen, color: "#a78bfa" },
};

const SERVICE_LABELS: Record<string, string> = {
  seo: "SEO",
  ppc: "Ads / PPC",
  social: "Social Media",
  orm: "Reputation (ORM)",
  blog: "Blog",
};

type Props = {
  tiers: ServiceTier[];
  initialItems: PlaybookItem[];
  isAdmin: boolean;
};

function groupByCategory(items: PlaybookItem[]): Record<string, PlaybookItem[]> {
  const groups: Record<string, PlaybookItem[]> = {};
  for (const item of items) {
    if (!groups[item.category]) groups[item.category] = [];
    groups[item.category].push(item);
  }
  return groups;
}

function ItemRow({
  item,
  isAdmin,
  onUpdate,
  onDelete,
}: {
  item: PlaybookItem;
  isAdmin: boolean;
  onUpdate: (id: number, patch: Partial<PlaybookItem>) => void;
  onDelete: (id: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(item.title);
  const [body, setBody] = useState(item.body ?? "");
  const [saving, setSaving] = useState(false);
  const meta = TYPE_META[item.type];
  const Icon = meta.icon;

  async function save() {
    setSaving(true);
    await fetch(`/api/playbook/items/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, body: body || null }),
    });
    onUpdate(item.id, { title, body: body || null });
    setEditing(false);
    setSaving(false);
  }

  async function remove() {
    if (!confirm("Remove this item?")) return;
    await fetch(`/api/playbook/items/${item.id}`, { method: "DELETE" });
    onDelete(item.id);
  }

  return (
    <div className="group flex gap-3 border-b border-[var(--bip-border)] px-4 py-3 last:border-0 hover:bg-[var(--bip-hover)] transition-colors">
      <Icon size={14} className="mt-0.5 shrink-0" style={{ color: meta.color }} />
      <div className="flex-1 min-w-0">
        {editing ? (
          <div className="flex flex-col gap-2">
            <input
              className="bip-input w-full text-sm"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
            <textarea
              className="bip-input w-full text-sm"
              rows={3}
              placeholder="Description (optional)"
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
            <div className="flex gap-2">
              <button
                onClick={save}
                disabled={saving}
                className="flex items-center gap-1 rounded-md bg-[var(--bip-accent)] px-3 py-1 text-xs font-medium text-[#0f1117]"
              >
                <Check size={11} />
                {saving ? "Saving…" : "Save"}
              </button>
              <button
                onClick={() => { setEditing(false); setTitle(item.title); setBody(item.body ?? ""); }}
                className="flex items-center gap-1 rounded-md border border-[var(--bip-border)] px-3 py-1 text-xs text-[rgba(255,255,255,0.5)]"
              >
                <X size={11} /> Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            <p className="text-sm text-white">{item.title}</p>
            {item.body && (
              <p className="mt-0.5 text-xs text-[rgba(255,255,255,0.45)] leading-relaxed">{item.body}</p>
            )}
            {item.auto_verify_key && (
              <span className="mt-1 inline-block rounded-full border border-[var(--bip-border)] px-2 py-0.5 text-[10px] text-[rgba(255,255,255,0.35)]">
                auto-verify: {item.auto_verify_key}
              </span>
            )}
          </>
        )}
      </div>
      {isAdmin && !editing && (
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => setEditing(true)} className="rounded p-1 hover:bg-[var(--bip-hover)]">
            <Pencil size={12} className="text-[rgba(255,255,255,0.4)]" />
          </button>
          <button onClick={remove} className="rounded p-1 hover:bg-[var(--bip-hover)]">
            <Trash2 size={12} className="text-[rgba(255,255,255,0.4)]" />
          </button>
        </div>
      )}
    </div>
  );
}

function AddItemForm({
  tierKey,
  onAdd,
  onClose,
}: {
  tierKey: string;
  onAdd: (item: PlaybookItem) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState("General");
  const [type, setType] = useState<PlaybookItemType>("checklist");
  const [autoVerifyKey, setAutoVerifyKey] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    const res = await fetch("/api/playbook/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tier_key: tierKey,
        title: title.trim(),
        body: body.trim() || null,
        category: category.trim() || "General",
        type,
        auto_verify_key: autoVerifyKey.trim() || null,
      }),
    });
    const item = await res.json();
    onAdd(item);
    setSaving(false);
    onClose();
  }

  return (
    <form onSubmit={submit} className="border-t border-[var(--bip-border)] bg-[var(--bip-page)] p-4 flex flex-col gap-3">
      <div className="flex gap-2">
        <input
          className="bip-input flex-1 text-sm"
          placeholder="Item title *"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoFocus
          required
        />
        <select
          className="bip-input text-sm"
          value={type}
          onChange={(e) => setType(e.target.value as PlaybookItemType)}
        >
          <option value="checklist">Checklist</option>
          <option value="deliverable">Deliverable</option>
          <option value="guideline">Guideline</option>
        </select>
      </div>
      <div className="flex gap-2">
        <input
          className="bip-input flex-1 text-sm"
          placeholder="Category (e.g. Technical Setup)"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        />
        <input
          className="bip-input flex-1 text-sm"
          placeholder="Auto-verify key (optional)"
          value={autoVerifyKey}
          onChange={(e) => setAutoVerifyKey(e.target.value)}
          list="verify-keys"
        />
        <datalist id="verify-keys">
          <option value="gsc_connected" />
          <option value="ads_synced" />
          <option value="ga4_connected" />
          <option value="gbp_connected" />
          <option value="basecamp_linked" />
          <option value="harvest_linked" />
        </datalist>
      </div>
      <textarea
        className="bip-input text-sm"
        rows={2}
        placeholder="Description (optional)"
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />
      <div className="flex gap-2">
        <button type="submit" disabled={saving} className="bip-btn-primary py-1.5 px-4 text-xs">
          {saving ? "Adding…" : "Add Item"}
        </button>
        <button type="button" onClick={onClose} className="bip-btn-secondary py-1.5 px-4 text-xs">
          Cancel
        </button>
      </div>
    </form>
  );
}

function TierPanel({
  tier,
  items: initialItems,
  isAdmin,
}: {
  tier: ServiceTier;
  items: PlaybookItem[];
  isAdmin: boolean;
}) {
  const [items, setItems] = useState(initialItems);
  const [open, setOpen] = useState(true);
  const [adding, setAdding] = useState(false);
  const grouped = groupByCategory(items);

  function handleUpdate(id: number, patch: Partial<PlaybookItem>) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  }

  function handleDelete(id: number) {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  return (
    <div className="bip-card overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 border-b border-[var(--bip-border)] px-4 py-3 hover:bg-[var(--bip-hover)] transition-colors"
      >
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <div className="flex-1 text-left">
          <p className="text-sm font-medium text-white">{tier.tier_label}</p>
          <p className="text-xs text-[rgba(255,255,255,0.4)] line-clamp-1">{tier.objective}</p>
        </div>
        <span className="text-xs text-[rgba(255,255,255,0.35)]">{items.length} items</span>
      </button>

      {open && (
        <>
          {items.length === 0 && !adding && (
            <p className="px-4 py-5 text-sm text-[rgba(255,255,255,0.3)]">
              No items yet.{isAdmin ? " Add your first item below." : ""}
            </p>
          )}

          {Object.entries(grouped).map(([cat, catItems]) => (
            <div key={cat}>
              <p className="bip-section-label px-4 pt-3 pb-1">{cat}</p>
              {catItems.map((item) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  isAdmin={isAdmin}
                  onUpdate={handleUpdate}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          ))}

          {adding && (
            <AddItemForm
              tierKey={tier.tier_key}
              onAdd={(item) => setItems((prev) => [...prev, item])}
              onClose={() => setAdding(false)}
            />
          )}

          {isAdmin && !adding && (
            <button
              onClick={() => setAdding(true)}
              className="flex w-full items-center gap-2 border-t border-[var(--bip-border)] px-4 py-2.5 text-xs text-[rgba(255,255,255,0.35)] hover:text-[var(--bip-accent)] hover:bg-[var(--bip-hover)] transition-colors"
            >
              <Plus size={12} /> Add item
            </button>
          )}
        </>
      )}
    </div>
  );
}

export default function PlaybookLibrary({ tiers, initialItems, isAdmin }: Props) {
  const services = [...new Set(tiers.map((t) => t.service))];
  const [activeService, setActiveService] = useState(services[0] ?? "seo");

  const visibleTiers = tiers.filter((t) => t.service === activeService);
  const itemsByTier: Record<string, PlaybookItem[]> = {};
  for (const item of initialItems) {
    if (!itemsByTier[item.tier_key]) itemsByTier[item.tier_key] = [];
    itemsByTier[item.tier_key].push(item);
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Service tabs */}
      <div className="flex gap-1 border-b border-[var(--bip-border)] pb-0">
        {services.map((svc) => (
          <button
            key={svc}
            onClick={() => setActiveService(svc)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeService === svc
                ? "border-[var(--bip-accent)] text-white"
                : "border-transparent text-[rgba(255,255,255,0.4)] hover:text-white"
            }`}
          >
            {SERVICE_LABELS[svc] ?? svc}
          </button>
        ))}
      </div>

      {/* Tier panels */}
      <div className="flex flex-col gap-4">
        {visibleTiers.map((tier) => (
          <TierPanel
            key={tier.tier_key}
            tier={tier}
            items={itemsByTier[tier.tier_key] ?? []}
            isAdmin={isAdmin}
          />
        ))}
      </div>
    </div>
  );
}
