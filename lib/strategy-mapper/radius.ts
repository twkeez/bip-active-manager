import type {
  DualRadiusResult,
  StrategyMapperFormData,
  StrategyMapperResearch,
} from "@/types/strategy-mapper";
import { HIGH_TICKET_SPECIALIZATION_SIGNALS } from "@/lib/strategy-mapper/form-options";

const URBAN_SIGNALS =
  /\b(downtown|midtown|city center|urban|manhattan|brooklyn|queens|bronx|philadelphia|boston|chicago|los angeles|san francisco|seattle|portland|denver|atlanta|miami|baltimore|washington dc|capitol hill)\b/i;

const SUBURBAN_SIGNALS =
  /\b(township|suburb|suburban|neighborhood|residential|monmouth|middlesex|suffolk|nassau|westchester|fairfax|gwinnett|collin county|lake county)\b/i;

const RURAL_SIGNALS =
  /\b(rural|county|farm|ranch|acre|miles from|outside town|unincorporated|highway \d+|route \d+)\b/i;

const METRO_DRAW_SIGNALS =
  /\b(drawing from|commute|nearby metro|greater [a-z]+ area|regional draw|within \d+ miles of)\b/i;

const SPECIALTY_TEXT_SIGNALS =
  /\b(tplo|orthopedic|cruciate|surgical referral|advanced diagnostic|specialty surgery)\b/i;

const SPECIALTY_RADIUS_MILES = 40;

function tierToWellnessRadius(tier: DualRadiusResult["densityTier"]): 3 | 5 | 15 {
  if (tier === "urban") return 3;
  if (tier === "suburban") return 5;
  return 15;
}

function inferTierFromText(text: string): DualRadiusResult["densityTier"] {
  const lower = text.toLowerCase();
  if (URBAN_SIGNALS.test(lower)) return "urban";
  if (RURAL_SIGNALS.test(lower)) return "rural";
  if (SUBURBAN_SIGNALS.test(lower)) return "suburban";
  if (/^\d+\s/.test(text.trim()) && /\b[A-Z]{2}\s+\d{5}\b/.test(text)) {
    return "suburban";
  }
  return "suburban";
}

export function hasHighTicketSpecialization(form: StrategyMapperFormData): boolean {
  const combined = [
    ...form.specializations,
    form.customSpecialization,
    form.locationNotes,
    form.strategicContextNotes,
    form.salesPdfExtract?.summary ?? "",
    ...(form.salesPdfExtract?.goals ?? []),
  ]
    .join(" ")
    .toLowerCase();

  const fromSelections = form.specializations.some((spec) =>
    HIGH_TICKET_SPECIALIZATION_SIGNALS.includes(
      spec as (typeof HIGH_TICKET_SPECIALIZATION_SIGNALS)[number],
    ),
  );

  return fromSelections || SPECIALTY_TEXT_SIGNALS.test(combined);
}

export function calculateDualRadius(
  form: StrategyMapperFormData,
): DualRadiusResult {
  const combined = `${form.streetAddress} ${form.locationNotes}`.trim();
  let densityTier = inferTierFromText(combined);
  let rationale = `Core wellness radius based on ${densityTier} density classification.`;

  if (METRO_DRAW_SIGNALS.test(form.locationNotes) && densityTier === "rural") {
    densityTier = "suburban";
    rationale =
      "Regional draw from nearby metro expanded classification from rural to suburban for wellness radius.";
  }

  const wellnessRadiusMiles = tierToWellnessRadius(densityTier);
  const specialtyRadiusEnabled = hasHighTicketSpecialization(form);
  const specialtyRadiusMiles = specialtyRadiusEnabled ? SPECIALTY_RADIUS_MILES : null;

  const geographicFocusLabel = specialtyRadiusEnabled
    ? `${wellnessRadiusMiles}-Mile Local Core & ${specialtyRadiusMiles}-Mile Regional Surgical Grid`
    : `${wellnessRadiusMiles}-Mile Local Core`;

  if (specialtyRadiusEnabled) {
    rationale += ` Specialty radius (${specialtyRadiusMiles} mi) enabled for high-ticket surgical/regional search intent.`;
  }

  return {
    densityTier,
    wellnessRadiusMiles,
    specialtyRadiusMiles,
    specialtyRadiusEnabled,
    geographicFocusLabel,
    rationale,
  };
}

function normalizeWellnessRadiusMiles(
  miles: number,
  densityTier: DualRadiusResult["densityTier"],
): 3 | 5 | 15 {
  if (miles === 3 || miles === 5 || miles === 15) return miles;
  return tierToWellnessRadius(densityTier);
}

/** Map audited research back to DualRadiusResult for tier assembly and report prompts. */
export function dualRadiusFromResearch(
  research: StrategyMapperResearch,
): DualRadiusResult {
  const wellnessRadiusMiles = normalizeWellnessRadiusMiles(
    research.wellnessRadiusMiles,
    research.densityTier,
  );
  const geographicFocusLabel =
    research.specialtyRadiusEnabled && research.specialtyRadiusMiles
      ? `${wellnessRadiusMiles}-Mile Local Core & ${research.specialtyRadiusMiles}-Mile Regional Surgical Grid`
      : `${wellnessRadiusMiles}-Mile Local Core`;

  return {
    densityTier: research.densityTier,
    wellnessRadiusMiles,
    specialtyRadiusMiles: research.specialtyRadiusMiles,
    specialtyRadiusEnabled: research.specialtyRadiusEnabled,
    geographicFocusLabel,
    rationale: research.radiusRationale,
  };
}

/** @deprecated Use calculateDualRadius */
export function calculateTargetRadius(
  streetAddress: string,
  locationNotes: string,
): DualRadiusResult {
  return calculateDualRadius({
    practiceName: "",
    practiceOwnerName: "",
    streetAddress,
    locationNotes,
    specializations: [],
    customSpecialization: "",
    activeServices: [],
    primaryGoal: "",
    strategicContextNotes: "",
  });
}
