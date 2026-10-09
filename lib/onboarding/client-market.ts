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
  /**
   * What edits are keyed by, and never changes: the name the research gave
   * (parsed), or "added:<id>" for a competitor added by hand. The shown name
   * can be edited, so it can't be the key.
   */
  key: string;
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
 * Things written for our strategist, not the client: star ratings and review
 * counts (praise or criticism, a competitor's reviews are not ours to quote),
 * and positioning advice. Remedy's 2026-10-09 research printed "its low Yelp
 * rating (2.9 stars) … can carve clear space as the friendlier alternative"
 * and "a key referral relationship to cultivate" in the client's document.
 */
const STRATEGIST_ONLY =
  /\b(yelp|ratings?|rated|stars?|reviews?|compet\w*|challeng\w*|advantage\w*|differentiat\w*|position(ing)?\s+(against|itself|as)|positioning|carve\w*|cultivat\w*|should|could|opportunit\w*|threat\w*|captur\w*|win\s+(over|back)|outrank\w*|weak\w*|dominan\w*|dominat\w*|revenue|(low|limited|minimal|poor)\s+(digital|online|web|review|search)\b|(digital|online)\s+(footprint|visibility))\b/i;

/**
 * Research sentences run long — the first sentence of each Tiburon competitor
 * was 250 to 330 characters. A limit below that cut every one mid-phrase
 * ("offers cancer therapy, exotic animal care, advanced…"), which reads as
 * broken in a client document. So a whole sentence is shown whenever it fits,
 * and only a genuinely long one is shortened, at a clause break.
 */
const MAX_DESCRIPTION = 420;
const MIN_USEFUL = 60;
/** A sentence cut back before strategist-only wording may be shorter: "Alto Tiburon has operated since 1974." */
const MIN_CUT = 30;

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

/** The client's own name and short forms ("Remedy", "VUC"): research about others shouldn't talk about them. */
export function selfReferencePattern(clientName: string | null | undefined): RegExp | null {
  const words = (clientName ?? "").split(/[^A-Za-z0-9&']+/).filter(Boolean);
  const generic = /^(the|of|and|&|veterinary|vet|animal|pet|pets|hospital|clinic|care|center|centre|urgent|emergency|services?|practice|group|medical)$/i;
  const distinctive = words.filter((word) => word.length >= 4 && !generic.test(word));
  // Short forms researchers coin: "AMH" for Animal Medical Hospital, "VUC"
  // for Remedy Veterinary Urgent Care. Initials of the first words, and of
  // the words after the first, three letters or more.
  const letters = words.filter((word) => /^[A-Za-z]/.test(word)).map((word) => word[0].toUpperCase());
  const initials = new Set<string>();
  for (let n = 3; n <= letters.length; n += 1) initials.add(letters.slice(0, n).join(""));
  for (let n = 3; n <= letters.length - 1; n += 1) initials.add(letters.slice(1, n + 1).join(""));
  const terms = [...distinctive, ...initials].map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return terms.length ? new RegExp(`\\b(${terms.join("|")})\\b`, "i") : null;
}

/** The first problem in a sentence: review talk, strategist-only wording, or the client named. */
function firstProblem(sentence: string, self: RegExp | null): number {
  const found = [UNSUITABLE, STRATEGIST_ONLY, self]
    .map((pattern) => (pattern ? pattern.exec(sentence)?.index ?? -1 : -1))
    .filter((index) => index >= 0);
  return found.length ? Math.min(...found) : -1;
}

/**
 * The first sentence fit for a client to read, or null. A sentence that
 * starts with neutral facts and drifts into ratings or positioning advice is
 * cut at the last clause break before the drift ("A family-owned GP since
 * 1952 at 9011 Harford Rd, …"); if too little is left, it is skipped.
 */
export function clientSafeDescription(note: string | null | undefined, clientName?: string | null): string | null {
  if (!note?.trim()) return null;
  const self = selfReferencePattern(clientName);
  for (const sentence of sentences(note)) {
    const at = firstProblem(sentence, self);
    if (at < 0) {
      const short = shortenAtClause(sentence, MAX_DESCRIPTION);
      if (short) return short;
      continue;
    }
    const before = sentence.slice(0, at);
    const cut = Math.max(
      ...[", ", " — ", "; ", " (", " with ", " and ", " offering ", " making ", " though ", " which "].map((mark) => before.lastIndexOf(mark)),
    );
    if (cut < MIN_CUT) continue;
    const clause = before
      .slice(0, cut)
      .replace(/\s+(and|or|with|including|such as|while|but|making|though|which|whose)$/i, "")
      .replace(/[,;:\s—(-]+$/, "");
    if (clause.length >= MIN_CUT) return shortenAtClause(clause.endsWith(".") ? clause : `${clause}.`, MAX_DESCRIPTION);
  }
  return null;
}

export function buildClientMarket(discovery: DiscoveryResearch, clientName?: string | null): ClientMarket | null {
  if (!discovery) return null;
  const snapshot = discovery.marketSnapshot?.trim() ?? "";
  const landscape = discovery.searchLandscape?.trim() ?? "";
  const competitors = (discovery.competitors ?? [])
    .filter((competitor) => competitor.name?.trim())
    .map((competitor) => {
      const parsed = parseCompetitorName(competitor.name!);
      return { key: parsed.name, ...parsed, description: clientSafeDescription(competitor.note, clientName) };
    });

  if (!snapshot && !landscape && competitors.length === 0) return null;
  return { snapshot, landscape, competitors };
}
