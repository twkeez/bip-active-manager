import { describe, expect, it } from "vitest";
import {
  isAwarenessDateActive,
  nthWeekdayOfMonth,
  resolveAwarenessDate,
  toDateString,
  type AwarenessRule,
} from "@/lib/social/awareness-resolver";

function rule(partial: Partial<AwarenessRule> & Pick<AwarenessRule, "rule_type" | "month">): AwarenessRule {
  return {
    day: null,
    nth: null,
    weekday: null,
    week_start_day: null,
    duration_days: null,
    ...partial,
  };
}

const start = (r: AwarenessRule, year: number) => toDateString(resolveAwarenessDate(r, year).start);
const end = (r: AwarenessRule, year: number) => {
  const resolved = resolveAwarenessDate(r, year);
  return resolved.end ? toDateString(resolved.end) : null;
};

describe("resolveAwarenessDate — week_of", () => {
  // National Veterinary Technician Week: the week beginning the third Sunday
  // of October. Oct 1 2026 is a Thursday, so the first Sunday is Oct 4.
  const vetTechWeek = rule({ rule_type: "week_of", month: 10, nth: 3, weekday: 0, duration_days: 7 });

  it("resolves the nth-weekday start form", () => {
    expect(start(vetTechWeek, 2026)).toBe("2026-10-18");
    expect(end(vetTechWeek, 2026)).toBe("2026-10-24");
  });

  // Walk Your Dog Week: fixed start, Oct 1-7.
  const walkWeek = rule({ rule_type: "week_of", month: 10, week_start_day: 1, duration_days: 7 });

  it("resolves the fixed-start form", () => {
    expect(start(walkWeek, 2026)).toBe("2026-10-01");
    expect(end(walkWeek, 2026)).toBe("2026-10-07");
  });

  it("counts duration_days inclusively of the start day", () => {
    const threeDay = rule({ rule_type: "week_of", month: 3, week_start_day: 10, duration_days: 3 });
    expect(start(threeDay, 2026)).toBe("2026-03-10");
    expect(end(threeDay, 2026)).toBe("2026-03-12");
  });

  it("lets a window run past the end of its month", () => {
    const spanning = rule({ rule_type: "week_of", month: 10, week_start_day: 29, duration_days: 7 });
    expect(start(spanning, 2026)).toBe("2026-10-29");
    expect(end(spanning, 2026)).toBe("2026-11-04");
  });

  it("shifts with the calendar year", () => {
    // 2027: Oct 1 is a Friday, so the first Sunday is Oct 3, the third is Oct 17.
    expect(start(vetTechWeek, 2027)).toBe("2027-10-17");
    expect(end(vetTechWeek, 2027)).toBe("2027-10-23");
  });

  it("rejects a row carrying neither start form", () => {
    expect(() => resolveAwarenessDate(rule({ rule_type: "week_of", month: 10, duration_days: 7 }), 2026)).toThrow();
  });

  it("rejects a row with no duration", () => {
    expect(() => resolveAwarenessDate(rule({ rule_type: "week_of", month: 10, week_start_day: 1 }), 2026)).toThrow();
  });
});

describe("resolveAwarenessDate — nth_weekday", () => {
  it("resolves nth = -1 as the last occurrence (last Monday of May 2026)", () => {
    const memorial = rule({ rule_type: "nth_weekday", month: 5, nth: -1, weekday: 1 });
    expect(start(memorial, 2026)).toBe("2026-05-25");
    expect(end(memorial, 2026)).toBeNull();
  });

  it("handles a month whose last day IS the target weekday", () => {
    // May 31 2026 is a Sunday, so the last Sunday is the 31st itself.
    const lastSunday = rule({ rule_type: "nth_weekday", month: 5, nth: -1, weekday: 0 });
    expect(start(lastSunday, 2026)).toBe("2026-05-31");
  });

  it("handles the 1st occurrence falling on the 1st of the month", () => {
    // Nov 1 2026 is a Sunday.
    const firstSunday = rule({ rule_type: "nth_weekday", month: 11, nth: 1, weekday: 0 });
    expect(start(firstSunday, 2026)).toBe("2026-11-01");
  });

  it("throws when the occurrence does not exist that year", () => {
    // October 2026 has only four Sundays.
    const fifthSunday = rule({ rule_type: "nth_weekday", month: 10, nth: 5, weekday: 0 });
    expect(() => resolveAwarenessDate(fifthSunday, 2026)).toThrow(/no occurrence/);
  });
});

describe("resolveAwarenessDate — fixed and month_long", () => {
  it("resolves a fixed date", () => {
    const birdDay = rule({ rule_type: "fixed", month: 1, day: 5 });
    expect(start(birdDay, 2026)).toBe("2026-01-05");
    expect(end(birdDay, 2026)).toBeNull();
  });

  it("spans a whole month, respecting leap years", () => {
    const dentalMonth = rule({ rule_type: "month_long", month: 2 });
    expect(start(dentalMonth, 2026)).toBe("2026-02-01");
    expect(end(dentalMonth, 2026)).toBe("2026-02-28");
    expect(end(dentalMonth, 2028)).toBe("2028-02-29");
  });

  it("throws when a fixed rule is missing its day", () => {
    expect(() => resolveAwarenessDate(rule({ rule_type: "fixed", month: 1 }), 2026)).toThrow();
  });
});

describe("nthWeekdayOfMonth", () => {
  it("returns null rather than rolling into the next month", () => {
    expect(nthWeekdayOfMonth(2026, 10, 5, 0)).toBeNull();
  });

  it("finds the 5th occurrence when it genuinely exists", () => {
    // October 2026 has five Thursdays: 1, 8, 15, 22, 29.
    expect(toDateString(nthWeekdayOfMonth(2026, 10, 5, 4)!)).toBe("2026-10-29");
  });
});

describe("isAwarenessDateActive", () => {
  const vetTechWeek = rule({ rule_type: "week_of", month: 10, nth: 3, weekday: 0, duration_days: 7 });

  it("matches days inside the window and rejects days outside it", () => {
    expect(isAwarenessDateActive(vetTechWeek, new Date(Date.UTC(2026, 9, 18)))).toBe(true); // start
    expect(isAwarenessDateActive(vetTechWeek, new Date(Date.UTC(2026, 9, 21)))).toBe(true); // middle
    expect(isAwarenessDateActive(vetTechWeek, new Date(Date.UTC(2026, 9, 24)))).toBe(true); // end
    expect(isAwarenessDateActive(vetTechWeek, new Date(Date.UTC(2026, 9, 25)))).toBe(false);
    expect(isAwarenessDateActive(vetTechWeek, new Date(Date.UTC(2026, 9, 17)))).toBe(false);
  });

  it("matches a single-day rule only on that day", () => {
    const birdDay = rule({ rule_type: "fixed", month: 1, day: 5 });
    expect(isAwarenessDateActive(birdDay, new Date(Date.UTC(2026, 0, 5)))).toBe(true);
    expect(isAwarenessDateActive(birdDay, new Date(Date.UTC(2026, 0, 6)))).toBe(false);
  });
});
