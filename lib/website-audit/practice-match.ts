import { US_STATES, statesNamedIn } from "@/lib/onboarding/research-location";
import type { AuditResults } from "@/lib/website-audit/types";

// Is the audit about one practice? It reads a website, a Google listing (from
// the client record, or found by name and town) and asks AI tools about a
// town. When the client record holds another practice's website or listing,
// every section is about a different business and nothing else says so
// (Edgewater, Oct 2026: an Alpharetta website, an Orlando listing, Indian Land
// questions). Worked out from the saved results, so older audits get it too.

export type MatchProblem = { what: "listing-website" | "listing-place" | "website-place"; detail: string };

const bareDomain = (d: string) =>
  d.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/[/?#].*$/, "");

/** The audit's state as a two-letter code ("SC" or "South Carolina" → "SC"), or null. */
function stateCode(state: string | null): string | null {
  const s = (state ?? "").trim();
  if (!s) return null;
  if (US_STATES[s.toUpperCase()]) return s.toUpperCase();
  return Object.entries(US_STATES).find(([, name]) => name.toLowerCase() === s.toLowerCase())?.[0] ?? null;
}

const named = (codes: string[]) => codes.map((c) => US_STATES[c]).join(" / ");

/** Everything that says the website, the Google listing and the town aren't the same practice. */
export function practiceMatchProblems(
  audit: { domain: string; city: string | null; state: string | null },
  results: AuditResults,
): MatchProblem[] {
  const problems: MatchProblem[] = [];
  const state = stateCode(audit.state);
  const town = [audit.city, state ?? audit.state].filter(Boolean).join(", ");
  const g = results.authority?.google;

  if (g?.listingWebsite && bareDomain(g.listingWebsite) !== bareDomain(audit.domain)) {
    problems.push({
      what: "listing-website",
      detail: `The Google listing (${g.listingName ?? "unnamed"}) links to ${bareDomain(g.listingWebsite)}, not ${bareDomain(audit.domain)}.`,
    });
  }

  if (state && g?.listingAddress) {
    const states = statesNamedIn(g.listingAddress);
    if (states.size && !states.has(state)) {
      problems.push({ what: "listing-place", detail: `The Google listing is at ${g.listingAddress}, in ${named([...states])}, not ${town}.` });
    }
  }

  const home = results.technical?.pages.find((p) => {
    try {
      return new URL(p.finalUrl || p.url).pathname === "/";
    } catch {
      return false;
    }
  });
  if (state && home) {
    const states = statesNamedIn(`${home.title ?? ""}\n${home.text}`);
    if (states.size && !states.has(state)) {
      problems.push({
        what: "website-place",
        detail: `The home page of ${bareDomain(audit.domain)} names ${named([...states])} and never ${US_STATES[state]}${home.title ? ` (its title: "${home.title}")` : ""}.`,
      });
    }
  }

  return problems;
}
