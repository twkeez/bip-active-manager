import { describe, expect, it } from "vitest";
import {
  applyMergeFields,
  assembleKickoffBody,
  kickoffThreadTitle,
  quarterLabel,
  type KickoffBlock,
} from "@/lib/clients/onboarding-kickoff";
import type { ClientActiveServices } from "@/lib/clients/types";

const NONE: ClientActiveServices = { blog: false, smm: false, seo: false, ppc: false, orm: false };

const BLOCKS: KickoffBlock[] = [
  { block_key: "intro", body: "Hi from {{strategist}} at {{client_name}} for {{quarter_label}}.", sort_order: 10 },
  { block_key: "svc_seo", body: "SEO block.", sort_order: 20 },
  { block_key: "svc_ppc", body: "PPC block.", sort_order: 30 },
  { block_key: "svc_smm", body: "SMM block.", sort_order: 40 },
  { block_key: "svc_blog", body: "Blog block.", sort_order: 50 },
  { block_key: "svc_orm", body: "ORM block.", sort_order: 60 },
  { block_key: "closing", body: "Talk soon, {{strategist}}.", sort_order: 70 },
];

describe("quarterLabel / kickoffThreadTitle", () => {
  it("maps months to the right quarter", () => {
    expect(quarterLabel(new Date(2026, 0, 15))).toBe("Q1 2026"); // Jan
    expect(quarterLabel(new Date(2026, 3, 1))).toBe("Q2 2026"); // Apr
    expect(quarterLabel(new Date(2026, 6, 9))).toBe("Q3 2026"); // Jul
    expect(quarterLabel(new Date(2026, 11, 31))).toBe("Q4 2026"); // Dec
  });

  it("builds the thread title", () => {
    expect(kickoffThreadTitle(new Date(2026, 0, 15))).toBe("Marketing Services - Q1 2026");
  });
});

describe("applyMergeFields", () => {
  it("replaces every merge field, including repeats", () => {
    const out = applyMergeFields("{{strategist}} & {{strategist}} for {{client_name}}", {
      clientName: "Happy Paws",
      strategist: "Tom",
      quarterLabel: "Q1 2026",
    });
    expect(out).toBe("Tom & Tom for Happy Paws");
  });
});

describe("assembleKickoffBody", () => {
  const ctx = {
    clientName: "Happy Paws Vet",
    strategist: "Tom",
    quarterLabel: "Q1 2026",
  };

  it("includes only blocks for active services, in fixed order", () => {
    const body = assembleKickoffBody(BLOCKS, {
      ...ctx,
      activeServices: { ...NONE, seo: true, smm: true },
    });
    expect(body).toContain("SEO block.");
    expect(body).toContain("SMM block.");
    expect(body).not.toContain("PPC block.");
    expect(body).not.toContain("Blog block.");
    expect(body.indexOf("SEO block.")).toBeLessThan(body.indexOf("SMM block."));
  });

  it("always frames with intro and closing, merge-substituted", () => {
    const body = assembleKickoffBody(BLOCKS, { ...ctx, activeServices: { ...NONE, seo: true } });
    expect(body.startsWith("Hi from Tom at Happy Paws Vet for Q1 2026.")).toBe(true);
    expect(body.endsWith("Talk soon, Tom.")).toBe(true);
  });

  it("omits a service block when its body is empty", () => {
    const blocks = BLOCKS.map((b) => (b.block_key === "svc_seo" ? { ...b, body: "  " } : b));
    const body = assembleKickoffBody(blocks, { ...ctx, activeServices: { ...NONE, seo: true } });
    expect(body).not.toContain("SEO block.");
  });
});
