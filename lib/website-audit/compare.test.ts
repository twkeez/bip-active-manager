import { describe, expect, it } from "vitest";
import { compareMetrics, formatMetric, type Metric } from "@/lib/website-audit/compare";

const metric = (key: string, value: number | null, higherIsBetter: boolean | null = true): Metric => ({ key, label: key, value, format: "number", higherIsBetter });

describe("compareMetrics", () => {
  it("has no last-run column on a first run", () => {
    expect(compareMetrics([metric("a", 5)], null)).toEqual([{ ...metric("a", 5), last: null, change: null }]);
  });

  it("marks improvements by direction, not by sign", () => {
    const [up, down, same] = compareMetrics(
      [metric("score", 72), metric("missingCanonical", 3, false), metric("x", 4)],
      [metric("score", 60), metric("missingCanonical", 18, false), metric("x", 4)],
    );
    expect(up.change).toBe("better");
    expect(down.change).toBe("better");
    expect(same.change).toBe("same");
    expect(compareMetrics([metric("score", 50)], [metric("score", 60)])[0].change).toBe("worse");
  });

  it("doesn't judge neutral counts, and flags metrics the last run didn't have", () => {
    expect(compareMetrics([metric("urls", 90, null)], [metric("urls", 92, null)])[0]).toMatchObject({ last: 92, change: null });
    expect(compareMetrics([metric("new", 1)], [metric("other", 1)])[0]).toMatchObject({ last: null, change: "new" });
  });
});

describe("formatMetric", () => {
  it("prints each format", () => {
    expect(formatMetric(0.415, "percent")).toBe("42%");
    expect(formatMetric(4.9, "rating")).toBe("4.9★");
    expect(formatMetric(11.84, "points")).toBe("11.8");
    expect(formatMetric(1409, "number")).toBe("1,409");
    expect(formatMetric(null, "number")).toBe("—");
  });
});
