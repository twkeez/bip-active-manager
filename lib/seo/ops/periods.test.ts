import { describe, expect, it } from "vitest";
import { isoWeekPeriodKey, monthPeriodKey } from "@/lib/seo/ops/periods";

describe("isoWeekPeriodKey", () => {
  it("returns ISO week format", () => {
    expect(isoWeekPeriodKey(new Date("2026-06-09T12:00:00Z"))).toMatch(/^\d{4}-W\d{2}$/);
  });
});

describe("monthPeriodKey", () => {
  it("returns YYYY-MM", () => {
    expect(monthPeriodKey(new Date("2026-06-09T12:00:00Z"))).toBe("2026-06");
  });
});
