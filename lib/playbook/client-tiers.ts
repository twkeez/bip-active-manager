import type { ClientRow } from "@/lib/types/client";

function normalize(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function isActive(value: string | null | undefined): boolean {
  const v = normalize(value);
  return v !== "" && v !== "n" && v !== "0" && v !== "no" && v !== "false";
}

function seoTierKey(value: string | null): string | null {
  if (!isActive(value)) return null;
  const v = normalize(value);
  if (v.includes("plus") || v.includes("+")) return "seo-premium-plus";
  if (v === "p" || v.includes("premium")) return "seo-premium";
  return "seo-foundation";
}

function ppcTierKey(value: string | null): string | null {
  if (!isActive(value)) return null;
  const v = normalize(value);
  if (v.includes("plus") || v.includes("+")) return "ppc-premium-plus";
  return "ppc-premium";
}

function ormTierKey(value: string | null): string | null {
  if (!isActive(value)) return null;
  const v = normalize(value);
  if (v === "p" || v.includes("premium")) return "orm-premium";
  return "orm-foundation";
}

function smmTierKey(value: string | null): string | null {
  if (!isActive(value)) return null;
  const v = normalize(value);
  if (v.includes("plus") || v.includes("+") || v === "pp") return "social-premium-plus";
  if (v === "p" || v.includes("premium")) return "social-premium";
  return "social-standard";
}

function blogTierKey(value: string | null): string | null {
  if (!isActive(value)) return null;
  const v = normalize(value);
  if (v === "p" || v.includes("premium")) return "blog-premium";
  return "blog-standard";
}

export function getClientTierKeys(client: ClientRow): string[] {
  const keys: (string | null)[] = [
    seoTierKey(client.seo),
    ppcTierKey(client.ppc),
    ormTierKey(client.orm),
    smmTierKey(client.smm),
    blogTierKey(client.blog),
  ];
  return keys.filter((k): k is string => k !== null);
}

// ── SEO keyword tracking allowance ─────────────────────────────────────────
// Number of keywords a client may track, derived from their SEO service tier:
// Foundation (or inactive) → 0, Premium → 3, Premium Plus → 10.
export function seoKeywordAllowance(client: ClientRow): number {
  switch (seoTierKey(client.seo)) {
    case "seo-premium-plus":
      return 10;
    case "seo-premium":
      return 3;
    default:
      return 0;
  }
}

// Starter keywords auto-seeded for a Premium (or higher) client with none yet.
// The city-based phrase is only included when a city is on file.
export function defaultSeoKeywords(client: ClientRow): string[] {
  const city = (client.city ?? "").trim();
  const candidates = [
    "vet near me",
    city ? `veterinarian in ${city}` : null,
    (client.account_name ?? "").trim() || null,
  ];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const candidate of candidates) {
    if (!candidate) continue;
    const key = candidate.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(candidate);
  }
  return result;
}

// Suggested tracked keywords for onboarding, sized to the SEO tier. Built from
// the practice name, city, and common vet-service terms — no client access
// needed. Returns [] for Foundation (no keyword tracking at that tier).
export function suggestSeoKeywords(client: ClientRow): string[] {
  const allowance = seoKeywordAllowance(client);
  if (allowance === 0) return [];

  const city = (client.city ?? "").split(",")[0].trim();
  const name = (client.account_name ?? "").trim();

  const candidates: string[] = ["vet near me"];
  if (city) candidates.push(`veterinarian in ${city}`);
  if (name) candidates.push(name);
  if (city) {
    candidates.push(
      `animal hospital ${city}`,
      `emergency vet ${city}`,
      `dog vaccinations ${city}`,
      `cat vet ${city}`,
      `spay and neuter ${city}`,
      `pet dental ${city}`,
      `puppy vet ${city}`,
    );
  }

  const seen = new Set<string>();
  const out: string[] = [];
  for (const kw of candidates) {
    const key = kw.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(kw);
    if (out.length >= allowance) break;
  }
  return out;
}

// ── Local rank zone allowance ──────────────────────────────────────────────
// Geographic rank "zones" a client may track, by SEO tier: Premium 1,
// Premium Plus 3, Foundation (or inactive) 0.
export function localRankZoneAllowance(client: ClientRow): number {
  switch (seoTierKey(client.seo)) {
    case "seo-premium-plus":
      return 3;
    case "seo-premium":
      return 1;
    default:
      return 0;
  }
}

// Premium Plus additionally gets the 25-point local-pack heat map.
export function hasLocalRankHeatmap(client: ClientRow): boolean {
  return seoTierKey(client.seo) === "seo-premium-plus";
}

export type ClientServiceTierDef = {
  label: string;
  tierKey: string;
  tierLabel: string;
};

export function getClientServiceTierDefs(client: ClientRow): ClientServiceTierDef[] {
  const candidates: Array<{ label: string; tierKey: string | null; raw: string | null }> = [
    { label: "SEO",    tierKey: seoTierKey(client.seo),   raw: client.seo },
    { label: "PPC",    tierKey: ppcTierKey(client.ppc),   raw: client.ppc },
    { label: "Social", tierKey: smmTierKey(client.smm),   raw: client.smm },
    { label: "Blog",   tierKey: blogTierKey(client.blog), raw: client.blog },
    { label: "ORM",    tierKey: ormTierKey(client.orm),   raw: client.orm },
  ];
  return candidates
    .filter((c): c is { label: string; tierKey: string; raw: string | null } => c.tierKey !== null)
    .map(({ label, tierKey, raw }) => ({
      label,
      tierKey,
      tierLabel: (raw ?? "").trim(),
    }));
}
