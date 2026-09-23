import type { ClientServiceKey } from "@/lib/clients/types";
import type { ServiceTierTable } from "@/lib/services/tier-content";
import { resolveScopeRows } from "@/lib/services/client-plan";
import type { ServiceTier } from "@/lib/onboarding/service-expectations";

/**
 * What a tier actually includes, shown beside the copy that promises it.
 *
 * Shared by the two places tier copy is written — the client document and the
 * kickoff message — because both can promise unbought work, and a writer
 * checking against the published scope is what stops that.
 */

/** Which published scope table backs each service. Reputation has none yet. */
const SCOPE_TABLE_KEY: Record<ClientServiceKey, string | null> = {
  seo: "seo",
  ppc: "ppc",
  smm: "social",
  blog: null,
  orm: null,
};

/**
 * What a tier actually includes, beside the copy promising it — the same scope
 * table "What this tier includes" shows. It is there so drift is visible while
 * writing: a tier's text should never promise anything missing from this list.
 */
export default function ScopeReference({
  service,
  tier,
  tables,
}: {
  service: ClientServiceKey;
  tier: ServiceTier;
  tables: ServiceTierTable[];
}) {
  const tableKey = SCOPE_TABLE_KEY[service];
  const table = tableKey ? tables.find((candidate) => candidate.key === tableKey) : undefined;
  const rows = table ? resolveScopeRows(table, tier) : [];
  if (rows.length === 0) {
    return (
      <p className="text-[11px] text-amber-600">
        No written scope for this tier, so there is nothing to check this copy against. Write it
        conservatively.
      </p>
    );
  }
  return (
    <p className="rounded bg-bip-fill/60 px-2 py-1.5 text-[11px] leading-relaxed text-bip-muted">
      <span className="font-semibold">This tier includes: </span>
      {rows.map((row) => `${row.label}: ${row.items.join(", ")}`).join(" · ")}
    </p>
  );
}

