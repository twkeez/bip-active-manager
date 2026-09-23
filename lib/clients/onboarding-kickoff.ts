import type { ClientActiveServices, ClientServiceKey } from "@/lib/clients/types";
import {
  resolveServiceTier,
  SERVICE_TIERS,
  type ServiceTier,
} from "@/lib/onboarding/service-expectations";

// Quarterly Basecamp kickoff message generator. Pure + side-effect free: assembles
// the standard verbiage plus the blocks for the services a client actually bought,
// stamped with the current quarter. COPY/PASTE ONLY — nothing here posts to Basecamp.

export type KickoffBlock = {
  block_key: string;
  body: string;
  sort_order: number;
};

/** Maps a service to its master-template block key. */
export const SERVICE_BLOCK_KEYS: Record<ClientServiceKey, string> = {
  seo: "svc_seo",
  ppc: "svc_ppc",
  smm: "svc_smm",
  blog: "svc_blog",
  orm: "svc_orm",
};

/**
 * Per-tier block keys, e.g. "svc_seo_premium".
 *
 * What a client is told we will do has to match what they bought. The client
 * document learned this first: a single block per service told a Foundation
 * client we would "optimize your priority pages", which starts at Premium. The
 * kickoff message is the first thing a practice reads, so it makes the same
 * promises earlier and louder.
 *
 * Tiers come from the same source the document uses, so the two cannot drift.
 */
export function kickoffTierBlockKey(service: ClientServiceKey, tier: ServiceTier): string {
  return `${SERVICE_BLOCK_KEYS[service]}_${tier}`;
}

/** Fixed order the service blocks appear in the message. */
const SERVICE_ORDER: ClientServiceKey[] = ["seo", "ppc", "smm", "blog", "orm"];

/** The full set of master block keys, in render order (intro → services → closing). */
export const KICKOFF_BLOCK_KEYS = [
  "intro",
  ...SERVICE_ORDER.flatMap((service) => [
    SERVICE_BLOCK_KEYS[service],
    ...SERVICE_TIERS[service].map((tier) => kickoffTierBlockKey(service, tier)),
  ]),
  "closing",
] as const;

/** e.g. "Q1 2026" — quarter is wall-clock, derived from the message's creation date. */
export function quarterLabel(date: Date = new Date()): string {
  const quarter = Math.floor(date.getMonth() / 3) + 1;
  return `Q${quarter} ${date.getFullYear()}`;
}

/** e.g. "Marketing Services - Q1 2026". */
export function kickoffThreadTitle(date: Date = new Date()): string {
  return `Marketing Services - ${quarterLabel(date)}`;
}

export type MergeContext = {
  clientName: string;
  strategist: string;
  quarterLabel: string;
};

/** Replaces {{client_name}}, {{strategist}}, {{quarter_label}} throughout the text. */
export function applyMergeFields(text: string, ctx: MergeContext): string {
  return text
    .replaceAll("{{client_name}}", ctx.clientName)
    .replaceAll("{{strategist}}", ctx.strategist)
    .replaceAll("{{quarter_label}}", ctx.quarterLabel);
}

export type AssembleContext = {
  clientName: string;
  strategist: string;
  quarterLabel: string;
  activeServices: ClientActiveServices;
  /**
   * The raw stored plan values ("Premium", "4"), which decide the tier. Omitted,
   * every service falls back to its shared block — exactly what the message
   * said before tiers existed.
   */
  serviceValues?: Partial<Record<ClientServiceKey, string | null>>;
};

/**
 * Builds the kickoff message body: intro, then a block for each active service in
 * fixed order, then closing — with merge fields substituted. Blocks with no body,
 * or for inactive services, are skipped.
 */
export function assembleKickoffBody(blocks: KickoffBlock[], ctx: AssembleContext): string {
  const byKey = new Map(blocks.map((b) => [b.block_key, b.body]));
  const parts: string[] = [];

  const intro = byKey.get("intro");
  if (intro?.trim()) parts.push(intro.trim());

  for (const service of SERVICE_ORDER) {
    if (!ctx.activeServices[service]) continue;
    const tier = resolveServiceTier(service, ctx.serviceValues?.[service] ?? null);
    // The tier's own wording when it has been written; the shared block
    // otherwise, so a tier nobody has written copy for degrades to what the
    // message always said rather than to silence.
    const tierBody = tier ? byKey.get(kickoffTierBlockKey(service, tier)) : undefined;
    const body = tierBody?.trim() ? tierBody : byKey.get(SERVICE_BLOCK_KEYS[service]);
    if (body?.trim()) parts.push(body.trim());
  }

  const closing = byKey.get("closing");
  if (closing?.trim()) parts.push(closing.trim());

  return applyMergeFields(parts.join("\n\n"), {
    clientName: ctx.clientName,
    strategist: ctx.strategist,
    quarterLabel: ctx.quarterLabel,
  });
}
