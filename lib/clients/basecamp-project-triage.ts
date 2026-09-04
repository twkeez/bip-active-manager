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
