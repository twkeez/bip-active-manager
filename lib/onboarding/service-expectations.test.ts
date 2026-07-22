import { describe, expect, it } from "vitest";
import {
  applyExpectationMergeFields,
  assembleServiceExpectations,
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
