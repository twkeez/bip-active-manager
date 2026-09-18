import { describe, expect, it } from "vitest";
import { describeSchedule, isDue, lastSlot, nextRun, zonedTime, type RoutineSchedule } from "./schedule";

const weekdays9am: RoutineSchedule = { days: [1, 2, 3, 4, 5], hour: 9, minute: 0, timezone: "America/New_York" };

describe("zonedTime", () => {
  // The case a UTC cron gets wrong twice a year.
  it("keeps 9am Eastern at 9am across the clock change", () => {
    const summer = zonedTime("America/New_York", { year: 2026, month: 9, day: 18 }, 9, 0);
    const winter = zonedTime("America/New_York", { year: 2026, month: 12, day: 18 }, 9, 0);
    expect(summer.toISOString()).toBe("2026-09-18T13:00:00.000Z"); // EDT, UTC-4
    expect(winter.toISOString()).toBe("2026-12-18T14:00:00.000Z"); // EST, UTC-5
  });
});

describe("isDue", () => {
  it("is due once the morning's time has passed and it has not run", () => {
    const now = new Date("2026-09-18T13:20:00Z"); // Friday 9:20am ET
    expect(isDue(weekdays9am, null, now)).toBe(true);
    expect(isDue(weekdays9am, "2026-09-17T13:05:00Z", now)).toBe(true); // ran yesterday
  });

  it("is not due again after it has run for this morning", () => {
    const now = new Date("2026-09-18T15:00:00Z");
    expect(isDue(weekdays9am, "2026-09-18T13:05:00Z", now)).toBe(false);
  });

  it("is not due before the time", () => {
    const now = new Date("2026-09-18T12:30:00Z"); // 8:30am ET
    expect(isDue(weekdays9am, "2026-09-17T13:05:00Z", now)).toBe(false);
  });

  // GitHub's scheduler drops wake-ups under load. A late one must still run.
  it("still runs if the wake-up arrives hours late", () => {
    const now = new Date("2026-09-18T17:40:00Z"); // 1:40pm ET
    expect(isDue(weekdays9am, "2026-09-17T13:05:00Z", now)).toBe(true);
  });

  it("does not run on a weekend", () => {
    const saturday = new Date("2026-09-19T14:00:00Z");
    // Friday's run happened; nothing is scheduled Saturday.
    expect(isDue(weekdays9am, "2026-09-18T13:05:00Z", saturday)).toBe(false);
  });

  // Switching a routine back on should not fire a run for a day long past.
  it("does not fire a stale run days later", () => {
    const monday = new Date("2026-09-21T11:00:00Z"); // 7am ET, before Monday's slot
    expect(isDue(weekdays9am, "2026-09-10T13:05:00Z", monday)).toBe(false);
  });
});

describe("slots", () => {
  it("finds the last and next scheduled times", () => {
    const friday = new Date("2026-09-18T20:00:00Z");
    expect(lastSlot(weekdays9am, friday)?.toISOString()).toBe("2026-09-18T13:00:00.000Z");
    // Next is Monday, skipping the weekend.
    expect(nextRun(weekdays9am, friday)?.toISOString()).toBe("2026-09-21T13:00:00.000Z");
  });
});

describe("describeSchedule", () => {
  it("says it the way a person would", () => {
    expect(describeSchedule(weekdays9am)).toBe("Weekdays at 9:00 AM ET");
    expect(describeSchedule({ ...weekdays9am, days: [1], hour: 14, minute: 30 })).toBe("Mondays at 2:30 PM ET");
    expect(describeSchedule({ ...weekdays9am, days: [0, 1, 2, 3, 4, 5, 6] })).toBe("Every day at 9:00 AM ET");
  });
});
