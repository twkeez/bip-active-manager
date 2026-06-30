import { describe, expect, it } from "vitest";
import {
  computeNextDue,
  dueStatus,
  isActionable,
  isCadence,
} from "@/lib/site-audit/seo-audit-schedule";

describe("computeNextDue", () => {
  it("adds the cadence in calendar months", () => {
    const next = computeNextDue("2026-01-15T00:00:00.000Z", 3);
    expect(next.startsWith("2026-04-15")).toBe(true);
  });

  it("handles a 6-month cadence across a year boundary", () => {
    const next = computeNextDue("2026-09-10T00:00:00.000Z", 6);
    expect(next.startsWith("2027-03-10")).toBe(true);
  });
});

describe("dueStatus", () => {
  const now = new Date("2026-06-30T12:00:00.000Z");

  it("returns none when there is no due date", () => {
    expect(dueStatus(null, now)).toBe("none");
  });

  it("flags a past date as overdue", () => {
    expect(dueStatus("2026-06-01T00:00:00.000Z", now)).toBe("overdue");
  });

  it("flags a date inside the window as due", () => {
    expect(dueStatus("2026-07-05T00:00:00.000Z", now)).toBe("due");
  });

  it("flags a far-future date as upcoming", () => {
    expect(dueStatus("2026-12-01T00:00:00.000Z", now)).toBe("upcoming");
  });
});

describe("isActionable", () => {
  const now = new Date("2026-06-30T12:00:00.000Z");
  it("is true for due and overdue, false otherwise", () => {
    expect(isActionable("2026-06-01T00:00:00.000Z", now)).toBe(true);
    expect(isActionable("2026-07-05T00:00:00.000Z", now)).toBe(true);
    expect(isActionable("2026-12-01T00:00:00.000Z", now)).toBe(false);
    expect(isActionable(null, now)).toBe(false);
  });
});

describe("isCadence", () => {
  it("accepts only 3 or 6", () => {
    expect(isCadence(3)).toBe(true);
    expect(isCadence(6)).toBe(true);
    expect(isCadence(4)).toBe(false);
    expect(isCadence("6")).toBe(false);
  });
});
