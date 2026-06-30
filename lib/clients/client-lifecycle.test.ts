import { describe, expect, it } from "vitest";
import { clientStage, stageLabel } from "@/lib/clients/client-lifecycle";
import { getClientTierKeys } from "@/lib/playbook/client-tiers";
import type { ClientRow } from "@/lib/types/client";

describe("clientStage", () => {
  it("maps complete onboarding to active", () => {
    expect(clientStage("complete")).toBe("active");
    expect(stageLabel(clientStage("complete"))).toBe("Active");
  });

  it("treats in-progress and not-started as onboarding", () => {
    expect(clientStage("active")).toBe("onboarding");
    expect(clientStage(null)).toBe("onboarding");
    expect(stageLabel(clientStage(null))).toBe("Onboarding");
  });
});

describe("getClientTierKeys — Blog", () => {
  const base = { blog: null, smm: null, seo: null, ppc: null, orm: null } as unknown as ClientRow;

  it("maps an active blog service to a blog tier", () => {
    expect(getClientTierKeys({ ...base, blog: "Premium" })).toContain("blog-premium");
    expect(getClientTierKeys({ ...base, blog: "Standard" })).toContain("blog-standard");
    expect(getClientTierKeys({ ...base, blog: "Yes" })).toContain("blog-standard");
  });

  it("omits blog when the service is inactive", () => {
    expect(getClientTierKeys({ ...base, blog: "N" })).not.toContain("blog-standard");
    expect(getClientTierKeys({ ...base, blog: null })).toEqual([]);
  });
});
