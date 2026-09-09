/**
 * A first guess at what an unclaimed Basecamp project actually is.
 *
 * 78 active projects have no client record. Most are real veterinary practices
 * that were never wired up; a handful are our own internal projects that should
 * never become clients. Deciding one by one is the slow part, so this sorts the
 * obvious internal ones out of the way and leaves the rest to a person.
 *
 * It only ever suggests. Nothing acts on the result without a click.
 */

export type ProjectDisposition = "internal" | "practice" | "unclear";

export type ProjectTriage = {
  disposition: ProjectDisposition;
  /** Why, in words that make sense next to the project name. */
  reason: string;
};

/** Our own projects: Beyond Indigo's internal spaces, templates, resources. */
const INTERNAL_PATTERNS: Array<{ re: RegExp; reason: string }> = [
  { re: /\bbeyond\s*indigo\b/i, reason: "One of our own Beyond Indigo projects" },
  { re: /\btemplates?\b/i, reason: "Looks like a project template" },
  { re: /\bdesigner resources\b/i, reason: "Internal resources project" },
  { re: /\bnewsstand\b/i, reason: "Internal Newsstand project" },
  { re: /\bcourageous conversations\b/i, reason: "Internal discussion project" },
  { re: /\b(test|testing|demo|sandbox|scratch)\b/i, reason: "Looks like a test or demo project" },
  { re: /\binternal\b/i, reason: "Named as internal" },
  { re: /\b(hr|onboarding|training|handbook)\b/i, reason: "Looks like an internal operations project" },
];

/** Words that only appear in the name of an actual practice. */
const PRACTICE_PATTERNS: Array<{ re: RegExp; reason: string }> = [
  {
    re: /\b(veterinary|veterinarian|animal|pet|vet)\b/i,
    reason: "Named like a veterinary practice",
  },
  { re: /\b(hospital|clinic|care center|centre|center)\b/i, reason: "Named like a practice" },
  { re: /\b(equine|feline|canine|avian|exotic)\b/i, reason: "Named like a species-specific practice" },
];

/**
 * Retired or superseded projects. Still practices, but the marker matters more
 * than the name — importing one of these as a fresh client would be wrong.
 */
const RETIRED = /\((?:old|previous|previously|inactive|closed|archived)[^)]*\)|\b(?:old|archived)\s*$/i;

export function triageProjectName(name: string): ProjectTriage {
  const trimmed = name.trim();
  if (!trimmed) {
    return { disposition: "unclear", reason: "No project name" };
  }

  for (const { re, reason } of INTERNAL_PATTERNS) {
    if (re.test(trimmed)) return { disposition: "internal", reason };
  }

  // Checked after internal, so "Beyond Indigo Pets — Technical Development"
  // stays internal despite the word "Pets".
  if (RETIRED.test(trimmed)) {
    return {
      disposition: "unclear",
      reason: "Marked old or previous — check before importing",
    };
  }

  for (const { re, reason } of PRACTICE_PATTERNS) {
    if (re.test(trimmed)) return { disposition: "practice", reason };
  }

  return { disposition: "unclear", reason: "Name gives nothing away — needs a look" };
}

/**
 * How long a project has been silent, said in a way that decides something.
 *
 * A name only gets you so far: "Parker Pet Clinic" reads like a live practice
 * whether the last message was yesterday or in 2023. The age is what separates
 * a project we are neglecting from a space that was finished with years ago.
 */
export type ProjectActivity = {
  /** "3 days ago", "14 months ago", "never" — short enough to sit beside a name. */
  label: string;
  days: number | null;
  /** Nothing for a year. Almost always safe to ignore, whatever the name says. */
  dormant: boolean;
};

/** A year of silence. Past this, a veterinary practice is not being served. */
export const DORMANT_DAYS = 365;

export function describeProjectActivity(
  lastEventAt: string | null | undefined,
  now: Date = new Date(),
): ProjectActivity {
  const parsed = lastEventAt ? new Date(lastEventAt) : null;
  if (!parsed || Number.isNaN(parsed.getTime())) {
    // Unknown is not the same as old, and must not be presented as either.
    return { label: "no activity date", days: null, dormant: false };
  }

  const days = Math.floor((now.getTime() - parsed.getTime()) / 86_400_000);
  if (days < 0) return { label: "just now", days: 0, dormant: false };

  const label =
    days === 0
      ? "today"
      : days === 1
        ? "yesterday"
        : days < 30
          ? `${days} days ago`
          : days < 365
            ? `${Math.floor(days / 30)} months ago`
            : `${(days / 365).toFixed(days < 730 ? 1 : 0)} years ago`;

  return { label, days, dormant: days >= DORMANT_DAYS };
}
