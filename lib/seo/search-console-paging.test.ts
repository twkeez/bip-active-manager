import { describe, expect, it } from "vitest";
import { readAllSearchAnalyticsRows } from "@/lib/seo/search-console";

describe("readAllSearchAnalyticsRows", () => {
  it("keeps asking until a short page comes back", async () => {
    const all = Array.from({ length: 7 }, (_, i) => i);
    const asked: number[] = [];
    const rows = await readAllSearchAnalyticsRows(async (startRow, rowLimit) => {
      asked.push(startRow);
      return all.slice(startRow, startRow + rowLimit);
    }, 3);
    expect(rows).toEqual(all);
    expect(asked).toEqual([0, 3, 6]);
  });

  it("asks once more after an exactly full page, and stops on an empty one", async () => {
    const all = [1, 2, 3, 4];
    const asked: number[] = [];
    const rows = await readAllSearchAnalyticsRows(async (startRow, rowLimit) => {
      asked.push(startRow);
      return all.slice(startRow, startRow + rowLimit);
    }, 2);
    expect(rows).toEqual(all);
    expect(asked).toEqual([0, 2, 4]);
  });

  it("passes a failed page on instead of returning what it had", async () => {
    await expect(
      readAllSearchAnalyticsRows(async (startRow) => {
        if (startRow > 0) throw new Error("Search Console API failed (500)");
        return [1, 2];
      }, 2),
    ).rejects.toThrow("Search Console API failed (500)");
  });
});
