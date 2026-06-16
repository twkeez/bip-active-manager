import type { ClientRow } from "@/lib/types/client";
import type { ClientActiveServices, ClientServiceKey } from "@/lib/clients/types";

const INACTIVE_VALUES = new Set(["", "n", "no", "none", "0", "false", "na", "n/a", "#n/a"]);

export function norm(value: string | null | undefined) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

export function isServiceActive(value: string | null | undefined) {
  const normalized = norm(value).toLowerCase();
  if (!normalized) return false;
  return !INACTIVE_VALUES.has(normalized);
}

export function isLowContactTier(tier: string | null | undefined) {
  return norm(tier).toLowerCase() === "low contact";
}

export function getClientActiveServices(client: Pick<ClientRow, ClientServiceKey>): ClientActiveServices {
  return {
    blog: isServiceActive(client.blog),
    smm: isServiceActive(client.smm),
    seo: isServiceActive(client.seo),
    ppc: isServiceActive(client.ppc),
    orm: isServiceActive(client.orm),
  };
}

export function activeServiceLabels(services: ClientActiveServices) {
  const labels: string[] = [];
  if (services.seo) labels.push("SEO");
  if (services.ppc) labels.push("PPC");
  if (services.smm) labels.push("SMM");
  if (services.blog) labels.push("Blog");
  if (services.orm) labels.push("ORM");
  return labels;
}
