import type { ClientActiveServices, ClientServiceKey } from "@/lib/clients/types";

// Client-expectations content generator. Pure + side-effect free: assembles the
// per-service expectation blurbs (what to expect, what we need, our
// recommendations) for the services a client actually bought, plus a shared
// intro, overall timetable, and closing — with merge fields substituted. This is
// the master, service-default content only; there is no per-client override.

export type ExpectationBlock = {
  block_key: string;
  body: string;
  sort_order: number;
};

/** The three structured fields authored per service. */
export const EXPECTATION_FIELDS = ["expect", "need", "recommend"] as const;
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
  need: "What we need from you",
  recommend: "Our recommendations",
};

/** e.g. serviceBlockKey("seo", "need") === "seo_need". */
export function serviceBlockKey(service: ClientServiceKey, field: ExpectationField): string {
  return `${service}_${field}`;
}

/** Shared (service-agnostic) blocks that always frame the document. */
export const GENERAL_EXPECTATION_KEYS = ["intro", "timetable", "closing"] as const;

/** Every master block key, in editor/render order (intro → timetable → services → closing). */
export const SERVICE_EXPECTATION_BLOCK_KEYS: string[] = [
  "intro",
  "timetable",
  ...SERVICE_EXPECTATION_ORDER.flatMap((service) =>
    EXPECTATION_FIELDS.map((field) => serviceBlockKey(service, field)),
  ),
  "closing",
];

export type ExpectationMergeContext = {
  clientName: string;
  strategist: string;
};

/** Replaces {{client_name}} and {{strategist}} throughout the text. */
export function applyExpectationMergeFields(text: string, ctx: ExpectationMergeContext): string {
  return text
    .replaceAll("{{client_name}}", ctx.clientName)
    .replaceAll("{{strategist}}", ctx.strategist);
}

export type ExpectationServiceSection = {
  key: ClientServiceKey;
  label: string;
  expect: string;
  need: string;
  recommend: string;
};

export type ServiceExpectationsModel = {
  intro: string;
  timetable: string;
  services: ExpectationServiceSection[];
  closing: string;
};

export type AssembleExpectationsContext = ExpectationMergeContext & {
  activeServices: ClientActiveServices;
};

/**
 * Builds the client-expectations document model: shared intro + timetable, then a
 * section per ACTIVE service (in fixed order) with its three fields, then closing —
 * all merge-substituted. A service is included only if it's active AND has at least
 * one non-empty field; individual empty fields are returned as "" so the renderer
 * can drop them.
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
    const expect = merge(serviceBlockKey(service, "expect"));
    const need = merge(serviceBlockKey(service, "need"));
    const recommend = merge(serviceBlockKey(service, "recommend"));
    if (!expect && !need && !recommend) continue;
    services.push({ key: service, label: SERVICE_EXPECTATION_LABEL[service], expect, need, recommend });
  }

  return {
    intro: merge("intro"),
    timetable: merge("timetable"),
    services,
    closing: merge("closing"),
  };
}
