import { describe, expect, it } from "vitest";
import { fetchAllRows, PAGE_SIZE } from "./fetch-all";

function fakeTable(total: number) {
  const rows = Array.from({ length: total }, (_, id) => ({ id }));
  const calls: Array<[number, number]> = [];
  const page = async (from: number, to: number) => {
    calls.push([from, to]);
    return { data: rows.slice(from, Math.min(to + 1, 1000 + from)), error: null };
  };
  return { page, calls };
}

describe("fetchAllRows", () => {
  it("reads every row across pages, far past the 1000-row cap", async () => {
    const { page, calls } = fakeTable(2345);
    const rows = await fetchAllRows(page);
    expect(rows).toHaveLength(2345);
    expect(new Set(rows.map((r) => r.id)).size).toBe(2345);
    expect(calls[1]).toEqual([PAGE_SIZE, 2 * PAGE_SIZE - 1]);
  });

  it("stops after a short page, including an empty table", async () => {
    expect(await fetchAllRows(fakeTable(0).page)).toEqual([]);
    const { page, calls } = fakeTable(PAGE_SIZE);
    expect(await fetchAllRows(page)).toHaveLength(PAGE_SIZE);
    expect(calls).toHaveLength(2);
  });

  it("throws on an error instead of returning a partial list", async () => {
    await expect(
      fetchAllRows(async () => ({ data: null, error: { message: "boom" } }), "ads snapshots"),
    ).rejects.toThrow("ads snapshots: boom");
  });
});
