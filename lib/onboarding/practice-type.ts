// What kind of practice a client is, and what that changes.
//
// Research and the plan document assumed every client is a general practice.
// For an urgent care or ER that is wrong where it matters: their competitors are
// other urgent cares and ERs, local general practices are referral partners,
// and their leads are calls and walk-ins. An empty practice type reads exactly
// as before (a general practice), so nothing changes until someone sets one.

export const PRACTICE_TYPES = ["general_practice", "urgent_care", "emergency_24h", "specialty", "mobile", "other"] as const;
export type PracticeType = (typeof PRACTICE_TYPES)[number];

export const PRACTICE_TYPE_LABEL: Record<PracticeType, string> = {
  general_practice: "General practice",
  urgent_care: "Urgent care",
  emergency_24h: "24-hour emergency",
  specialty: "Specialty / referral",
  mobile: "Mobile / house call",
  other: "Other",
};

export function asPracticeType(value: unknown): PracticeType | null {
  return typeof value === "string" && (PRACTICE_TYPES as readonly string[]).includes(value) ? (value as PracticeType) : null;
}

/** The "Practice Type" line in research prompts. Empty keeps the old wording. */
export function practiceTypeForPrompt(type: PracticeType | null): string {
  switch (type) {
    case "urgent_care":
      return "veterinary URGENT CARE (same-day urgent visits; not a general practice)";
    case "emergency_24h":
      return "24-hour veterinary EMERGENCY hospital (not a general practice)";
    case "specialty":
      return "veterinary specialty / referral hospital (not a general practice)";
    case "mobile":
      return "mobile / house-call veterinary practice";
    case "general_practice":
      return "general veterinary practice";
    default:
      return "veterinary practice";
  }
}

/**
 * Who the competitors are for this kind of practice, for research prompts.
 * Null for general practices and unknown types: their prompts are unchanged.
 */
export function competitorGuidance(type: PracticeType | null): string | null {
  switch (type) {
    case "urgent_care":
      return "COMPETITORS for an urgent care are other veterinary urgent cares and 24-hour emergency hospitals nearby. Local general practices are REFERRAL PARTNERS (they send urgent cases), not competitors: do not list them as competitors, and do not frame the opportunity as winning their patients.";
    case "emergency_24h":
      return "COMPETITORS for a 24-hour emergency hospital are other emergency hospitals and veterinary urgent cares nearby. Local general practices are REFERRAL PARTNERS, not competitors: do not list them as competitors.";
    case "specialty":
      return "COMPETITORS for a specialty / referral hospital are other specialty and referral hospitals in the region. Local general practices are REFERRAL SOURCES, not competitors.";
    case "mobile":
      return "COMPETITORS for a mobile practice are other mobile / house-call vets serving the same area, and nearby clinics for routine care.";
    default:
      return null;
  }
}

/** True when the plan document should use urgent / emergency framing instead of general-practice wording. */
export function isUrgentPractice(type: PracticeType | null): boolean {
  return type === "urgent_care" || type === "emergency_24h";
}

/**
 * How the plan document introduces the competitor list. General practices and
 * unknown types keep the original wording.
 */
export function competitorFraming(type: PracticeType | null): { title: string; intro: string } {
  if (type === "urgent_care" || type === "emergency_24h") {
    return {
      title: "Other urgent and emergency care nearby",
      intro:
        "The urgent cares and emergency hospitals most likely to come up alongside you when people search. Local general practices aren't on this list: they're partners who can send urgent cases your way.",
    };
  }
  if (type === "specialty") {
    return {
      title: "Other specialty and referral hospitals nearby",
      intro: "The practices most likely to come up alongside you when people search. Local general practices are referral partners, not competitors.",
    };
  }
  return { title: "Nearby practices", intro: "The practices most likely to come up alongside you when people search." };
}
