/**
 * When a routine should run, in the practice's working time rather than UTC.
 *
 * Routines are written as a person says them — "weekdays at 9am" — so the
 * schedule is stored that way too: days of the week, a time, a timezone. The
 * alternative, a cron string in UTC, would drift an hour twice a year at the
 * clock change, and nobody reading "0 13 * * 1-5" knows it means 9am Eastern.
 *
 * The runner is a job that wakes up every hour and asks each routine "are you
 * due?". GitHub's scheduler delivers those wake-ups late or not at all under
 * load, so "due" means "a scheduled time has passed that you have not run for
 * yet" — never "it is exactly 9:00 now". A missed wake-up is caught by the next
 * one instead of skipping a day.
 */

export type RoutineSchedule = {
  /** 0 = Sunday … 6 = Saturday, as JavaScript counts them. */
  days: number[];
  /**
   * The hours it runs at, in its own timezone. A watcher checking through the
   * working day runs at several: [8, 10, 12, 14, 16, 21]. `hour` is the older
   * single-time form and is still read, so schedules saved before this stay
   * exactly as they were.
   */
  hours?: number[];
  hour?: number;
  minute: number;
  /** IANA name, e.g. "America/New_York". */
  timezone: string;
};

/** The times of day a schedule runs at, however it was written. */
export function scheduleHours(schedule: RoutineSchedule): number[] {
  const hours = schedule.hours?.length ? schedule.hours : [schedule.hour ?? 0];
  return [...new Set(hours.filter((hour) => Number.isInteger(hour) && hour >= 0 && hour <= 23))].sort(
    (a, b) => a - b,
  );
}

/**
 * How late a run may still happen. Long enough to survive a morning of missed
 * wake-ups; short enough that a routine paused for a week does not fire a
 * stale "daily" run the moment it is switched back on.
 */
export const CATCH_UP_HOURS = 20;

/**
 * For a routine that runs several times a day, a missed slot is only worth
 * catching up until the next one is due — otherwise a run at 10:05 would still
 * be "due" for the 8am slot it already covered.
 */
function catchUpHours(schedule: RoutineSchedule): number {
  const hours = scheduleHours(schedule);
  if (hours.length < 2) return CATCH_UP_HOURS;
  const gaps = hours.slice(1).map((hour, index) => hour - hours[index]);
  return Math.max(Math.min(...gaps), 1);
}

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** The wall-clock parts of an instant, as seen in a timezone. */
function partsIn(timezone: string, instant: Date) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    weekday: "short",
    hour12: false,
  });
  const parts = Object.fromEntries(formatter.formatToParts(instant).map((part) => [part.type, part.value]));
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(parts.weekday);
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    // Some engines report midnight as "24".
    hour: Number(parts.hour) % 24,
    minute: Number(parts.minute),
    second: Number(parts.second),
    weekday,
  };
}

/** Minutes the timezone is ahead of UTC at an instant (negative in the Americas). */
function offsetMinutes(timezone: string, instant: Date): number {
  const p = partsIn(timezone, instant);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUtc - instant.getTime()) / 60_000);
}

/**
 * The instant a wall-clock time happens in a timezone. Computed twice so the
 * offset used is the one in force at that moment, which is what keeps a 9am
 * routine at 9am across the daylight-saving change.
 */
export function zonedTime(
  timezone: string,
  date: { year: number; month: number; day: number },
  hour: number,
  minute: number,
): Date {
  const guess = Date.UTC(date.year, date.month - 1, date.day, hour, minute);
  const first = guess - offsetMinutes(timezone, new Date(guess)) * 60_000;
  return new Date(guess - offsetMinutes(timezone, new Date(first)) * 60_000);
}

/** Every scheduled instant within a window of days around now, oldest first. */
function slotsAround(schedule: RoutineSchedule, now: Date, daysBack: number, daysForward: number): Date[] {
  const slots: Date[] = [];
  for (let offset = -daysBack; offset <= daysForward; offset += 1) {
    const probe = new Date(now.getTime() + offset * 86_400_000);
    const local = partsIn(schedule.timezone, probe);
    if (!schedule.days.includes(local.weekday)) continue;
    for (const hour of scheduleHours(schedule)) {
      slots.push(zonedTime(schedule.timezone, local, hour, schedule.minute));
    }
  }
  return slots.sort((a, b) => a.getTime() - b.getTime());
}

/** The most recent scheduled time at or before now, or null if none this week. */
export function lastSlot(schedule: RoutineSchedule, now: Date): Date | null {
  const past = slotsAround(schedule, now, 8, 0).filter((slot) => slot.getTime() <= now.getTime());
  return past.at(-1) ?? null;
}

export function nextRun(schedule: RoutineSchedule, now: Date): Date | null {
  return slotsAround(schedule, now, 0, 8).find((slot) => slot.getTime() > now.getTime()) ?? null;
}

/**
 * Due when a scheduled time has passed that this routine has not run for, and
 * it is not so long ago that running now would be misleading.
 */
export function isDue(schedule: RoutineSchedule, lastRunAt: string | null, now: Date): boolean {
  if (schedule.days.length === 0) return false;
  const slot = lastSlot(schedule, now);
  if (!slot) return false;
  if (now.getTime() - slot.getTime() > catchUpHours(schedule) * 3_600_000) return false;
  if (!lastRunAt) return true;
  return Date.parse(lastRunAt) < slot.getTime();
}

/** "Weekdays at 9:00 AM ET" — how a person would say it. */
export function describeSchedule(schedule: RoutineSchedule): string {
  const days = [...schedule.days].sort();
  const hours = scheduleHours(schedule);
  const weekdays = [1, 2, 3, 4, 5];
  let when: string;
  if (days.length === 7) when = "Every day";
  else if (days.length === 5 && weekdays.every((day) => days.includes(day))) when = "Weekdays";
  else if (days.length === 2 && days.includes(0) && days.includes(6)) when = "Weekends";
  else if (days.length === 1) when = `${DAY_NAMES[days[0]]}s`;
  else when = days.map((day) => DAY_NAMES[day].slice(0, 3)).join(", ");

  const clock = (hour: number) => {
    const hour12 = hour % 12 === 0 ? 12 : hour % 12;
    return `${hour12}${schedule.minute ? `:${String(schedule.minute).padStart(2, "0")}` : ""}${hour < 12 ? "am" : "pm"}`;
  };
  const zone = schedule.timezone === "America/New_York" ? "ET" : schedule.timezone;

  if (hours.length === 1) {
    const hour = hours[0];
    const hour12 = hour % 12 === 0 ? 12 : hour % 12;
    const suffix = hour < 12 ? "AM" : "PM";
    return `${when} at ${hour12}:${String(schedule.minute).padStart(2, "0")} ${suffix} ${zone}`;
  }

  // "Weekdays every 2 hours, 8am to 4pm, and 9pm ET" beats listing six times.
  const gaps = hours.slice(1).map((hour, index) => hour - hours[index]);
  const even = gaps.slice(0, -1).every((gap) => gap === gaps[0]);
  const trailing = gaps.at(-1)! > gaps[0] ? hours.at(-1)! : null;
  const run = trailing ? hours.slice(0, -1) : hours;
  if (even && run.length > 2) {
    const every = `every ${gaps[0]} hours, ${clock(run[0])} to ${clock(run.at(-1)!)}`;
    return `${when} ${every}${trailing !== null ? `, and ${clock(trailing)}` : ""} ${zone}`;
  }
  return `${when} at ${hours.map(clock).join(", ")} ${zone}`;
}

export function isValidSchedule(value: unknown): value is RoutineSchedule {
  if (!value || typeof value !== "object") return false;
  const schedule = value as Record<string, unknown>;
  const days = schedule.days;
  const hours = Array.isArray(schedule.hours)
    ? (schedule.hours as unknown[])
    : [schedule.hour];
  return (
    Array.isArray(days) &&
    days.every((day) => Number.isInteger(day) && (day as number) >= 0 && (day as number) <= 6) &&
    hours.length > 0 &&
    hours.every((hour) => Number.isInteger(hour) && (hour as number) >= 0 && (hour as number) <= 23) &&
    Number.isInteger(schedule.minute) &&
    (schedule.minute as number) >= 0 &&
    (schedule.minute as number) <= 59 &&
    typeof schedule.timezone === "string" &&
    schedule.timezone.length > 0
  );
}
