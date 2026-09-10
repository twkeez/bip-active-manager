import { describe, expect, it } from "vitest";
import { getClientTierKeys, ppcTierKey } from "@/lib/playbook/client-tiers";
import type { ClientRow } from "@/lib/types/client";

describe("ppcTierKey", () => {
  it("maps Foundation to ppc-foundation", () => {
    expect(ppcTierKey("Foundation")).toBe("ppc-foundation");
    expect(ppcTierKey("  foundation ")).toBe("ppc-foundation");
  });

  it("maps Premium to ppc-premium", () => {
    expect(ppcTierKey("Premium")).toBe("ppc-premium");
    expect(ppcTierKey("P")).toBe("ppc-premium");
  });

  it("maps Premium Plus to ppc-premium-plus", () => {
    expect(ppcTierKey("Premium Plus")).toBe("ppc-premium-plus");
    expect(ppcTierKey("Premium+")).toBe("ppc-premium-plus");
  });

  it("returns null for inactive values", () => {
    for (const value of [null, "", "  ", "N", "n", "0", "No", "false"]) {
      expect(ppcTierKey(value)).toBeNull();
    }
  });
});

describe("getClientTierKeys — PPC", () => {
  const base = { blog: null, smm: null, seo: null, ppc: null, orm: null } as unknown as ClientRow;

  it("gives a Foundation client the Foundation tier, not Premium", () => {
    const keys = getClientTierKeys({ ...base, ppc: "Foundation" });
    expect(keys).toEqual(["ppc-foundation"]);
  });
});
