import { describe, expect, it } from "vitest";
import { renderClientRequest, formatDateRange } from "@/lib/social/client-request-message";

// National Veterinary Technician Week as stored: third Sunday of October, 7 days.
const VET_TECH_WEEK = {
  rule_type: "week_of" as const,
  month: 10,
  day: null,
  nth: 3,
  weekday: 0,
  week_start_day: null,
  duration_days: 7,
  request_respond_by_days: 23,
  client_request_template:
    "Vet Tech Week is {{date_range}}. Reply by {{respond_by}} or we run Option 1. ({{year}})",
};

describe("renderClientRequest", () => {
  it("fills the dates from the stored rule, not from the text", () => {
    const out = renderClientRequest(VET_TECH_WEEK, 2026, new Date("2026-09-04T00:00:00Z"));
    expect(out).not.toBeNull();
    expect(out!.dateRange).toBe("October 18–24");
    // 23 days before the Sunday start always lands on a Friday.
    expect(out!.respondBy).toBe("Friday, September 25");
    expect(out!.message).toBe(
      "Vet Tech Week is October 18–24. Reply by Friday, September 25 or we run Option 1. (2026)",
    );
  });

  // The whole point of storing a rule instead of dates: next year needs no edit.
  it("moves to the right week the following year with no change to the template", () => {
    const out = renderClientRequest(VET_TECH_WEEK, 2027, new Date("2027-01-01T00:00:00Z"));
    // NAVTA publishes 17–23 October 2027, which the third-Sunday rule reproduces.
    expect(out!.dateRange).toBe("October 17–23");
    expect(out!.respondBy).toBe("Friday, September 24");
  });

  it("knows when the ask is already late", () => {
    const before = renderClientRequest(VET_TECH_WEEK, 2026, new Date("2026-09-04T00:00:00Z"));
    const after = renderClientRequest(VET_TECH_WEEK, 2026, new Date("2026-10-01T00:00:00Z"));
    expect(before!.overdue).toBe(false);
    expect(after!.overdue).toBe(true);
  });

  it("returns null for a day with no client ask, so nothing renders", () => {
    expect(
      renderClientRequest({ ...VET_TECH_WEEK, client_request_template: null }, 2026),
    ).toBeNull();
    expect(
      renderClientRequest({ ...VET_TECH_WEEK, client_request_template: "   " }, 2026),
    ).toBeNull();
  });

  it("says so rather than leaving a gap when no deadline is configured", () => {
    const out = renderClientRequest(
      { ...VET_TECH_WEEK, request_respond_by_days: null },
      2026,
    );
    expect(out!.respondBy).toBeNull();
    expect(out!.message).toContain("[no reply deadline set]");
    expect(out!.overdue).toBe(false);
  });
});

describe("formatDateRange", () => {
  it("keeps a single month tight", () => {
    expect(formatDateRange(new Date(Date.UTC(2026, 9, 18)), new Date(Date.UTC(2026, 9, 24)))).toBe(
      "October 18–24",
    );
  });

  it("spells out both months when the window crosses one", () => {
    expect(formatDateRange(new Date(Date.UTC(2026, 9, 29)), new Date(Date.UTC(2026, 10, 2)))).toBe(
      "October 29 – November 2",
    );
  });

  it("handles single-day events", () => {
    expect(formatDateRange(new Date(Date.UTC(2026, 9, 29)), null)).toBe("October 29");
  });
});
