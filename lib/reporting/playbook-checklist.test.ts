import { describe, expect, it } from "vitest";
import { loadPlaybookChecklist } from "@/lib/reporting/playbook-checklist";
import type { ClientRow } from "@/lib/types/client";

// Minimal chainable stand-in for the Supabase query builder: records the
// tier keys passed to .in() and resolves to the given rows.
function fakeSupabase(rows: unknown[]) {
  const calls: { inValues: string[] | null; queried: boolean } = { inValues: null, queried: false };
  const builder = {
    select: () => builder,
    in: (_col: string, values: string[]) => {
      calls.inValues = values;
      return builder;
    },
    eq: () => builder,
    order: () => builder,
    then: (resolve: (v: { data: unknown[] }) => unknown) => resolve({ data: rows }),
  };
  const supabase = {
    from: () => {
      calls.queried = true;
      return builder;
    },
  };
  return { supabase: supabase as never, calls };
}

const base = { seo: null, ppc: null, smm: null, orm: null, blog: null } as unknown as ClientRow;

describe("loadPlaybookChecklist", () => {
  it("queries playbook tier keys, not raw column values", async () => {
    const { supabase, calls } = fakeSupabase([]);
    await loadPlaybookChecklist(supabase, {
      ...base,
      seo: "Premium",
      ppc: "Premium Plus",
      blog: "Standard",
    });
    expect(calls.inValues).toEqual(["seo-premium", "ppc-premium-plus", "blog-standard"]);
  });

  it("skips the query when the client has no active services", async () => {
    const { supabase, calls } = fakeSupabase([]);
    expect(await loadPlaybookChecklist(supabase, { ...base, seo: "N" })).toEqual([]);
    expect(calls.queried).toBe(false);
  });

  it("marks items without an auto-verify key as manual", async () => {
    const { supabase } = fakeSupabase([
      { id: 1, title: "Set up GBP", category: "Setup", tier_key: "seo-foundation", type: "checklist", auto_verify_key: null },
    ]);
    const result = await loadPlaybookChecklist(supabase, { ...base, seo: "Foundation" });
    expect(result).toEqual([
      { id: 1, title: "Set up GBP", category: "Setup", tier_key: "seo-foundation", type: "checklist", status: "manual", verify_label: null },
    ]);
  });
});
