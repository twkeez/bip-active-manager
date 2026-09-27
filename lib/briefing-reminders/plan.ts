// Scheduled briefing reminders (Tom, 2026-09-26): every client buying a
// marketing service gets a reminder to their strategist built from their
// briefing. Low Contact clients once a month (first Monday), everyone else
// twice (first and third Monday), at 8am Eastern. One email per client.
//
// This file is the pure plan: when runs happen, who is in each run and who
// each reminder goes to. Nothing here sends anything.

import { resolveStrategistContacts, type StaffProfile } from "@/lib/onboarding/expectation-people";

export const REMINDER_TIMEZONE = "America/New_York";
export const REMINDER_HOUR = 8;

/** First Monday of the month (days 1–7), or third (days 15–21). */
export type ReminderSlot = "first" | "third";
export type Cadence = "monthly" | "twice_monthly";

export type ReminderRun = {
  /** Calendar date in Eastern time, YYYY-MM-DD. */
  date: string;
  slot: ReminderSlot;
};

/** Who gets reminded when a client has no strategist the app can email. */
export function fallbackRecipient(): string {
  return process.env.BRIEFING_FALLBACK_EMAIL?.trim() || "tom@beyondindigo.com";
}

function easternDate(now: Date): { year: number; month: number; day: number; hour: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: REMINDER_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour") };
}

/** Which run a calendar date is, if any. */
export function slotForDate(year: number, month: number, day: number): ReminderSlot | null {
  // Noon UTC keeps the weekday stable whatever the machine's timezone.
  const weekday = new Date(Date.UTC(year, month - 1, day, 12)).getUTCDay();
  if (weekday !== 1) return null;
  if (day <= 7) return "first";
  if (day >= 15 && day <= 21) return "third";
  return null;
}

/** The next `count` runs, counting today's if its 8am has not passed yet. */
export function upcomingRuns(now: Date, count = 2): ReminderRun[] {
  const today = easternDate(now);
  const runs: ReminderRun[] = [];
  const cursor = new Date(Date.UTC(today.year, today.month - 1, today.day, 12));
  if (today.hour >= REMINDER_HOUR) cursor.setUTCDate(cursor.getUTCDate() + 1);
  for (let i = 0; i < 70 && runs.length < count; i += 1) {
    const year = cursor.getUTCFullYear();
    const month = cursor.getUTCMonth() + 1;
    const day = cursor.getUTCDate();
    const slot = slotForDate(year, month, day);
    if (slot) {
      runs.push({
        date: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
        slot,
      });
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return runs;
}

export function cadenceFor(isLowContact: boolean): Cadence {
  return isLowContact ? "monthly" : "twice_monthly";
}

export function includedInRun(cadence: Cadence, slot: ReminderSlot): boolean {
  return slot === "first" || cadence === "twice_monthly";
}

export type PlanClient = {
  id: number;
  accountName: string;
  marketingStrategist: string | null;
  isLowContact: boolean;
  /** The client's Basecamp project, when one is linked. */
  basecampProjectId: string | null;
  /** Set when that project is on the "not tracked" list, with its reason. */
  ignoredReason: string | null;
};

export type PlannedReminder = {
  clientId: number;
  accountName: string;
  cadence: Cadence;
  to: Array<{ name: string; email: string }>;
  /** True when nobody on file could be emailed, so it goes to the fallback. */
  toFallback: boolean;
  basecampProjectId: string | null;
  /** Things worth fixing before this goes out. */
  warnings: string[];
};

export type LeftOut = { clientId: number; accountName: string; reason: string };

/**
 * Who a run reminds and about which clients. Clients whose Basecamp project
 * was marked "not tracked" (no longer a client, internal) are left out.
 */
export function planRun(
  clients: PlanClient[],
  staff: StaffProfile[],
  slot: ReminderSlot,
): { reminders: PlannedReminder[]; leftOut: LeftOut[] } {
  const reminders: PlannedReminder[] = [];
  const leftOut: LeftOut[] = [];
  const fallback = fallbackRecipient();

  for (const client of clients) {
    const cadence = cadenceFor(client.isLowContact);
    if (!includedInRun(cadence, slot)) continue;
    if (client.ignoredReason) {
      leftOut.push({
        clientId: client.id,
        accountName: client.accountName,
        reason: `Basecamp project marked not tracked (${client.ignoredReason})`,
      });
      continue;
    }

    const warnings: string[] = [];
    const field = client.marketingStrategist?.trim() ?? "";
    const contacts = resolveStrategistContacts(field, staff);
    const to = contacts.filter((c): c is { name: string; email: string } => Boolean(c.email));
    let toFallback = false;
    if (to.length === 0) {
      toFallback = true;
      to.push({ name: "Tom", email: fallback });
      warnings.push(
        !field
          ? "No strategist on file."
          : contacts.length
            ? `"${field}" matches more than one teammate.`
            : `Strategist field says "${field}", not a teammate.`,
      );
    }
    if (!client.isLowContact && /low contact/i.test(field)) {
      warnings.push('Strategist field says "Low Contact" but the client is not flagged Low Contact, so it is reminded twice a month.');
    }
    if (!client.basecampProjectId) {
      warnings.push("No Basecamp project linked, so it can only be closed by marking it complete.");
    }

    reminders.push({
      clientId: client.id,
      accountName: client.accountName,
      cadence,
      to,
      toFallback,
      basecampProjectId: client.basecampProjectId,
      warnings,
    });
  }

  reminders.sort((a, b) => a.accountName.localeCompare(b.accountName));
  leftOut.sort((a, b) => a.accountName.localeCompare(b.accountName));
  return { reminders, leftOut };
}
