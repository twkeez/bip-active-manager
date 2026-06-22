// types/cockpit.ts
// Typed contract for the internal strategist cockpit. Built from
// ClientWorkspaceInitialData via lib/dashboard/cockpit-view-model.ts.
// Internal only — never rendered for clients.

export interface ClientMeta {
  id: number; // numeric clientId, matching the route segment
  name: string;
  location?: string | null;
  strategists?: string | null;
  window: string; // e.g. "Last 30 days"
  syncedAt?: string | null; // display string
}

export type ChannelStatus = "ok" | "warn" | "bad";
export interface HealthItem {
  channel: string;
  status: ChannelStatus;
  label: string;
}

export type Priority = "P1" | "P2" | "P3";
export interface FocusTag {
  label: string;
  tone?: "hi" | "lo" | "neutral";
}

/** One specific instance folded into a grouped focus item
 *  (e.g. a single affected page or keyword set with its metrics). */
export interface FocusEntry {
  label?: string; // affected page URL / keyword summary
  metrics?: string; // preformatted metric chip, e.g. "impr 7,875 · CTR 0.78% · pos 6.7"
}

export interface FocusItem {
  id: string;
  priority: Priority;
  channel: string; // "SEO" | "Ads" | "Analytics" | "Social"
  title: string; // grouped signal title
  why: string; // shared description
  fix?: string; // recommended action ("Fix:" line from the signal)
  count: number; // how many raw signals were folded into this item
  entries: FocusEntry[]; // the specific instances, shown on expand
  link?: { label: string; href: string }; // deep link to the relevant tab
  tags: FocusTag[];
  source: "signal" | "strategic";
}

export interface FeatureWin {
  title: string;
  detail: string;
}

export interface PriorityCounts {
  P1: number;
  P2: number;
  P3: number;
}

export interface CockpitData {
  client: ClientMeta;
  health: HealthItem[];
  focus: FocusItem[];
  counts: PriorityCounts; // counts of GROUPED items, for the summary bar
  features: FeatureWin[];
}
