import { describe, expect, it } from "vitest";
import {
  clientSummary,
  isMissingSummaryColumns,
  parseRecommendations,
  summaryBlocksProgress,
  toMonthSummary,
  validateSummaryInput,
  type MonthSummary,
} from "@/lib/reporting/month-summary";

const base: MonthSummary = {
  summary: "Website visits rose 12.0%.",
  recommendations: [{ priority: "high", text: "Add a booking button." }],
  aiDrafted: true,
  updatedAt: "2026-11-25T20:00:00Z",
  approvedAt: null,
};

describe("clientSummary", () => {
  it("never returns a draft", () => {
    expect(clientSummary(base)).toBeNull();
  });
  it("returns approved text", () => {
    expect(clientSummary({ ...base, approvedAt: "2026-11-25T21:00:00Z" })).toEqual({
      summary: "Website visits rose 12.0%.",
      recommendations: [{ priority: "high", text: "Add a booking button." }],
    });
  });
  it("returns nothing when there is nothing approved or nothing written", () => {
    expect(clientSummary(null)).toBeNull();
    expect(clientSummary({ ...base, summary: "", recommendations: [], approvedAt: "2026-11-25T21:00:00Z" })).toBeNull();
  });
});

describe("summaryBlocksProgress", () => {
  it("blocks Reviewed and Sent while a summary waits for approval", () => {
    expect(summaryBlocksProgress(base, "2026-11")).toContain("November 2026");
  });
  it("lets an approved, empty or missing summary through", () => {
    expect(summaryBlocksProgress({ ...base, approvedAt: "2026-11-25T21:00:00Z" }, "2026-11")).toBeNull();
    expect(summaryBlocksProgress({ ...base, summary: " ", recommendations: [] }, "2026-11")).toBeNull();
    expect(summaryBlocksProgress(null, "2026-11")).toBeNull();
  });
});

describe("parseRecommendations", () => {
  it("keeps well-formed steps, trims them and defaults an unknown priority to medium", () => {
    expect(
      parseRecommendations([
        { priority: "high", text: "  Fix the form. " },
        { priority: "urgent", text: "Post weekly." },
        { priority: "low", text: "   " },
        "not a step",
        null,
      ]),
    ).toEqual([
      { priority: "high", text: "Fix the form." },
      { priority: "medium", text: "Post weekly." },
    ]);
  });
  it("treats anything but a list as none", () => {
    expect(parseRecommendations({ text: "x" })).toEqual([]);
  });
});

describe("validateSummaryInput", () => {
  it("cleans valid input", () => {
    expect(validateSummaryInput({ summary: "  Hi. ", recommendations: [{ priority: "low", text: "Do it" }] })).toEqual({
      summary: "Hi.",
      recommendations: [{ priority: "low", text: "Do it" }],
    });
  });
  it("refuses text that is too long and too many steps", () => {
    expect(validateSummaryInput({ summary: "x".repeat(4001) })).toHaveProperty("error");
    const nine = Array.from({ length: 9 }, () => ({ priority: "low", text: "Step" }));
    expect(validateSummaryInput({ recommendations: nine })).toHaveProperty("error");
    expect(validateSummaryInput({ summary: 5 })).toHaveProperty("error");
  });
});

describe("toMonthSummary and isMissingSummaryColumns", () => {
  it("reads an empty row as nothing saved", () => {
    expect(toMonthSummary(null)).toEqual({ summary: "", recommendations: [], aiDrafted: false, updatedAt: null, approvedAt: null });
  });
  it("spots a missing column without mistaking other errors", () => {
    expect(isMissingSummaryColumns({ code: "42703", message: "column monthly_reports.summary does not exist" })).toBe(true);
    expect(isMissingSummaryColumns({ code: "23514", message: "violates check constraint" })).toBe(false);
    expect(isMissingSummaryColumns(null)).toBe(false);
  });
});
