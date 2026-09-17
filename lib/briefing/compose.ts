import type { ClientBriefing } from "@/lib/briefing/types";

/**
 * The briefing as words, written without a model.
 *
 * Deliberately deterministic: the same numbers always produce the same note, so
 * what a strategist reads can be checked against the data, and a run costs
 * nothing. A model may polish this later — it has a genuine advantage in
 * phrasing three findings as prose — but the note must never *depend* on one,
 * or a lapsed API key silently ends the fortnightly rhythm.
 *
 * The shape is fixed on purpose. Someone reading their fourth of these should
 * find the answer in the same place every time.
 */

const LEVEL_MARK = { needs_you: "•", watch: "·", good: "+" } as const;

export function composeSubject(briefing: ClientBriefing): string {
  const needs = briefing.findings.filter((finding) => finding.level === "needs_you").length;
  if (needs > 0) return `${briefing.clientName}: ${needs} thing${needs === 1 ? "" : "s"} to look at`;
  if (briefing.blindSpots.length > 0) return `${briefing.clientName}: nothing to action, some gaps in what we can see`;
  return `${briefing.clientName}: nothing needs you`;
}

export function composeNote(briefing: ClientBriefing): string {
  const lines: string[] = [];
  const services = briefing.services.map((service) => service.label).join(", ") || "no active services";
  lines.push(`${briefing.clientName} — ${services}`);
  lines.push("");

  if (briefing.findings.length === 0) {
    lines.push("Nothing needs you this fortnight.");
  } else {
    if (briefing.quiet) lines.push("Nothing needs action. Worth knowing:");
    for (const finding of briefing.findings) {
      const metric = finding.metric ? ` (${finding.metric})` : "";
      lines.push(`${LEVEL_MARK[finding.level]} ${finding.headline}${metric}`);
      if (finding.detail) lines.push(`    ${finding.detail}`);
    }
  }

  // Always last, always present when true. A note that omits this is a note
  // that says "all fine" about a client we cannot see.
  if (briefing.blindSpots.length > 0) {
    lines.push("");
    lines.push("What we could not see:");
    for (const spot of briefing.blindSpots) {
      const since = spot.lastSeen ? ` — last data ${spot.lastSeen.slice(0, 10)}` : "";
      lines.push(`- ${spot.source}: ${spot.reason}${since}`);
    }
  }

  return lines.join("\n");
}
