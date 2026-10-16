import { distinctiveTokens, matchToMasterSheet, type MasterSheetRow } from "@/lib/clients/master-sheet";
import {
  emailDomain,
  FREE_EMAIL_DOMAINS,
  isIgnorableDomain,
  isSystemSender,
  normalizeDomain,
} from "@/lib/help-desk/domains";

/**
 * Loose matching for people the strict rules could not place — a guess, with
 * how sure it is and why, for someone to approve on the Unmatched tab.
 *
 * The strict rules only trust a website domain or an exact name. But clients
 * leave plenty of looser clues: "quitmananimalclinic@gmail.com" is plainly
 * Quitman Animal Clinic, and "quitmanvet@yahoo.com" very probably is. This
 * compares what we know about a person — the email's local part, any
 * non-mailbox domain, their Zendesk name and organization, sites they
 * mentioned, ticket subjects — against each practice's name and web address
 * with spaces and punctuation removed.
 *
 *   High   — a clue IS the practice's name or web address
 *            (quitmananimalclinic@gmail.com → "Quitman Animal Clinic")
 *   Medium — a clue contains the identifying part of the name
 *            (quitmanvet@yahoo.com → "Quitman"), or a subject names the practice
 *   Low    — partial or name-similarity evidence; worth a look, often wrong
 *
 * Lessons from the first live run, each a rule below:
 * - Words like "village", "choice", "funeral" identify nothing; they are
 *   ignored when deciding what a name's identifying part is.
 * - A name with no identifying part ("Animal Medical Center", "East Side
 *   Animal Hospital") is capped at Medium even on an exact hit — "Nebraska
 *   Animal Medical Center" contains it and is a different business.
 * - Sites mentioned in tickets count only on an exact hit, and not at all
 *   when the person mentions several practices' sites (vendors, staff).
 * - Machine senders (voicemail-to-email, no-reply) get no guess.
 * When two practices fit equally well the guess is marked Low and the other
 * is named, so nobody approves a coin toss.
 */

export type Confidence = "High" | "Medium" | "Low";

export type Suggestion = {
  practice: MasterSheetRow;
  confidence: Confidence;
  reason: string;
};

export type SuggestionHints = {
  email?: string | null;
  requesterName?: string | null;
  organizationName?: string | null;
  mentionedDomains?: string[];
  subjects?: string[];
};

const RANK: Record<Confidence, number> = { High: 3, Medium: 2, Low: 1 };

/**
 * Words that appear in many practice names, or in ordinary text, and so say
 * nothing about which practice is meant. On top of the Master Sheet's own
 * generic list ("animal", "hospital", "vet"...).
 */
const COMMON_WORDS = new Set([
  "north", "south", "east", "west", "northeast", "northwest", "southeast", "southwest",
  "central", "side", "eastside", "westside", "downtown", "uptown", "midtown",
  "city", "county", "country", "town", "village", "valley", "creek", "river", "lake",
  "lakes", "lakeside", "park", "hill", "hills", "mountain", "mountains", "mountainview",
  "bay", "coast", "shore", "point", "ridge", "spring", "springs", "forest", "oaks",
  "pine", "pines", "cedar", "meadow", "meadows", "view", "crossing", "station",
  "road", "street", "avenue", "main", "heart", "friends", "friend", "best", "choice",
  "premier", "quality", "complete", "total", "advanced", "modern", "caring", "loving",
  "gentle", "happy", "healthy", "neighborhood", "community", "foundation", "associates",
  "partners", "veterinarian", "veterinary", "doctor", "doctors", "dental", "rehab",
  "rehabilitation", "therapy", "funeral", "funerals", "cremation", "crematorium",
  "crematory", "memorial", "memorials", "home", "homes", "society", "credit", "union",
  "corporate", "healthcare", "inc", "embrace", "spirit", "eagle", "place", "steps",
  "canine", "feline", "equine", "exotic", "pets", "paws", "critter", "critters", "vetcare",
]);

/** "Quitman Animal Clinic (MS)" → "quitmananimalclinic". */
export function compact(value: string | null | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]/g, "");
}

/** The words that pick out one practice: "Quitman Animal Clinic" → ["quitman"]. */
export function identifyingWords(practiceName: string): string[] {
  return [...distinctiveTokens(practiceName)].filter((t) => t.length >= 4 && !COMMON_WORDS.has(t));
}

type PracticeKeys = {
  practice: MasterSheetRow;
  name: string;
  stem: string | null;
  core: string[];
};

function keysFor(practice: MasterSheetRow): PracticeKeys {
  const domain = normalizeDomain(practice.url);
  return {
    practice,
    name: compact(practice.practiceName),
    stem: domain ? domain.split(".")[0]!.replace(/[^a-z0-9]/g, "") : null,
    core: identifyingWords(practice.practiceName),
  };
}

type Clue = {
  text: string;
  label: string;
  /** A site mentioned in a ticket, not the person's own address or name. */
  mentioned: boolean;
  /**
   * Names another business (their own email domain, their Zendesk org): one
   * that merely shares a place name with a practice is usually a different
   * business.
   */
  otherBusiness?: boolean;
};

function cluesFrom(hints: SuggestionHints): Clue[] {
  const clues: Clue[] = [];
  const email = (hints.email ?? "").trim().toLowerCase();
  if (email.includes("@")) {
    const local = compact(email.split("@")[0]);
    if (local) clues.push({ text: local, label: `email ${email}`, mentioned: false });
    const domain = emailDomain(email);
    if (domain && !FREE_EMAIL_DOMAINS.has(domain) && !isIgnorableDomain(domain)) {
      clues.push({ text: compact(domain.split(".")[0]), label: `email domain ${domain}`, mentioned: false, otherBusiness: true });
    }
  }
  for (const domain of hints.mentionedDomains ?? []) {
    const d = normalizeDomain(domain);
    // A practice's own subdomain on a vendor platform names it:
    // "fischerveterinaryclinic.ourvet.com".
    if (d && !isIgnorableDomain(d)) clues.push({ text: compact(d.split(".")[0]), label: `mentioned ${d}`, mentioned: true });
  }
  if (hints.requesterName) clues.push({ text: compact(hints.requesterName), label: `Zendesk name "${hints.requesterName}"`, mentioned: false });
  if (hints.organizationName) clues.push({ text: compact(hints.organizationName), label: `Zendesk org "${hints.organizationName}"`, mentioned: false, otherBusiness: true });
  return clues.filter((c) => c.text.length >= 4);
}

type Candidate = { practice: MasterSheetRow; confidence: Confidence; reason: string; strength: number };

/** A name with no identifying word cannot be trusted past `cap`. */
function capped(keys: PracticeKeys, wanted: Confidence, cap: Confidence): Confidence {
  if (keys.core.length > 0) return wanted;
  return RANK[wanted] > RANK[cap] ? cap : wanted;
}

function score(keys: PracticeKeys, clues: Clue[], subjects: string[]): Candidate | null {
  let best: Candidate | null = null;
  const consider = (confidence: Confidence, reason: string, strength: number) => {
    const current = best as Candidate | null;
    if (!current || RANK[confidence] > RANK[current.confidence] || (RANK[confidence] === RANK[current.confidence] && strength > current.strength)) {
      best = { practice: keys.practice, confidence, reason, strength };
    }
  };
  const coreLength = keys.core.join("").length;

  for (const clue of clues) {
    const t = clue.text;
    // High: the clue is the name or the web address, or plainly contains it.
    if (keys.name.length >= 6 && t === keys.name) {
      consider(capped(keys, "High", "Medium"), `${clue.label} is the practice name`, t.length + 100);
    } else if (keys.stem && keys.stem.length >= (clue.mentioned ? 8 : 6) && t === keys.stem) {
      // A short web name on a different ending ("allpet.com" vs "allpet.net")
      // is a different site, so mentioned sites need a longer exact name.
      consider("High", `${clue.label} is the practice's web address`, t.length + 100);
    } else if (keys.name.length >= 10 && t.includes(keys.name)) {
      consider(capped(keys, "High", "Low"), `${clue.label} contains the practice name`, keys.name.length + 50);
    } else if (keys.stem && keys.stem.length >= 8 && t.includes(keys.stem)) {
      consider(capped(keys, "High", "Low"), `${clue.label} contains the practice's web address`, keys.stem.length + 50);
    } else if (clue.mentioned) {
      // Sites mentioned in passing only count on an exact hit (above).
      continue;
    } else if (keys.core.length && coreLength >= 6 && keys.core.every((w) => t.includes(w))) {
      // Medium: the identifying part of the name is in the clue — Low when the
      // clue names another business ("Arlington Heights Veterinary Hospital"
      // vs Arlington Animal Hospital).
      consider(clue.otherBusiness ? "Low" : "Medium", `${clue.label} contains "${keys.core.join(" ")}"`, coreLength);
    } else if (keys.core.length && t.length >= 8 && (keys.name.includes(t) || (keys.stem?.includes(t) ?? false))) {
      consider(clue.otherBusiness ? "Low" : "Medium", `${clue.label} is part of the practice name`, t.length);
    } else {
      // Low: some, not all, of the identifying words.
      const hits = keys.core.filter((w) => w.length >= 5 && t.includes(w));
      if (hits.length) consider("Low", `${clue.label} contains "${hits.join(" ")}"`, hits.join("").length);
    }
  }

  if (keys.core.length && keys.name.length >= 10) {
    const subject = subjects.find((s) => compact(s).includes(keys.name));
    if (subject) consider("Medium", `a ticket subject names the practice ("${subject.slice(0, 60)}")`, keys.name.length);
  }
  return best;
}

let cachedPractices: MasterSheetRow[] | null = null;
let cachedKeys: PracticeKeys[] = [];

function keysOf(practices: MasterSheetRow[]) {
  if (cachedPractices !== practices) {
    cachedPractices = practices;
    cachedKeys = practices.map(keysFor);
  }
  return cachedKeys;
}

export function suggestPracticeForRequester(practices: MasterSheetRow[], hints: SuggestionHints): Suggestion | null {
  if (isSystemSender(hints.email, hints.requesterName)) return null;
  const allKeys = keysOf(practices);
  const clues = cluesFrom(hints);
  const subjects = hints.subjects ?? [];

  // Someone whose tickets mention several practices' sites works with many
  // practices (a vendor, a freelancer); their mentions identify none of them.
  const mentioned = clues.filter((c) => c.mentioned);
  const mentionedPractices = new Set(
    allKeys
      .filter((k) => mentioned.some((c) => c.text === k.name || (k.stem && c.text === k.stem) || (k.stem && k.stem.length >= 8 && c.text.includes(k.stem))))
      .map((k) => k.practice),
  );
  const usable = mentionedPractices.size > 1 ? clues.filter((c) => !c.mentioned) : clues;

  const candidates = allKeys
    .map((keys) => score(keys, usable, subjects))
    .filter((c): c is Candidate => c !== null)
    .sort((a, b) => RANK[b.confidence] - RANK[a.confidence] || b.strength - a.strength);

  if (candidates.length === 0) {
    // Last resort: the organization's name is close to a practice's name.
    if (hints.organizationName) {
      const near = matchToMasterSheet(hints.organizationName, practices);
      const row = near.row ?? near.nearest?.row;
      if (row) return { practice: row, confidence: "Low", reason: `Zendesk org "${hints.organizationName}" has a similar name` };
    }
    return null;
  }

  const [top, runnerUp] = candidates;
  if (runnerUp && RANK[runnerUp.confidence] === RANK[top!.confidence] && runnerUp.strength === top!.strength) {
    return {
      practice: top!.practice,
      confidence: "Low",
      reason: `${top!.reason} — but fits "${runnerUp.practice.practiceName}" just as well`,
    };
  }
  return { practice: top!.practice, confidence: top!.confidence, reason: top!.reason };
}
