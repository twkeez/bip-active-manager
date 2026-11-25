import { describe, expect, it } from "vitest";
import {
  monthName,
  snapshotReportMonth,
  countStates,
  defaultReportMonth,
  isMissingMonthlyTable,
  monthLabel,
  monthStartDate,
  nextState,
  parseReportMonth,
  parseSentVia,
  recentMonths,
  stateOf,
} from "@/lib/reporting/monthly";

const nov25 = new Date("2026-11-25T15:00:00Z");

describe("report months", () => {
  it("default to the month that just ended", () => {
    expect(defaultReportMonth(nov25)).toBe("2026-10");
    expect(defaultReportMonth(new Date("2027-01-03T00:00:00Z"))).toBe("2026-12");
  });

  it("accept a past or current month and refuse the future or nonsense", () => {
    expect(parseReportMonth("2026-09", nov25)).toBe("2026-09");
    expect(parseReportMonth("2026-11", nov25)).toBe("2026-11");
    expect(parseReportMonth("2026-12", nov25)).toBe("2026-10");
    expect(parseReportMonth("2026-13", nov25)).toBe("2026-10");
    expect(parseReportMonth(undefined, nov25)).toBe("2026-10");
  });

  it("are stored as the first day and shown by name", () => {
    expect(monthStartDate("2026-10")).toBe("2026-10-01");
    expect(monthLabel("2026-10")).toBe("October 2026");
  });

  it("list the current month and the ones before it", () => {
    expect(recentMonths(3, new Date("2027-02-10T00:00:00Z"))).toEqual(["2027-02", "2027-01", "2026-12"]);
  });
});

describe("report states", () => {
  it("are Not started without a row, and never an unknown value", () => {
    expect(stateOf(null)).toBe("not_started");
    expect(stateOf({ status: "reviewed" })).toBe("reviewed");
    expect(stateOf({ status: "approved" })).toBe("not_started");
  });

  it("move forward one step at a time and stop at Sent", () => {
    expect(nextState("not_started")).toBe("draft");
    expect(nextState("draft")).toBe("reviewed");
    expect(nextState("reviewed")).toBe("sent");
    expect(nextState("sent")).toBeNull();
  });

  it("are counted per state", () => {
    expect(countStates(["draft", "sent", "draft"])).toEqual({ not_started: 0, draft: 2, reviewed: 0, sent: 1 });
  });

  it("keep only known ways of sending", () => {
    expect(parseSentVia(["pdf", "fax", "pdf", "snapshot"])).toEqual(["snapshot", "pdf"]);
    expect(parseSentVia(null)).toEqual([]);
  });
});

describe("isMissingMonthlyTable", () => {
  it("spots the table not being there yet", () => {
    expect(isMissingMonthlyTable({ code: "42P01", message: "x" })).toBe(true);
    expect(isMissingMonthlyTable({ message: 'monthly_reports: relation "public.monthly_reports" does not exist' })).toBe(true);
    expect(
      isMissingMonthlyTable({ message: "Could not find the table 'public.monthly_reports' in the schema cache" }),
    ).toBe(true);
  });

  it("doesn't mistake other failures for it", () => {
    expect(isMissingMonthlyTable({ message: "monthly_reports: canceling statement due to statement timeout" })).toBe(false);
    expect(isMissingMonthlyTable(null)).toBe(false);
  });
});

describe("snapshotReportMonth", () => {
  it("counts a snapshot toward the month most of its days fall in", () => {
    expect(snapshotReportMonth("2026-12-03T15:00:00Z")).toBe("2026-11");
    expect(snapshotReportMonth("2026-11-28T15:00:00Z")).toBe("2026-11");
    expect(snapshotReportMonth("2026-11-16T00:00:00Z")).toBe("2026-11");
    expect(snapshotReportMonth("2026-11-15T23:00:00Z")).toBe("2026-10");
  });

  it("crosses the year", () => {
    expect(snapshotReportMonth(new Date("2027-01-05T12:00:00Z"))).toBe("2026-12");
  });
});

describe("monthName", () => {
  it("names the month alone", () => {
    expect(monthName("2026-11")).toBe("November");
    expect(monthName("2027-01")).toBe("January");
  });
});
