import {
  ALLOWED_RADIUS_MILES,
  DEFAULT_GRID_SIZE,
  DEFAULT_RADIUS_MILES,
  MAX_KEYWORDS,
} from "@/lib/local-rank/constants";

export function normalizeKeywords(keywords: string[]): string[] {
  const unique = [...new Set(keywords.map((keyword) => keyword.trim()).filter(Boolean))];
  if (!unique.length) {
    throw new Error("At least one keyword is required.");
  }
  if (unique.length > MAX_KEYWORDS) {
    throw new Error(`Maximum ${MAX_KEYWORDS} keywords per run.`);
  }
  return unique;
}

export function normalizeRadiusMiles(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!ALLOWED_RADIUS_MILES.includes(parsed as (typeof ALLOWED_RADIUS_MILES)[number])) {
    return DEFAULT_RADIUS_MILES;
  }
  return parsed;
}

export function normalizeGridSize(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (parsed !== DEFAULT_GRID_SIZE) {
    throw new Error(`Grid size must be ${DEFAULT_GRID_SIZE} (25 points).`);
  }
  return DEFAULT_GRID_SIZE;
}

export function plannedApiCalls(keywordCount: number, gridSize = DEFAULT_GRID_SIZE): number {
  return keywordCount * gridSize * gridSize;
}
