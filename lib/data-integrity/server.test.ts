import { afterEach, describe, expect, it, vi } from "vitest";

describe("guardedFetch + withIntegrityScope", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("catches a capped read inside an export's scope, and only there", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        new Response("[]", {
          status: 200,
          headers: { "content-range": url.includes("big_table") ? "0-999/*" : "0-9/*" },
        }),
      ),
    );
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { guardedFetch, withIntegrityScope } = await import("./server");

    const { truncated } = await withIntegrityScope(async () => {
      await guardedFetch("https://x.supabase.co/rest/v1/small_table?select=*");
      await guardedFetch("https://x.supabase.co/rest/v1/big_table?select=*&order=id.asc");
    });
    expect(truncated.map((read) => read.table)).toEqual(["big_table"]);

    // Outside any scope nothing is collected (the read is still recorded).
    const outside = await withIntegrityScope(async () => undefined);
    expect(outside.truncated).toEqual([]);
  });
});
