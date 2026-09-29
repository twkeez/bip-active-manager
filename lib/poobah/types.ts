// Poobah Client Watch: Tom's notebook per watched client. Separate from the
// daily "Client watch" routine (lib/routines/kinds/client-watch.ts).

export const POOBAH_NAME = "Poobah Client Watch";

/** Who made a change: a person in the app, or Claude acting for a person. */
export type PoobahActor = { kind: "person" | "claude"; email: string };

export type PoobahWatch = {
  id: number;
  client_id: number | null;
  name: string;
  basics: string;
  created_at: string;
  created_by_kind: PoobahActor["kind"];
  created_by_email: string;
  updated_at: string;
};

export type PoobahStatus = {
  id: number;
  watch_id: number;
  status: string;
  set_at: string;
  set_by_kind: PoobahActor["kind"];
  set_by_email: string;
};

export type PoobahItem = {
  id: number;
  watch_id: number;
  text: string;
  owner: string | null;
  due_date: string | null;
  done: boolean;
  done_at: string | null;
  done_by_kind: PoobahActor["kind"] | null;
  done_by_email: string | null;
  created_at: string;
  created_by_kind: PoobahActor["kind"];
  created_by_email: string;
  updated_at: string;
};

export type PoobahLogEntry = {
  id: number;
  watch_id: number;
  entry_date: string;
  text: string;
  source: string;
  created_at: string;
  created_by_kind: PoobahActor["kind"];
  created_by_email: string;
};

export type PoobahChange = {
  id: number;
  watch_id: number;
  entity: string;
  entity_id: number | null;
  action: string;
  before: unknown;
  after: unknown;
  actor_kind: PoobahActor["kind"];
  actor_email: string;
  at: string;
};

/**
 * The linked BIP Control client's lifecycle, read live from the clients table
 * every time (never stored here), by the same rule as the Clients page
 * (lib/clients/client-status.ts). "launch" is onboarding, waiting on the
 * website. null: not a BIP client (e.g. a prospect).
 */
export type PoobahBipStatus = "onboarding" | "launch" | "active" | null;

export const BIP_STATUS_LABEL: Record<Exclude<PoobahBipStatus, null>, string> = {
  onboarding: "Onboarding",
  launch: "Pending launch",
  active: "Active",
};

export function bipStatusLabel(status: PoobahBipStatus): string {
  return status ? BIP_STATUS_LABEL[status] : "Not a BIP client";
}

export type PoobahSummary = {
  id: number;
  name: string;
  client_id: number | null;
  client_name: string | null;
  bip_status: PoobahBipStatus;
  bip_status_label: string;
  status: string | null;
  status_set_at: string | null;
  open_items: number;
  last_log_date: string | null;
  updated_at: string;
};

export type PoobahDetail = {
  watch: PoobahWatch;
  client: { id: number; name: string; bip_status: Exclude<PoobahBipStatus, null>; bip_status_label: string } | null;
  /** Newest first; the first is the current status. */
  statuses: PoobahStatus[];
  /** Open first (oldest first), then done (most recently done first). */
  items: PoobahItem[];
  /** Newest first. */
  log: PoobahLogEntry[];
  /** Newest first. */
  changes: PoobahChange[];
};

/** Where a log entry came from. Free text is allowed; these are the usual ones. */
export const LOG_SOURCES = ["email", "Basecamp", "meeting", "call", "Claude", "note"] as const;

export const LIMITS = { name: 200, status: 4000, basics: 20000, text: 4000, owner: 200, source: 60 } as const;
