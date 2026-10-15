import { distinctiveTokens, matchToMasterSheet, type MasterSheetRow } from "@/lib/clients/master-sheet";
import { emailDomain, FREE_EMAIL_DOMAINS, isIgnorableDomain, normalizeDomain } from "@/lib/help-desk/domains";

/**
 * Loose matching for people the strict rules could not place — a guess, with
 * how sure it is and why, for someone to approve on the Unmatched tab.
 *
 * The strict rules only trust a website domain or an exact name. But clients
 * leave plenty of looser clues: "quitmananimalclinic@gmail.com" is plainly
 * Quitman Animal Clinic, and "quitmanvet@yahoo.com" very probably is. This
 * compares everything we know about a person — the email's local part, any
 * non-mailbox domain, their Zendesk name and organization, sites they
 * mentioned, ticket subjects — against each practice's name and web address
 * with spaces and punctuation removed.
 *
 *   High   — a clue IS the practice's name or web address
 *            (quitmananimalclinic@gmail.com → "Quitman Animal Clinic")
 *   Medium — a clue contains the distinctive part of the name
 *            (quitmanvet@yahoo.com → "Quitman"), or a subject names the practice
 *   Low    — partial or name-similarity evidence; worth a look, often wrong
 *
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

/** "Quitman Animal Clinic (MS)" → "quitmananimalclinic". */
export function compact(value: string | null | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]/g, "");
}

type PracticeKeys = {
  practice: MasterSheetRow;
  name: string;
  stem: string | null;
  /** The identifying words, e.g. ["quitman"]; generic ones like "animal" removed. */
  core: string[];
};

function keysFor(practice: MasterSheetRow): PracticeKeys {
  const domain = normalizeDomain(practice.url);
  return {
    practice,
    name: compact(practice.practiceName),
    stem: domain ? domain.split(".")[0]!.replace(/[^a-z0-9]/g, "") : null,
    core: [...distinctiveTokens(practice.practiceName)].filter((t) => t.length >= 4),
  };
}

type Clue = { text: string; label: string };

function cluesFrom(hints: SuggestionHints): Clue[] {
  const clues: Clue[] = [];
  const email = (hints.email ?? "").trim().toLowerCase();
  if (email.includes("@")) {
    const local = compact(email.split("@")[0]);
    if (local) clues.push({ text: local, label: `email ${email}` });
    const domain = emailDomain(email);
    if (domain && !FREE_EMAIL_DOMAINS.has(domain) && !isIgnorableDomain(domain)) {
      clues.push({ text: compact(domain.split(".")[0]), label: `email domain ${domain}` });
    }
  }
  for (const domain of hints.mentionedDomains ?? []) {
    const d = normalizeDomain(domain);
    if (d && !isIgnorableDomain(d)) clues.push({ text: compact(d.split(".")[0]), label: `mentioned ${d}` });
  }
  if (hints.requesterName) clues.push({ text: compact(hints.requesterName), label: `Zendesk name "${hints.requesterName}"` });
  if (hints.organizationName) clues.push({ text: compact(hints.organizationName), label: `Zendesk org "${hints.organizationName}"` });
  return clues.filter((c) => c.text.length >= 4);
}

type Candidate = { practice: MasterSheetRow; confidence: Confidence; reason: string; strength: number };

function score(keys: PracticeKeys, clues: Clue[], subjects: string[]): Candidate | null {
  let best: Candidate | null = null;
  const consider = (confidence: Confidence, reason: string, strength: number) => {
    if (!best || RANK[confidence] > RANK[best.confidence] || (RANK[confidence] === RANK[best.confidence] && strength > best.strength)) {
      best = { practice: keys.practice, confidence, reason, strength };
    }
  };
  const coreLength = keys.core.join("").length;

  for (const clue of clues) {
    const t = clue.text;
    // High: the clue is the name or the web address, or plainly contains it.
    if (keys.name.length >= 6 && t === keys.name) consider("High", `${clue.label} is the practice name`, t.length + 100);
    else if (keys.stem && keys.stem.length >= 6 && t === keys.stem) consider("High", `${clue.label} is the practice's web address`, t.length + 100);
    else if (keys.name.length >= 10 && t.includes(keys.name)) consider("High", `${clue.label} contains the practice name`, keys.name.length + 50);
    else if (keys.stem && keys.stem.length >= 8 && t.includes(keys.stem)) consider("High", `${clue.label} contains the practice's web address`, keys.stem.length + 50);
    // Medium: the identifying part of the name is in the clue.
    else if (keys.core.length && coreLength >= 6 && keys.core.every((w) => t.includes(w))) {
      consider("Medium", `${clue.label} contains "${keys.core.join(" ")}"`, coreLength);
    } else if (t.length >= 8 && (keys.name.includes(t) || (keys.stem?.includes(t) ?? false))) {
      consider("Medium", `${clue.label} is part of the practice name`, t.length);
    }
    // Low: some, not all, of the identifying words.
    else {
      const hits = keys.core.filter((w) => w.length >= 5 && t.includes(w));
      if (hits.length) consider("Low", `${clue.label} contains "${hits.join(" ")}"`, hits.join("").length);
    }
  }

  if (keys.name.length >= 10) {
    const subject = subjects.find((s) => compact(s).includes(keys.name));
    if (subject) consider("Medium", `a ticket subject names the practice ("${subject.slice(0, 60)}")`, keys.name.length);
  }
  return best;
}

let cachedPractices: MasterSheetRow[] | null = null;
let cachedKeys: PracticeKeys[] = [];

export function suggestPracticeForRequester(practices: MasterSheetRow[], hints: SuggestionHints): Suggestion | null {
  if (cachedPractices !== practices) {
    cachedPractices = practices;
    cachedKeys = practices.map(keysFor);
  }
  const clues = cluesFrom(hints);
  const subjects = hints.subjects ?? [];

  const candidates = cachedKeys
    .map((keys) => score(keys, clues, subjects))
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
