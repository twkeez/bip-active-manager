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

/**
 * True for quiet accounts: no Basecamp project or Harvest IDs are expected, and
 * they list as Paused rather than looking like a live client gone silent.
 *
 * Reads the dedicated `is_low_contact` column, falling back to the legacy
 * `tier === "Low Contact"` text while both exist. The fallback means the column
 * can be added, backfilled, and the `tier` values retired in any order without a
 * window where these clients start throwing setup warnings. Once `tier` is
 * cleared the fallback simply never matches, and it can be deleted.
 */
export function isLowContact(
  client: Pick<ClientRow, "tier"> & { is_low_contact?: boolean | null },
) {
  if (typeof client.is_low_contact === "boolean") return client.is_low_contact;
  return isLowContactTier(client.tier);
}

/** @deprecated Prefer isLowContact(client) — the tier column is being retired. */
export function isLowContactTier(tier: string | null | undefined) {
  return norm(tier).toLowerCase() === "low contact";
}

/**
 * True for website-build-only accounts, which are hidden from the client lists
 * behind a "show website-only clients" toggle. 154 of 248 clients today, so this
 * decides what the list looks like more than any other single field.
 *
 * Same column-with-text-fallback shape as isLowContact, for the same reason: the
 * migration and the deploy can land in either order. The legacy comparison is
 * exact and case-sensitive, matching the behaviour it replaces — a client whose
 * tier reads "website only" was never hidden, and still isn't.
 */
export function isWebsiteOnly(
  client: Pick<ClientRow, "tier"> & { is_website_only?: boolean | null },
) {
  if (typeof client.is_website_only === "boolean") return client.is_website_only;
  return client.tier === "Website Only";
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
