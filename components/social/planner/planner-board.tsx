"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import {
  CONTENT_PILLARS,
  IDEA_CATEGORIES,
  UNCATEGORIZED,
  categoryColor,
  pillarColor,
} from "@/lib/social/taxonomy";
import { buildPlanCsv, exportFileName } from "@/lib/social/plan-export";
import { resolveAwarenessDate } from "@/lib/social/awareness-resolver";
import type {
  SocialAwarenessDay,
  SocialContentPlan,
  SocialContentPost,
  SocialIdea,
  SocialSeriesWithParts,
} from "@/lib/social/types";
import { PostEditorModal, type EditorDraft, type EditorProvenance } from "./post-editor-modal";
import {
  FONT,
  MONTH_NAMES,
  T,
  WEEKDAY_HEADERS,
  dayOf,
  daysInMonth,
  firstWeekdayOfMonth,
  isoDate,
  selectDateLabel,
} from "./tokens";

export type PlannerClient = { id: number; account_name: string; public_name: string | null };

/** Monthly post target. Config per client/tier lands here later. */
const DEFAULT_TARGET = 12;

type DragPayload =
  | { kind: "idea"; id: number }
  | { kind: "seasonal"; id: number }
  | { kind: "series"; id: number }
  | { kind: "post"; id: number };

// ─── Small shared bits ────────────────────────────────────────────────────────

function Dot({ color, size = 7 }: { color: string; size?: number }) {
  return (
    <span
      style={{ background: color, width: size, height: size }}
      className="inline-block shrink-0 rounded-full"
    />
  );
}

function RailCard({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{ background: T.card, borderColor: T.border }}
      className="rounded-2xl border p-3.5"
    >
      {children}
    </div>
  );
}

function RailLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{ color: T.faint, letterSpacing: "0.09em" }}
      className="text-[10.5px] font-bold uppercase"
    >
      {children}
    </p>
  );
}

/** Draggable source card — an idea, seasonal item, or series. */
function SourceCard({
  dragId,
  payload,
  used,
  onClick,
  children,
}: {
  dragId: string;
  payload: DragPayload;
  used: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: dragId,
    data: payload,
    disabled: used,
  });

  return (
    <div
      ref={setNodeRef}
      {...(used ? {} : attributes)}
      {...(used ? {} : listeners)}
      onClick={onClick}
      style={{
        background: T.fill,
        borderColor: T.borderSoft,
        opacity: used ? 0.45 : isDragging ? 0.4 : 1,
      }}
      className={`rounded-[10px] border px-2.5 py-[9px] transition-colors ${
        used ? "cursor-default" : "cursor-pointer hover:!bg-white hover:!border-[#C9C4B5]"
      }`}
    >
      {children}
    </div>
  );
}

// ─── Calendar ─────────────────────────────────────────────────────────────────

function PostChip({ post, onClick }: { post: SocialContentPost; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `post-${post.id}`,
    data: { kind: "post", id: post.id } satisfies DragPayload,
  });
  const headline = post.headline?.trim() || "Untitled post";

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={onClick}
      title={headline}
      style={{
        background: T.fill,
        borderColor: T.chipBorder,
        opacity: isDragging ? 0.4 : 1,
      }}
      className="flex cursor-grab items-start gap-1.5 rounded-lg border px-[7px] py-[5px] active:cursor-grabbing"
    >
      <span className="mt-[3px]">
        <Dot color={pillarColor(post.content_pillar)} />
      </span>
      <span
        style={{ color: T.ink, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}
        className="overflow-hidden text-[11px] font-semibold leading-snug"
      >
        {headline}
      </span>
    </div>
  );
}

function DayCell({
  day,
  year,
  month,
  posts,
  onPostClick,
}: {
  day: number;
  year: number;
  month: number;
  posts: SocialContentPost[];
  onPostClick: (post: SocialContentPost) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `day-${day}`, data: { day } });

  return (
    <div
      ref={setNodeRef}
      style={{
        background: isOver ? T.primaryTint : T.card,
        borderColor: isOver ? T.primary : T.border,
        borderStyle: isOver ? "dashed" : "solid",
        minHeight: 96,
      }}
      className="rounded-xl border px-2 py-[7px]"
    >
      <p
        style={{ color: posts.length > 0 ? T.ink : T.faint }}
        className="mb-1 text-[11px] font-bold"
      >
        {day}
      </p>
      <div className="flex flex-col gap-1">
        {posts.map((p) => (
          <PostChip key={p.id} post={p} onClick={() => onPostClick(p)} />
        ))}
      </div>
      <span className="sr-only">{selectDateLabel(year, month, day)}</span>
    </div>
  );
}

// ─── Export sheet ─────────────────────────────────────────────────────────────

const SHEET_COLUMNS = "118px 165px 1.5fr 1.7fr 1.5fr 30px";

function SheetCellInput({
  value,
  onCommit,
  bold,
}: {
  value: string;
  onCommit: (next: string) => void;
  bold?: boolean;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);

  return (
    <input
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => draft !== value && onCommit(draft)}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") {
          setDraft(value);
          e.currentTarget.blur();
        }
      }}
      style={{ color: bold ? T.ink : T.secondary }}
      className={`w-full rounded-md border border-transparent bg-transparent px-1.5 py-1 text-[12px] outline-none focus:!border-[#2B3FE4] focus:bg-white ${
        bold ? "font-semibold" : ""
      }`}
    />
  );
}

// ─── Board ────────────────────────────────────────────────────────────────────

export function PlannerBoard({
  clients,
  bankIdeas,
  awarenessDays,
  series,
  initialClientId,
}: {
  clients: PlannerClient[];
  bankIdeas: SocialIdea[];
  awarenessDays: SocialAwarenessDay[];
  series: SocialSeriesWithParts[];
  isAdminUser: boolean;
  initialClientId?: number;
}) {
  const now = new Date();
  const [clientId, setClientId] = useState<number | "">(
    initialClientId != null && clients.some((c) => c.id === initialClientId) ? initialClientId : "",
  );
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const [plan, setPlan] = useState<SocialContentPlan | null>(null);
  const [posts, setPosts] = useState<SocialContentPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [verifiedMonths, setVerifiedMonths] = useState<Set<string>>(new Set());

  const [openCategory, setOpenCategory] = useState<string | null>(null);
  const [editor, setEditor] = useState<EditorDraft | null>(null);
  const [dragging, setDragging] = useState<DragPayload | null>(null);
  const [clearOpen, setClearOpen] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const client = clients.find((c) => c.id === clientId) ?? null;
  const clientName = client ? (client.public_name?.trim() || client.account_name) : "";

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 10 } }),
  );

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2600);
  }, []);

  // ── Load ──
  const loadMonth = useCallback(async () => {
    if (clientId === "") {
      setPlan(null);
      setPosts([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/social/plans?clientId=${clientId}`);
      // The route returns a bare array of plans, each with its posts inlined.
      const plans = (await res.json()) as (SocialContentPlan & {
        posts: SocialContentPost[];
      })[];
      const match = (Array.isArray(plans) ? plans : []).find(
        (p) => p.plan_month === month && p.plan_year === year,
      );
      setPlan(match ?? null);
      setPosts(match?.posts ?? []);
    } catch {
      setPlan(null);
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, [clientId, month, year]);

  useEffect(() => {
    void loadMonth();
  }, [loadMonth]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/social/awareness-verifications");
        const json = (await res.json()) as { verifications?: { year: number; month: number }[] };
        if (!cancelled) {
          setVerifiedMonths(new Set((json.verifications ?? []).map((v) => `${v.year}-${v.month}`)));
        }
      } catch {
        // Treated as unverified — the rail shows the "verify dates" notice.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Derived ──
  const seasonalVerified = verifiedMonths.has(`${year}-${month}`);

  const seasonalItems = useMemo(() => {
    if (!seasonalVerified) return [];
    return awarenessDays
      .filter((d) => d.month === month)
      .map((d) => {
        const resolved = resolveAwarenessDate(d, year);
        return { day: resolved.start.getUTCDate(), item: d };
      })
      .sort((a, b) => a.day - b.day);
  }, [awarenessDays, month, year, seasonalVerified]);

  const usedIdeaIds = useMemo(
    () => new Set(posts.map((p) => p.idea_id).filter((v): v is number => v != null)),
    [posts],
  );
  const usedSeasonalIds = useMemo(
    () => new Set(posts.map((p) => p.awareness_day_id).filter((v): v is number => v != null)),
    [posts],
  );

  /** Uncategorized first — a visible to-do rather than a hidden junk drawer. */
  const categorySections = useMemo(() => {
    const buckets = new Map<string, SocialIdea[]>();
    for (const idea of bankIdeas) {
      const key = idea.category?.trim() || UNCATEGORIZED;
      const list = buckets.get(key);
      if (list) list.push(idea);
      else buckets.set(key, [idea]);
    }
    const ordered: { name: string; ideas: SocialIdea[] }[] = [];
    const uncategorized = buckets.get(UNCATEGORIZED);
    if (uncategorized?.length) ordered.push({ name: UNCATEGORIZED, ideas: uncategorized });
    for (const name of IDEA_CATEGORIES) {
      const list = buckets.get(name);
      if (list?.length) ordered.push({ name, ideas: list });
    }
    return ordered;
  }, [bankIdeas]);

  const postsByDay = useMemo(() => {
    const map = new Map<number, SocialContentPost[]>();
    for (const p of posts) {
      const d = dayOf(p.post_date);
      const list = map.get(d);
      if (list) list.push(p);
      else map.set(d, [p]);
    }
    return map;
  }, [posts]);

  const sortedPosts = useMemo(
    () => [...posts].sort((a, b) => a.post_date.localeCompare(b.post_date) || a.sort_order - b.sort_order),
    [posts],
  );

  const dayCount = daysInMonth(year, month);
  const leadingBlanks = firstWeekdayOfMonth(year, month);
  const meterPct = Math.min(100, (posts.length / DEFAULT_TARGET) * 100);

  // ── Mutations ──

  async function persistPost(postId: number, updates: Record<string, unknown>) {
    if (!plan) return;
    const res = await fetch(`/api/social/plans/${plan.id}/posts`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postId, updates }),
    });
    if (!res.ok) {
      const json = (await res.json()) as { error?: string };
      throw new Error(json.error ?? "Save failed");
    }
    const updated = (await res.json()) as SocialContentPost;
    setPosts((prev) => prev.map((p) => (p.id === postId ? updated : p)));
  }

  async function createPost(draft: EditorDraft) {
    if (clientId === "") return;
    const res = await fetch("/api/social/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId,
        month,
        year,
        postDate: isoDate(year, month, draft.day),
        kind: draft.provenance === "custom" ? "custom" : draft.provenance,
        title: draft.headline,
        campaignType: draft.provenance === "seasonal" ? "awareness_day" : "custom",
        sourceId: draft.ideaId ?? draft.awarenessDayId ?? null,
        seriesId: draft.seriesId ?? null,
      }),
    });
    if (!res.ok) {
      const json = (await res.json()) as { error?: string };
      throw new Error(json.error ?? "Could not create the post");
    }
    const created = (await res.json()) as { post?: SocialContentPost; plan?: SocialContentPlan };
    if (created.plan) setPlan(created.plan);

    // The create route sets placement and provenance; the sheet fields are
    // written straight after so one save does the whole job.
    if (created.post) {
      const planId = created.plan?.id ?? plan?.id;
      if (planId) {
        const put = await fetch(`/api/social/plans/${planId}/posts`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            postId: created.post.id,
            updates: {
              content_pillar: draft.contentPillar || null,
              headline: draft.headline,
              subheadline: draft.subheadline,
              photo_suggestion: draft.photoSuggestion,
            },
          }),
        });
        if (put.ok) {
          const full = (await put.json()) as SocialContentPost;
          setPosts((prev) => [...prev, full]);
          return;
        }
      }
      setPosts((prev) => [...prev, created.post!]);
    }
  }

  async function handleEditorSave(draft: EditorDraft) {
    if (draft.postId != null) {
      await persistPost(draft.postId, {
        post_date: isoDate(year, month, draft.day),
        content_pillar: draft.contentPillar || null,
        headline: draft.headline,
        subheadline: draft.subheadline,
        photo_suggestion: draft.photoSuggestion,
      });
    } else {
      await createPost(draft);
    }
    setEditor(null);
  }

  async function handleDelete(postId: number) {
    const res = await fetch("/api/social/posts", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postId }),
    });
    if (!res.ok) {
      const json = (await res.json()) as { error?: string };
      throw new Error(json.error ?? "Delete failed");
    }
    setPosts((prev) => prev.filter((p) => p.id !== postId));
    setEditor(null);
  }

  async function handleDuplicate(draft: EditorDraft) {
    // The copy is custom-provenance so it doesn't consume the source idea.
    await createPost({
      ...draft,
      postId: undefined,
      day: Math.min(draft.day + 1, dayCount),
      provenance: "custom",
      ideaId: null,
      awarenessDayId: null,
      seriesId: null,
    });
    setEditor(null);
    showToast("Duplicated to the next day");
  }

  async function handleClearMonth() {
    setClearing(true);
    try {
      for (const p of posts) {
        await fetch("/api/social/posts", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ postId: p.id }),
        });
      }
      setPosts([]);
      setClearOpen(false);
      showToast(`Cleared ${MONTH_NAMES[month]} ${year}`);
    } finally {
      setClearing(false);
    }
  }

  async function handleDraftWithAi() {
    if (!plan) return;
    setDrafting(true);
    try {
      const res = await fetch("/api/social/plans/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: plan.id }),
      });
      const json = (await res.json()) as { updated?: number; skipped?: number; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Drafting failed");
      await loadMonth();
      showToast(`Drafted ${json.updated ?? 0} post${json.updated === 1 ? "" : "s"}`);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Drafting failed");
    } finally {
      setDrafting(false);
    }
  }

  // ── Drag ──
  function onDragStart(e: DragStartEvent) {
    setDragging((e.active.data.current as DragPayload) ?? null);
  }

  async function onDragEnd(e: DragEndEvent) {
    setDragging(null);
    const payload = e.active.data.current as DragPayload | undefined;
    const day = (e.over?.data.current as { day?: number } | undefined)?.day;
    if (!payload || day == null) return;

    if (payload.kind === "post") {
      const post = posts.find((p) => p.id === payload.id);
      if (!post || dayOf(post.post_date) === day) return;
      try {
        await persistPost(post.id, { post_date: isoDate(year, month, day) });
        showToast(`Moved to ${selectDateLabel(year, month, day)}`);
      } catch (err) {
        showToast(err instanceof Error ? err.message : "Move failed");
      }
      return;
    }

    setEditor(draftForSource(payload, day));
  }

  /** Editor pre-filled from whatever was dragged or clicked. */
  function draftForSource(payload: DragPayload, day: number): EditorDraft {
    const base = {
      day,
      headline: "",
      subheadline: "",
      photoSuggestion: "",
      contentPillar: "",
    };
    if (payload.kind === "idea") {
      const idea = bankIdeas.find((i) => i.id === payload.id);
      return {
        ...base,
        provenance: "idea" as EditorProvenance,
        ideaId: payload.id,
        headline: idea?.title ?? "",
        subheadline: idea?.default_subheadline ?? "",
        photoSuggestion: idea?.default_photo_suggestion ?? "",
        contentPillar: idea?.default_pillar ?? "",
      };
    }
    if (payload.kind === "seasonal") {
      const entry = awarenessDays.find((a) => a.id === payload.id);
      return {
        ...base,
        provenance: "seasonal" as EditorProvenance,
        awarenessDayId: payload.id,
        headline: entry?.name ?? "",
        subheadline: entry?.content_angle ?? "",
      };
    }
    if (payload.kind === "series") {
      const s = series.find((x) => x.id === payload.id);
      return {
        ...base,
        provenance: "series" as EditorProvenance,
        seriesId: payload.id,
        headline: s?.title ?? "",
      };
    }
    return { ...base, provenance: "custom" as EditorProvenance };
  }

  function openPost(post: SocialContentPost) {
    setEditor({
      postId: post.id,
      day: dayOf(post.post_date),
      contentPillar: post.content_pillar ?? "",
      headline: post.headline ?? "",
      subheadline: post.subheadline ?? "",
      photoSuggestion: post.photo_suggestion ?? "",
      provenance: post.idea_id
        ? "idea"
        : post.awareness_day_id
          ? "seasonal"
          : post.series_id
            ? "series"
            : "custom",
      ideaId: post.idea_id,
      awarenessDayId: post.awareness_day_id,
      seriesId: post.series_id,
    });
  }

  function shiftMonth(delta: number) {
    let m = month + delta;
    let y = year;
    if (m < 1) {
      m = 12;
      y -= 1;
    } else if (m > 12) {
      m = 1;
      y += 1;
    }
    setMonth(m);
    setYear(y);
    setClearOpen(false);
  }

  function downloadCsv() {
    const csv = buildPlanCsv(posts);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = exportFileName(clientName || "client", month, year, "csv");
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  // ── Render ──
  return (
    <div style={{ background: T.bg, fontFamily: FONT, color: T.ink }} className="min-h-screen flex-1">
      <div className="mx-auto max-w-[1230px] px-[34px] pb-12 pt-[30px]">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h1 style={{ letterSpacing: "-0.01em" }} className="text-[26px] font-semibold">
              Social planner
            </h1>
            <div
              style={{ background: T.card, borderColor: T.border }}
              className="flex items-center gap-1 rounded-full border p-1"
            >
              <button
                type="button"
                onClick={() => shiftMonth(-1)}
                aria-label="Previous month"
                style={{ color: T.secondary }}
                className="flex h-[26px] w-[26px] items-center justify-center rounded-full transition-colors hover:!bg-[#F6F5F0]"
              >
                <ChevronLeft size={15} />
              </button>
              <span className="min-w-[118px] text-center text-[13.5px] font-bold">
                {MONTH_NAMES[month]} {year}
              </span>
              <button
                type="button"
                onClick={() => shiftMonth(1)}
                aria-label="Next month"
                style={{ color: T.secondary }}
                className="flex h-[26px] w-[26px] items-center justify-center rounded-full transition-colors hover:!bg-[#F6F5F0]"
              >
                <ChevronRight size={15} />
              </button>
            </div>

            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value === "" ? "" : Number(e.target.value))}
              style={{ background: T.card, borderColor: T.border, color: T.ink }}
              className="rounded-full border px-3.5 py-[7px] text-[12.5px] font-semibold outline-none"
            >
              <option value="">Choose a client…</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.public_name?.trim() || c.account_name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div
              style={{ background: T.card, borderColor: T.border }}
              className="flex items-center gap-2 rounded-full border px-3 py-[7px]"
            >
              <span style={{ color: T.secondary }} className="text-[11.5px] font-bold">
                {posts.length} of {DEFAULT_TARGET} posts
              </span>
              <span style={{ background: T.track }} className="h-[5px] w-[70px] overflow-hidden rounded-full">
                <span
                  style={{
                    width: `${meterPct}%`,
                    background: posts.length >= DEFAULT_TARGET ? T.green : T.primary,
                  }}
                  className="block h-full rounded-full transition-all"
                />
              </span>
            </div>

            {plan && posts.length > 0 && (
              <button
                type="button"
                onClick={() => void handleDraftWithAi()}
                disabled={drafting}
                style={{ background: T.card, borderColor: T.border, color: T.secondary }}
                className="inline-flex items-center gap-1.5 rounded-full border px-3.5 py-[7px] text-[12.5px] font-semibold transition-colors hover:!border-[#C9C4B5] hover:!text-[#191813] disabled:opacity-50"
              >
                {drafting ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                Draft with AI
              </button>
            )}

            <div className="relative">
              <button
                type="button"
                onClick={() =>
                  posts.length === 0
                    ? showToast("Nothing to clear this month")
                    : setClearOpen((v) => !v)
                }
                style={{ background: T.card, borderColor: T.border, color: T.rust }}
                className="inline-flex items-center gap-1.5 rounded-full border px-3.5 py-[7px] text-[12.5px] font-semibold transition-colors hover:!border-[#D9A79E]"
              >
                <Trash2 size={13} /> Clear calendar
              </button>

              {clearOpen && (
                <div
                  style={{ background: T.card, borderColor: T.border }}
                  className="absolute right-0 top-[calc(100%+6px)] z-30 w-[240px] rounded-xl border p-3.5 shadow-lg"
                >
                  <p className="text-[13px] font-bold">
                    Clear {MONTH_NAMES[month]} {year}?
                  </p>
                  <p style={{ color: T.secondary }} className="mt-1 text-[11.5px]">
                    Removes all {posts.length} planned post{posts.length === 1 ? "" : "s"}. Ideas
                    become available again.
                  </p>
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => setClearOpen(false)}
                      style={{ borderColor: T.border, color: T.secondary }}
                      className="flex-1 rounded-lg border py-1.5 text-[12px] font-semibold"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleClearMonth()}
                      disabled={clearing}
                      style={{ background: T.rust, color: "#fff" }}
                      className="flex-1 rounded-lg py-1.5 text-[12px] font-semibold transition-colors hover:!bg-[#8A3227] disabled:opacity-60"
                    >
                      {clearing ? "Clearing…" : "Clear all"}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() =>
                clientId === ""
                  ? showToast("Choose a client first")
                  : setEditor({
                      day: 1,
                      contentPillar: "",
                      headline: "",
                      subheadline: "",
                      photoSuggestion: "",
                      provenance: "custom",
                    })
              }
              style={{ background: T.primary, color: "#fff" }}
              className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-[7px] text-[12.5px] font-semibold transition-colors hover:!bg-[#1F31C8]"
            >
              <Plus size={13} /> Custom post
            </button>
          </div>
        </div>

        {clientId === "" ? (
          <div
            style={{ background: T.card, borderColor: T.border, color: T.secondary }}
            className="mt-6 rounded-2xl border p-10 text-center text-[13px]"
          >
            Choose a client to start planning their month.
          </div>
        ) : (
          <DndContext
            id="social-planner-dnd"
            sensors={sensors}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
          >
            <div className="mt-4 flex flex-wrap items-start gap-4">
              {/* ── Left rail ── */}
              <div style={{ width: 288 }} className="flex shrink-0 flex-col gap-3">
                {/* Seasonal */}
                <RailCard>
                  <div className="flex items-center justify-between gap-2">
                    <RailLabel>
                      Seasonal · {MONTH_NAMES[month].slice(0, 3).toUpperCase()} {year}
                    </RailLabel>
                    <span
                      style={{
                        background: seasonalVerified ? T.greenTint : T.amberTint,
                        color: seasonalVerified ? T.green : T.amber,
                      }}
                      className="shrink-0 rounded-full px-2 py-[2px] text-[10px] font-bold"
                    >
                      {seasonalVerified ? `Verified ${year}` : "Resets yearly"}
                    </span>
                  </div>

                  {seasonalVerified ? (
                    <div className="mt-2.5 flex flex-col gap-1.5">
                      {seasonalItems.length === 0 && (
                        <p style={{ color: T.faint }} className="text-[11.5px]">
                          Nothing seasonal listed for this month.
                        </p>
                      )}
                      {seasonalItems.map(({ day, item }) => (
                        <SourceCard
                          key={item.id}
                          dragId={`seasonal-${item.id}`}
                          payload={{ kind: "seasonal", id: item.id }}
                          used={usedSeasonalIds.has(item.id)}
                          onClick={() =>
                            usedSeasonalIds.has(item.id)
                              ? showToast("Already placed this month")
                              : setEditor(draftForSource({ kind: "seasonal", id: item.id }, day))
                          }
                        >
                          <div className="flex items-center gap-1.5">
                            <span
                              style={{ background: T.amberTint, color: T.amber }}
                              className="rounded px-1.5 py-[1px] text-[10px] font-bold"
                            >
                              {MONTH_NAMES[month].slice(0, 3)} {day}
                            </span>
                            <span style={{ color: T.faint }} className="text-[10px] font-bold uppercase">
                              {item.rule_type === "fixed" ? "Awareness day" : "Seasonal"}
                            </span>
                          </div>
                          <p style={{ color: T.ink }} className="mt-1 text-[12.5px] font-semibold">
                            {item.name}
                          </p>
                        </SourceCard>
                      ))}
                    </div>
                  ) : (
                    <div
                      style={{
                        background: T.amberNoticeBg,
                        borderColor: T.amberNoticeBorder,
                      }}
                      className="mt-2.5 rounded-xl border p-3"
                    >
                      <p style={{ color: T.amberNoticeText }} className="text-[12px] font-bold">
                        Not verified for {MONTH_NAMES[month]} {year}
                      </p>
                      <p style={{ color: T.amberNoticeText }} className="mt-1 text-[11.5px]">
                        Seasonal lists reset each year. Verify this month&apos;s dates to load them.
                      </p>
                      <a
                        href="/social-planner/awareness"
                        style={{ background: T.amber, color: "#fff" }}
                        className="mt-2.5 inline-block rounded-lg px-3 py-1.5 text-[11.5px] font-bold"
                      >
                        Verify dates
                      </a>
                    </div>
                  )}
                </RailCard>

                {/* Idea repository */}
                <div
                  style={{ background: T.card, borderColor: T.border }}
                  className="rounded-2xl border p-2"
                >
                  <div className="px-1.5 pb-1 pt-1.5">
                    <RailLabel>Idea repository</RailLabel>
                  </div>
                  {categorySections.map(({ name, ideas }) => {
                    const open = openCategory === name;
                    return (
                      <div key={name}>
                        <button
                          type="button"
                          onClick={() => setOpenCategory(open ? null : name)}
                          style={{ background: open ? T.hover : undefined }}
                          className="flex w-full items-center gap-2 rounded-[10px] px-2 py-[9px] text-left transition-colors hover:!bg-[#F6F5F0]"
                        >
                          <Dot color={categoryColor(name)} />
                          <span style={{ color: T.ink }} className="flex-1 text-[13px] font-semibold">
                            {name}
                          </span>
                          <span style={{ color: T.faint }} className="text-[11px]">
                            {ideas.length}
                          </span>
                          <ChevronDown
                            size={14}
                            style={{
                              color: T.faint,
                              transform: open ? "rotate(180deg)" : undefined,
                              transition: "transform 0.15s",
                            }}
                          />
                        </button>
                        {open && (
                          <div className="flex flex-col gap-1.5 px-1.5 pb-2 pt-0.5">
                            {ideas.map((idea) => {
                              const used = usedIdeaIds.has(idea.id);
                              return (
                                <SourceCard
                                  key={idea.id}
                                  dragId={`idea-${idea.id}`}
                                  payload={{ kind: "idea", id: idea.id }}
                                  used={used}
                                  onClick={() =>
                                    used
                                      ? showToast("Already placed this month — clear it to reuse")
                                      : setEditor(draftForSource({ kind: "idea", id: idea.id }, 1))
                                  }
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <p style={{ color: T.ink }} className="text-[12.5px] font-semibold">
                                      {idea.title}
                                    </p>
                                    {used && (
                                      <span
                                        style={{ color: T.green }}
                                        className="shrink-0 text-[10px] font-bold"
                                      >
                                        Placed ✓
                                      </span>
                                    )}
                                  </div>
                                  <div className="mt-1 flex items-center gap-1.5">
                                    <Dot color={pillarColor(idea.default_pillar)} size={6} />
                                    <span style={{ color: T.muted }} className="text-[10.5px] font-semibold">
                                      {idea.default_pillar ?? "No pillar set"}
                                    </span>
                                  </div>
                                </SourceCard>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Series — kept from the previous planner; not in the handoff's
                    rail, but it follows the same logic: recurring content. */}
                {series.length > 0 && (
                  <RailCard>
                    <RailLabel>Series</RailLabel>
                    <div className="mt-2.5 flex flex-col gap-1.5">
                      {series.map((s) => (
                        <SourceCard
                          key={s.id}
                          dragId={`series-${s.id}`}
                          payload={{ kind: "series", id: s.id }}
                          used={false}
                          onClick={() => setEditor(draftForSource({ kind: "series", id: s.id }, 1))}
                        >
                          <p style={{ color: T.ink }} className="text-[12.5px] font-semibold">
                            {s.title}
                          </p>
                          <p style={{ color: T.muted }} className="mt-0.5 text-[10.5px] font-semibold">
                            {s.cadence ?? "Recurring"}
                          </p>
                        </SourceCard>
                      ))}
                    </div>
                  </RailCard>
                )}

                <p style={{ color: T.faint }} className="px-1 text-[11px]">
                  Drag an idea onto a day — or click it to pick a date in the editor.
                </p>
              </div>

              {/* ── Right column ── */}
              <div className="min-w-[420px] flex-1">
                <div className="grid grid-cols-7 gap-1.5">
                  {WEEKDAY_HEADERS.map((w) => (
                    <p
                      key={w}
                      style={{ color: T.faint, letterSpacing: "0.06em" }}
                      className="pb-1 text-center text-[10.5px] font-bold uppercase"
                    >
                      {w}
                    </p>
                  ))}
                  {Array.from({ length: leadingBlanks }, (_, i) => (
                    <div key={`blank-${i}`} />
                  ))}
                  {Array.from({ length: dayCount }, (_, i) => i + 1).map((day) => (
                    <DayCell
                      key={day}
                      day={day}
                      year={year}
                      month={month}
                      posts={postsByDay.get(day) ?? []}
                      onPostClick={openPost}
                    />
                  ))}
                </div>

                {/* Export sheet */}
                <div
                  style={{ background: T.card, borderColor: T.border }}
                  className="mt-4 overflow-hidden rounded-2xl border"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                    <div>
                      <p className="text-[14px] font-bold">Export sheet</p>
                      <p style={{ color: T.muted }} className="text-[12px]">
                        Mirrors the SMM team handoff · {posts.length} row
                        {posts.length === 1 ? "" : "s"}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={downloadCsv}
                      disabled={posts.length === 0}
                      style={{ background: T.ink, color: "#fff" }}
                      className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[12.5px] font-semibold transition-colors hover:!bg-[#33312A] disabled:opacity-40"
                    >
                      <Download size={13} /> Download CSV
                    </button>
                  </div>

                  {posts.length === 0 ? (
                    <p style={{ color: T.muted }} className="px-4 pb-5 text-[12.5px]">
                      No posts yet — drag ideas into the calendar and they&apos;ll appear here.
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <div style={{ minWidth: 760 }}>
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: SHEET_COLUMNS,
                            gap: 10,
                            color: T.faint,
                            letterSpacing: "0.06em",
                          }}
                          className="px-4 py-2 text-[10px] font-bold uppercase"
                        >
                          <span>Date</span>
                          <span>Content pillar</span>
                          <span>Headline</span>
                          <span>Subheadline</span>
                          <span>Photo suggestion</span>
                          <span />
                        </div>
                        {sortedPosts.map((p) => (
                          <div
                            key={p.id}
                            style={{
                              display: "grid",
                              gridTemplateColumns: SHEET_COLUMNS,
                              gap: 10,
                              borderTop: `1px solid ${T.hairline}`,
                              alignItems: "center",
                            }}
                            className="px-4 py-2"
                          >
                            <select
                              value={dayOf(p.post_date)}
                              onChange={(e) =>
                                void persistPost(p.id, {
                                  post_date: isoDate(year, month, Number(e.target.value)),
                                }).catch((err) => showToast(err.message))
                              }
                              style={{ color: T.secondary }}
                              className="w-full rounded-md border border-transparent bg-transparent px-1 py-1 text-[12px] outline-none focus:!border-[#2B3FE4] focus:bg-white"
                            >
                              {Array.from({ length: dayCount }, (_, i) => i + 1).map((d) => (
                                <option key={d} value={d}>
                                  {selectDateLabel(year, month, d)}
                                </option>
                              ))}
                            </select>
                            <select
                              value={p.content_pillar ?? ""}
                              onChange={(e) =>
                                void persistPost(p.id, {
                                  content_pillar: e.target.value || null,
                                }).catch((err) => showToast(err.message))
                              }
                              style={{ color: T.secondary }}
                              className="w-full rounded-md border border-transparent bg-transparent px-1 py-1 text-[12px] outline-none focus:!border-[#2B3FE4] focus:bg-white"
                            >
                              <option value="">— none —</option>
                              {CONTENT_PILLARS.map((pillar) => (
                                <option key={pillar} value={pillar}>
                                  {pillar}
                                </option>
                              ))}
                            </select>
                            <SheetCellInput
                              bold
                              value={p.headline ?? ""}
                              onCommit={(v) =>
                                void persistPost(p.id, { headline: v }).catch((err) =>
                                  showToast(err.message),
                                )
                              }
                            />
                            <SheetCellInput
                              value={p.subheadline ?? ""}
                              onCommit={(v) =>
                                void persistPost(p.id, { subheadline: v }).catch((err) =>
                                  showToast(err.message),
                                )
                              }
                            />
                            <SheetCellInput
                              value={p.photo_suggestion ?? ""}
                              onCommit={(v) =>
                                void persistPost(p.id, { photo_suggestion: v }).catch((err) =>
                                  showToast(err.message),
                                )
                              }
                            />
                            <button
                              type="button"
                              aria-label="Remove row"
                              onClick={() =>
                                void handleDelete(p.id).catch((err) => showToast(err.message))
                              }
                              style={{ color: T.faint }}
                              className="flex h-[22px] w-[22px] items-center justify-center rounded-md transition-colors hover:!bg-[#FBF1EF] hover:!text-[#A03A2E]"
                            >
                              <X size={13} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {loading && (
                  <p style={{ color: T.faint }} className="mt-3 text-[12px]">
                    Loading…
                  </p>
                )}
              </div>
            </div>

            <DragOverlay dropAnimation={null}>
              {dragging && (
                <div
                  style={{ background: T.card, borderColor: T.primary }}
                  className="rounded-[10px] border px-2.5 py-[9px] text-[12.5px] font-semibold shadow-lg"
                >
                  Drop on a day
                </div>
              )}
            </DragOverlay>
          </DndContext>
        )}
      </div>

      {editor && (
        <PostEditorModal
          draft={editor}
          month={month}
          year={year}
          onSave={handleEditorSave}
          onDelete={editor.postId != null ? handleDelete : undefined}
          onDuplicate={editor.postId != null ? handleDuplicate : undefined}
          onClose={() => setEditor(null)}
        />
      )}

      {toast && (
        <div
          style={{ background: T.ink, color: "#fff" }}
          className="fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-full px-4 py-2 text-[12.5px] font-semibold shadow-lg"
        >
          {toast}
        </div>
      )}
    </div>
  );
}
