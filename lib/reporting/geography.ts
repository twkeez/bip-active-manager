// Geography for the client report.
//
// GA4's city list is the site's top 15 locations by sessions anywhere in the
// world. For a local practice that mixes in places no client could come from
// (Adobe Animal Hospital, Nov 24 2026: Singapore, Ashburn VA, Tokyo and London,
// which are mostly automated traffic from data centres). The report now shows
// only locations in the client's own state, and says what it left out.

import type { Ga4GeoRow } from "@/lib/types/client";

const US_STATES: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California",
  CO: "Colorado", CT: "Connecticut", DE: "Delaware", DC: "District of Columbia",
  FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois",
  IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana",
  ME: "Maine", MD: "Maryland", MA: "Massachusetts", MI: "Michigan",
  MN: "Minnesota", MS: "Mississippi", MO: "Missouri", MT: "Montana",
  NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey",
  NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota",
  OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania",
  RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota",
  TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia",
  WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
  PR: "Puerto Rico",
  // Canadian provinces, for clients across the border.
  AB: "Alberta", BC: "British Columbia", MB: "Manitoba", NB: "New Brunswick",
  NL: "Newfoundland and Labrador", NS: "Nova Scotia", ON: "Ontario",
  PE: "Prince Edward Island", QC: "Quebec", SK: "Saskatchewan",
};

/** The full state or province name GA4 uses for a two-letter code, or null. */
export function stateName(code: string | null | undefined): string | null {
  if (!code) return null;
  const trimmed = code.trim();
  return US_STATES[trimmed.toUpperCase()] ?? (Object.values(US_STATES).includes(trimmed) ? trimmed : null);
}

const NOT_SET = "(not set)";

function isSet(value: string | null | undefined): value is string {
  return Boolean(value && value.trim() && value.trim() !== NOT_SET);
}

export type ReportGeography = {
  rows: Array<{ location: string; sessions: number; users: number }>;
  /** The state the list was narrowed to, or null when none could be told. */
  state: string | null;
  /** "client" when it is the client's state on file, "traffic" when it is where most visits came from. */
  stateSource: "client" | "traffic" | null;
  /** How many listed locations were left out because they are outside that state. */
  leftOut: number;
};

/** The state or region with the most sessions among the listed locations. */
function busiestRegion(rows: Ga4GeoRow[]): string | null {
  const totals = new Map<string, number>();
  for (const r of rows) {
    if (!isSet(r.region)) continue;
    totals.set(r.region.trim(), (totals.get(r.region.trim()) ?? 0) + r.sessions);
  }
  let best: string | null = null;
  let bestSessions = 0;
  for (const [region, sessions] of totals) {
    if (sessions > bestSessions) {
      best = region;
      bestSessions = sessions;
    }
  }
  return best;
}

/**
 * The locations to show: in the client's state, or the busiest region when the
 * client has no state on file; every listed location when neither is known. A city GA4 couldn't place reads "Unknown city" instead of
 * "(not set)".
 */
export function reportGeography(rows: Ga4GeoRow[], clientState: string | null | undefined): ReportGeography {
  // A client with no state on file is narrowed to the region most visits came
  // from, which for a local practice is its own state.
  const onFile = stateName(clientState);
  const state = onFile ?? busiestRegion(rows);
  const stateSource = onFile ? "client" : state ? "traffic" : null;
  const kept = state
    ? rows.filter((r) => isSet(r.region) && r.region.trim().toLowerCase() === state.toLowerCase())
    : rows;
  return {
    rows: kept.map((r) => ({
      location: state
        ? isSet(r.city) ? r.city : `Unknown city, ${state}`
        : [isSet(r.city) ? r.city : null, isSet(r.region) ? r.region : null].filter(Boolean).join(", ") ||
          "Location not available",
      sessions: r.sessions,
      users: r.users,
    })),
    state,
    stateSource,
    leftOut: rows.length - kept.length,
  };
}

/** One line under the table saying what was left out, or null when nothing was. */
export function geographyNote(geo: ReportGeography): string | null {
  if (!geo.state || geo.leftOut === 0) return null;
  const where =
    geo.stateSource === "traffic"
      ? `Showing visits from ${geo.state}, where most of the site's visits come from.`
      : `Showing visits from ${geo.state}.`;
  return `${where} Visits from other states and countries, which often come from automated traffic, are left out.`;
}
