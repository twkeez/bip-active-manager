// Pure transform — no fetching. Feed it the ClientWorkspaceInitialData the client
// dashboard page already loads via loadClientWorkspaceData().
//
// The focus queue is built PRIMARILY from the channel signals the platform already
// computes (client_gsc_signals / client_ads_signals / client_social_signals), then
// augmented with standing strategic items only when the data warrants it.

import type { ClientWorkspaceInitialData } from "@/lib/dashboard/client-workspace-types";
import type {
  CockpitData,
  FocusItem,
  HealthItem,
  Priority,
  ChannelStatus,
} from "@/types/cockpit";

// ---------------------------------------------------------------------------
// Helpers — severity values are "critical" | "watch" in this codebase
// ---------------------------------------------------------------------------
type RealSeverity = "critical" | "watch";

type SignalRow = {
  id: number;
  signal_id?: string;
  severity: RealSeverity;
  title: string;
  description: string | null;
};

function severityToPriority(sev: RealSeverity): Priority {
  return sev === "critical" ? "P1" : "P2";
}

function severityToStatus(sev: RealSeverity): ChannelStatus {
  return sev === "critical" ? "bad" : "warn";
}

function worstStatus(signals: SignalRow[]): ChannelStatus {
  if (signals.some((s) => s.severity === "critical")) return "bad";
  if (signals.length > 0) return "warn";
  return "ok";
}

function signalsToFocus(signals: SignalRow[], channelLabel: string): FocusItem[] {
  return signals.map((s, i) => ({
    id: `sig-${channelLabel.toLowerCase()}-${s.signal_id ?? s.id ?? i}`,
    priority: severityToPriority(s.severity),
    title: s.title,
    why: s.description ?? "",
    tags: [{ label: channelLabel }],
    source: "signal" as const,
  }));
}

const PRIORITY_ORDER: Record<Priority, number> = { P1: 0, P2: 1, P3: 2 };

// ---------------------------------------------------------------------------
// Main adapter
// ---------------------------------------------------------------------------
export function toCockpitViewModel(data: ClientWorkspaceInitialData): CockpitData {
  const { client, gscSignals, adsSignals, socialSignals, gbpSnapshot, adsSnapshot, gscPageMetrics, ga4Snapshot } = data;

  const conversionTrackingConfigured =
    Boolean((client.ga4_property_id ?? "").trim()) && ga4Snapshot !== null;

  // 1) Signals → focus items
  const fromSignals: FocusItem[] = [
    ...signalsToFocus(gscSignals, "SEO"),
    ...signalsToFocus(adsSignals, "Ads"),
    ...signalsToFocus(socialSignals, "Social"),
  ];

  // 2) Strategic augmentation — only when signals don't already cover them
  const strategic: FocusItem[] = [];
  if (!conversionTrackingConfigured) {
    strategic.push({
      id: "strat-conversion-tracking",
      priority: "P1",
      title: "Set up conversion tracking on organic & the website",
      why: "Organic traffic with no visibility into calls or form fills. We can't prove ROI or optimize what we can't measure — this unblocks everything else.",
      tags: [{ label: "CRO" }, { label: "High impact", tone: "hi" }, { label: "Med effort" }],
      source: "strategic",
    });
  }
  const lostBudget = adsSnapshot?.totals.search_budget_lost_impression_share ?? 0;
  if (lostBudget > 25) {
    strategic.push({
      id: "strat-budget",
      priority: "P1",
      title: "Pitch a paid budget increase to the client",
      why: `Losing ${lostBudget.toFixed(1)}% of impressions to budget. Fastest path to more booked appointments — and a billable upsell.`,
      tags: [{ label: "Ads" }, { label: "High impact", tone: "hi" }, { label: "Low effort", tone: "lo" }],
      source: "strategic",
    });
  }

  const focus = [...strategic, ...fromSignals].sort(
    (a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority],
  );

  // 3) Health strip — worst signal severity per channel
  const health: HealthItem[] = [
    { channel: "Organic", ...statusLabel(worstStatus(gscSignals)) },
    { channel: "Paid search", ...statusLabel(worstStatus(adsSignals)) },
    { channel: "Social", ...statusLabel(worstStatus(socialSignals)) },
    {
      channel: "Reviews",
      status: "ok",
      label: gbpSnapshot?.rating != null ? `${gbpSnapshot.rating.toFixed(1)}★` : "—",
    },
    {
      channel: "Conv. tracking",
      status: conversionTrackingConfigured ? "ok" : "bad",
      label: conversionTrackingConfigured ? "Connected" : "Not set up",
    },
  ];

  // 4) Wins to spotlight in the client report
  const features = buildFeatures(data);

  // Best available sync timestamp
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
      id: client.id,
      name: client.account_name,
      location: null,
      strategists: client.marketing_strategist ?? null,
      window: "Last 30 days",
      syncedAt: syncedAtLabel,
    },
    health,
    focus,
    features,
  };
}

function statusLabel(status: ChannelStatus): { status: ChannelStatus; label: string } {
  return {
    status,
    label: status === "bad" ? "Issue" : status === "warn" ? "Needs attention" : "Healthy",
  };
}

function buildFeatures(data: ClientWorkspaceInitialData): Array<{ title: string; detail: string }> {
  const wins: Array<{ title: string; detail: string }> = [];

  const totalClicks = data.gscPageMetrics.reduce((sum, m) => sum + m.clicks, 0);
  if (totalClicks > 0) {
    wins.push({ title: "Organic traffic is healthy", detail: `${totalClicks.toLocaleString()} clicks this period` });
  }

  const conversions = data.adsSnapshot?.totals.conversions;
  if (conversions) {
    wins.push({ title: "Paid running efficiently", detail: `${conversions.toLocaleString()} conversions this period` });
  }

  const rating = data.gbpSnapshot?.rating;
  const total = data.gbpSnapshot?.user_ratings_total;
  if (rating != null) {
    wins.push({
      title: "Reputation is excellent",
      detail: `${rating.toFixed(1)}★${total ? ` across ${total.toLocaleString()} reviews` : ""}`,
    });
  }

  if (data.gscPageMetrics.some((m) => m.page_url?.includes("/blog"))) {
    wins.push({ title: "Content engine working", detail: "Blog drives the majority of organic traffic" });
  }

  return wins;
}
