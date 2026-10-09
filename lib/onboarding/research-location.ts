// Where a client is, for research prompts, and a check that research came back
// about that place.
//
// Remedy Veterinary Urgent Care (client 303, Parkville, MD) got market research
// about Parkville, MISSOURI on 2026-09-21: the research prompt said only
// "Location: Parkville". Both research calls now send the full address with the
// state spelled out and an explicit instruction, research cannot run without a
// state, and the result is checked for other states before it is saved.

export const US_STATES: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado",
  CT: "Connecticut", DE: "Delaware", DC: "District of Columbia", FL: "Florida", GA: "Georgia",
  HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky",
  LA: "Louisiana", ME: "Maine", MD: "Maryland", MA: "Massachusetts", MI: "Michigan", MN: "Minnesota",
  MS: "Mississippi", MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire",
  NJ: "New Jersey", NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota",
  OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina",
  SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia",
  WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
};

export type ResearchLocation = {
  street: string | null;
  city: string;
  /** Two-letter code, e.g. "MD". */
  state: string;
  stateName: string;
  zip: string | null;
  /** e.g. "Baltimore County", from the onboarding form when it names one. */
  county: string | null;
};

type LocationSource = {
  city?: string | null;
  state?: string | null;
  street_address?: string | null;
  zip?: string | null;
};

/**
 * The client's location for research, or why research can't run. A city
 * without a state is refused: "Parkville" alone is exactly how Remedy got
 * Missouri research.
 */
export function researchLocationFor(
  client: LocationSource,
  pipelineLocation?: string | null,
): { ok: true; location: ResearchLocation } | { ok: false; error: string } {
  let city = (client.city ?? "").trim();
  let state = (client.state ?? "").trim().toUpperCase();
  // Older records hold "Parkville, MD" in city.
  const combined = /^(.+?),\s*([A-Za-z]{2})\.?$/.exec(city);
  if (combined) {
    city = combined[1].trim();
    if (!state) state = combined[2].toUpperCase();
  }
  if (!city) return { ok: false, error: "Add the client's town on the client page before running research." };
  if (!state) {
    return {
      ok: false,
      error: `Add the client's state on the client page before running research. "${city}" alone is ambiguous: there are towns with that name in more than one state.`,
    };
  }
  const stateName = US_STATES[state];
  if (!stateName) return { ok: false, error: `"${state}" is not a US state code. Fix it on the client page.` };
  const countyMatch = /([A-Z][A-Za-z.' -]+ (County|Parish|Borough))/.exec(pipelineLocation ?? "");
  return {
    ok: true,
    location: {
      street: client.street_address?.trim() || null,
      city,
      state,
      stateName,
      zip: client.zip?.trim() || null,
      county: countyMatch ? countyMatch[1].trim() : null,
    },
  };
}

/** One line: "9512 Harford Rd, Parkville, MD 21234 (Baltimore County, Maryland, USA)". */
export function describeLocation(location: ResearchLocation): string {
  const street = location.street ? `${location.street}, ` : "";
  const zip = location.zip ? ` ${location.zip}` : "";
  const area = [location.county, `${location.stateName}, USA`].filter(Boolean).join(", ");
  return `${street}${location.city}, ${location.state}${zip} (${area})`;
}

/** The instruction every research prompt carries, so the model can't drift to a same-named town. */
export function locationInstruction(location: ResearchLocation): string {
  return `LOCATION (read carefully): this practice is in ${location.city}, ${location.stateName} (${location.state}), USA${
    location.street ? ` at ${describeLocation(location)}` : ""
  }. Research ONLY that area of ${location.stateName}. Other states may have a town called ${location.city}; ignore them entirely. Every competitor must be in or near ${location.city}, ${location.state}; give each competitor's town and state in its name, like "Example Animal Hospital (Town, ${location.state})".`;
}

export type LocationProblem = { where: string; found: string };

const STATE_NAME_PATTERN = new RegExp(
  `\\b(${Object.values(US_STATES)
    .sort((a, b) => b.length - a.length)
    .map((name) => name.replace(/ /g, "\\s+"))
    .join("|")})\\b`,
  "g",
);
// "Parkville, MO", "(Kansas City, MO 64152)": a town, comma, a capital state code.
const STATE_CODE_PATTERN = /,\s*([A-Z]{2})(?=[\s).,;:]|\d|$)/g;

/** The states a piece of text names, by full name or by ", XX" code. */
export function statesNamedIn(text: string): Set<string> {
  const found = new Set<string>();
  const byName = new Map(Object.entries(US_STATES).map(([code, name]) => [name.toLowerCase(), code]));
  for (const match of text.matchAll(STATE_NAME_PATTERN)) {
    const code = byName.get(match[1].replace(/\s+/g, " ").toLowerCase());
    // "Washington" alone is as often a street or a person as the state.
    if (code && !(code === "WA" && !/Washington\s+(State|state)|,\s*Washington\b/.test(text))) found.add(code);
  }
  for (const match of text.matchAll(STATE_CODE_PATTERN)) if (US_STATES[match[1]]) found.add(match[1]);
  // West Virginia contains "Virginia": only count VA if Virginia appears on its own too.
  if (found.has("WV") && found.has("VA") && !/(^|[^t]\s)Virginia\b/.test(text.replace(/West\s+Virginia/g, ""))) found.delete("VA");
  return found;
}

/**
 * Research about the wrong place: any part that names another state without
 * naming the client's own. Each problem says where and what was found.
 */
export function checkResearchLocation(
  parts: { where: string; text: string | null | undefined }[],
  location: ResearchLocation,
): LocationProblem[] {
  const problems: LocationProblem[] = [];
  for (const part of parts) {
    const states = statesNamedIn(part.text ?? "");
    const others = [...states].filter((code) => code !== location.state);
    if (others.length && !states.has(location.state)) {
      problems.push({ where: part.where, found: others.map((code) => `${US_STATES[code]} (${code})`).join(", ") });
    }
  }
  return problems;
}

/** Plain-English refusal for a rejected research result. */
export function locationProblemMessage(problems: LocationProblem[], location: ResearchLocation): string {
  return `Research was not saved: it looks like it is about the wrong place. The client is in ${location.city}, ${location.stateName}, but ${problems
    .map((p) => `${p.where} mentions ${p.found}`)
    .join("; ")}. The previous research was kept. Check the client's town and state, then run it again.`;
}
