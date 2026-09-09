import type { ClientActiveServices, ClientServiceKey } from "@/lib/clients/types";

/**
 * Plain-language definitions of the terms we use with clients.
 *
 * Kept as one shared list rather than a block of text per service, because the
 * expectations document covers every service a client bought and the vocabulary
 * overlaps: "impressions" means the same thing whether we are talking about
 * search or ads. Per-service text would print it twice in the same document and
 * invite the two copies to drift apart.
 *
 * A term with no services is general and always appears.
 */

export type GlossaryTerm = {
  id?: number;
  term: string;
  definition: string;
  /** Empty means "always include". */
  services: ClientServiceKey[];
  sortOrder: number;
};

const normalize = (term: string) => term.trim().toLowerCase();

/**
 * The terms worth printing for one client: general ones, plus those tagged with
 * a service they actually bought. Ordered as authored, then alphabetically, so
 * an unordered list still reads sensibly.
 */
export function selectGlossaryTerms(
  terms: GlossaryTerm[],
  activeServices: ClientActiveServices,
): GlossaryTerm[] {
  const active = new Set(
    (Object.keys(activeServices) as ClientServiceKey[]).filter((key) => activeServices[key]),
  );

  const kept: GlossaryTerm[] = [];
  const seen = new Set<string>();
  for (const term of terms) {
    const label = term.term.trim();
    const definition = term.definition.trim();
    if (!label || !definition) continue;

    const relevant = term.services.length === 0 || term.services.some((s) => active.has(s));
    if (!relevant) continue;

    // One entry per term. A duplicate is an authoring slip, and printing a term
    // twice with two definitions is worse than dropping the later one.
    const key = normalize(label);
    if (seen.has(key)) continue;
    seen.add(key);

    kept.push({ ...term, term: label, definition });
  }

  return kept.sort(
    (a, b) => a.sortOrder - b.sortOrder || a.term.localeCompare(b.term),
  );
}
