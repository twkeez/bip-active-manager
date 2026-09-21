import type { SupabaseClient } from "@supabase/supabase-js";
import { loadClientBriefing } from "@/lib/briefing/load";
import type { RoutineFinding, RoutineResult } from "@/lib/routines/types";

/**
 * A few clients, watched closely.
 *
 * The twice-monthly briefings cover everyone at a fortnightly pace. Some
 * clients need more than that — a group being onboarded, an account under
 * scrutiny, the practices that keep turning up in the same problems. This
 * watches a chosen list every day and reports only what needs somebody.
 *
 * It reuses the briefing engine rather than judging anything itself, so a
 * client cannot be told one thing by the briefing and another by the watch,
 * and so a run costs nothing: every number comes from data we already store.
 */

export type ClientWatchSettings = {
  clientIds: number[];
  /** Include things worth keeping an eye on, not only what needs action. */
  includeWatchItems: boolean;
};

export function readSettings(raw: Record<string, unknown>): ClientWatchSettings {
  const ids = Array.isArray(raw.clientIds)
    ? raw.clientIds.map(Number).filter((id) => Number.isInteger(id) && id > 0)
    : [];
  return {
    clientIds: [...new Set(ids)],
    includeWatchItems: raw.includeWatchItems !== false,
  };
}

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

export async function runClientWatch(
  supabase: SupabaseClient,
  rawSettings: Record<string, unknown>,
): Promise<RoutineResult> {
  const settings = readSettings(rawSettings);
  if (settings.clientIds.length === 0) {
    return {
      status: "ok",
      headline: "No clients are being watched yet — choose some on the right.",
      findings: [],
    };
  }

  const findings: RoutineFinding[] = [];
  const needing = new Set<number>();
  let checked = 0;
  const unseen: string[] = [];

  for (const clientId of settings.clientIds) {
    const briefing = await loadClientBriefing(supabase, clientId);
    if (!briefing) continue;
    checked += 1;

    for (const finding of briefing.findings) {
      if (finding.level === "good") continue;
      if (finding.level === "watch" && !settings.includeWatchItems) continue;
      if (finding.level === "needs_you") needing.add(clientId);
      findings.push({
        group: briefing.clientName,
        label: finding.headline,
        meta: [finding.scope.toUpperCase(), finding.metric, finding.detail].filter(Boolean).join(" · "),
        href: `/dashboard/clients/${clientId}`,
        flagged: finding.level === "needs_you",
      });
    }

    // Said once per client rather than per source: a client we cannot see is
    // one fact, and the daily repetition of three lines about it is noise.
    if (briefing.blindSpots.length > 0) {
      findings.push({
        group: briefing.clientName,
        label: `We cannot see ${briefing.blindSpots.map((spot) => spot.source).join(", ")}`,
        meta: briefing.blindSpots.map((spot) => spot.reason).join(" · "),
        href: `/dashboard/clients/${clientId}`,
      });
      unseen.push(briefing.clientName);
    }
  }

  if (findings.length === 0) {
    return {
      status: "ok",
      headline: `Nothing needs you across ${plural(checked, "watched client")}.`,
      findings: [],
    };
  }

  const parts = [
    needing.size > 0 ? `${plural(needing.size, "client")} need something` : null,
    unseen.length > 0 ? `${unseen.length} with data we cannot see` : null,
  ].filter(Boolean);

  return {
    status: needing.size > 0 ? "attention" : "ok",
    headline: `${parts.join(", ") || `${findings.length} things to know`} — ${plural(checked, "client")} checked.`,
    findings,
  };
}
