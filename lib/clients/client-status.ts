import type { ClientRow } from "@/lib/types/client";

// The Clients page collapses every client into exactly one of three states.
// Deliberately simpler than the old alert/needs-reply treatment: comms urgency
// is monitored elsewhere, so this page answers "where is this client in its
// lifecycle" and nothing more.

export type ClientLifecycleStatus = "active" | "onboarding" | "launch";

export const CLIENT_STATUS_LABEL: Record<ClientLifecycleStatus, string> = {
  active: "Active",
  onboarding: "Onboarding",
  launch: "Pending launch",
};

/** Longer form, used on the summary widgets. */
export const CLIENT_STATUS_WIDGET_LABEL: Record<ClientLifecycleStatus, string> = {
  active: "Active clients",
  onboarding: "Onboarding",
  launch: "Pending website launch",
};

type StatusInput = Pick<ClientRow, "onboarding_status" | "awaiting_website_launch">;

/**
 * Precedence matters: a client waiting on their website is also mid-onboarding,
 * and the more specific state is the useful one — it says what is actually
 * blocking them.
 */
export function getClientLifecycleStatus(client: StatusInput): ClientLifecycleStatus {
  if (client.awaiting_website_launch) return "launch";
  if (client.onboarding_status === "active") return "onboarding";
  return "active";
}

/** Counts across the WHOLE book — widget numbers must not move while filtering. */
export function countByLifecycleStatus(
  clients: StatusInput[],
): Record<ClientLifecycleStatus, number> {
  const counts: Record<ClientLifecycleStatus, number> = { active: 0, onboarding: 0, launch: 0 };
  for (const c of clients) counts[getClientLifecycleStatus(c)] += 1;
  return counts;
}
