import { describe, expect, it } from "vitest";
import {
  SERVICE_EXPECTATION_BLOCK_KEYS,
  applyExpectationMergeFields,
  assembleServiceExpectations,
  cityForCopy,
  resolveServiceTier,
  serviceSectionTitle,
  type ExpectationBlock,
} from "@/lib/onboarding/service-expectations";
import type { ClientActiveServices } from "@/lib/clients/types";

const NONE: ClientActiveServices = { blog: false, smm: false, seo: false, ppc: false, orm: false };

const BLOCKS: ExpectationBlock[] = [
  { block_key: "intro", body: "Hi {{client_name}} from {{strategist}}.", sort_order: 10 },
  { block_key: "timetable", body: "Weeks 1–2: setup.", sort_order: 20 },
  { block_key: "seo_expect", body: "SEO expect.", sort_order: 100 },
  { block_key: "seo_need", body: "SEO need.", sort_order: 101 },
  { block_key: "seo_recommend", body: "SEO recommend.", sort_order: 102 },
  { block_key: "ppc_expect", body: "PPC expect.", sort_order: 110 },
  { block_key: "ppc_need", body: "PPC need.", sort_order: 111 },
  { block_key: "ppc_recommend", body: "PPC recommend.", sort_order: 112 },
  { block_key: "smm_expect", body: "SMM expect.", sort_order: 120 },
  { block_key: "smm_need", body: "", sort_order: 121 },
  { block_key: "smm_recommend", body: "", sort_order: 122 },
  { block_key: "closing", body: "Talk soon, {{strategist}}.", sort_order: 900 },
];

const ctx = { clientName: "Happy Paws Vet", strategist: "Tom" };

describe("applyExpectationMergeFields", () => {
  it("replaces every merge field, including repeats", () => {
    const out = applyExpectationMergeFields("{{strategist}} & {{strategist}} for {{client_name}}", ctx);
    expect(out).toBe("Tom & Tom for Happy Paws Vet");
  });
});

describe("assembleServiceExpectations", () => {
  it("includes only active services, in fixed order, merge-substituted", () => {
    const model = assembleServiceExpectations(BLOCKS, {
      ...ctx,
      activeServices: { ...NONE, seo: true, ppc: true },
    });
    expect(model.services.map((s) => s.key)).toEqual(["seo", "ppc"]);
    expect(model.intro).toBe("Hi Happy Paws Vet from Tom.");
    expect(model.closing).toBe("Talk soon, Tom.");
    expect(model.timetable).toBe("Weeks 1–2: setup.");
  });

  it("carries the three structured fields per service with client-facing labels", () => {
    const model = assembleServiceExpectations(BLOCKS, { ...ctx, activeServices: { ...NONE, seo: true } });
    const seo = model.services[0]!;
    expect(seo.label).toBe("SEO");
    expect(seo.expect).toBe("SEO expect.");
    expect(seo.need).toBe("SEO need.");
    expect(seo.recommend).toBe("SEO recommend.");
  });

  it("drops empty fields but keeps a service that has at least one field", () => {
    // SMM has only `expect`; need/recommend are empty.
    const model = assembleServiceExpectations(BLOCKS, { ...ctx, activeServices: { ...NONE, smm: true } });
    expect(model.services).toHaveLength(1);
    const smm = model.services[0]!;
    expect(smm.expect).toBe("SMM expect.");
    expect(smm.need).toBe("");
    expect(smm.recommend).toBe("");
  });

  it("omits a service entirely when active but all three fields are empty", () => {
    const model = assembleServiceExpectations(BLOCKS, { ...ctx, activeServices: { ...NONE, orm: true } });
    expect(model.services).toHaveLength(0);
  });
});

describe("glossary in the assembled document", () => {
  const blocks = [
    { block_key: "seo_expect", body: "SEO takes time.", sort_order: 0 },
    { block_key: "ppc_expect", body: "Ads are quicker.", sort_order: 1 },
  ];
  const terms = [
    { term: "Map Pack", definition: "The three local results.", services: ["seo" as const], sortOrder: 10 },
    { term: "Quality Score", definition: "Google's ad rating.", services: ["ppc" as const], sortOrder: 20 },
    { term: "Impressions", definition: "Times you were shown.", services: [], sortOrder: 30 },
  ];

  it("includes only the terms that match the services bought", () => {
    const model = assembleServiceExpectations(blocks, {
      clientName: "Happy Paws",
      strategist: "Tom",
      activeServices: { seo: true, ppc: false, smm: false, blog: false, orm: false },
      glossary: terms,
    });
    expect(model.glossary.map((t) => t.term)).toEqual(["Map Pack", "Impressions"]);
  });

  it("is empty rather than absent when no glossary has been authored", () => {
    const model = assembleServiceExpectations(blocks, {
      clientName: "Happy Paws",
      strategist: "Tom",
      activeServices: { seo: true, ppc: false, smm: false, blog: false, orm: false },
    });
    expect(model.glossary).toEqual([]);
  });
});

describe("tier-specific What to expect", () => {
  const blocks: ExpectationBlock[] = [
    { block_key: "seo_expect", body: "Shared SEO.", sort_order: 0 },
    { block_key: "seo_expect_foundation", body: "Foundation SEO in {{city}}.", sort_order: 0 },
    { block_key: "seo_expect_premium", body: "", sort_order: 0 },
    { block_key: "orm_expect", body: "Shared reviews.", sort_order: 0 },
    { block_key: "blog_expect", body: "Shared blog.", sort_order: 0 },
  ];
  const active = { ...NONE, seo: true, orm: true, blog: true };

  // The failure this exists for: a Foundation client was told we would
  // optimize their pages, which starts at Premium.
  it("gives a client the copy for the tier they bought", () => {
    const model = assembleServiceExpectations(blocks, {
      ...ctx,
      city: "Oshawa, Ontario, Canada",
      activeServices: active,
      serviceValues: { seo: "Foundation" },
    });
    expect(model.services.find((s) => s.key === "seo")?.expect).toBe("Foundation SEO in Oshawa.");
  });

  it("falls back to the shared copy while a tier has nothing written", () => {
    const model = assembleServiceExpectations(blocks, {
      ...ctx,
      activeServices: active,
      serviceValues: { seo: "Premium" },
    });
    expect(model.services.find((s) => s.key === "seo")?.expect).toBe("Shared SEO.");
  });

  it("falls back for a value that is not a tier we sell", () => {
    const model = assembleServiceExpectations(blocks, {
      ...ctx,
      activeServices: active,
      serviceValues: { seo: "Legacy" },
    });
    const seo = model.services.find((s) => s.key === "seo")!;
    expect(seo.expect).toBe("Shared SEO.");
    expect(seo.planLabel).toBeNull();
  });

  it("names the plan on each section, and the post count for Blog", () => {
    const model = assembleServiceExpectations(blocks, {
      ...ctx,
      activeServices: active,
      serviceValues: { seo: "Foundation", orm: "Premium", blog: "2" },
    });
    const titles = model.services.map(serviceSectionTitle);
    expect(titles).toEqual(["SEO · Foundation", "Blog · 2 posts a month", "Reviews · Premium"]);
  });

  // One live client has "Foundation" in its Blog field. Printing "Blog ·
  // Foundation" would state a plan that does not exist.
  it("prints no plan for a Blog value that is not a post count", () => {
    const model = assembleServiceExpectations(blocks, {
      ...ctx,
      activeServices: active,
      serviceValues: { blog: "Foundation" },
    });
    expect(model.services.find((s) => s.key === "blog")?.planLabel).toBeNull();
  });

  it("does not offer Reputation a Premium Plus it is never sold at", () => {
    expect(resolveServiceTier("orm", "Premium Plus")).toBeNull();
    expect(resolveServiceTier("smm", "Premium Plus")).toBe("premium_plus");
  });

  it("gives the editor a field per tier, and none for Blog", () => {
    expect(SERVICE_EXPECTATION_BLOCK_KEYS).toContain("seo_expect_premium_plus");
    expect(SERVICE_EXPECTATION_BLOCK_KEYS).toContain("orm_expect_premium");
    expect(SERVICE_EXPECTATION_BLOCK_KEYS).not.toContain("orm_expect_premium_plus");
    expect(SERVICE_EXPECTATION_BLOCK_KEYS.some((k) => k.startsWith("blog_expect_"))).toBe(false);
  });
});

describe("merge fields", () => {
  // Stored geocoder-style; the whole string reads badly in a sentence.
  it("uses just the town from a stored city", () => {
    expect(cityForCopy("Oshawa, Ontario, Canada")).toBe("Oshawa");
    expect(cityForCopy("Boulder")).toBe("Boulder");
    expect(cityForCopy(null)).toBe("");
  });

  it("falls back to wording that still reads when a value is missing", () => {
    const out = applyExpectationMergeFields("{{strategist}} will call. A vet in {{city}}.", {
      clientName: "X",
      strategist: "  ",
      city: null,
    });
    expect(out).toBe("Your strategist will call. A vet in your area.");
  });

  it("merges the glossary definitions too", () => {
    const model = assembleServiceExpectations([], {
      ...ctx,
      city: "Oshawa, Ontario, Canada",
      activeServices: { ...NONE, seo: true },
      glossary: [
        { term: "Keyword", definition: "Like \"emergency vet in {{city}}\".", services: ["seo"], sortOrder: 0 },
      ],
    });
    expect(model.glossary[0].definition).toBe('Like "emergency vet in Oshawa".');
  });
});
