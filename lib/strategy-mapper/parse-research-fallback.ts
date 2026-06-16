import type { DensityTier, StrategyMapperResearch } from "@/types/strategy-mapper";

const DENSITY_TIERS: DensityTier[] = ["urban", "suburban", "rural"];

function extractJsonObject(text: string): string | null {
  const trimmed = text.trim();
  if (trimmed.startsWith("{")) return trimmed;

  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch?.[1]) return fenceMatch[1].trim();

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return trimmed.slice(start, end + 1);
  }

  return null;
}

export function parseResearchFromText(text: string): StrategyMapperResearch | null {
  const jsonText = extractJsonObject(text);
  if (!jsonText) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== "object") return null;
  const record = parsed as Record<string, unknown>;

  if (!DENSITY_TIERS.includes(record.densityTier as DensityTier)) return null;
  if (typeof record.wellnessRadiusMiles !== "number") return null;
  if (typeof record.specialtyRadiusEnabled !== "boolean") return null;
  if (record.specialtyRadiusMiles !== null && typeof record.specialtyRadiusMiles !== "number") {
    return null;
  }
  if (typeof record.radiusRationale !== "string" || !record.radiusRationale.trim()) {
    return null;
  }

  const clientMetrics = record.clientMetrics;
  if (!clientMetrics || typeof clientMetrics !== "object") return null;
  const metrics = clientMetrics as Record<string, unknown>;
  if (typeof metrics.googleRating !== "number") return null;
  if (typeof metrics.reviewCount !== "number") return null;
  if (typeof metrics.runsGoogleAds !== "boolean") return null;

  if (!Array.isArray(record.competitors)) return null;
  const competitors = record.competitors.map((item) => {
    if (!item || typeof item !== "object") return null;
    const c = item as Record<string, unknown>;
    if (typeof c.name !== "string") return null;
    if (typeof c.distanceMiles !== "number") return null;
    if (typeof c.googleRating !== "number") return null;
    if (typeof c.reviewCount !== "number") return null;
    if (typeof c.runsGoogleAds !== "boolean") return null;
    if (c.scope !== "local" && c.scope !== "regional") return null;
    return {
      name: c.name,
      distanceMiles: c.distanceMiles,
      googleRating: c.googleRating,
      reviewCount: c.reviewCount,
      runsGoogleAds: c.runsGoogleAds,
      scope: c.scope as "local" | "regional",
    };
  });
  if (competitors.some((c) => c == null)) return null;

  return {
    densityTier: record.densityTier as DensityTier,
    wellnessRadiusMiles: record.wellnessRadiusMiles,
    specialtyRadiusMiles: record.specialtyRadiusMiles as number | null,
    specialtyRadiusEnabled: record.specialtyRadiusEnabled,
    radiusRationale: record.radiusRationale,
    clientMetrics: {
      googleRating: metrics.googleRating,
      reviewCount: metrics.reviewCount,
      runsGoogleAds: metrics.runsGoogleAds,
    },
    competitors: competitors as StrategyMapperResearch["competitors"],
  };
}
