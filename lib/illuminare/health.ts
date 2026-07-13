// Per-client health roll-up for the Illuminare list. Pure so it can be unit-tested
// and reused on both the list page and (later) a portfolio dashboard.
//
// Inputs today: lifecycle status + deliverables (overdue projects, re-engagement
// follow-ups due, projects due soon). Basecamp comms staleness will feed in here
// once the Illuminare account is connected.
import {
  evaluateDeliverable,
  todayIso,
  type IlluminareDeliverableRow,
} from "@/lib/illuminare/deliverables";
import type { IlluminareClientRow } from "@/lib/illuminare/types";

export type HealthLevel = "attention" | "watch" | "on_track" | "inactive";

export const HEALTH_DUE_SOON_DAYS = 7;

export type ClientHealth = {
  clientId: number;
  level: HealthLevel;
  reasons: string[];
  followUpsDue: number;
  overdueProjects: number;
  dueSoonProjects: number;
};

function pluralize(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

export function computeClientHealth(
  client: Pick<IlluminareClientRow, "id" | "status">,
  deliverables: IlluminareDeliverableRow[],
  today: string = todayIso(),
): ClientHealth {
  // Paused / offboarded clients aren't actively scored.
  if (client.status === "paused" || client.status === "offboarded") {
    const label = client.status === "paused" ? "Paused" : "Offboarded";
    return {
      clientId: client.id,
      level: "inactive",
      reasons: [label],
      followUpsDue: 0,
      overdueProjects: 0,
      dueSoonProjects: 0,
    };
  }

  let followUpsDue = 0;
  let overdueProjects = 0;
  let dueSoonProjects = 0;

  for (const deliverable of deliverables) {
    const evaluation = evaluateDeliverable(deliverable, today);
    if (evaluation.needsFollowUp) followUpsDue += 1;
    if (evaluation.isOpenOneTime && evaluation.dueInDays != null) {
      if (evaluation.dueInDays < 0) overdueProjects += 1;
      else if (evaluation.dueInDays <= HEALTH_DUE_SOON_DAYS) dueSoonProjects += 1;
    }
  }

  const reasons: string[] = [];
  if (overdueProjects > 0) reasons.push(`${pluralize(overdueProjects, "project")} overdue`);
  if (followUpsDue > 0) reasons.push(`${followUpsDue} to check back in`);
  if (dueSoonProjects > 0) reasons.push(`${pluralize(dueSoonProjects, "project")} due soon`);

  let level: HealthLevel;
  if (overdueProjects > 0 || followUpsDue > 0) {
    level = "attention";
  } else if (dueSoonProjects > 0) {
    level = "watch";
  } else {
    level = "on_track";
  }

  if (level === "on_track") {
    reasons.push(client.status === "onboarding" ? "Onboarding" : "On track");
  }

  return {
    clientId: client.id,
    level,
    reasons,
    followUpsDue,
    overdueProjects,
    dueSoonProjects,
  };
}

export type HealthSummary = {
  attention: number;
  watch: number;
  onTrack: number;
  inactive: number;
};

export function summarizeHealth(healths: ClientHealth[]): HealthSummary {
  const summary: HealthSummary = { attention: 0, watch: 0, onTrack: 0, inactive: 0 };
  for (const health of healths) {
    if (health.level === "attention") summary.attention += 1;
    else if (health.level === "watch") summary.watch += 1;
    else if (health.level === "on_track") summary.onTrack += 1;
    else summary.inactive += 1;
  }
  return summary;
}

/** Sort order for the list: most-urgent clients first. */
export const HEALTH_RANK: Record<HealthLevel, number> = {
  attention: 0,
  watch: 1,
  on_track: 2,
  inactive: 3,
};
