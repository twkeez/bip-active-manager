// Typed contract for the internal strategist cockpit. Built from
// ClientWorkspaceInitialData via lib/dashboard/cockpit-view-model.ts.
// Internal only — never rendered for clients.

export interface ClientMeta {
  id: number;
  name: string;
  location?: string | null;
  strategists?: string | null;
  window: string;
  syncedAt?: string | null;
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
export interface FocusItem {
  id: string;
  priority: Priority;
  title: string;
  why: string;
  tags: FocusTag[];
  source: "signal" | "strategic";
}
export interface FeatureWin {
  title: string;
  detail: string;
}

export interface CockpitData {
  client: ClientMeta;
  health: HealthItem[];
  focus: FocusItem[];
  features: FeatureWin[];
}
