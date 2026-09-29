import type { PoobahActor } from "./types";

/** "tom" for a person, "Claude (for tom)" for Claude acting for them. */
export function actorLabel(kind: PoobahActor["kind"] | null | undefined, email: string | null | undefined): string {
  const who = (email ?? "").split("@")[0] || "someone";
  return kind === "claude" ? `Claude (for ${who})` : who;
}

/** A date-and-time in Eastern, e.g. "Sep 29, 2:05 PM". */
export function whenEastern(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** A calendar date (YYYY-MM-DD) as "Sep 29, 2026", without shifting a day by time zone. */
export function calendarDate(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(`${value}T12:00:00Z`).toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
