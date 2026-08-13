"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, Lock, PanelLeftOpen, Sparkles, X } from "lucide-react";
import { getCampaignType } from "@/lib/social/campaign-types";
import { resolveAwarenessDate, toDateString } from "@/lib/social/awareness-resolver";
import { purposeStyle } from "@/lib/social/purpose-style";
import type { FreshIdea } from "@/lib/social/idea-brainstorm";
import type {
  SocialAwarenessDay,
  SocialContentPost,
  SocialIdea,
  SocialPlanWithPosts,
  SocialPurpose,
  SocialSeriesWithParts,
} from "@/lib/social/types";
import { SOCIAL_PURPOSES } from "@/lib/social/types";
import { SeriesCard } from "./series-tab";

const MONTH_NAMES = [
  "", "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const WEEKDAY_HEADS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export type CalendarClient = {
  id: number;
  account_name: string;
};

type RailTab = "ideas" | "fresh" | "days" | "series";
type BoardFreshIdea = FreshIdea & { checked: boolean; saved?: boolean; custom?: boolean };

// ─── Calendar helpers ─────────────────────────────────────────────────────────

type GridCell = { key: string; dateStr: string; day: number; inMonth: boolean };

/** Month grid padded with adjacent-month days to whole weeks (Sun-Sat). */
function buildMonthGrid(year: number, month: number): GridCell[] {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const leading = first.getUTCDay();
  const total = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cellCount = Math.ceil((leading + total) / 7) * 7;

  const cells: GridCell[] = [];
  for (let i = 0; i < cellCount; i++) {
    const d = new Date(Date.UTC(year, month - 1, 1 - leading + i));
    const dateStr = toDateString(d);
    cells.push({
      key: dateStr,
      dateStr,
      day: d.getUTCDate(),
      inMonth: d.getUTCMonth() === month - 1 && d.getUTCFullYear() === year,
    });
  }
  return cells;
}

function todayString(): string {
  const now = new Date();
  return toDateString(new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())));
}

/** "Oct 18-24" for a range, "Oct 18" for a single day. */
function formatRange(start: Date, end: Date | null): string {
  const m = MONTH_NAMES[start.getUTCMonth() + 1].slice(0, 3);
  if (!end) return `${m} ${start.getUTCDate()}`;
  const em = MONTH_NAMES[end.getUTCMonth() + 1].slice(0, 3);
  return m === em
    ? `${m} ${start.getUTCDate()}-${end.getUTCDate()}`
    : `${m} ${start.getUTCDate()} – ${em} ${end.getUTCDate()}`;
}

// ─── Shared card shell ────────────────────────────────────────────────────────

function SourceCard({
  title,
  description,
  pills,
  meta,
  selected,
  onClick,
  action,
}: {
  title: string;
  description?: string;
  pills?: React.ReactNode;
  meta?: React.ReactNode;
  selected?: boolean;
  onClick?: () => void;
  action?: React.ReactNode;
}) {
  const interactive = Boolean(onClick);
  return (
    <div
      onClick={onClick}
      className={`rounded-2xl border bg-white p-4 shadow-sm transition hover:shadow-md ${
        selected ? "border-slate-900 ring-1 ring-slate-900" : "border-slate-200/80"
      } ${interactive ? "cursor-pointer" : ""}`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-slate-900">{title}</p>
        {action}
      </div>
      {description && <p className="mt-1.5 text-sm text-slate-600">{description}</p>}
      {(pills || meta) && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {pills}
          {meta}
        </div>
      )}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function CalendarBuilder({
  clients,
  bankIdeas,
  awarenessDays,
  series,
  isAdminUser,
  initialClientId,
}: {
  clients: CalendarClient[];
  bankIdeas: SocialIdea[];
  awarenessDays: SocialAwarenessDay[];
  series: SocialSeriesWithParts[];
  isAdminUser: boolean;
  initialClientId?: number;
}) {
  const now = new Date();
  const defaultMonth = now.getMonth() + 2 > 12 ? 1 : now.getMonth() + 2;
  const defaultYear = now.getMonth() + 2 > 12 ? now.getFullYear() + 1 : now.getFullYear();

  const [clientId, setClientId] = useState<number | "">(
    initialClientId != null && clients.some((c) => c.id === initialClientId) ? initialClientId : "",
  );
  const [month, setMonth] = useState(defaultMonth);
  const [year, setYear] = useState(defaultYear);

  // Left rail
  const [railTab, setRailTab] = useState<RailTab>("ideas");
  const [railOpen, setRailOpen] = useState(false); // small screens only
  const [purposeFilter, setPurposeFilter] = useState<SocialPurpose[]>([]);

  // Sources
  const [bankChecked, setBankChecked] = useState<number[]>([]);
  const [fresh, setFresh] = useState<BoardFreshIdea[]>([]);
  const [brainstorming, setBrainstorming] = useState(false);
  const [gettingMore, setGettingMore] = useState(false);
  const [customIdea, setCustomIdea] = useState("");

  // Plan for the selected month
  const [plan, setPlan] = useState<SocialPlanWithPosts | null>(null);
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Build
  const [building, setBuilding] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [checkingExisting, setCheckingExisting] = useState(false);
  const [confirmRebuild, setConfirmRebuild] = useState<{ preserved: number; replaced: number } | null>(null);
  const [lastPreserved, setLastPreserved] = useState<number | null>(null);

  const client = clients.find((c) => c.id === clientId) ?? null;
  const selectedCount = bankChecked.length + fresh.filter((f) => f.checked).length;

  // ── Load the plan whenever (client, month, year) changes ───────────────────
  const loadPlan = useCallback(async () => {
    if (!client) {
      setPlan(null);
      return;
    }
    setLoadingPlan(true);
    setError(null);
    try {
      const res = await fetch(`/api/social/plans?clientId=${client.id}`);
      const plans = (await res.json()) as SocialPlanWithPosts[] | { error?: string };
      if (!res.ok || !Array.isArray(plans)) {
        throw new Error((plans as { error?: string }).error ?? "Could not load plans");
      }
      setPlan(plans.find((p) => p.plan_month === month && p.plan_year === year) ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load plans");
      setPlan(null);
    } finally {
      setLoadingPlan(false);
    }
  }, [client, month, year]);

  useEffect(() => {
    void loadPlan();
  }, [loadPlan]);

  // Elapsed-seconds ticker while generating.
  useEffect(() => {
    if (!building) return;
    setElapsed(0);
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, [building]);

  // ── Derived source lists ───────────────────────────────────────────────────

  // Global ideas plus ones scoped to this client.
  const visibleIdeas = useMemo(
    () =>
      bankIdeas.filter(
        (i) => i.is_active && (i.client_id == null || (client != null && i.client_id === client.id)),
      ),
    [bankIdeas, client],
  );

  const filteredIdeas = useMemo(() => {
    if (purposeFilter.length === 0) return visibleIdeas;
    // Null-purpose ideas always show — most existing rows have none.
    return visibleIdeas.filter((i) => i.purpose == null || purposeFilter.includes(i.purpose));
  }, [visibleIdeas, purposeFilter]);

  const ideasByType = useMemo(() => {
    const map = new Map<string, SocialIdea[]>();
    for (const idea of filteredIdeas) {
      const key = getCampaignType(idea.campaign_type)?.label ?? idea.campaign_type;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(idea);
    }
    return [...map.entries()];
  }, [filteredIdeas]);

  const visibleSeries = useMemo(
    () => series.filter((s) => s.client_id == null || (client != null && s.client_id === client.id)),
    [series, client],
  );

  // Awareness days for the selected month, resolved for the selected year.
  const { monthLongDays, datedDays } = useMemo(() => {
    const forMonth = awarenessDays.filter((d) => d.month === month);
    const monthLong: SocialAwarenessDay[] = [];
    const dated: Array<{ row: SocialAwarenessDay; start: Date; end: Date | null; label: string }> = [];
    for (const row of forMonth) {
      if (row.rule_type === "month_long") {
        monthLong.push(row);
        continue;
      }
      try {
        const { start, end } = resolveAwarenessDate(row, year);
        dated.push({ row, start, end, label: formatRange(start, end) });
      } catch {
        // A rule that can't resolve this year (e.g. a 5th weekday that doesn't
        // exist) is simply skipped rather than breaking the rail.
      }
    }
    dated.sort((a, b) => a.start.getTime() - b.start.getTime());
    return { monthLongDays: monthLong, datedDays: dated };
  }, [awarenessDays, month, year]);

  // Awareness markers keyed by date, for the grid cells.
  const awarenessByDate = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const { row, start, end } of datedDays) {
      const last = end ?? start;
      for (let t = start.getTime(); t <= last.getTime(); t += 86_400_000) {
        const key = toDateString(new Date(t));
        const list = map.get(key) ?? [];
        list.push(row.name);
        map.set(key, list);
      }
    }
    return map;
  }, [datedDays]);

  // ── Grid ───────────────────────────────────────────────────────────────────

  const cells = useMemo(() => buildMonthGrid(year, month), [year, month]);
  const today = todayString();

  const postsByDate = useMemo(() => {
    const map = new Map<string, SocialContentPost[]>();
    for (const post of plan?.posts ?? []) {
      const list = map.get(post.post_date) ?? [];
      list.push(post);
      map.set(post.post_date, list);
    }
    return map;
  }, [plan]);

  // Posts carry provenance via idea_id; purpose comes from the linked idea.
  const purposeByIdeaId = useMemo(() => {
    const map = new Map<number, SocialPurpose | null>();
    for (const idea of bankIdeas) map.set(idea.id, idea.purpose);
    return map;
  }, [bankIdeas]);

  // ── Actions ────────────────────────────────────────────────────────────────

  async function brainstorm(more: boolean) {
    if (!clientId || brainstorming || gettingMore) return;
    if (more) setGettingMore(true);
    else setBrainstorming(true);
    setError(null);
    setRailTab("fresh");
    try {
      const res = await fetch("/api/social/brainstorm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, month, exclude: more ? fresh.map((f) => f.title) : [] }),
      });
      const data = (await res.json()) as { ideas?: FreshIdea[]; error?: string };
      if (!res.ok || !data.ideas) throw new Error(data.error ?? "Brainstorm failed");
      const cards = data.ideas.map((i) => ({ ...i, checked: false }));
      setFresh(more ? [...fresh, ...cards] : cards);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Brainstorm failed");
    } finally {
      setBrainstorming(false);
      setGettingMore(false);
    }
  }

  function addCustomIdea() {
    const t = customIdea.trim();
    if (!t) return;
    setFresh([...fresh, { title: t, description: "", shot_idea: "", campaign_type: "series", checked: true, custom: true }]);
    setCustomIdea("");
  }

  async function saveToBank(index: number) {
    const idea = fresh[index];
    if (!idea || idea.saved) return;
    const res = await fetch("/api/social/ideas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: idea.title,
        description: idea.shot_idea ? `${idea.description} Shot idea: ${idea.shot_idea}` : idea.description,
        campaign_type: idea.campaign_type,
        tags: ["ai-generated"],
      }),
    });
    if (res.ok) setFresh(fresh.map((f, i) => (i === index ? { ...f, saved: true } : f)));
  }

  async function buildCalendar() {
    if (!client || selectedCount === 0 || building || checkingExisting) return;
    setError(null);
    setCheckingExisting(true);
    try {
      const res = await fetch(`/api/social/plans?clientId=${client.id}`);
      const plans = (await res.json()) as SocialPlanWithPosts[] | { error?: string };
      if (res.ok && Array.isArray(plans)) {
        const existing = plans.find((p) => p.plan_month === month && p.plan_year === year);
        if (existing) {
          const preserved = existing.posts.filter((p) => p.locked || p.status !== "idea").length;
          const replaced = existing.posts.length - preserved;
          if (preserved > 0) {
            setConfirmRebuild({ preserved, replaced });
            return;
          }
        }
      }
    } catch {
      // Pre-check is advisory; the server preserves protected posts regardless.
    } finally {
      setCheckingExisting(false);
    }
    await runGenerate();
  }

  async function runGenerate() {
    if (!client || selectedCount === 0 || building) return;
    setConfirmRebuild(null);
    setBuilding(true);
    setError(null);
    try {
      const selectedIdeas = [
        ...bankIdeas.filter((i) => bankChecked.includes(i.id)).map((i) => ({ title: i.title, description: i.description })),
        ...fresh.filter((f) => f.checked).map((f) => ({ title: f.title, description: f.description, shot_idea: f.shot_idea || undefined })),
      ];
      const res = await fetch("/api/social/plans/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: client.id, clientName: client.account_name, month, year, selectedIdeas }),
      });
      const payload = (await res.json()) as {
        plan?: SocialPlanWithPosts;
        posts?: SocialContentPost[];
        preservedCount?: number;
        error?: string;
      };
      if (!res.ok || !payload.plan) throw new Error(payload.error ?? "Calendar build failed");
      // Render the response directly — no refetch.
      setPlan({ ...payload.plan, posts: payload.posts ?? [] });
      setLastPreserved(payload.preservedCount ?? 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Calendar build failed");
    } finally {
      setBuilding(false);
    }
  }

  const years = [now.getFullYear(), now.getFullYear() + 1];

  // ── Rail content ───────────────────────────────────────────────────────────

  const railTabs: Array<{ id: RailTab; label: string; count: number }> = [
    { id: "ideas", label: "Ideas", count: filteredIdeas.length },
    { id: "fresh", label: "Fresh", count: fresh.length },
    { id: "days", label: "Days", count: monthLongDays.length + datedDays.length },
    { id: "series", label: "Series", count: visibleSeries.length },
  ];

  const rail = (
    <div className="flex h-full flex-col">
      {/* Segmented tabs */}
      <div className="flex shrink-0 gap-1 rounded-xl bg-slate-100 p-1">
        {railTabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setRailTab(t.id)}
            className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-semibold transition ${
              railTab === t.id ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"
            }`}
          >
            {t.label}
            <span className={`ml-1 tabular-nums ${railTab === t.id ? "text-slate-400" : "text-slate-400"}`}>
              {t.count}
            </span>
          </button>
        ))}
      </div>

      <div className="mt-3 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
        {/* ── Ideas ── */}
        {railTab === "ideas" && (
          <>
            <div className="flex flex-wrap gap-1.5">
              {SOCIAL_PURPOSES.map((p) => {
                const on = purposeFilter.includes(p);
                const ps = purposeStyle(p);
                return (
                  <button
                    key={p}
                    onClick={() =>
                      setPurposeFilter((prev) => (on ? prev.filter((x) => x !== p) : [...prev, p]))
                    }
                    className={`rounded-full border px-2 py-0.5 text-xs font-medium transition ${
                      on ? ps.pill : "border-slate-200/80 bg-white text-slate-500 hover:border-slate-400"
                    }`}
                  >
                    {ps.label}
                  </button>
                );
              })}
              {purposeFilter.length > 0 && (
                <button
                  onClick={() => setPurposeFilter([])}
                  className="rounded-full px-2 py-0.5 text-xs font-medium text-slate-400 hover:text-slate-900"
                >
                  Clear
                </button>
              )}
            </div>

            {ideasByType.length === 0 && (
              <p className="py-8 text-center text-sm text-slate-400">No ideas match.</p>
            )}
            {ideasByType.map(([label, list]) => (
              <div key={label} className="space-y-2">
                <p className="text-[0.65rem] font-semibold uppercase tracking-widest text-slate-400">{label}</p>
                {list.map((idea) => {
                  const ps = purposeStyle(idea.purpose);
                  return (
                    <SourceCard
                      key={idea.id}
                      title={idea.title}
                      description={idea.description}
                      selected={bankChecked.includes(idea.id)}
                      onClick={() =>
                        setBankChecked((prev) =>
                          prev.includes(idea.id) ? prev.filter((id) => id !== idea.id) : [...prev, idea.id],
                        )
                      }
                      pills={
                        <>
                          {idea.purpose && (
                            <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${ps.pill}`}>
                              {ps.label}
                            </span>
                          )}
                          {idea.client_id != null && (
                            <span className="rounded-full border border-indigo-200/60 bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
                              This practice
                            </span>
                          )}
                        </>
                      }
                    />
                  );
                })}
              </div>
            ))}
          </>
        )}

        {/* ── Fresh ── */}
        {railTab === "fresh" && (
          <>
            <button
              onClick={() => void brainstorm(fresh.length > 0)}
              disabled={!client || brainstorming || gettingMore}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-700 disabled:opacity-50"
            >
              <Sparkles size={14} />
              {brainstorming || gettingMore
                ? "Thinking…"
                : fresh.length > 0
                  ? "More ideas"
                  : "Brainstorm cute ideas"}
            </button>
            {!client && (
              <p className="text-center text-xs text-slate-400">Pick a practice first.</p>
            )}

            {fresh.length === 0 && !brainstorming && client && (
              <p className="px-2 py-8 text-center text-sm text-slate-400">
                Practice-specific concepts — clinic pet spotlights, trick-for-a-treat videos — each with the exact
                photo to ask the client for.
              </p>
            )}

            {fresh.map((idea, i) => {
              const ct = getCampaignType(idea.campaign_type);
              return (
                <SourceCard
                  key={`${idea.title}-${i}`}
                  title={idea.title}
                  description={idea.description || undefined}
                  selected={idea.checked}
                  onClick={() => setFresh(fresh.map((f, idx) => (idx === i ? { ...f, checked: !f.checked } : f)))}
                  action={
                    isAdminUser && !idea.custom ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          void saveToBank(i);
                        }}
                        disabled={idea.saved}
                        title="Save to the shared Idea Bank"
                        className="shrink-0 text-xs font-medium text-slate-400 transition hover:text-slate-900 disabled:text-emerald-600"
                      >
                        {idea.saved ? "✓ banked" : "+ bank"}
                      </button>
                    ) : undefined
                  }
                  pills={
                    <>
                      {ct && (
                        <span className="rounded-full border border-slate-200/60 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-600">
                          {ct.label}
                        </span>
                      )}
                      {idea.custom && (
                        <span className="rounded-full border border-slate-200/60 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-500">
                          Yours
                        </span>
                      )}
                    </>
                  }
                  meta={
                    idea.shot_idea ? (
                      <span className="mt-1 block w-full rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs text-amber-900">
                        📸 {idea.shot_idea}
                      </span>
                    ) : undefined
                  }
                />
              );
            })}

            {fresh.length > 0 && (
              <div className="flex gap-2 pt-1">
                <input
                  value={customIdea}
                  onChange={(e) => setCustomIdea(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addCustomIdea()}
                  placeholder="Add your own idea…"
                  className="flex-1 rounded-lg border border-slate-200/80 bg-white px-3 py-1.5 text-sm outline-none focus:border-slate-400"
                />
                <button
                  onClick={addCustomIdea}
                  disabled={!customIdea.trim()}
                  className="rounded-lg border border-slate-200/80 px-3 py-1.5 text-xs font-semibold text-slate-600 disabled:opacity-40"
                >
                  Add
                </button>
              </div>
            )}
          </>
        )}

        {/* ── Days ── */}
        {railTab === "days" && (
          <>
            {monthLongDays.length === 0 && datedDays.length === 0 && (
              <p className="py-8 text-center text-sm text-slate-400">
                No verified awareness days for {MONTH_NAMES[month]}.
              </p>
            )}

            {monthLongDays.length > 0 && (
              <div className="space-y-2">
                <p className="text-[0.65rem] font-semibold uppercase tracking-widest text-slate-400">All month</p>
                {monthLongDays.map((d) => (
                  <SourceCard
                    key={d.id}
                    title={d.name}
                    description={d.content_angle}
                    pills={
                      <span className="rounded-full border border-emerald-200/60 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                        All month
                      </span>
                    }
                  />
                ))}
              </div>
            )}

            {datedDays.length > 0 && (
              <div className="space-y-2">
                <p className="text-[0.65rem] font-semibold uppercase tracking-widest text-slate-400">Dated</p>
                {datedDays.map(({ row, label }) => (
                  <SourceCard
                    key={row.id}
                    title={row.name}
                    description={row.content_angle}
                    pills={
                      <span className="rounded-full border border-sky-200/60 bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-700">
                        {label}
                      </span>
                    }
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* ── Series ── */}
        {railTab === "series" && (
          <>
            {visibleSeries.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-400">No active series.</p>
            ) : (
              visibleSeries.map((s) => <SeriesCard key={s.id} series={s} />)
            )}
          </>
        )}
      </div>
    </div>
  );

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Rebuild confirmation */}
      {confirmRebuild && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          onClick={() => setConfirmRebuild(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-bold tracking-tight text-slate-900">
              Rebuild {MONTH_NAMES[month]} {year}?
            </h3>
            <p className="mt-2 text-sm text-slate-500">
              This month already has a calendar. Work your team has touched is protected — everything else is
              rewritten.
            </p>
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between rounded-xl border border-emerald-200/60 bg-emerald-50 px-4 py-2.5">
                <span className="text-sm font-medium text-emerald-700">Kept as-is</span>
                <span className="text-sm font-bold text-emerald-700">
                  {confirmRebuild.preserved} post{confirmRebuild.preserved === 1 ? "" : "s"}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-amber-200/60 bg-amber-50 px-4 py-2.5">
                <span className="text-sm font-medium text-amber-700">Replaced</span>
                <span className="text-sm font-bold text-amber-700">
                  {confirmRebuild.replaced} post{confirmRebuild.replaced === 1 ? "" : "s"}
                </span>
              </div>
            </div>
            <p className="mt-3 text-xs text-slate-500">
              Locked posts and any post past &ldquo;Idea&rdquo; (brief sent, drafted, approved, scheduled, posted)
              are kept, along with their dates.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setConfirmRebuild(null)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-slate-500 transition hover:text-slate-900"
              >
                Cancel
              </button>
              <button
                onClick={() => void runGenerate()}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-slate-700"
              >
                Rebuild {confirmRebuild.replaced} post{confirmRebuild.replaced === 1 ? "" : "s"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Selector row */}
      <div className="flex flex-wrap items-end gap-3 px-6 py-4">
        <button
          onClick={() => setRailOpen(true)}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200/80 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm xl:hidden"
        >
          <PanelLeftOpen size={14} /> Sources
        </button>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Practice</label>
          <select
            value={clientId === "" ? "" : String(clientId)}
            onChange={(e) => {
              setClientId(e.target.value ? Number(e.target.value) : "");
              setBankChecked([]);
              setFresh([]);
              setLastPreserved(null);
            }}
            className="min-w-56 rounded-lg border border-slate-200/80 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none"
          >
            <option value="">Select a practice…</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.account_name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Month</label>
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="rounded-lg border border-slate-200/80 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none"
          >
            {MONTH_NAMES.slice(1).map((m, i) => (
              <option key={m} value={i + 1}>{m}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Year</label>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="rounded-lg border border-slate-200/80 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none"
          >
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>

        <div className="ml-auto flex items-center gap-3">
          {lastPreserved != null && lastPreserved > 0 && (
            <span className="rounded-full border border-emerald-200/60 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
              {lastPreserved} kept
            </span>
          )}
          <span className="text-xs font-medium text-slate-400">
            {selectedCount} selected
          </span>
          <button
            onClick={() => void buildCalendar()}
            disabled={!client || selectedCount === 0 || building || checkingExisting}
            className="rounded-lg bg-slate-900 px-5 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-slate-700 disabled:opacity-50"
          >
            {building ? "Building…" : checkingExisting ? "Checking…" : `Build ${MONTH_NAMES[month]}`}
          </button>
        </div>
      </div>

      {error && (
        <p className="mx-6 mb-3 rounded-xl border border-red-200/80 bg-red-50 px-4 py-2.5 text-sm text-red-700">
          {error}
        </p>
      )}

      {/* Two panels */}
      <div className="flex min-h-0 flex-1 gap-5 px-6 pb-6">
        {/* Left rail — desktop */}
        <aside className="hidden w-[360px] shrink-0 xl:block">{rail}</aside>

        {/* Left rail — overlay on smaller screens */}
        {railOpen && (
          <div className="fixed inset-0 z-40 flex xl:hidden" role="dialog" aria-modal="true">
            <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm" onClick={() => setRailOpen(false)} />
            <div className="relative z-10 flex h-full w-[360px] max-w-[90vw] flex-col bg-slate-50 p-4 shadow-xl">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-bold tracking-tight text-slate-900">Sources</p>
                <button onClick={() => setRailOpen(false)} className="text-slate-400 hover:text-slate-900">
                  <X size={16} />
                </button>
              </div>
              <div className="min-h-0 flex-1">{rail}</div>
            </div>
          </div>
        )}

        {/* Right panel — calendar */}
        <section className="flex min-w-0 flex-1 flex-col">
          {!client ? (
            <div className="flex flex-1 items-center justify-center rounded-2xl border border-dashed border-slate-300">
              <div className="text-center">
                <CalendarDays size={28} className="mx-auto text-slate-300" />
                <p className="mt-3 text-sm font-medium text-slate-500">Pick a practice to open its calendar.</p>
                <p className="mt-1 text-xs text-slate-400">
                  Selecting a month opens that month&rsquo;s plan — no build required to look.
                </p>
              </div>
            </div>
          ) : (
            <div className={building ? "pointer-events-none opacity-60 transition-opacity" : "transition-opacity"}>
              {/* Month-long observance banners */}
              {monthLongDays.length > 0 && (
                <div className="mb-3 space-y-1.5">
                  {monthLongDays.map((d) => (
                    <div
                      key={d.id}
                      className="flex items-center gap-2 rounded-xl border border-emerald-200/60 bg-emerald-50 px-4 py-2"
                    >
                      <span className="text-xs font-bold uppercase tracking-wide text-emerald-700">All month</span>
                      <span className="truncate text-sm font-medium text-emerald-900">{d.name}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Weekday header */}
              <div className="mb-1.5 grid grid-cols-7 gap-1.5">
                {WEEKDAY_HEADS.map((w) => (
                  <div key={w} className="px-1 text-xs uppercase tracking-wide text-slate-400">
                    {w}
                  </div>
                ))}
              </div>

              {/* Grid */}
              <div className="grid grid-cols-7 gap-1.5">
                {cells.map((cell) => {
                  const posts = postsByDate.get(cell.dateStr) ?? [];
                  const marks = cell.inMonth ? awarenessByDate.get(cell.dateStr) ?? [] : [];
                  return (
                    <div
                      key={cell.key}
                      className={`min-h-[120px] rounded-xl border border-slate-200/80 p-2 ${
                        cell.inMonth ? "bg-white" : "bg-slate-50/50"
                      }`}
                    >
                      <div className="mb-1 flex items-center gap-1.5">
                        <span className={`text-sm ${cell.inMonth ? "text-slate-500" : "text-slate-300"}`}>
                          {cell.day}
                        </span>
                        {cell.dateStr === today && <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />}
                      </div>

                      {/* Awareness markers */}
                      {marks.map((name) => (
                        <div
                          key={name}
                          title={name}
                          className="mb-1 truncate rounded-md bg-sky-50 px-1.5 py-0.5 text-[0.65rem] font-medium text-sky-700"
                        >
                          {name}
                        </div>
                      ))}

                      {/* Post chips — title only; captions run 600-900 chars and never appear here */}
                      {posts.map((post) => {
                        const ps = purposeStyle(
                          post.idea_id != null ? purposeByIdeaId.get(post.idea_id) ?? null : null,
                        );
                        return (
                          <div
                            key={post.id}
                            title={post.campaign_label}
                            className="mb-1 flex items-center gap-1.5 rounded-md border border-slate-200/80 bg-white px-1.5 py-1 shadow-sm"
                          >
                            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${ps.dot}`} />
                            <span className="min-w-0 flex-1 truncate text-[0.7rem] font-medium text-slate-700">
                              {post.campaign_label}
                            </span>
                            {post.locked && <Lock size={9} className="shrink-0 text-slate-400" />}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>

              {loadingPlan && <p className="mt-3 text-xs font-medium text-slate-400">Loading plan…</p>}
              {!loadingPlan && !plan && (
                <p className="mt-3 text-xs font-medium text-slate-400">
                  No plan for {MONTH_NAMES[month]} {year} yet — pick sources on the left and build one.
                </p>
              )}
            </div>
          )}

          {/* Build progress */}
          {building && (
            <div className="mt-4 rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-900">
                  Writing {MONTH_NAMES[month]} {year}…
                </p>
                <span className="text-xs font-medium tabular-nums text-slate-500">{elapsed}s</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                <div className="h-1.5 w-full animate-pulse rounded-full bg-gradient-to-r from-indigo-500 to-violet-500" />
              </div>
              <p className="mt-2 text-xs text-slate-400">
                Drafting captions, shot lists, and hashtags — usually 40-75 seconds.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
