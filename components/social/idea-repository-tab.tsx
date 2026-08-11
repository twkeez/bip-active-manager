"use client";

import { useState } from "react";
import { CAMPAIGN_TYPES, getCampaignType } from "@/lib/social/campaign-types";
import type { SocialIdea } from "@/lib/social/types";

const EMPTY_FORM = { title: "", description: "", campaign_type: "educational", tags: "" };

export function IdeaRepositoryTab({ initialIdeas }: { initialIdeas: SocialIdea[] }) {
  const [ideas, setIdeas] = useState<SocialIdea[]>(initialIdeas);
  const [filter, setFilter] = useState<string>("all");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const active = ideas.filter((i) => i.is_active && (filter === "all" || i.campaign_type === filter));
  const archived = ideas.filter((i) => !i.is_active);

  async function save() {
    setSaving(true);
    setError(null);
    const tags = form.tags.split(",").map((t) => t.trim()).filter(Boolean);
    try {
      if (editingId) {
        const res = await fetch(`/api/social/ideas/${editingId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...form, tags }),
        });
        const data = await res.json() as SocialIdea;
        setIdeas((prev) => prev.map((i) => (i.id === editingId ? data : i)));
      } else {
        const res = await fetch("/api/social/ideas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...form, tags }),
        });
        const data = await res.json() as SocialIdea;
        setIdeas((prev) => [...prev, data]);
      }
      setForm(EMPTY_FORM);
      setEditingId(null);
      setShowForm(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  function startEdit(idea: SocialIdea) {
    setForm({ title: idea.title, description: idea.description, campaign_type: idea.campaign_type, tags: idea.tags.join(", ") });
    setEditingId(idea.id);
    setShowForm(true);
  }

  async function archive(id: number) {
    await fetch(`/api/social/ideas/${id}`, { method: "DELETE" });
    setIdeas((prev) => prev.map((i) => (i.id === id ? { ...i, is_active: false } : i)));
  }

  async function restore(id: number) {
    await fetch(`/api/social/ideas/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: true }),
    });
    setIdeas((prev) => prev.map((i) => (i.id === id ? { ...i, is_active: true } : i)));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setFilter("all")}
            className={`px-3 py-1 rounded-full text-xs font-medium ${filter === "all" ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
          >
            All ({ideas.filter((i) => i.is_active).length})
          </button>
          {CAMPAIGN_TYPES.map((ct) => {
            const count = ideas.filter((i) => i.is_active && i.campaign_type === ct.key).length;
            if (count === 0) return null;
            return (
              <button
                key={ct.key}
                onClick={() => setFilter(ct.key)}
                className={`px-3 py-1 rounded-full text-xs font-medium ${filter === ct.key ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
              >
                {ct.label} ({count})
              </button>
            );
          })}
        </div>
        <button
          onClick={() => { setForm(EMPTY_FORM); setEditingId(null); setShowForm(true); }}
          className="px-3 py-1.5 rounded-md bg-foreground text-background text-sm font-medium shrink-0"
        >
          + Add idea
        </button>
      </div>

      {showForm && (
        <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
          <p className="text-sm font-medium">{editingId ? "Edit idea" : "New idea"}</p>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs text-muted-foreground">Title</label>
              <input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                className="w-full mt-1 px-3 py-1.5 rounded-md border bg-background text-sm"
                placeholder="Pet of the Month"
              />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-muted-foreground">Description (what to post and why)</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                className="w-full mt-1 px-3 py-2 rounded-md border bg-background text-sm resize-none"
                rows={3}
                placeholder="Describe the post idea and what makes it work..."
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Campaign type</label>
              <select
                value={form.campaign_type}
                onChange={(e) => setForm((f) => ({ ...f, campaign_type: e.target.value }))}
                className="w-full mt-1 px-3 py-1.5 rounded-md border bg-background text-sm"
              >
                {CAMPAIGN_TYPES.map((ct) => (
                  <option key={ct.key} value={ct.key}>{ct.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Tags (comma separated)</label>
              <input
                value={form.tags}
                onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
                className="w-full mt-1 px-3 py-1.5 rounded-md border bg-background text-sm"
                placeholder="recurring, team, educational"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={save} disabled={saving} className="px-4 py-1.5 rounded-md bg-foreground text-background text-sm font-medium disabled:opacity-50">
              {saving ? "Saving…" : "Save"}
            </button>
            <button onClick={() => { setShowForm(false); setEditingId(null); }} className="px-4 py-1.5 rounded-md border text-sm">
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {active.length === 0 && (
          <p className="text-sm text-muted-foreground py-6 text-center">No ideas in this category yet.</p>
        )}
        {active.map((idea) => {
          const ct = getCampaignType(idea.campaign_type);
          return (
            <div key={idea.id} className="border rounded-lg p-4 flex gap-4 items-start">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm">{idea.title}</span>
                  {ct && <span className={`text-xs px-2 py-0.5 rounded-full ${ct.color}`}>{ct.label}</span>}
                  {idea.tags.map((tag) => (
                    <span key={tag} className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{tag}</span>
                  ))}
                </div>
                <p className="text-sm text-muted-foreground mt-1">{idea.description}</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => startEdit(idea)} className="text-xs text-muted-foreground hover:text-foreground">Edit</button>
                <button onClick={() => archive(idea.id)} className="text-xs text-muted-foreground hover:text-red-600">Archive</button>
              </div>
            </div>
          );
        })}
      </div>

      {archived.length > 0 && (
        <details className="mt-4">
          <summary className="text-xs text-muted-foreground cursor-pointer">Archived ({archived.length})</summary>
          <div className="mt-2 space-y-1">
            {archived.map((idea) => (
              <div key={idea.id} className="border rounded px-4 py-2 flex items-center gap-3 opacity-50">
                <span className="text-sm flex-1">{idea.title}</span>
                <button onClick={() => restore(idea.id)} className="text-xs text-muted-foreground hover:text-foreground">Restore</button>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
