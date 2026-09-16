/**
 * The part of onboarding research a client gets to read.
 *
 * Discovery research is written for the strategist: it names competitors, what
 * their reviews complain about, and how to beat them. Tom chose (2026-09-16) to
 * show clients the market summary, the search landscape and the names of nearby
 * practices — and to keep offers, counter-strategies and campaign detail
 * internal. Everything here exists to make that line hold even when the
 * research wording varies from client to client.
 */

export type DiscoveryResearch = {
  competitors?: Array<{ name?: string; note?: string }>;
  marketSnapshot?: string;
  searchLandscape?: string;
} | null;

export type ClientCompetitor = {
  name: string;
  /** "Mill Valley, CA", when the research gave one. */
  location: string | null;
  /** One neutral sentence, or null when nothing suitable was left. */
  description: string | null;
};

export type ClientMarket = {
  snapshot: string;
  landscape: string;
  competitors: ClientCompetitor[];
};

/**
 * Sentences that talk about another practice's reviews, prices or conduct.
 *
 * Research notes sometimes quote review sentiment ("some clients calling
 * emergency visit costs 'exorbitant'"). That is useful to a strategist and
 * unkind — and not ours to repeat — in a document the practice may forward.
 * Neutral mentions of visibility ("highly visible Yelp and Google rankings")
 * are left alone.
 */
const UNSUITABLE =
  /\b(complain\w*|exorbitant|overpric\w*|expensive|pric(e|es|ing)\s+concerns?|negative|bad reviews?|poor reviews?|one-star|1-star|rude|unprofessional|lawsuit|malpractice|scathing|criticis\w*|dissatisf\w*|mixed reviews?|low(er)? ratings?)\b/i;

/**
 * Research sentences run long — the first sentence of each Tiburon competitor
 * was 250 to 330 characters. A limit below that cut every one mid-phrase
 * ("offers cancer therapy, exotic animal care, advanced…"), which reads as
 * broken in a client document. So a whole sentence is shown whenever it fits,
 * and only a genuinely long one is shortened, at a clause break.
 */
const MAX_DESCRIPTION = 420;
const MIN_USEFUL = 60;

/** "Alto Tiburon Veterinary Hospital (Mill Valley, CA)" → name and location. */
export function parseCompetitorName(raw: string): { name: string; location: string | null } {
  const trimmed = raw.trim();
  const match = /^(.*?)\s*\(([^()]+)\)\s*$/.exec(trimmed);
  return match ? { name: match[1].trim(), location: match[2].trim() } : { name: trimmed, location: null };
}

function sentences(text: string): string[] {
  // A full stop inside "Dr.", "Ave." or an address's "15200 S. Jog Rd" must not
  // end a sentence: splitting there printed PAWS's competitors as "Situated at
  // 15200 S." Single capital letters cover street directions and initials.
  return text
    .replace(/\b(Dr|St|Mr|Mrs|Ms|Jr|Sr|Ave|Rd|Blvd|Hwy|Pkwy|Ste|Ln|Ct|Pl|Mt|Ft|Inc|Co|No|vs|[A-Z])\./g, "$1․")
    .split(/(?<=[.!?])\s+(?=[A-Z"“])/)
    .map((sentence) => sentence.replace(/․/g, ".").trim())
    .filter(Boolean);
}

/**
 * A sentence that fits, or the same sentence ended at its last clause break
 * before the limit. Never a trailing ellipsis mid-phrase: if there is no clean
 * place to stop, the description is left out and the practice's name stands
 * alone.
 */
function shortenAtClause(text: string, max: number): string | null {
  if (text.length <= max) return text;
  const window = text.slice(0, max);
  const breaks = [window.lastIndexOf(", "), window.lastIndexOf(" — "), window.lastIndexOf("; ")];
  const at = Math.max(...breaks);
  if (at < MIN_USEFUL) return null;
  const clause = window
    .slice(0, at)
    .replace(/\s+(and|or|with|including|such as|while|but)$/i, "")
    .replace(/[,;:\s—-]+$/, "");
  return clause.length >= MIN_USEFUL ? `${clause}.` : null;
}

/** The first sentence fit for a client to read, or null. */
export function clientSafeDescription(note: string | null | undefined): string | null {
  if (!note?.trim()) return null;
  const suitable = sentences(note).find((sentence) => !UNSUITABLE.test(sentence));
  return suitable ? shortenAtClause(suitable, MAX_DESCRIPTION) : null;
}

export function buildClientMarket(discovery: DiscoveryResearch): ClientMarket | null {
  if (!discovery) return null;
  const snapshot = discovery.marketSnapshot?.trim() ?? "";
  const landscape = discovery.searchLandscape?.trim() ?? "";
  const competitors = (discovery.competitors ?? [])
    .filter((competitor) => competitor.name?.trim())
    .map((competitor) => ({
      ...parseCompetitorName(competitor.name!),
      description: clientSafeDescription(competitor.note),
    }));

  if (!snapshot && !landscape && competitors.length === 0) return null;
  return { snapshot, landscape, competitors };
}
