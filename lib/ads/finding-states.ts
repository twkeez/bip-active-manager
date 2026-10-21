// Decisions about ads findings that must outlast the browser tab: muted or
// flagged anomalies on Conversion Integrity, dismissed budget hogs on PPC
// Defense, ignored or snoozed tips on a client's Ads tab. Stored in
// ads_finding_states and shared by the whole team.

export const FINDING_TOOLS = ["conversion_integrity", "ppc_defense", "ads_playbook"] as const;
export type FindingTool = (typeof FINDING_TOOLS)[number];

export const FINDING_STATES = ["muted", "flagged", "dismissed", "snoozed"] as const;
export type FindingState = (typeof FINDING_STATES)[number];

export type FindingStateRow = {
  finding_key: string;
  client_id: number | null;
  state: FindingState;
  snoozed_until: string | null;
  set_by: string | null;
  created_at: string;
};

/** How long Snooze hides a tip. */
export const SNOOZE_DAYS = 30;

/** True while a row still applies: a snooze ends by itself. */
export function isActive(row: Pick<FindingStateRow, "state" | "snoozed_until">, now = new Date()): boolean {
  if (row.state !== "snoozed") return true;
  return !row.snoozed_until || new Date(row.snoozed_until) > now;
}

export function isFindingTool(value: unknown): value is FindingTool {
  return typeof value === "string" && (FINDING_TOOLS as readonly string[]).includes(value);
}

export function isFindingState(value: unknown): value is FindingState {
  return typeof value === "string" && (FINDING_STATES as readonly string[]).includes(value);
}
