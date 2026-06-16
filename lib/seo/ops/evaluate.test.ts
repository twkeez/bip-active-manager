import { describe, expect, it } from "vitest";
import { evaluateSeoOpsClient, emptySeoOpsContext } from "@/lib/seo/ops/evaluate";
import type { SeoOpsTemplate } from "@/lib/seo/ops/types";
import type { ClientRow } from "@/lib/types/client";

const templates: SeoOpsTemplate[] = [
  {
    id: 1,
    item_key: "weekly_gsc_sanity",
    label: "GSC sanity",
    cadence: "weekly",
    verification: "auto:gsc_health",
    sort_order: 10,
    requires_service: "seo",
    is_active: true,
    created_at: "",
    updated_at: "",
  },
];

const seoClient = {
  id: 1,
  account_name: "Test Vet",
  marketing_strategist: "Tom",
  seo: "Y",
  blog: null,
} as ClientRow;

describe("evaluateSeoOpsClient", () => {
  it("marks gsc sanity incomplete without snapshot", () => {
    const evaluation = evaluateSeoOpsClient(seoClient, templates, [], emptySeoOpsContext());
    expect(evaluation.weeklyItems[0]?.done).toBe(false);
    expect(evaluation.weeklyItems[0]?.hint).toContain("Sync Search Console");
  });

  it("skips items when SEO inactive", () => {
    const inactive = { ...seoClient, seo: "N" } as ClientRow;
    const evaluation = evaluateSeoOpsClient(inactive, templates, [], emptySeoOpsContext());
    expect(evaluation.weeklyItems[0]?.skipped).toBe(true);
  });
});
