import { describe, expect, it } from "vitest";
import { partitionClients, type EligibilityInput } from "@/lib/daily-brief/eligibility";
import { compareBriefClients, countByTier, reasonsFor, tierFor } from "@/lib/daily-brief/prioritize";
import type { BriefClient } from "@/lib/daily-brief/types";

const none = { escalatedThreads: 0, needsYou: 0, watch: 0, blindSpots: 0 };

describe("tierFor", () => {
  it("puts onboarding and pending-launch clients first, whatever else is true", () => {
    expect(tierFor({ ...none, lifecycle: "onboarding" })).toBe(1);
    expect(tierFor({ ...none, lifecycle: "launch" })).toBe(1);
    expect(tierFor({ lifecycle: "onboarding", escalatedThreads: 2, needsYou: 3, watch: 1, blindSpots: 1 })).toBe(1);
  });

  it("ranks a chasing client above one with a finding", () => {
    expect(tierFor({ ...none, lifecycle: "active", escalatedThreads: 1, needsYou: 4 })).toBe(2);
  });

  it("then needs-action, then watch or blind spots, then quiet", () => {
    expect(tierFor({ ...none, lifecycle: "active", needsYou: 1, watch: 2 })).toBe(3);
    expect(tierFor({ ...none, lifecycle: "active", watch: 1 })).toBe(4);
    expect(tierFor({ ...none, lifecycle: "active", blindSpots: 1 })).toBe(4);
    expect(tierFor({ ...none, lifecycle: "active" })).toBe(5);
  });
});

describe("reasonsFor", () => {
  it("says what is blocking a launch client and still lists what else was found", () => {
    expect(reasonsFor({ ...none, lifecycle: "launch", needsYou: 1 })).toEqual([
      "Onboarding, waiting on the website to launch",
      "1 finding needs action",
    ]);
  });

  it("is empty for a quiet active client", () => {
    expect(reasonsFor({ ...none, lifecycle: "active" })).toEqual([]);
  });
});

function client(overrides: Partial<BriefClient> & { name: string; tier: BriefClient["tier"] }): BriefClient {
  return {
    clientId: 1,
    lifecycle: "active",
    reasons: [],
    services: [],
    strategists: [],
    findings: [],
    blindSpots: [],
    escalatedThreads: [],
    awaitingReplyCount: 0,
    watch: null,
    ...overrides,
  };
}

const needsYou = (id: string) => ({ id, scope: "account" as const, level: "needs_you" as const, headline: id });

describe("compareBriefClients", () => {
  it("orders by tier, then by how much needs action, then by name", () => {
    const list = [
      client({ name: "Zeta", tier: 3, findings: [needsYou("a")] }),
      client({ name: "Alpha", tier: 3, findings: [needsYou("a")] }),
      client({ name: "Busy", tier: 3, findings: [needsYou("a"), needsYou("b")] }),
      client({ name: "Quiet", tier: 5 }),
      client({ name: "New", tier: 1, lifecycle: "onboarding" }),
    ];
    expect([...list].sort(compareBriefClients).map((c) => c.name)).toEqual(["New", "Busy", "Alpha", "Zeta", "Quiet"]);
  });
});

describe("countByTier", () => {
  it("always reports all five tiers", () => {
    expect(countByTier([{ tier: 1 }, { tier: 5 }, { tier: 5 }])).toEqual({ 1: 1, 2: 0, 3: 0, 4: 0, 5: 2 });
  });
});

const base = (overrides: Partial<EligibilityInput> & { id: number }): EligibilityInput => ({
  onboarding_status: null,
  awaiting_website_launch: false,
  tier: null,
  seo: "Premium",
  ppc: null,
  smm: null,
  blog: null,
  orm: null,
  ...overrides,
});

describe("partitionClients", () => {
  it("leaves out website-only, paused and service-less accounts, and counts each", () => {
    const { included, excluded } = partitionClients([
      base({ id: 1 }),
      base({ id: 2, is_website_only: true }),
      base({ id: 3, is_low_contact: true }),
      base({ id: 4, seo: "N/A" }),
    ]);
    expect(included.map((c) => c.row.id)).toEqual([1]);
    expect(excluded).toEqual({ websiteOnly: 1, paused: 1, noServices: 1 });
  });

  it("keeps onboarding and pending-launch clients even before any service has started", () => {
    const { included } = partitionClients([
      base({ id: 1, onboarding_status: "active", seo: null }),
      base({ id: 2, awaiting_website_launch: true, onboarding_status: "active", seo: null }),
    ]);
    expect(included.map((c) => [c.row.id, c.lifecycle])).toEqual([
      [1, "onboarding"],
      [2, "launch"],
    ]);
  });

  it("never lets a website-only account in, even mid-onboarding", () => {
    const { included, excluded } = partitionClients([
      base({ id: 1, onboarding_status: "active", is_website_only: true }),
    ]);
    expect(included).toEqual([]);
    expect(excluded.websiteOnly).toBe(1);
  });
});
