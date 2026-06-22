// lib/dashboard/cockpit-view-model.ts
// Pure transform — no fetching. Feed it the ClientWorkspaceInitialData the client
// dashboard page already loads via loadClientWorkspaceData().
//
// Key behaviours:
//  - GROUPS raw signals by type so duplicates collapse into one card with a count
//    and an expandable list of affected pages/keywords.
//  - Includes ANALYTICS signals (client_ga4_signals: no-conversions, low-engagement,
//    high-direct), not just SEO / Ads / Social.
//  - Drives the health strip from the worst LIVE signal per channel.
//  - Only surfaces client-facing "wins" for channels that are actually healthy.

import type { ClientWorkspaceInitialData } from "@/lib/dashboard/client-workspace-types";
import type {
  AdsSignal,
  AdsSnapshot,
  Ga4Signal,
  GscSignal,
  SocialSignal,
} from "@/lib/types/client";
import {
  SIGNAL_CHANNEL_LABEL,
  SIGNAL_CHANNEL_TAB,
  affectedKeywordsForAdsSignal,
  tabHref,
  type SignalChannelSource,
} from "@/lib/dashboard/signal-mapping";
import type {
  CockpitData,
  FocusItem,
  FocusEntry,
  HealthItem,
  Priority,
  ChannelStatus,
  FeatureWin,
} from "@/types/cockpit";

// ---------------------------------------------------------------------------
// Normalized signal — the shape the grouping logic operates on. Each raw row
// from client_*_signals is mapped into this via the channel-specific mappers
// below, which mirror the field choices the Attention Needed panel makes.
// ---------------------------------------------------------------------------
interface Signal {
  source: SignalChannelSource;
  code: string; // signal_id — the stable type code, used as the grouping key
  severity: "critical" | "watch";
  title: string;
  detail?: string;
  fix?: string;
  metrics?: string; // preformatted per-instance metric chip
  affected?: string; // affected page URL / keyword summary for this instance
}

function gscToSignal(s: GscSignal): Signal {
  return {
    source: "seo",
    code: s.signal_id,
    severity: s.severity,
    title: s.title,
    detail: s.description ?? undefined,
    fix: s.suggestion ?? undefined,
    metrics: s.metric_value ?? undefined,
    affected: s.page_url ?? s.query ?? undefined,
  };
}

function adsToSignal(s: AdsSignal, adsSnapshot: AdsSnapshot | null): Signal {
  const keywords = affectedKeywordsForAdsSignal(adsSnapshot, s.signal_id);
  const affected =
    keywords.length > 0
      ? `${keywords.length} keyword${keywords.length > 1 ? "s" : ""} affected`
      : undefined;
  return {
    source: "ads",
    code: s.signal_id,
    severity: s.severity,
    title: s.title,
    detail: s.description ?? undefined,
    fix: s.suggestion ?? undefined,
    metrics: s.metric_value ?? undefined,
    affected,
  };
}

function ga4ToSignal(s: Ga4Signal): Signal {
  return {
    source: "analytics",
    code: s.signal_id,
    severity: s.severity,
    title: s.title,
    detail: s.description ?? undefined,
    fix: s.suggestion ?? undefined,
    metrics: s.metric_value ?? undefined,
  };
}

function socialToSignal(s: SocialSignal): Signal {
  return {
    source: "social",
    code: s.signal_id,
    severity: s.severity,
    title: s.title,
    detail: s.description ?? undefined,
    fix: s.suggestion ?? undefined,
    metrics: s.metric_value ?? undefined,
  };
}

// ---------------------------------------------------------------------------
// Severity / priority mapping. Real severities are "critical" | "watch".
// ---------------------------------------------------------------------------
function severityToPriority(sev: "critical" | "watch"): Priority {
  return sev === "critical" ? "P1" : "P2";
}
function severityToStatus(sev: "critical" | "watch"): ChannelStatus {
  return sev === "critical" ? "bad" : "warn";
}
const PRIORITY_ORDER: Record<Priority, number> = { P1: 0, P2: 1, P3: 2 };

// ---------------------------------------------------------------------------
// Grouping — collapse duplicate signals into one card per type.
// ---------------------------------------------------------------------------
function groupSignals(signals: Signal[], clientId: number): FocusItem[] {
  const map = new Map<string, FocusItem>();
  for (const s of signals) {
    if (!s.title) continue;
    const channel = SIGNAL_CHANNEL_LABEL[s.source];
    const tab = SIGNAL_CHANNEL_TAB[s.source];
    const key = `${channel}:${s.code}`;
    const priority = severityToPriority(s.severity);

    let item = map.get(key);
    if (!item) {
      item = {
        id: `grp-${key}`.replace(/\s+/g, "-"),
        priority,
        channel,
        title: s.title,
        why: s.detail ?? "",
        fix: s.fix,
        count: 0,
        entries: [],
        link: { label: `Open ${channel} tab`, href: tabHref(clientId, tab) },
        tags: [{ label: channel }],
        source: "signal",
      };
      map.set(key, item);
    }
    item.count += 1;
    const entry: FocusEntry = { label: s.affected, metrics: s.metrics };
    if (entry.label || entry.metrics) item.entries.push(entry);
    // escalate the group to its most severe member
    if (PRIORITY_ORDER[priority] < PRIORITY_ORDER[item.priority]) item.priority = priority;
    if (!item.fix && s.fix) item.fix = s.fix;
  }
  for (const item of map.values()) {
    if (item.count > 1) item.tags.push({ label: `${item.count} pages`, tone: "neutral" });
  }
  return [...map.values()];
}

function worstStatus(signals: Signal[] = []): ChannelStatus {
  if (signals.some((s) => s.severity === "critical")) return "bad";
  if (signals.length > 0) return "warn";
  return "ok";
}
function statusLabel(status: ChannelStatus): string {
  return status === "bad" ? "Issue" : status === "warn" ? "Needs attention" : "Healthy";
}

// ---------------------------------------------------------------------------
// Main adapter
// ---------------------------------------------------------------------------
export function toCockpitViewModel(data: ClientWorkspaceInitialData): CockpitData {
  const { client, adsSnapshot, ga4Snapshot, gbpSnapshot } = data;
  const clientId = client.id;

  const seoSignals = data.gscSignals.map(gscToSignal);
  const adsSignals = data.adsSignals.map((s) => adsToSignal(s, adsSnapshot));
  const analyticsSignals = data.ga4Signals.map(ga4ToSignal);
  const socialSignals = data.socialSignals.map(socialToSignal);

  // 1) Group all signals (incl. analytics) into deduped focus items.
  const grouped = groupSignals(
    [...seoSignals, ...adsSignals, ...analyticsSignals, ...socialSignals],
    clientId,
  );

  // 2) Standing strategic items — only when a signal hasn't already covered it.
  const conversionTrackingConfigured =
    Boolean((client.ga4_property_id ?? "").trim()) && ga4Snapshot !== null;
  const strategic: FocusItem[] = [];
  if (!conversionTrackingConfigured) {
    strategic.push({
      id: "strat-conversion-tracking",
      priority: "P1",
      channel: "Analytics",
      title: "Set up conversion tracking on organic & the website",
      why: "We need calls and form fills tracked as conversions to prove ROI and optimize. Verify before the next report.",
      count: 1,
      entries: [],
      tags: [{ label: "CRO" }, { label: "High impact", tone: "hi" }],
      source: "strategic",
    });
  }
  const lostBudget = adsSnapshot?.totals.search_budget_lost_impression_share ?? 0;
  const haveBudgetSignal = adsSignals.some((s) =>
    /budget/i.test(`${s.code} ${s.title}`),
  );
  if (lostBudget > 25 && !haveBudgetSignal) {
    strategic.push({
      id: "strat-budget",
      priority: "P1",
      channel: "Ads",
      title: "Pitch a paid budget increase",
      why: `Losing ${lostBudget.toFixed(1)}% of impressions to budget — fastest path to more booked appointments, and a billable upsell.`,
      count: 1,
      entries: [],
      tags: [{ label: "Ads" }, { label: "High impact", tone: "hi" }, { label: "Low effort", tone: "lo" }],
      source: "strategic",
    });
  }

  const focus = [...strategic, ...grouped].sort(
    (a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority],
  );

  const counts = {
    P1: focus.filter((f) => f.priority === "P1").length,
    P2: focus.filter((f) => f.priority === "P2").length,
    P3: focus.filter((f) => f.priority === "P3").length,
  };

  // 3) Health strip — driven by live signals per channel.
  const seoStatus = worstStatus(seoSignals);
  const adsStatus = worstStatus(adsSignals);
  const analyticsStatus = worstStatus(analyticsSignals);
  const socialStatus = worstStatus(socialSignals);

  const rating = gbpSnapshot?.rating;
  const health: HealthItem[] = [
    { channel: "Organic", status: seoStatus, label: statusLabel(seoStatus) },
    { channel: "Paid search", status: adsStatus, label: statusLabel(adsStatus) },
    { channel: "Analytics", status: analyticsStatus, label: statusLabel(analyticsStatus) },
    { channel: "Social", status: socialStatus, label: statusLabel(socialStatus) },
    {
      channel: "Reviews",
      status: "ok",
      label: rating != null ? `${rating.toFixed(1)}★` : "—",
    },
    {
      channel: "Conv. tracking",
      status: conversionTrackingConfigured ? "ok" : "bad",
      label: conversionTrackingConfigured ? "Connected" : "Not set up",
    },
  ];

  // 4) Wins to feature — ONLY from genuinely healthy channels (no contradictions).
  const features: FeatureWin[] = [];
  const totalClicks = data.gscPageMetrics.reduce((sum, m) => sum + m.clicks, 0);
  if (seoStatus === "ok" && totalClicks > 0) {
    features.push({ title: "Organic traffic is healthy", detail: `${totalClicks.toLocaleString()} clicks this period` });
  }
  const conversions = adsSnapshot?.totals.conversions;
  if (adsStatus === "ok" && conversions) {
    features.push({ title: "Paid running efficiently", detail: `${conversions.toLocaleString()} conversions this period` });
  }
  if (rating != null && rating >= 4.5) {
    const total = gbpSnapshot?.user_ratings_total;
    features.push({
      title: "Reputation is excellent",
      detail: `${rating.toFixed(1)}★${total ? ` across ${total.toLocaleString()} reviews` : ""}`,
    });
  }
  if (features.length === 0) {
    features.push({ title: "No clean wins to feature yet", detail: "Address the P1 items, then revisit what to spotlight." });
  }

  // Best available sync timestamp across connected services.
  const syncedAt = [
    data.gscSnapshot?.updated_at,
    data.adsSnapshot?.updated_at,
    data.gbpSnapshot?.updated_at,
    data.ga4Snapshot?.updated_at,
  ]
    .filter(Boolean)
    .sort()
    .at(-1) ?? null;
  const syncedAtLabel = syncedAt
    ? new Date(syncedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : null;

  return {
    client: {
      id: clientId,
      name: client.account_name,
      location: null,
      strategists: client.marketing_strategist ?? null,
      window: "Last 30 days",
      syncedAt: syncedAtLabel,
    },
    health,
    focus,
    counts,
    features,
  };
}
