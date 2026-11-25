import { describe, expect, it } from "vitest";
import { cutInsideWindow } from "@/lib/dashboard/load-client-workspace-data";

const day = (date: string) => ({ date });

describe("cutInsideWindow", () => {
  it("is fine when fewer rows came back than the limit", () => {
    expect(cutInsideWindow([day("2026-11-20")], 3, (r) => r.date, "2026-10-26")).toBe(false);
  });

  it("is fine when the full list already reaches back past the window", () => {
    const rows = [day("2026-11-20"), day("2026-11-01"), day("2026-10-01")];
    expect(cutInsideWindow(rows, 3, (r) => r.date, "2026-10-26")).toBe(false);
  });

  it("flags a full list whose oldest row is still inside the window", () => {
    const rows = [day("2026-11-20"), day("2026-11-10"), day("2026-11-01")];
    expect(cutInsideWindow(rows, 3, (r) => r.date, "2026-10-26")).toBe(true);
  });

  it("compares numbers too (review times in seconds)", () => {
    expect(cutInsideWindow([{ t: 200 }, { t: 150 }], 2, (r) => r.t, 100)).toBe(true);
    expect(cutInsideWindow([{ t: 200 }, { t: 50 }], 2, (r) => r.t, 100)).toBe(false);
  });
});
