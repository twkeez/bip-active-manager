"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardCode,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  closestCorners,
  getFirstCollision,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  type KeyboardCoordinateGetter,
} from "@dnd-kit/core";
import { CalendarDays, Download, GripVertical, Link2, Lock, PanelLeftOpen, Plus, Sparkles, X } from "lucide-react";
import { getCampaignType } from "@/lib/social/campaign-types";
import { resolveAwarenessDate, toDateString } from "@/lib/social/awareness-resolver";
import { expandSeries, type SeriesExpansion } from "@/lib/social/series-expansion";
import { buildPhotoBriefText, buildPlanCsv, buildPlanText, exportFileName } from "@/lib/social/plan-export";
import { getClientDisplayName } from "@/lib/clients/display-name";
import { purposeStyle } from "@/lib/social/purpose-style";
import type { FreshIdea } from "@/lib/social/idea-brainstorm";
import type {
  SocialAwarenessDay,
  SocialContentPlan,
  SocialContentPost,
  SocialIdea,
  SocialPlanWithPosts,
  SocialPurpose,
  SocialSeriesWithParts,
} from "@/lib/social/types";
import { SOCIAL_PURPOSES } from "@/lib/social/types";
import { PostDetailPanel } from "./post-detail-panel";

const MONTH_NAMES = [
  "", "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const WEEKDAY_HEADS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export type CalendarClient = { id: number; account_name: string; public_name: string | null };

type RailTab = "ideas" | "fresh" | "days" | "series";
type BoardFreshIdea = FreshIdea & { saved?: boolean; custom?: boolean };

/** What a dragged source card carries into a day cell. */
type SourcePayload = {
  type: "source";
  kind: "idea" | "fresh" | "awareness" | "series";
  sourceId: number | null;
  title: string;
  description: string;
  campaignType: string;
};

/** What a dragged, already-placed chip carries. */
type PostPayload = { type: "post"; postId: number; postDate: string };

// ─── Calendar helpers ─────────────────────────────────────────────────────────

type GridCell = { key: string; dateStr: string; day: number; inMonth: boolean };

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

// dnd-kit's default keyboard step is a fixed 25px, so on a grid of 120px-tall
// cells ArrowDown never reaches the next week — keyboard users could only place
// into the first row. This jumps to the nearest droppable in the pressed
// direction instead.
const ARROW_KEYS = [KeyboardCode.Down, KeyboardCode.Right, KeyboardCode.Up, KeyboardCode.Left];

const gridCoordinateGetter: KeyboardCoordinateGetter = (
  event,
  { context: { active, droppableRects, droppableContainers, collisionRect } },
) => {
  if (!ARROW_KEYS.includes(event.code as KeyboardCode)) return;
  event.preventDefault();
  if (!active || !collisionRect) return;

  const candidates = droppableContainers.getEnabled().filter((entry) => {
    if (!entry || entry.disabled) return false;
    const rect = droppableRects.get(entry.id);
    if (!rect) return false;
    switch (event.code) {
      case KeyboardCode.Down: return collisionRect.top < rect.top;
      case KeyboardCode.Up: return collisionRect.top > rect.top;
      case KeyboardCode.Left: return collisionRect.left >= rect.left + rect.width;
      case KeyboardCode.Right: return collisionRect.left + collisionRect.width <= rect.left;
      default: return false;
    }
  });

  const collisions = closestCorners({
    active,
    collisionRect,
    droppableRects,
    droppableContainers: candidates,
    pointerCoordinates: null,
  });
  const closestId = getFirstCollision(collisions, "id");
  if (closestId == null) return;

  const rect = droppableRects.get(closestId);
  if (!rect) return;
  return {
    x: rect.left + (rect.width - collisionRect.width) / 2,
    y: rect.top + (rect.height - collisionRect.height) / 2,
  };
};

function todayString(): string {
  const now = new Date();
  return toDateString(new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())));
}

function formatRange(start: Date, end: Date | null): string {
  const m = MONTH_NAMES[start.getUTCMonth() + 1].slice(0, 3);
  if (!end) return `${m} ${start.getUTCDate()}`;
  const em = MONTH_NAMES[end.getUTCMonth() + 1].slice(0, 3);
  return m === em
    ? `${m} ${start.getUTCDate()}-${end.getUTCDate()}`
    : `${m} ${start.getUTCDate()} – ${em} ${end.getUTCDate()}`;
}

function friendlyDate(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  return `${WEEKDAY_HEADS[d.getUTCDay()]}, ${MONTH_NAMES[d.getUTCMonth() + 1].slice(0, 3)} ${d.getUTCDate()}`;
}

// ─── Draggable source card ────────────────────────────────────────────────────

function DraggableCard({
  id,
  payload,
  title,
  description,
  pills,
  meta,
  action,
}: {
  id: string;
  payload: SourcePayload;
  title: string;
  description?: string;
  pills?: React.ReactNode;
  meta?: React.ReactNode;
  action?: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id, data: payload });
  return (
    <div
      ref={setNodeRef}
      className={`rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm transition hover:shadow-md ${
        isDragging ? "opacity-40" : ""
      }`}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label={`Drag ${title} onto a day`}
          className="mt-0.5 shrink-0 cursor-grab rounded text-slate-300 transition hover:text-slate-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 active:cursor-grabbing"
        >
          <GripVertical size={14} />
        </button>
        <div className="min-w-0 flex-1">
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
      </div>
    </div>
  );
}

// ─── Placed post chip ─────────────────────────────────────────────────────────

function PostChip({
  post,
  dotClass,
  onSelect,
  selected,
  partsTotal,
}: {
  post: SocialContentPost;
  dotClass: string;
  onSelect: () => void;
  selected: boolean;
  /** Total parts in this post's arc, for the "2/5" badge. */
  partsTotal?: number;
}) {
  const needsCaption = !post.caption_draft?.trim();
  // Locked posts are not draggable at all — they can't be moved or deleted.
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `post:${post.id}`,
    data: { type: "post", postId: post.id, postDate: post.post_date } satisfies PostPayload,
    disabled: post.locked,
  });

  return (
    <div
      ref={setNodeRef}
      {...(post.locked ? {} : attributes)}
      {...(post.locked ? {} : listeners)}
      onClick={onSelect}
      title={`${post.campaign_label}${needsCaption ? " — needs caption" : ""}${post.locked ? " (locked)" : ""}`}
      className={`mb-1 flex items-center gap-1.5 rounded-md border bg-white px-1.5 py-1 shadow-sm transition ${
        selected ? "border-indigo-400 ring-1 ring-indigo-300" : "border-slate-200/80"
      } ${post.locked ? "cursor-default" : "cursor-grab active:cursor-grabbing"} ${
        isDragging ? "opacity-40" : ""
      } focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400`}
    >
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dotClass}`} />
      {post.series_id != null && (
        <Link2 size={9} className="shrink-0 text-violet-500" aria-label="Part of a series" />
      )}
      <span className="min-w-0 flex-1 truncate text-[0.7rem] font-medium text-slate-700">
        {post.campaign_label}
      </span>
      {post.series_part != null && (
        <span className="shrink-0 rounded bg-violet-50 px-1 text-[0.6rem] font-semibold tabular-nums text-violet-700">
          {post.series_part}
          {partsTotal ? `/${partsTotal}` : ""}
        </span>
      )}
      {needsCaption && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" title="Needs caption" />}
      {post.locked && <Lock size={9} className="shrink-0 text-slate-400" />}
    </div>
  );
}

// ─── Droppable day cell ───────────────────────────────────────────────────────

function DayCell({
  cell,
  isToday,
  marks,
  onQuickAdd,
  children,
}: {
  cell: GridCell;
  isToday: boolean;
  marks: string[];
  /** Create an ad-hoc post on this day from a typed title. */
  onQuickAdd?: (title: string) => void;
  children: React.ReactNode;
}) {
  // Adjacent-month cells are never drop targets.
  const { setNodeRef, isOver } = useDroppable({ id: `cell:${cell.dateStr}`, disabled: !cell.inMonth });
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");

  function commit() {
    const t = title.trim();
    if (t && onQuickAdd) onQuickAdd(t);
    setTitle("");
    setAdding(false);
  }

  return (
    <div
      ref={cell.inMonth ? setNodeRef : undefined}
      className={`group min-h-[120px] rounded-xl border p-2 transition-colors ${
        cell.inMonth
          ? isOver
            ? "border-indigo-300 bg-indigo-50/50"
            : "border-slate-200/80 bg-white"
          : "border-slate-200/80 bg-slate-50/50"
      }`}
    >
      <div className="mb-1 flex items-center gap-1.5">
        <span className={`text-sm ${cell.inMonth ? "text-slate-500" : "text-slate-300"}`}>{cell.day}</span>
        {isToday && <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />}
        {cell.inMonth && onQuickAdd && !adding && (
          <button
            onClick={() => setAdding(true)}
            aria-label={`Add a post on day ${cell.day}`}
            title="Add your own post"
            className="ml-auto rounded p-0.5 text-slate-300 opacity-0 transition group-hover:opacity-100 hover:text-slate-900 focus:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
          >
            <Plus size={12} />
          </button>
        )}
      </div>
      {marks.map((name) => (
        <div
          key={name}
          title={name}
          className="mb-1 truncate rounded-md bg-sky-50 px-1.5 py-0.5 text-[0.65rem] font-medium text-sky-700"
        >
          {name}
        </div>
      ))}
      {children}
      {adding && (
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") { setTitle(""); setAdding(false); }
          }}
          onBlur={commit}
          placeholder="Post title…"
          className="mt-1 w-full rounded-md border border-indigo-300 bg-white px-1.5 py-1 text-[0.7rem] outline-none"
        />
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

  const [railTab, setRailTab] = useState<RailTab>("ideas");
  const [railOpen, setRailOpen] = useState(false);
  const [purposeFilter, setPurposeFilter] = useState<SocialPurpose[]>([]);

  const [fresh, setFresh] = useState<BoardFreshIdea[]>([]);
  const [brainstorming, setBrainstorming] = useState(false);
  const [gettingMore, setGettingMore] = useState(false);
  const [customIdea, setCustomIdea] = useState("");

  const [plan, setPlan] = useState<SocialPlanWithPosts | null>(null);
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [activeDrag, setActiveDrag] = useState<SourcePayload | PostPayload | null>(null);
  const [selectedPostId, setSelectedPostId] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<SocialContentPost | null>(null);
  // The detail panel shares the rail's column, so unsaved edits are guarded
  // before anything swaps it away.
  const [panelDirty, setPanelDirty] = useState(false);
  const [pendingNav, setPendingNav] = useState<(() => void) | null>(null);

  // Caption generation
  const [writing, setWriting] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [writeResult, setWriteResult] = useState<{ updated: number; skipped: number } | null>(null);

  // Series expansion awaiting confirmation — nothing is written until confirmed.
  const [pendingSeries, setPendingSeries] = useState<
    { series: SocialSeriesWithParts; dropDate: string; expansion: SeriesExpansion } | null
  >(null);
  const [placingSeries, setPlacingSeries] = useState(false);

  // Client-facing display name
  const [publicNames, setPublicNames] = useState<Record<number, string | null>>({});
  const [publicNameDraft, setPublicNameDraft] = useState("");
  const [savingPublicName, setSavingPublicName] = useState(false);

  // Temp ids for optimistic inserts, replaced by the server row on success.
  const tempId = useRef(-1);

  const client = clients.find((c) => c.id === clientId) ?? null;
  // Server value, overridden locally once saved in this session.
  const publicName = client ? publicNames[client.id] ?? client.public_name : null;
  const needsPublicName = Boolean(client && !publicName?.trim());

  async function savePublicName() {
    if (!client || savingPublicName) return;
    const value = publicNameDraft.trim();
    if (!value) return;
    setSavingPublicName(true);
    setError(null);
    try {
      const res = await fetch(`/api/clients/${client.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ public_name: value }),
      });
      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        throw new Error(err.error ?? "Could not save the public name");
      }
      setPublicNames((prev) => ({ ...prev, [client.id]: value }));
      setPublicNameDraft("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the public name");
    } finally {
      setSavingPublicName(false);
    }
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: gridCoordinateGetter }),
  );

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

  // Elapsed-seconds ticker while captions are being written.
  useEffect(() => {
    if (!writing) return;
    setElapsed(0);
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, [writing]);

  // ── Derived source lists ───────────────────────────────────────────────────

  const visibleIdeas = useMemo(
    () =>
      bankIdeas.filter(
        (i) => i.is_active && (i.client_id == null || (client != null && i.client_id === client.id)),
      ),
    [bankIdeas, client],
  );

  const filteredIdeas = useMemo(() => {
    if (purposeFilter.length === 0) return visibleIdeas;
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
        // A rule with no occurrence this year is skipped rather than breaking the rail.
      }
    }
    dated.sort((a, b) => a.start.getTime() - b.start.getTime());
    return { monthLongDays: monthLong, datedDays: dated };
  }, [awarenessDays, month, year]);

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

  const cells = useMemo(() => buildMonthGrid(year, month), [year, month]);
  const today = todayString();

  const postsByDate = useMemo(() => {
    const map = new Map<string, SocialContentPost[]>();
    for (const post of plan?.posts ?? []) {
      const list = map.get(post.post_date) ?? [];
      list.push(post);
      map.set(post.post_date, list);
    }
    for (const list of map.values()) list.sort((a, b) => a.sort_order - b.sort_order);
    return map;
  }, [plan]);

  const purposeByIdeaId = useMemo(() => {
    const map = new Map<number, SocialPurpose | null>();
    for (const idea of bankIdeas) map.set(idea.id, idea.purpose);
    return map;
  }, [bankIdeas]);

  const selectedPost = useMemo(
    () => (plan?.posts ?? []).find((p) => p.id === selectedPostId) ?? null,
    [plan, selectedPostId],
  );

  /** Run `action`, but ask first if the open panel has unsaved edits. */
  const guardNav = useCallback(
    (action: () => void) => {
      if (panelDirty) setPendingNav(() => action);
      else action();
    },
    [panelDirty],
  );

  const applyPostUpdate = useCallback((updated: SocialContentPost) => {
    setPlan((prev) =>
      prev ? { ...prev, posts: prev.posts.map((p) => (p.id === updated.id ? updated : p)) } : prev,
    );
  }, []);

  /** Ad-hoc post typed straight onto a day — no idea, series, or awareness row. */
  const quickAdd = useCallback(
    (dateStr: string, title: string) => {
      void placeSource(
        { type: "source", kind: "fresh", sourceId: null, title, description: "", campaignType: "series" },
        dateStr,
      );
    },
    // placeSource is declared below and closes over current state; it is stable
    // enough for this callback's purpose.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [client, month, year, plan],
  );

  const removePostLocally = useCallback((postId: number) => {
    setPlan((prev) => (prev ? { ...prev, posts: prev.posts.filter((p) => p.id !== postId) } : prev));
    setSelectedPostId(null);
    setPanelDirty(false);
  }, []);

  // Locked posts are never rewritten, so they don't count toward the button.
  const needsCaption = useMemo(
    () => (plan?.posts ?? []).filter((p) => !p.locked && !p.caption_draft?.trim()),
    [plan],
  );

  async function writeCaptionsForPlan(postIds?: number[]) {
    if (!plan || plan.id < 0 || writing) return;
    setWriting(true);
    setWriteResult(null);
    setError(null);
    try {
      const res = await fetch("/api/social/plans/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: plan.id, ...(postIds ? { postIds } : {}) }),
      });
      const data = (await res.json()) as { updated?: number; skipped?: number; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Caption generation failed");
      setWriteResult({ updated: data.updated ?? 0, skipped: data.skipped ?? 0 });
      // Pull the written copy back so the amber dots clear.
      await loadPlan();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Caption generation failed");
    } finally {
      setWriting(false);
    }
  }

  // ── Placement ──────────────────────────────────────────────────────────────

  async function placeSource(payload: SourcePayload, dateStr: string) {
    if (!client) return;
    const optimisticId = tempId.current--;
    const optimistic: SocialContentPost = {
      id: optimisticId,
      plan_id: plan?.id ?? -1,
      client_id: client.id,
      post_date: dateStr,
      platform: "both",
      campaign_type: payload.campaignType,
      campaign_label: payload.title,
      caption_draft: "",
      shot_list: "",
      hashtags: null,
      status: "idea",
      locked: false,
      sort_order: (plan?.posts.length ?? 0) + 1,
      idea_id: payload.kind === "idea" ? payload.sourceId : null,
      series_id: null,
      series_part: null,
      awareness_day_id: payload.kind === "awareness" ? payload.sourceId : null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Show it immediately.
    setPlan((prev) =>
      prev
        ? { ...prev, posts: [...prev.posts, optimistic] }
        : ({
            id: -1,
            client_id: client.id,
            plan_month: month,
            plan_year: year,
            status: "draft",
            campaign_types_used: [],
            awareness_days_used: [],
            notes: null,
            created_by: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            posts: [optimistic],
          } as SocialPlanWithPosts),
    );
    setError(null);

    try {
      const res = await fetch("/api/social/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: client.id,
          month,
          year,
          postDate: dateStr,
          kind: payload.kind,
          sourceId: payload.sourceId,
          title: payload.title,
          campaignType: payload.campaignType,
        }),
      });
      const data = (await res.json()) as {
        post?: SocialContentPost;
        plan?: SocialContentPlan;
        error?: string;
      };
      if (!res.ok || !data.post) throw new Error(data.error ?? "Could not place the post");
      // Swap the optimistic row for the real one.
      setPlan((prev) =>
        prev
          ? {
              ...prev,
              ...(data.plan ?? {}),
              posts: prev.posts.map((p) => (p.id === optimisticId ? data.post! : p)),
            }
          : prev,
      );
    } catch (e) {
      setPlan((prev) => (prev ? { ...prev, posts: prev.posts.filter((p) => p.id !== optimisticId) } : prev));
      setError(e instanceof Error ? e.message : "Could not place the post");
    }
  }

  async function movePost(postId: number, fromDate: string, toDate: string) {
    if (fromDate === toDate || !plan) return;
    setPlan((prev) =>
      prev ? { ...prev, posts: prev.posts.map((p) => (p.id === postId ? { ...p, post_date: toDate } : p)) } : prev,
    );
    setError(null);
    try {
      const res = await fetch(`/api/social/plans/${plan.id}/posts`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId, updates: { post_date: toDate } }),
      });
      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        throw new Error(err.error ?? "Could not move the post");
      }
    } catch (e) {
      setPlan((prev) =>
        prev
          ? { ...prev, posts: prev.posts.map((p) => (p.id === postId ? { ...p, post_date: fromDate } : p)) }
          : prev,
      );
      setError(e instanceof Error ? e.message : "Could not move the post");
    }
  }

  async function deletePost(post: SocialContentPost) {
    setConfirmDelete(null);
    setPlan((prev) => (prev ? { ...prev, posts: prev.posts.filter((p) => p.id !== post.id) } : prev));
    setSelectedPostId((id) => (id === post.id ? null : id));
    setError(null);
    try {
      const res = await fetch("/api/social/posts", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId: post.id }),
      });
      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        throw new Error(err.error ?? "Could not delete the post");
      }
    } catch (e) {
      // Put it back where it was.
      setPlan((prev) => (prev ? { ...prev, posts: [...prev.posts, post] } : prev));
      setError(e instanceof Error ? e.message : "Could not delete the post");
    }
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveDrag((event.active.data.current as SourcePayload | PostPayload) ?? null);
  }

  /** Write a confirmed series expansion in one request. */
  async function commitSeriesExpansion() {
    if (!client || !pendingSeries || placingSeries) return;
    const { series: s, expansion } = pendingSeries;
    if (expansion.posts.length === 0) {
      setPendingSeries(null);
      return;
    }
    setPlacingSeries(true);
    setError(null);
    try {
      const res = await fetch("/api/social/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: client.id,
          month,
          year,
          items: expansion.posts.map((p) => ({
            postDate: p.postDate,
            kind: "series" as const,
            title: p.campaignLabel,
            campaignType: s.campaign_type,
            seriesId: s.id,
            seriesPart: p.seriesPart,
            shotList: p.shotList,
          })),
        }),
      });
      const data = (await res.json()) as {
        posts?: SocialContentPost[];
        plan?: SocialContentPlan;
        error?: string;
      };
      if (!res.ok || !data.posts) throw new Error(data.error ?? "Could not place the series");
      setPlan((prev) =>
        prev && prev.id > 0
          ? { ...prev, posts: [...prev.posts, ...data.posts!] }
          : ({ ...(data.plan as SocialContentPlan), posts: data.posts! } as SocialPlanWithPosts),
      );
      setPendingSeries(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not place the series");
    } finally {
      setPlacingSeries(false);
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const payload = event.active.data.current as SourcePayload | PostPayload | undefined;
    setActiveDrag(null);
    if (!payload) return;

    const overId = event.over?.id;
    const targetDate = typeof overId === "string" && overId.startsWith("cell:") ? overId.slice(5) : null;

    if (payload.type === "source") {
      if (!targetDate) return;
      // A series can create many posts, so it always goes through a preview.
      if (payload.kind === "series") {
        const s = visibleSeries.find((x) => x.id === payload.sourceId);
        if (!s) return;
        setPendingSeries({ series: s, dropDate: targetDate, expansion: expandSeries(s, targetDate, year, month) });
        return;
      }
      void placeSource(payload, targetDate);
      return;
    }

    // An existing post: onto a cell = move; anywhere outside the grid = delete.
    const post = (plan?.posts ?? []).find((p) => p.id === payload.postId);
    if (!post || post.locked) return;
    if (targetDate) {
      void movePost(payload.postId, payload.postDate, targetDate);
    } else {
      setConfirmDelete(post);
    }
  }

  // ── Rail actions ───────────────────────────────────────────────────────────

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
      setFresh(more ? [...fresh, ...data.ideas] : data.ideas);
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
    setFresh([...fresh, { title: t, description: "", shot_idea: "", campaign_type: "series", custom: true }]);
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

  // ── Export ─────────────────────────────────────────────────────────────────

  const [exportOpen, setExportOpen] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const exportName = client ? getClientDisplayName(client) : "";
  const exportPosts = plan?.posts ?? [];

  function downloadFile(contents: string, mime: string, ext: string) {
    const url = URL.createObjectURL(new Blob([contents], { type: `${mime};charset=utf-8` }));
    const a = document.createElement("a");
    a.href = url;
    a.download = exportFileName(exportName, month, year, ext);
    a.click();
    URL.revokeObjectURL(url);
  }

  async function copyText(kind: "plan" | "brief") {
    const text =
      kind === "plan"
        ? buildPlanText({ clientName: exportName, month, year, posts: exportPosts })
        : buildPhotoBriefText({ clientName: exportName, month, year, posts: exportPosts });
    setExportOpen(false);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      setTimeout(() => setCopied(null), 1800);
    } catch {
      // Some browsers block clipboard writes (permissions, unfocused window).
      // Fall back to a download so the export still lands somewhere useful.
      downloadFile(text, "text/plain", "txt");
      setCopied("file");
      setTimeout(() => setCopied(null), 3000);
    }
  }

  function downloadCsv() {
    downloadFile(buildPlanCsv(exportPosts), "text/csv", "csv");
    setExportOpen(false);
  }

  const years = [now.getFullYear(), now.getFullYear() + 1];

  const railTabs: Array<{ id: RailTab; label: string; count: number }> = [
    { id: "ideas", label: "Ideas", count: filteredIdeas.length },
    { id: "fresh", label: "Fresh", count: fresh.length },
    { id: "days", label: "Days", count: monthLongDays.length + datedDays.length },
    { id: "series", label: "Series", count: visibleSeries.length },
  ];

  // ── Rail ───────────────────────────────────────────────────────────────────

  const rail = (
    <div className="flex h-full flex-col">
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
            <span className="ml-1 tabular-nums text-slate-400">{t.count}</span>
          </button>
        ))}
      </div>

      <div className="mt-3 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
        {railTab === "ideas" && (
          <>
            <div className="flex flex-wrap gap-1.5">
              {SOCIAL_PURPOSES.map((p) => {
                const on = purposeFilter.includes(p);
                const ps = purposeStyle(p);
                return (
                  <button
                    key={p}
                    onClick={() => setPurposeFilter((prev) => (on ? prev.filter((x) => x !== p) : [...prev, p]))}
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

            {ideasByType.length === 0 && <p className="py-8 text-center text-sm text-slate-400">No ideas match.</p>}
            {ideasByType.map(([label, list]) => (
              <div key={label} className="space-y-2">
                <p className="text-[0.65rem] font-semibold uppercase tracking-widest text-slate-400">{label}</p>
                {list.map((idea) => {
                  const ps = purposeStyle(idea.purpose);
                  return (
                    <DraggableCard
                      key={idea.id}
                      id={`idea:${idea.id}`}
                      payload={{
                        type: "source",
                        kind: "idea",
                        sourceId: idea.id,
                        title: idea.title,
                        description: idea.description,
                        campaignType: idea.campaign_type,
                      }}
                      title={idea.title}
                      description={idea.description}
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

        {railTab === "fresh" && (
          <>
            <button
              onClick={() => void brainstorm(fresh.length > 0)}
              disabled={!client || brainstorming || gettingMore}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-700 disabled:opacity-50"
            >
              <Sparkles size={14} />
              {brainstorming || gettingMore ? "Thinking…" : fresh.length > 0 ? "More ideas" : "Brainstorm cute ideas"}
            </button>
            {!client && <p className="text-center text-xs text-slate-400">Pick a practice first.</p>}

            {fresh.map((idea, i) => {
              const ct = getCampaignType(idea.campaign_type);
              return (
                <DraggableCard
                  key={`${idea.title}-${i}`}
                  id={`fresh:${i}`}
                  payload={{
                    type: "source",
                    kind: "fresh",
                    sourceId: null,
                    title: idea.title,
                    description: idea.description,
                    campaignType: idea.campaign_type,
                  }}
                  title={idea.title}
                  description={idea.description || undefined}
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
                  <DraggableCard
                    key={d.id}
                    id={`aw:${d.id}`}
                    payload={{
                      type: "source",
                      kind: "awareness",
                      sourceId: d.id,
                      title: d.name,
                      description: d.content_angle,
                      campaignType: "awareness_day",
                    }}
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
                  <DraggableCard
                    key={row.id}
                    id={`aw:${row.id}`}
                    payload={{
                      type: "source",
                      kind: "awareness",
                      sourceId: row.id,
                      title: row.name,
                      description: row.content_angle,
                      campaignType: "awareness_day",
                    }}
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

        {railTab === "series" && (
          <>
            {visibleSeries.length === 0 ? (
              <p className="px-2 py-8 text-center text-sm text-slate-400">
                No active series. Create one in the Series tab, then drag it here to lay out a whole run at once.
              </p>
            ) : (
              visibleSeries.map((s) => {
                const isArc = s.kind === "arc";
                return (
                  <DraggableCard
                    key={s.id}
                    id={`series:${s.id}`}
                    payload={{
                      type: "source",
                      kind: "series",
                      sourceId: s.id,
                      title: s.title,
                      description: s.description,
                      campaignType: s.campaign_type,
                    }}
                    title={s.title}
                    description={s.description}
                    pills={
                      <>
                        <span
                          className={`rounded-full border px-2 py-0.5 text-xs font-medium ${
                            isArc
                              ? "border-violet-200/60 bg-violet-50 text-violet-700"
                              : "border-sky-200/60 bg-sky-50 text-sky-700"
                          }`}
                        >
                          {isArc ? "Arc" : "Recurring"}
                        </span>
                        <span className="text-xs font-medium text-slate-400">
                          {isArc
                            ? `${s.parts.length} part${s.parts.length === 1 ? "" : "s"}${s.spacing_days ? ` · every ${s.spacing_days}d` : ""}`
                            : [s.cadence, s.day_of_week != null ? WEEKDAY_HEADS[s.day_of_week] : null]
                                .filter(Boolean)
                                .join(" · ")}
                        </span>
                      </>
                    }
                  />
                );
              })
            )}
          </>
        )}
      </div>
    </div>
  );

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <DndContext
      // Stable id: without it dnd-kit derives aria-describedby from a global
      // counter that differs between the server and client render, which
      // React reports as a hydration mismatch.
      id="social-calendar-dnd"
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveDrag(null)}
    >
      <div className="flex min-h-0 flex-1 flex-col">
        {/* Unsaved edits in the detail panel */}
        {pendingNav && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            onClick={() => setPendingNav(null)}
          >
            <div
              className="w-full max-w-sm rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-base font-bold tracking-tight text-slate-900">Discard unsaved changes?</h3>
              <p className="mt-2 text-sm text-slate-500">
                This post has edits you haven&rsquo;t saved. Leaving now loses them.
              </p>
              <div className="mt-5 flex justify-end gap-2">
                <button
                  onClick={() => setPendingNav(null)}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-slate-500 transition hover:text-slate-900"
                >
                  Keep editing
                </button>
                <button
                  onClick={() => {
                    const run = pendingNav;
                    setPendingNav(null);
                    setPanelDirty(false);
                    run?.();
                  }}
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-slate-700"
                >
                  Discard
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Series expansion preview — nothing is written until this is confirmed */}
        {pendingSeries && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            onClick={() => setPendingSeries(null)}
          >
            <div
              className="flex max-h-[80vh] w-full max-w-lg flex-col rounded-2xl border border-slate-200/80 bg-white shadow-sm"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="border-b border-slate-100 p-6 pb-4">
                <h3 className="text-base font-bold tracking-tight text-slate-900">
                  Add &ldquo;{pendingSeries.series.title}&rdquo; to {MONTH_NAMES[month]}?
                </h3>
                <p className="mt-2 text-sm text-slate-500">
                  {pendingSeries.expansion.posts.length === 0
                    ? "Nothing would land inside this month."
                    : pendingSeries.expansion.posts.length === 1
                      ? "This creates 1 post with an empty caption."
                      : `This creates ${pendingSeries.expansion.posts.length} posts, all with empty captions.`}
                </p>
                {pendingSeries.expansion.clipped > 0 && (
                  <p className="mt-2 rounded-lg border border-amber-200/60 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
                    {pendingSeries.expansion.posts.length} of {pendingSeries.expansion.totalWanted}{" "}
                    {pendingSeries.series.kind === "arc" ? "parts" : "posts"} fall in {MONTH_NAMES[month]};{" "}
                    {pendingSeries.expansion.clipped} would land in the next month and will be skipped.
                  </p>
                )}
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
                <ol className="space-y-1.5">
                  {pendingSeries.expansion.posts.map((p, i) => (
                    <li key={`${p.postDate}-${i}`} className="flex items-center gap-3 text-sm">
                      <span className="w-28 shrink-0 font-medium text-slate-400">{friendlyDate(p.postDate)}</span>
                      <span className="min-w-0 flex-1 truncate text-slate-900">{p.campaignLabel}</span>
                      {p.seriesPart != null && (
                        <span className="shrink-0 rounded bg-violet-50 px-1.5 py-0.5 text-xs font-semibold tabular-nums text-violet-700">
                          {p.seriesPart}/{pendingSeries.series.parts.length}
                        </span>
                      )}
                    </li>
                  ))}
                </ol>
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-100 p-6 pt-4">
                <button
                  onClick={() => setPendingSeries(null)}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-slate-500 transition hover:text-slate-900"
                >
                  Cancel
                </button>
                <button
                  onClick={() => void commitSeriesExpansion()}
                  disabled={placingSeries || pendingSeries.expansion.posts.length === 0}
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-slate-700 disabled:opacity-40"
                >
                  {placingSeries
                    ? "Creating…"
                    : `Create ${pendingSeries.expansion.posts.length} post${
                        pendingSeries.expansion.posts.length === 1 ? "" : "s"
                      }`}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete confirmation */}
        {confirmDelete && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            onClick={() => setConfirmDelete(null)}
          >
            <div
              className="w-full max-w-md rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-base font-bold tracking-tight text-slate-900">Remove this post?</h3>
              <p className="mt-2 text-sm text-slate-500">
                <span className="font-medium text-slate-900">{confirmDelete.campaign_label}</span> on{" "}
                {friendlyDate(confirmDelete.post_date)} will be deleted from the calendar.
              </p>
              <div className="mt-5 flex justify-end gap-2">
                <button
                  onClick={() => setConfirmDelete(null)}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-slate-500 transition hover:text-slate-900"
                >
                  Keep it
                </button>
                <button
                  onClick={() => void deletePost(confirmDelete)}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-red-500"
                >
                  Remove post
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
                setFresh([]);
                setSelectedPostId(null);
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
              onChange={(e) => { setMonth(Number(e.target.value)); setSelectedPostId(null); }}
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
              onChange={(e) => { setYear(Number(e.target.value)); setSelectedPostId(null); }}
              className="rounded-lg border border-slate-200/80 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none"
            >
              {years.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          <p className="ml-auto text-xs font-medium text-slate-400">
            Drag a card onto a day — or focus its handle and press space, then arrow to a day.
          </p>
        </div>

        {/* Captions will use the internal account name unless a public one is set. */}
        {needsPublicName && client && (
          <div className="mx-6 mb-3 rounded-xl border border-amber-200/60 bg-amber-50 px-4 py-3">
            <p className="text-sm text-amber-900">
              Captions will use{" "}
              <span className="font-semibold">&ldquo;{client.account_name}&rdquo;</span> — set a public
              name if that&rsquo;s not what clients should see.
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <input
                value={publicNameDraft}
                onChange={(e) => setPublicNameDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void savePublicName()}
                placeholder={client.account_name}
                aria-label="Client-facing practice name"
                className="min-w-64 flex-1 rounded-lg border border-amber-200 bg-white px-3 py-1.5 text-sm text-slate-900 outline-none focus:border-amber-400 sm:flex-none"
              />
              <button
                onClick={() => void savePublicName()}
                disabled={!publicNameDraft.trim() || savingPublicName}
                className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-slate-700 disabled:opacity-40"
              >
                {savingPublicName ? "Saving…" : "Save public name"}
              </button>
            </div>
          </div>
        )}

        {error && (
          <p className="mx-6 mb-3 rounded-xl border border-red-200/80 bg-red-50 px-4 py-2.5 text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="flex min-h-0 flex-1 gap-5 px-6 pb-6">
          {/* One column: sources, or the open post. Widens for editing. */}
          <aside
            className={`hidden shrink-0 transition-[width] duration-150 xl:block ${
              selectedPost ? "w-[480px]" : "w-[360px]"
            }`}
          >
            {selectedPost && plan ? (
              <PostDetailPanel
                key={selectedPost.id}
                post={selectedPost}
                planId={plan.id}
                series={series}
                awarenessDays={awarenessDays}
                onBack={() => guardNav(() => { setSelectedPostId(null); setPanelDirty(false); })}
                onClose={() => guardNav(() => { setSelectedPostId(null); setPanelDirty(false); })}
                onUpdated={applyPostUpdate}
                onDeleted={removePostLocally}
                onDirtyChange={setPanelDirty}
              />
            ) : (
              rail
            )}
          </aside>

          {/* Below xl the column is hidden, so the same content opens as a drawer.
              A selected post opens it automatically — otherwise the detail panel
              would be unreachable on a narrower screen. */}
          {(railOpen || selectedPost) && (
            <div className="fixed inset-0 z-40 flex xl:hidden" role="dialog" aria-modal="true">
              <div
                className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm"
                onClick={() =>
                  selectedPost
                    ? guardNav(() => { setSelectedPostId(null); setPanelDirty(false); })
                    : setRailOpen(false)
                }
              />
              <div
                className={`relative z-10 flex h-full max-w-[95vw] flex-col bg-slate-50 p-4 shadow-xl ${
                  selectedPost ? "w-[480px]" : "w-[360px]"
                }`}
              >
                {selectedPost && plan ? (
                  <PostDetailPanel
                    key={selectedPost.id}
                    post={selectedPost}
                    planId={plan.id}
                    series={series}
                    awarenessDays={awarenessDays}
                    onBack={() => guardNav(() => { setSelectedPostId(null); setPanelDirty(false); setRailOpen(true); })}
                    onClose={() => guardNav(() => { setSelectedPostId(null); setPanelDirty(false); })}
                    onUpdated={applyPostUpdate}
                    onDeleted={removePostLocally}
                    onDirtyChange={setPanelDirty}
                  />
                ) : (
                  <>
                    <div className="mb-3 flex items-center justify-between">
                      <p className="text-sm font-bold tracking-tight text-slate-900">Sources</p>
                      <button onClick={() => setRailOpen(false)} className="text-slate-400 hover:text-slate-900">
                        <X size={16} />
                      </button>
                    </div>
                    <div className="min-h-0 flex-1">{rail}</div>
                  </>
                )}
              </div>
            </div>
          )}

          <section className="flex min-w-0 flex-1 flex-col">
            {!client ? (
              <div className="flex flex-1 items-center justify-center rounded-2xl border border-dashed border-slate-300">
                <div className="text-center">
                  <CalendarDays size={28} className="mx-auto text-slate-300" />
                  <p className="mt-3 text-sm font-medium text-slate-500">Pick a practice to open its calendar.</p>
                </div>
              </div>
            ) : (
              <>
                {/* Caption generation */}
                <div className="mb-3 flex flex-wrap items-center gap-3">
                  <button
                    onClick={() => void writeCaptionsForPlan()}
                    disabled={!plan || plan.id < 0 || needsCaption.length === 0 || writing}
                    className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-slate-700 disabled:opacity-40"
                  >
                    {writing
                      ? "Writing…"
                      : `Write captions for ${needsCaption.length} post${needsCaption.length === 1 ? "" : "s"}`}
                  </button>

                  {/* Export */}
                  <div className="relative">
                    <button
                      onClick={() => setExportOpen((v) => !v)}
                      disabled={exportPosts.length === 0}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200/80 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-slate-400 hover:text-slate-900 disabled:opacity-40"
                    >
                      <Download size={13} />
                      Export
                    </button>
                    {exportOpen && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setExportOpen(false)} />
                        <div className="absolute left-0 top-full z-20 mt-1 w-60 overflow-hidden rounded-xl border border-slate-200/80 bg-white py-1 shadow-lg">
                          <button
                            onClick={() => void copyText("plan")}
                            className="block w-full px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50"
                          >
                            Copy full month
                            <span className="block text-slate-400">Captions, shot lists, hashtags</span>
                          </button>
                          <button
                            onClick={() => void copyText("brief")}
                            className="block w-full px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50"
                          >
                            Copy client photo brief
                            <span className="block text-slate-400">Just what the practice must shoot</span>
                          </button>
                          <button
                            onClick={downloadCsv}
                            className="block w-full px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50"
                          >
                            Download CSV
                            <span className="block text-slate-400">One row per post, for a spreadsheet</span>
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                  {copied && (
                    <span className="text-xs font-medium text-emerald-600">
                      {copied === "plan"
                        ? "Month copied"
                        : copied === "brief"
                          ? "Photo brief copied"
                          : "Clipboard blocked — downloaded as a file instead"}
                    </span>
                  )}
                  {writeResult && !writing && (
                    <span className="text-xs font-medium text-slate-500">
                      Wrote {writeResult.updated} post{writeResult.updated === 1 ? "" : "s"}
                      {writeResult.skipped > 0 && ` · skipped ${writeResult.skipped}`}
                    </span>
                  )}
                </div>

                {writing && (
                  <div className="mb-3 rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-sm font-semibold text-slate-900">
                        Writing captions and shot lists…
                      </p>
                      <span className="text-xs font-medium tabular-nums text-slate-500">{elapsed}s</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                      <div className="h-1.5 w-full animate-pulse rounded-full bg-gradient-to-r from-indigo-500 to-violet-500" />
                    </div>
                    <p className="mt-2 text-xs text-slate-400">Usually 40-75 seconds for a full month.</p>
                  </div>
                )}

                <div className={writing ? "pointer-events-none opacity-60 transition-opacity" : "transition-opacity"}>
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

                <div className="mb-1.5 grid grid-cols-7 gap-1.5">
                  {WEEKDAY_HEADS.map((w) => (
                    <div key={w} className="px-1 text-xs uppercase tracking-wide text-slate-400">
                      {w}
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-1.5">
                  {cells.map((cell) => (
                    <DayCell
                      key={cell.key}
                      cell={cell}
                      isToday={cell.dateStr === today}
                      marks={cell.inMonth ? awarenessByDate.get(cell.dateStr) ?? [] : []}
                      onQuickAdd={(title) => quickAdd(cell.dateStr, title)}
                    >
                      {(postsByDate.get(cell.dateStr) ?? []).map((post) => (
                        <PostChip
                          key={post.id}
                          post={post}
                          selected={post.id === selectedPostId}
                          onSelect={() => guardNav(() => setSelectedPostId(post.id))}
                          partsTotal={
                            post.series_id != null
                              ? series.find((s) => s.id === post.series_id)?.parts.length
                              : undefined
                          }
                          dotClass={
                            purposeStyle(post.idea_id != null ? purposeByIdeaId.get(post.idea_id) ?? null : null).dot
                          }
                        />
                      ))}
                    </DayCell>
                  ))}
                </div>

                {loadingPlan &&<p className="mt-3 text-xs font-medium text-slate-400">Loading plan…</p>}
                {!loadingPlan && !plan && (
                  <p className="mt-3 text-xs font-medium text-slate-400">
                    Nothing planned for {MONTH_NAMES[month]} {year} — drag a card from the left onto a day to start.
                  </p>
                )}
                </div>
              </>
            )}
          </section>
        </div>
      </div>

      {/* Drag preview */}
      <DragOverlay dropAnimation={null}>
        {activeDrag ? (
          activeDrag.type === "source" ? (
            <div className="max-w-[300px] rounded-xl border border-indigo-300 bg-white px-3 py-2 shadow-lg">
              <p className="truncate text-sm font-semibold text-slate-900">{activeDrag.title}</p>
            </div>
          ) : (
            <div className="rounded-md border border-indigo-300 bg-white px-2 py-1 shadow-lg">
              <p className="truncate text-[0.7rem] font-medium text-slate-700">
                {(plan?.posts ?? []).find((p) => p.id === activeDrag.postId)?.campaign_label ?? "Post"}
              </p>
            </div>
          )
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
