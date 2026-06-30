import type { ClientActiveServices, ClientServiceKey } from "@/lib/clients/types";

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

/** Fixed order the service blocks appear in the message. */
const SERVICE_ORDER: ClientServiceKey[] = ["seo", "ppc", "smm", "blog", "orm"];

/** The full set of master block keys, in render order (intro → services → closing). */
export const KICKOFF_BLOCK_KEYS = [
  "intro",
  ...SERVICE_ORDER.map((s) => SERVICE_BLOCK_KEYS[s]),
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
    const body = byKey.get(SERVICE_BLOCK_KEYS[service]);
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
