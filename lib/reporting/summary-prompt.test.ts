import { describe, expect, it } from "vitest";
import { metricLine, parseSummaryAnswer } from "@/lib/reporting/summary-prompt";

describe("metricLine", () => {
  it("gives the number, the one before and the change, as the report has them", () => {
    expect(metricLine({ label: "Clicks", current: 1200, previous: 1000, deltaAbsolute: 200, deltaPercent: 20 })).toBe(
      "Clicks: 1,200, was 1,000 (+20.0%)",
    );
    expect(metricLine({ label: "CTR", current: 2.5, previous: 3, deltaAbsolute: -0.5, deltaPercent: -16.67, valueSuffix: "%" })).toBe(
      "CTR: 2.5%, was 3% (-16.7%)",
    );
  });
  it("says when there is nothing to compare, and skips a missing number", () => {
    expect(metricLine({ label: "Calls", current: 4, previous: null, deltaAbsolute: null, deltaPercent: null })).toBe(
      "Calls: 4 (no earlier period to compare)",
    );
    expect(metricLine({ label: "Calls", current: null, previous: 3, deltaAbsolute: null, deltaPercent: null })).toBeNull();
  });
});

describe("parseSummaryAnswer", () => {
  it("reads the JSON even with text around it", () => {
    expect(
      parseSummaryAnswer('Here you go:\n{"summary": " Visits rose. ", "recommendations": [{"priority": "high", "text": "Add CTA"}]}'),
    ).toEqual({ summary: "Visits rose.", recommendations: [{ priority: "high", text: "Add CTA" }] });
  });
  it("throws a plain reason when the answer is unusable", () => {
    expect(() => parseSummaryAnswer("no json here")).toThrow(/no summary/);
    expect(() => parseSummaryAnswer("{not json}")).toThrow(/couldn't be read/);
    expect(() => parseSummaryAnswer('{"summary": ""}')).toThrow(/no summary/);
  });
});
