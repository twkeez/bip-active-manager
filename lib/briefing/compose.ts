import type { ClientBriefing } from "@/lib/briefing/types";

/**
 * The briefing as two messages, written without a model.
 *
 * Two, because they are for different people and carry opposite halves of the
 * same data:
 *
 * - The client message shares what went well, in the shape the strategists
 *   already use in Basecamp: a greeting, what we have been working on, a few
 *   concrete numbers, an invitation to tell us what is coming up, a sign-off.
 * - The strategist note carries what needs doing and what we could not see.
 *   None of that reaches the practice from us; a strategist decides how and
 *   when to raise it, because they know what else is going on.
 *
 * Deterministic on purpose: the same numbers always produce the same words, so
 * what a practice receives can be checked against the data, and the fortnightly
 * rhythm never depends on an API key that might lapse.
 */

const LEVEL_MARK = { needs_you: "•", watch: "·", good: "+" } as const;

/** How the client message names what we have been doing for them. */
function servicesSentence(briefing: ClientBriefing): string {
  // Left as written, never lowercased: "seo, google ads" reads like a typo in
  // a message a practice owner opens.
  const labels = briefing.services.map((service) => service.label);
  if (labels.length === 0) return "your marketing";
  if (labels.length === 1) return labels[0];
  return `${labels.slice(0, -1).join(", ")} and ${labels.at(-1)}`;
}

function signOff(briefing: ClientBriefing): string {
  const names = briefing.strategists.map((person) => person.name);
  if (names.length === 0) return "The team at Beyond Indigo Pets";
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}

// ---------------------------------------------------------------------------
// To the practice
// ---------------------------------------------------------------------------

/**
 * Empty when there is not enough to say. A note scraping for one thin positive
 * is worse than no note: a practice paying every month can tell.
 */
export function composeClientMessage(briefing: ClientBriefing): string | null {
  if (!briefing.clientNoteReady) return null;

  const lines: string[] = [];
  // No contact name is stored, and guessing "Dr." from a practice name gets it
  // wrong often enough to matter, so the greeting is to the team. A strategist
  // can make it personal in the two seconds before they send it.
  lines.push(`Hi ${briefing.clientName} team,`);
  lines.push("");
  lines.push(
    `We've continued working on ${servicesSentence(briefing)} for you. A few highlights from the past month:`,
  );
  lines.push("");
  for (const highlight of briefing.highlights) lines.push(`• ${highlight.text}`);
  lines.push("");
  lines.push(
    "Please let us know if you have any questions, updates, upcoming promotions, or anything else you'd like us to focus on.",
  );
  lines.push("");
  lines.push("Take care,");
  lines.push(signOff(briefing));
  return lines.join("\n");
}

export function composeClientSubject(briefing: ClientBriefing): string {
  return `${briefing.clientName} — marketing update`;
}

// ---------------------------------------------------------------------------
// To the strategist
// ---------------------------------------------------------------------------

export function composeStrategistSubject(briefing: ClientBriefing): string {
  const needs = briefing.findings.filter((finding) => finding.level === "needs_you").length;
  if (needs > 0) return `${briefing.clientName}: ${needs} thing${needs === 1 ? "" : "s"} to look at`;
  if (briefing.blindSpots.length > 0) return `${briefing.clientName}: nothing to action, some gaps in what we can see`;
  return `${briefing.clientName}: nothing needs you`;
}

export function composeStrategistNote(briefing: ClientBriefing): string {
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

  lines.push("");
  lines.push(
    briefing.clientNoteReady
      ? `A client update is ready to send — ${briefing.highlights.length} highlights, all good news.`
      : "No client update this time: not enough went up to be worth sending.",
  );

  return lines.join("\n");
}
