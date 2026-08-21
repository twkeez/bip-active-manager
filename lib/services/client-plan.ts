import type { ClientRow } from "@/lib/types/client";
import type { ClientServiceKey } from "@/lib/clients/types";
import { isServiceActive, norm } from "@/lib/clients/service-active";
import type { ServiceTierTable } from "@/lib/services/tier-content";

/**
 * Which reference table backs each service a client can buy.
 *
 * Three of the five line up with published scope tables. The other two don't,
 * and pretending otherwise would be worse than saying so:
 *
 *  - `blog` isn't tiered at all — the client field holds a post count (0/1/2/5/10).
 *  - `orm` is genuinely tiered in client data (Foundation, Premium) but no scope
 *    table has been written yet. Add one keyed "orm" and it lights up here with
 *    no further changes.
 */
const TABLE_KEY_BY_SERVICE: Record<ClientServiceKey, string | null> = {
  seo: "seo",
  ppc: "ppc",
  smm: "social",
  blog: null,
  orm: "orm",
};

const SERVICE_LABEL: Record<ClientServiceKey, string> = {
  seo: "SEO",
  ppc: "PPC",
  smm: "Social Media",
  blog: "Blog",
  orm: "Reputation (ORM)",
};

/** Display order — the services strategists ask about most, first. */
const SERVICE_ORDER: ClientServiceKey[] = ["seo", "ppc", "smm", "blog", "orm"];

export type ClientPlanEntry = {
  service: ClientServiceKey;
  label: string;
  /** Exactly what the client record says, e.g. "Premium Plus" or "2". */
  rawValue: string;
  /**
   * - `tiered`       — matched a scope table and a tier column within it
   * - `count`        — a quantity rather than a tier (Blog)
   * - `unreferenced` — the client is on a tier we have no scope content for
   */
  kind: "tiered" | "count" | "unreferenced";
  table: ServiceTierTable | null;
  /** Key of the tier column to highlight, when `kind` is "tiered". */
  tierKey: string | null;
  /** The tier as written on the client record, e.g. "Premium Plus". */
  tierLabel: string | null;
};

/** "Premium Plus" and "premium_plus" should both match the premium_plus column. */
function tierSlug(value: string) {
  return norm(value).toLowerCase().replace(/[\s-]+/g, "_");
}

function findTierKey(table: ServiceTierTable, value: string): string | null {
  const wanted = tierSlug(value);
  const match = table.tiers.find(
    (tier) => tierSlug(tier.key) === wanted || tierSlug(tier.label) === wanted,
  );
  return match?.key ?? null;
}

/**
 * One-line-per-service summary of what a client is on: ["SEO Premium",
 * "PPC Foundation", "Blog 2/mo"].
 *
 * Deliberately independent of the scope tables, so it can render anywhere the
 * client row is in hand — including client components that never load them.
 */
export function clientPlanSummary(
  client: Pick<ClientRow, ClientServiceKey>,
): string[] {
  const summary: string[] = [];

  for (const service of SERVICE_ORDER) {
    const rawValue = norm(client[service]);
    if (!isServiceActive(rawValue)) continue;

    if (service === "blog") {
      summary.push(`Blog ${rawValue}/mo`);
      continue;
    }
    summary.push(`${SERVICE_LABEL[service]} ${rawValue}`);
  }

  return summary;
}

export type ScopeRow = {
  label: string;
  note?: string;
  /** Everything the client gets for this row, lowest tier upward. */
  items: string[];
};

/**
 * Flattens a scope table into what one tier actually includes.
 *
 * The published cells are cumulative — Premium reads "+ Competitor tracking",
 * meaning on top of Foundation — so a client's real scope is every tier up to
 * and including theirs. Showing their column alone would omit most of what they
 * are paying for. The leading "+ " is dropped once the tiers are merged, since
 * it only made sense as a comparison between columns.
 */
export function resolveScopeRows(
  table: ServiceTierTable,
  tierKey: string,
): ScopeRow[] {
  const tierIndex = table.tiers.findIndex((tier) => tier.key === tierKey);
  if (tierIndex < 0) return [];

  return table.rows.map((row) => ({
    label: row.label,
    note: row.note,
    items: row.cells
      .slice(0, tierIndex + 1)
      .flat()
      .map((item) => item.replace(/^\+\s*/, "")),
  }));
}

/**
 * Builds what one client actually buys, resolved against the published scope
 * tables. Services the client isn't on are left out entirely — the point is to
 * answer "what is this client paying for", not to show the whole catalogue.
 */
export function buildClientPlan(
  client: Pick<ClientRow, ClientServiceKey>,
  tables: ServiceTierTable[],
): ClientPlanEntry[] {
  const entries: ClientPlanEntry[] = [];

  for (const service of SERVICE_ORDER) {
    const rawValue = norm(client[service]);
    if (!isServiceActive(rawValue)) continue;

    const label = SERVICE_LABEL[service];

    // Blog is a monthly post count, so there is no tier to resolve.
    if (service === "blog") {
      entries.push({
        service,
        label,
        rawValue,
        kind: "count",
        table: null,
        tierKey: null,
        tierLabel: null,
      });
      continue;
    }

    const tableKey = TABLE_KEY_BY_SERVICE[service];
    const table = tableKey
      ? (tables.find((candidate) => candidate.key === tableKey) ?? null)
      : null;
    const tierKey = table ? findTierKey(table, rawValue) : null;

    entries.push({
      service,
      label,
      rawValue,
      // A tier we can't resolve to published scope is still worth showing by
      // name — silently dropping it would hide that the client buys it at all.
      kind: table && tierKey ? "tiered" : "unreferenced",
      table: tierKey ? table : null,
      tierKey,
      tierLabel: rawValue,
    });
  }

  return entries;
}
