import type { ClientActiveServices, ClientServiceKey } from "@/lib/clients/types";
import {
  selectGlossaryTerms,
  type GlossaryTerm,
} from "@/lib/onboarding/expectation-glossary";

// Client-expectations content generator. Pure + side-effect free: assembles the
// per-service expectation blurbs for the services a client actually bought, plus a
// shared intro, overall timetable, glossary and closing — with merge fields
// substituted. Content is master copy; there is no per-client override. What does
// vary per client is which services appear and, for "What to expect", which tier.

export type ExpectationBlock = {
  block_key: string;
  body: string;
  sort_order: number;
};

/**
 * The structured fields authored per service.
 *
 * "limits" exists because the expectations this document is meant to set are as
 * much about what will not happen as what will — no guaranteed rankings, no
 * results next week, not the same thing as running ads. Saying so in writing at
 * kickoff is what prevents the month-two phone call.
 */
export const EXPECTATION_FIELDS = ["expect", "limits", "need", "recommend"] as const;
export type ExpectationField = (typeof EXPECTATION_FIELDS)[number];

/** Fixed order services appear in the document (matches the rest of onboarding). */
export const SERVICE_EXPECTATION_ORDER: ClientServiceKey[] = ["seo", "ppc", "smm", "blog", "orm"];

/** Client-facing service names (mirrors onboarding-report's SERVICE_LABEL). */
export const SERVICE_EXPECTATION_LABEL: Record<ClientServiceKey, string> = {
  seo: "SEO",
  ppc: "Google Ads",
  smm: "Social Media",
  blog: "Blog",
  orm: "Reviews",
};

/** Friendly labels for each structured field, shown in the editor and document. */
export const EXPECTATION_FIELD_LABEL: Record<ExpectationField, string> = {
  expect: "What to expect",
  // Was "What this isn't". Four negative headings in a welcome document set the
  // wrong tone; the content underneath is unchanged.
  limits: "Good to know",
  need: "What we need from you",
  recommend: "Our recommendations",
};

/** e.g. serviceBlockKey("seo", "need") === "seo_need". */
export function serviceBlockKey(service: ClientServiceKey, field: ExpectationField): string {
  return `${service}_${field}`;
}

/**
 * Tiers, and why "What to expect" follows them.
 *
 * A single "What to expect" per service told every client the same thing, so
 * an SEO Foundation client read that we would "optimize your priority pages" —
 * monthly page work starts at Premium. For a document whose job is setting
 * realistic expectations, promising unbought work is the one failure it cannot
 * afford. So "What to expect" can be written per tier; the other three fields
 * stay shared because they hold true at every tier.
 *
 * Keys match the published scope tables (lib/services/tier-content.ts), so the
 * editor can show what each tier actually includes beside its text.
 */
export type ServiceTier = "foundation" | "premium" | "premium_plus";

export const TIER_LABEL: Record<ServiceTier, string> = {
  foundation: "Foundation",
  premium: "Premium",
  premium_plus: "Premium Plus",
};

/** Tiers each service is sold in. Blog is sold by post count, so it has none. */
export const SERVICE_TIERS: Record<ClientServiceKey, ServiceTier[]> = {
  seo: ["foundation", "premium", "premium_plus"],
  ppc: ["foundation", "premium", "premium_plus"],
  smm: ["foundation", "premium", "premium_plus"],
  blog: [],
  // Premium Plus added 2026-09-10 when Tom defined the Reviews tiers.
  orm: ["foundation", "premium", "premium_plus"],
};

/** e.g. tierExpectKey("seo", "premium_plus") === "seo_expect_premium_plus". */
export function tierExpectKey(service: ClientServiceKey, tier: ServiceTier): string {
  return `${service}_expect_${tier}`;
}

/** "Premium Plus" → "premium_plus". Null for anything the service is not sold at. */
export function resolveServiceTier(
  service: ClientServiceKey,
  raw: string | null | undefined,
): ServiceTier | null {
  const slug = (raw ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  return (SERVICE_TIERS[service] as string[]).includes(slug) ? (slug as ServiceTier) : null;
}

/** Blog stores a monthly post count. Anything else is not a count worth printing. */
function blogPlanLabel(raw: string | null | undefined): string | null {
  const n = Number((raw ?? "").trim());
  if (!Number.isInteger(n) || n <= 0) return null;
  return `${n} post${n === 1 ? "" : "s"} a month`;
}

/** Shared (service-agnostic) blocks that always frame the document. */
export const GENERAL_EXPECTATION_KEYS = ["intro", "timetable", "closing"] as const;

/**
 * Every master block key, in editor order: intro → timetable → per service (its
 * four fields, then a "What to expect" per tier) → closing.
 */
export const SERVICE_EXPECTATION_BLOCK_KEYS: string[] = [
  "intro",
  "timetable",
  ...SERVICE_EXPECTATION_ORDER.flatMap((service) => [
    ...EXPECTATION_FIELDS.map((field) => serviceBlockKey(service, field)),
    ...SERVICE_TIERS[service].map((tier) => tierExpectKey(service, tier)),
  ]),
  "closing",
];

export type ExpectationMergeContext = {
  clientName: string;
  strategist: string;
  /** As stored — often "Oshawa, Ontario, Canada". */
  city?: string | null;
};

/**
 * The part of a stored city that reads naturally in a sentence.
 *
 * Cities are stored geocoder-style — "Oshawa, Ontario, Canada" — and dropping
 * that into "how competitive {{city}} is" prints all three parts.
 */
export function cityForCopy(city: string | null | undefined): string {
  return (city ?? "").split(",")[0]?.trim() ?? "";
}

/**
 * Replaces {{client_name}}, {{strategist}} and {{city}}.
 *
 * The fallbacks are written to read correctly where the copy puts them: a
 * strategist name opens a sentence ("Stephanie will go through it with you"),
 * and a city sits after a preposition ("an emergency vet in your area").
 */
export function applyExpectationMergeFields(text: string, ctx: ExpectationMergeContext): string {
  return text
    .replaceAll("{{client_name}}", ctx.clientName)
    .replaceAll("{{strategist}}", ctx.strategist.trim() || "Your strategist")
    .replaceAll("{{city}}", cityForCopy(ctx.city) || "your area");
}

export type ExpectationServiceSection = {
  key: ClientServiceKey;
  label: string;
  /**
   * What the client bought — "Foundation", "Premium Plus", "1 post a month".
   * Null when the stored value is not something we sell, rather than a guess.
   */
  planLabel: string | null;
  expect: string;
  limits: string;
  need: string;
  recommend: string;
};

/** "SEO · Foundation" — the document now says which plan each section describes. */
export function serviceSectionTitle(
  section: Pick<ExpectationServiceSection, "label" | "planLabel">,
): string {
  return section.planLabel ? `${section.label} · ${section.planLabel}` : section.label;
}

export type ChecklistItem = { text: string; serviceLabel: string };

const normaliseItem = (text: string) =>
  text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();

/**
 * Everything the client has to do, in one list.
 *
 * "What we need from you" was split across every service section, so a
 * practice manager had to read the whole document to build their own to-do
 * list — and it is the only part of the document that asks them to act. Bullet
 * lines become items; a block with no bullets becomes a single item.
 *
 * Duplicates across services are dropped, keeping the fuller wording: SEO asks
 * for "access to your Google Business Profile and Google Search Console" and
 * Reviews for "access to your Google Business Profile", which is one task.
 */
export function buildKickoffChecklist(services: ExpectationServiceSection[]): ChecklistItem[] {
  const items: ChecklistItem[] = [];
  for (const service of services) {
    const lines = service.need.split("\n").map((line) => line.trim()).filter(Boolean);
    const bulleted = lines.filter((line) => /^[•\-*]\s*/.test(line));
    const texts =
      bulleted.length > 0
        ? bulleted.map((line) => line.replace(/^[•\-*]\s*/, "").trim())
        : service.need.trim()
          ? [service.need.trim()]
          : [];
    for (const text of texts) if (text) items.push({ text, serviceLabel: service.label });
  }

  return items.filter((item, index) => {
    const own = normaliseItem(item.text);
    return !items.some((other, otherIndex) => {
      if (otherIndex === index) return false;
      const theirs = normaliseItem(other.text);
      if (own === theirs) return otherIndex < index; // same task twice: keep the first
      return theirs.includes(own); // covered by a fuller item: drop this one
    });
  });
}

export type ServiceExpectationsModel = {
  intro: string;
  timetable: string;
  services: ExpectationServiceSection[];
  /** "What we need from you" across all services, deduplicated — printed as one checklist. */
  checklist: ChecklistItem[];
  /** Definitions for the services this client bought. May be empty. */
  glossary: GlossaryTerm[];
  closing: string;
};

export type AssembleExpectationsContext = ExpectationMergeContext & {
  activeServices: ClientActiveServices;
  /**
   * The raw stored values ("Foundation", "1"), which decide the tier. Omitted,
   * every section falls back to its shared "What to expect".
   */
  serviceValues?: Partial<Record<ClientServiceKey, string | null>>;
  /** Omitted when no glossary has been authored yet. */
  glossary?: GlossaryTerm[];
};

/**
 * Builds the client-expectations document model: shared intro + timetable, then a
 * section per ACTIVE service (in fixed order), then glossary and closing — all
 * merge-substituted. A service is included only if it's active AND has at least
 * one non-empty field; individual empty fields are returned as "" so the renderer
 * can drop them.
 *
 * "What to expect" uses the client's tier version when one is written, and the
 * shared version otherwise — so a tier with no copy yet degrades to exactly what
 * the document said before tiers existed.
 */
export function assembleServiceExpectations(
  blocks: ExpectationBlock[],
  ctx: AssembleExpectationsContext,
): ServiceExpectationsModel {
  const byKey = new Map(blocks.map((b) => [b.block_key, b.body]));
  const merge = (key: string) => applyExpectationMergeFields((byKey.get(key) ?? "").trim(), ctx);

  const services: ExpectationServiceSection[] = [];
  for (const service of SERVICE_EXPECTATION_ORDER) {
    if (!ctx.activeServices[service]) continue;

    const raw = ctx.serviceValues?.[service] ?? null;
    const tier = resolveServiceTier(service, raw);
    const tierExpect = tier ? merge(tierExpectKey(service, tier)) : "";

    const expect = tierExpect || merge(serviceBlockKey(service, "expect"));
    const limits = merge(serviceBlockKey(service, "limits"));
    const need = merge(serviceBlockKey(service, "need"));
    const recommend = merge(serviceBlockKey(service, "recommend"));
    if (!expect && !limits && !need && !recommend) continue;

    services.push({
      key: service,
      label: SERVICE_EXPECTATION_LABEL[service],
      planLabel: tier ? TIER_LABEL[tier] : service === "blog" ? blogPlanLabel(raw) : null,
      expect,
      limits,
      need,
      recommend,
    });
  }

  return {
    intro: merge("intro"),
    timetable: merge("timetable"),
    services,
    checklist: buildKickoffChecklist(services),
    glossary: selectGlossaryTerms(ctx.glossary ?? [], ctx.activeServices).map((term) => ({
      ...term,
      definition: applyExpectationMergeFields(term.definition, ctx),
    })),
    closing: merge("closing"),
  };
}
