import { describe, expect, it } from "vitest";
import { buildClientPlan, clientPlanSummary, resolveScopeRows } from "@/lib/services/client-plan";
import { SERVICE_TIER_TABLES } from "@/lib/services/tier-content";
import type { ClientServiceKey } from "@/lib/clients/types";

type Services = Pick<Record<ClientServiceKey, string | null>, ClientServiceKey>;

function client(overrides: Partial<Services>): Services {
  return { seo: "N", ppc: "N", smm: "N", blog: "N", orm: "N", ...overrides };
}

describe("buildClientPlan", () => {
  it("resolves a tier label to the matching scope column", () => {
    const [entry] = buildClientPlan(client({ seo: "Premium Plus" }), SERVICE_TIER_TABLES);
    expect(entry.service).toBe("seo");
    expect(entry.kind).toBe("tiered");
    expect(entry.tierKey).toBe("premium_plus");
    expect(entry.table?.key).toBe("seo");
    expect(entry.tierLabel).toBe("Premium Plus");
  });

  it("maps smm onto the social scope table", () => {
    const [entry] = buildClientPlan(client({ smm: "Premium" }), SERVICE_TIER_TABLES);
    expect(entry.table?.key).toBe("social");
    expect(entry.tierKey).toBe("premium");
  });

  // Real values seen in the client seed: "N", "0", "", "#N/A".
  it("leaves out services the client isn't on", () => {
    for (const value of ["N", "n", "0", "", "  ", "#N/A", "none"]) {
      expect(buildClientPlan(client({ seo: value }), SERVICE_TIER_TABLES), value).toHaveLength(0);
    }
  });

  it("tolerates the spacing and casing variants in the client data", () => {
    for (const value of ["Premium Plus", "premium plus", "  Premium  Plus ", "premium_plus", "PREMIUM PLUS"]) {
      const [entry] = buildClientPlan(client({ ppc: value }), SERVICE_TIER_TABLES);
      expect(entry?.tierKey, value).toBe("premium_plus");
    }
  });

  it("treats blog as a monthly count, not a tier", () => {
    const [entry] = buildClientPlan(client({ blog: "2" }), SERVICE_TIER_TABLES);
    expect(entry.kind).toBe("count");
    expect(entry.rawValue).toBe("2");
    expect(entry.table).toBeNull();
    expect(entry.tierKey).toBeNull();
  });

  it("keeps ORM visible by name even with no scope table published", () => {
    const [entry] = buildClientPlan(client({ orm: "Premium" }), SERVICE_TIER_TABLES);
    expect(entry.service).toBe("orm");
    expect(entry.kind).toBe("unreferenced");
    expect(entry.tierLabel).toBe("Premium");
    expect(entry.table).toBeNull();
  });

  it("keeps a service whose tier doesn't match any published column", () => {
    const [entry] = buildClientPlan(client({ seo: "Legacy Gold" }), SERVICE_TIER_TABLES);
    expect(entry.kind).toBe("unreferenced");
    expect(entry.tierLabel).toBe("Legacy Gold");
  });

  it("returns active services in a stable order", () => {
    const plan = buildClientPlan(
      client({ orm: "Premium", blog: "5", ppc: "Foundation", seo: "Premium" }),
      SERVICE_TIER_TABLES,
    );
    expect(plan.map((entry) => entry.service)).toEqual(["seo", "ppc", "blog", "orm"]);
  });

  it("returns nothing for a client on no services", () => {
    expect(buildClientPlan(client({}), SERVICE_TIER_TABLES)).toEqual([]);
  });

  describe("clientPlanSummary", () => {
    it("names each service with its tier", () => {
      expect(
        clientPlanSummary(client({ seo: "Premium Plus", ppc: "Foundation" })),
      ).toEqual(["SEO Premium Plus", "PPC Foundation"]);
    });

    it("renders blog as a monthly count", () => {
      expect(clientPlanSummary(client({ blog: "2" }))).toEqual(["Blog 2/mo"]);
    });

    it("includes ORM even though it has no scope table", () => {
      expect(clientPlanSummary(client({ orm: "Premium" }))).toEqual([
        "Reputation (ORM) Premium",
      ]);
    });

    it("leaves out inactive services", () => {
      expect(clientPlanSummary(client({ seo: "N", ppc: "0", smm: "" }))).toEqual([]);
    });
  });

  // Tier cells are written as additions to the tier below, so a client's real
  // scope is every tier up to theirs.
  describe("resolveScopeRows", () => {
    const seo = SERVICE_TIER_TABLES.find((t) => t.key === "seo")!;

    it("gives Foundation only its own cells", () => {
      const [row] = resolveScopeRows(seo, "foundation");
      expect(row.items).toEqual(seo.rows[0].cells[0]);
    });

    it("accumulates lower tiers into the client's tier", () => {
      const [foundation] = resolveScopeRows(seo, "foundation");
      const [premium] = resolveScopeRows(seo, "premium");
      const [premiumPlus] = resolveScopeRows(seo, "premium_plus");

      expect(premium.items.length).toBeGreaterThan(foundation.items.length);
      expect(premiumPlus.items.length).toBeGreaterThan(premium.items.length);
      // Everything Foundation gets, Premium Plus also gets.
      for (const item of foundation.items) {
        expect(premiumPlus.items).toContain(item);
      }
    });

    it("drops the comparison '+' once tiers are merged", () => {
      const rows = resolveScopeRows(seo, "premium_plus");
      for (const row of rows) {
        for (const item of row.items) {
          expect(item.startsWith("+")).toBe(false);
        }
      }
    });

    it("returns nothing for a tier the table doesn't define", () => {
      expect(resolveScopeRows(seo, "legacy_gold")).toEqual([]);
    });
  });

  // The real row that prompted this view: SEO Premium Plus, PPC Foundation,
  // everything else off.
  it("handles a real client row end to end", () => {
    const plan = buildClientPlan(
      client({ blog: "0", smm: "N", seo: "Premium Plus", ppc: "Foundation", orm: "N" }),
      SERVICE_TIER_TABLES,
    );
    expect(plan).toHaveLength(2);
    expect(plan[0]).toMatchObject({ service: "seo", tierKey: "premium_plus", kind: "tiered" });
    expect(plan[1]).toMatchObject({ service: "ppc", tierKey: "foundation", kind: "tiered" });
  });
});
