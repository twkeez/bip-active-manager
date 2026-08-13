"use client";

import { useState, useEffect, useCallback } from "react";
import { Lock, LockOpen } from "lucide-react";
import { getCampaignType } from "@/lib/social/campaign-types";
import type { SocialPlanWithPosts, SocialContentPost, SocialClientProfile, StandingCampaign, PostStatus } from "@/lib/social/types";

const MONTH_NAMES = [
  "", "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const STATUS_LABELS: Record<PostStatus, string> = {
  idea: "Idea",
  brief_sent: "Brief sent",
  asset_received: "Asset received",
  drafted: "Drafted",
  approved: "Approved",
  scheduled: "Scheduled",
  posted: "Posted",
};

const STATUS_COLORS: Record<PostStatus, string> = {
  idea: "bg-gray-100 text-gray-600",
  brief_sent: "bg-blue-100 text-blue-700",
  asset_received: "bg-yellow-100 text-yellow-700",
  drafted: "bg-orange-100 text-orange-700",
  approved: "bg-green-100 text-green-700",
  scheduled: "bg-teal-100 text-teal-700",
  posted: "bg-purple-100 text-purple-700",
};

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function PostCard({
  post,
  planId,
  onUpdate,
}: {
  post: SocialContentPost;
  planId: number;
  onUpdate: (updated: SocialContentPost) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ caption_draft: post.caption_draft ?? "", shot_list: post.shot_list ?? "", hashtags: post.hashtags ?? "" });
  const [saving, setSaving] = useState(false);
  // Optimistic lock state — falls back to the server value, reverts on failure.
  const [lockedOverride, setLockedOverride] = useState<boolean | null>(null);
  const [lockError, setLockError] = useState(false);
  const ct = getCampaignType(post.campaign_type);
  const locked = lockedOverride ?? post.locked;

  async function toggleLock() {
    const next = !locked;
    setLockedOverride(next);
    setLockError(false);
    try {
      const res = await fetch(`/api/social/plans/${planId}/posts`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId: post.id, updates: { locked: next } }),
      });
      if (!res.ok) throw new Error("Lock failed");
      const updated = (await res.json()) as SocialContentPost;
      setLockedOverride(null);
      onUpdate(updated);
    } catch {
      setLockedOverride(null); // revert to the server value
      setLockError(true);
      setTimeout(() => setLockError(false), 2500);
    }
  }

  async function saveEdits() {
    setSaving(true);
    const res = await fetch(`/api/social/plans/${planId}/posts`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postId: post.id, updates: draft }),
    });
    const updated = await res.json() as SocialContentPost;
    onUpdate(updated);
    setEditing(false);
    setSaving(false);
  }

  async function updateStatus(status: PostStatus) {
    const res = await fetch(`/api/social/plans/${planId}/posts`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postId: post.id, updates: { status } }),
    });
    const updated = await res.json() as SocialContentPost;
    onUpdate(updated);
  }

  return (
    <div className="border rounded-lg overflow-hidden" data-theme="light">
      <div
        className="px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-gray-50"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="text-xs text-gray-500 w-20 shrink-0">{formatDate(post.post_date)}</div>
        {ct && <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${ct.color}`}>{ct.label}</span>}
        <span className="text-sm text-gray-700 truncate flex-1">{post.campaign_label}</span>
        <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${STATUS_COLORS[post.status]}`}>
          {STATUS_LABELS[post.status]}
        </span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            void toggleLock();
          }}
          title={
            lockError
              ? "Could not change lock — try again"
              : locked
                ? "Locked — protected from rebuild"
                : "Lock to protect from rebuild"
          }
          aria-label={locked ? "Locked — protected from rebuild" : "Lock to protect from rebuild"}
          aria-pressed={locked}
          className={`shrink-0 rounded-md border p-1 transition-colors ${
            lockError
              ? "border-red-200 bg-red-50 text-red-600"
              : locked
                ? "border-slate-200 bg-slate-100 text-slate-700"
                : "border-transparent text-slate-400 hover:text-slate-600"
          }`}
        >
          {locked ? <Lock size={13} /> : <LockOpen size={13} />}
        </button>
        <span className="text-gray-400 text-xs">{expanded ? "▲" : "▼"}</span>
      </div>

      {expanded && (
        <div className="border-t px-4 py-4 space-y-4 bg-white" data-theme="light">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-500">Status:</span>
            {(Object.keys(STATUS_LABELS) as PostStatus[]).map((s) => (
              <button
                key={s}
                onClick={() => updateStatus(s)}
                className={`text-xs px-2 py-0.5 rounded-full border ${post.status === s ? STATUS_COLORS[s] + " border-transparent" : "border-gray-200 text-gray-500 hover:border-gray-400"}`}
              >
                {STATUS_LABELS[s]}
              </button>
            ))}
          </div>

          {editing ? (
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500">Caption draft</label>
                <textarea
                  value={draft.caption_draft}
                  onChange={(e) => setDraft((d) => ({ ...d, caption_draft: e.target.value }))}
                  className="w-full mt-1 px-3 py-2 rounded-md border text-sm resize-none"
                  rows={5}
                />
              </div>
              <div>
                <label className="text-xs text-gray-500">Shot list (what photo/video to take)</label>
                <textarea
                  value={draft.shot_list}
                  onChange={(e) => setDraft((d) => ({ ...d, shot_list: e.target.value }))}
                  className="w-full mt-1 px-3 py-2 rounded-md border text-sm resize-none"
                  rows={3}
                />
              </div>
              <div>
                <label className="text-xs text-gray-500">Hashtags</label>
                <input
                  value={draft.hashtags}
                  onChange={(e) => setDraft((d) => ({ ...d, hashtags: e.target.value }))}
                  className="w-full mt-1 px-3 py-1.5 rounded-md border text-sm"
                />
              </div>
              <div className="flex gap-2">
                <button onClick={saveEdits} disabled={saving} className="px-3 py-1.5 rounded-md bg-gray-900 text-white text-xs font-medium disabled:opacity-50">
                  {saving ? "Saving…" : "Save"}
                </button>
                <button onClick={() => setEditing(false)} className="px-3 py-1.5 rounded-md border text-xs">Cancel</button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <p className="text-xs text-gray-500 mb-1">Caption draft</p>
                <p className="text-sm text-gray-800 whitespace-pre-wrap">{post.caption_draft || <span className="italic text-gray-400">No caption yet</span>}</p>
              </div>
              {post.shot_list && (
                <div className="bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                  <p className="text-xs font-medium text-amber-800 mb-1">📸 Shot list for client</p>
                  <p className="text-sm text-amber-900">{post.shot_list}</p>
                </div>
              )}
              {post.hashtags && (
                <p className="text-xs text-gray-400">{post.hashtags}</p>
              )}
              <button onClick={() => setEditing(true)} className="text-xs text-gray-500 hover:text-gray-900 underline">Edit</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ClientProfileForm({
  clientId,
  profile,
  onSave,
}: {
  clientId: number;
  profile: SocialClientProfile | null;
  onSave: (p: SocialClientProfile) => void;
}) {
  const [specialty, setSpecialty] = useState(profile?.specialty ?? "");
  const [tone, setTone] = useState(profile?.tone ?? "");
  const [notes, setNotes] = useState(profile?.notes ?? "");
  const [postsPerWeek, setPostsPerWeek] = useState(profile?.posts_per_week ?? 3);
  const [campaigns, setCampaigns] = useState<StandingCampaign[]>(
    (profile?.standing_campaigns as StandingCampaign[]) ?? []
  );
  const [saving, setSaving] = useState(false);

  function addCampaign() {
    setCampaigns((c) => [...c, { name: "", description: "" }]);
  }
  function removeCampaign(i: number) {
    setCampaigns((c) => c.filter((_, idx) => idx !== i));
  }
  function updateCampaign(i: number, field: keyof StandingCampaign, value: string) {
    setCampaigns((c) => c.map((camp, idx) => idx === i ? { ...camp, [field]: value } : camp));
  }

  async function save() {
    setSaving(true);
    const res = await fetch("/api/social/client-profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId, specialty, tone, notes, posts_per_week: postsPerWeek, standing_campaigns: campaigns }),
    });
    const data = await res.json() as SocialClientProfile;
    onSave(data);
    setSaving(false);
  }

  return (
    <div className="space-y-4 p-4 border rounded-lg bg-gray-50" data-theme="light">
      <p className="text-sm font-medium text-gray-700">Content Profile</p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-500">Practice specialty</label>
          <input value={specialty} onChange={(e) => setSpecialty(e.target.value)}
            className="w-full mt-1 px-3 py-1.5 rounded-md border bg-white text-sm"
            placeholder="General small animal, Emergency, Exotic…" />
        </div>
        <div>
          <label className="text-xs text-gray-500">Posts per week</label>
          <select value={postsPerWeek} onChange={(e) => setPostsPerWeek(Number(e.target.value))}
            className="w-full mt-1 px-3 py-1.5 rounded-md border bg-white text-sm">
            <option value={2}>2</option>
            <option value={3}>3</option>
            <option value={4}>4</option>
            <option value={5}>5</option>
          </select>
        </div>
        <div className="col-span-2">
          <label className="text-xs text-gray-500">Voice & tone</label>
          <input value={tone} onChange={(e) => setTone(e.target.value)}
            className="w-full mt-1 px-3 py-1.5 rounded-md border bg-white text-sm"
            placeholder="Warm, friendly, and professional. Dog-heavy clientele." />
        </div>
        <div className="col-span-2">
          <label className="text-xs text-gray-500">Notes for AI (anything else to know)</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
            className="w-full mt-1 px-3 py-2 rounded-md border bg-white text-sm resize-none" rows={2}
            placeholder="Has a resident cat named Biscuit. Avoid holiday-heavy content." />
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs text-gray-500">Standing campaigns / recurring series</label>
          <button onClick={addCampaign} className="text-xs text-gray-500 hover:text-gray-900">+ Add</button>
        </div>
        {campaigns.map((c, i) => (
          <div key={i} className="flex gap-2 mb-2">
            <input value={c.name} onChange={(e) => updateCampaign(i, "name", e.target.value)}
              className="px-2 py-1 rounded border text-sm w-40 shrink-0 bg-white"
              placeholder="Campaign name" />
            <input value={c.description} onChange={(e) => updateCampaign(i, "description", e.target.value)}
              className="px-2 py-1 rounded border text-sm flex-1 bg-white"
              placeholder="Description (e.g. Resident cat named Biscuit, posted every 2nd week)" />
            <button onClick={() => removeCampaign(i)} className="text-gray-400 hover:text-red-600 shrink-0">×</button>
          </div>
        ))}
        {campaigns.length === 0 && <p className="text-xs text-gray-400">None yet</p>}
      </div>

      <button onClick={save} disabled={saving} className="px-4 py-1.5 rounded-md bg-gray-900 text-white text-sm font-medium disabled:opacity-50">
        {saving ? "Saving…" : "Save profile"}
      </button>
    </div>
  );
}

export function ContentPlanEditor({
  clientId,
  clientName,
  initialMonth,
  initialYear,
}: {
  clientId: number;
  clientName: string;
  initialMonth?: number;
  initialYear?: number;
}) {
  const now = new Date();
  const [month, setMonth] = useState(initialMonth ?? now.getMonth() + 1);
  const [year, setYear] = useState(initialYear ?? now.getFullYear());
  const [briefCopied, setBriefCopied] = useState(false);
  const [plans, setPlans] = useState<SocialPlanWithPosts[]>([]);
  const [profile, setProfile] = useState<SocialClientProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  const currentPlan = plans.find((p) => p.plan_month === month && p.plan_year === year) ?? null;

  const load = useCallback(async () => {
    setLoading(true);
    const [plansRes, profileRes] = await Promise.all([
      fetch(`/api/social/plans?clientId=${clientId}`).then((r) => r.json()) as Promise<SocialPlanWithPosts[]>,
      fetch(`/api/social/client-profile?clientId=${clientId}`).then((r) => r.json()) as Promise<SocialClientProfile | null>,
    ]);
    setPlans(plansRes ?? []);
    setProfile(profileRes ?? null);
    setLoading(false);
  }, [clientId]);

  useEffect(() => { load(); }, [load]);

  async function generate() {
    setGenerating(true);
    setGenError(null);
    const res = await fetch("/api/social/plans/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId, clientName, month, year }),
    });
    if (!res.ok) {
      const err = await res.json() as { error: string };
      setGenError(err.error ?? "Generation failed");
      setGenerating(false);
      return;
    }
    const { plan, posts } = await res.json() as { plan: SocialPlanWithPosts; posts: SocialContentPost[] };
    setPlans((prev) => {
      const withoutCurrent = prev.filter((p) => !(p.plan_month === month && p.plan_year === year));
      return [...withoutCurrent, { ...plan, posts }];
    });
    setGenerating(false);
  }

  // Client-facing "photo homework" — every shot the practice needs to capture this month.
  async function copyPhotoBrief() {
    if (!currentPlan) return;
    const lines = [
      `${clientName} — ${MONTH_NAMES[month]} Photo & Video List`,
      "",
      "Here's everything we need from you this month. Phone photos are perfect — candid beats polished!",
      "",
      ...currentPlan.posts
        .filter((p) => p.shot_list)
        .map((p) => `• ${formatDate(p.post_date)} — ${p.campaign_label}:\n  ${p.shot_list}`),
      "",
      "Send everything to your Beyond Indigo strategist whenever it's ready. Thank you!",
    ];
    await navigator.clipboard.writeText(lines.join("\n"));
    setBriefCopied(true);
    setTimeout(() => setBriefCopied(false), 1500);
  }

  function updatePost(planId: number, updated: SocialContentPost) {
    setPlans((prev) => prev.map((p) => p.id !== planId ? p : { ...p, posts: p.posts.map((post) => post.id === updated.id ? updated : post) }));
  }

  const months = Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: MONTH_NAMES[i + 1] }));
  const years = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1];

  if (loading) return <p className="text-sm text-gray-400 py-4">Loading…</p>;

  return (
    <div className="space-y-4" data-theme="light">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-2 items-center">
          <select value={month} onChange={(e) => setMonth(Number(e.target.value))}
            className="px-2 py-1 rounded border text-sm bg-white">
            {months.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
          <select value={year} onChange={(e) => setYear(Number(e.target.value))}
            className="px-2 py-1 rounded border text-sm bg-white">
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div className="flex gap-2">
          {currentPlan && (
            <button onClick={copyPhotoBrief} className="px-3 py-1.5 rounded-md border text-xs text-gray-600">
              {briefCopied ? "Copied!" : "📸 Copy photo brief"}
            </button>
          )}
          <button onClick={() => setShowProfile((v) => !v)} className="px-3 py-1.5 rounded-md border text-xs text-gray-600">
            {showProfile ? "Hide profile" : "Content profile"}
          </button>
          <button
            onClick={generate}
            disabled={generating}
            className="px-3 py-1.5 rounded-md bg-gray-900 text-white text-xs font-medium disabled:opacity-50"
          >
            {generating ? "Generating…" : currentPlan ? "Regenerate plan" : `Generate ${MONTH_NAMES[month]} plan`}
          </button>
        </div>
      </div>

      {showProfile && (
        <ClientProfileForm clientId={clientId} profile={profile} onSave={(p) => { setProfile(p); setShowProfile(false); }} />
      )}

      {genError && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{genError}</p>}

      {!currentPlan && !generating && (
        <div className="border-2 border-dashed rounded-lg py-10 text-center">
          <p className="text-sm text-gray-500">No plan for {MONTH_NAMES[month]} {year} yet.</p>
          <p className="text-xs text-gray-400 mt-1">Click "Generate plan" to create one with AI.</p>
        </div>
      )}

      {currentPlan && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500">{currentPlan.posts.length} posts · {MONTH_NAMES[month]} {year}</p>
            <span className={`text-xs px-2 py-0.5 rounded-full ${
              currentPlan.status === "approved" ? "bg-green-100 text-green-700" :
              currentPlan.status === "sent_to_client" ? "bg-blue-100 text-blue-700" :
              "bg-gray-100 text-gray-500"
            }`}>
              {currentPlan.status === "sent_to_client" ? "Brief sent" : currentPlan.status}
            </span>
          </div>
          {currentPlan.posts.map((post) => (
            <PostCard key={post.id} post={post} planId={currentPlan.id} onUpdate={(u) => updatePost(currentPlan.id, u)} />
          ))}
        </div>
      )}

      {plans.filter((p) => !(p.plan_month === month && p.plan_year === year)).length > 0 && (
        <details className="mt-2">
          <summary className="text-xs text-gray-500 cursor-pointer">Previous plans</summary>
          <div className="mt-2 space-y-1">
            {plans
              .filter((p) => !(p.plan_month === month && p.plan_year === year))
              .map((p) => (
                <button key={p.id} onClick={() => { setMonth(p.plan_month); setYear(p.plan_year); }}
                  className="text-xs text-gray-500 hover:text-gray-900 underline block">
                  {MONTH_NAMES[p.plan_month]} {p.plan_year} ({p.posts.length} posts)
                </button>
              ))}
          </div>
        </details>
      )}
    </div>
  );
}
