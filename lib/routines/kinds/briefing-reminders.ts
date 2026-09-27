import type { SupabaseClient } from "@supabase/supabase-js";
import { checkSourcesFresh } from "@/lib/briefing-reminders/freshness";
import { REMINDER_TIMEZONE, runDueAt, upcomingRuns } from "@/lib/briefing-reminders/plan";
import { sendReminderRun, type SendRunResult } from "@/lib/briefing-reminders/send";
import type { RoutineFinding, RoutineResult } from "@/lib/routines/types";

/** The last Monday slot (noon Eastern). A hold at this slot becomes a failure Tom hears about. */
const LAST_ATTEMPT_HOUR = 12;

function easternHour(now: Date): number {
  return Number(
    new Intl.DateTimeFormat("en-US", { timeZone: REMINDER_TIMEZONE, hour: "2-digit", hourCycle: "h23" }).format(now),
  );
}

/**
 * Client update reminders. The routine wakes every Monday at 8am Eastern and
 * only sends on the first and third Monday of the month (the scheduler knows
 * weekdays, not "third Monday", so the runner decides).
 *
 * If any reminder fails the routine throws after sending the rest. The run is
 * then recorded as an error, the hourly job answers 207, and the watchdog
 * emails Tom. "Run now" on Coal Mines retries only the clients not yet sent.
 */
export async function runBriefingReminders(
  admin: SupabaseClient,
  _settings: Record<string, unknown>,
  now: Date,
): Promise<RoutineResult> {
  const run = runDueAt(now);
  if (!run) {
    const next = upcomingRuns(now, 1)[0];
    return {
      status: "ok",
      headline: `Not a reminder Monday. Next run: ${next?.date ?? "unknown"}.`,
      findings: [],
    };
  }

  // Accurate data first: hold until every nightly sync the briefing reads has
  // finished today. The routine runs at 8, 10 and noon on Mondays; a hold
  // before noon waits for the next slot, and at noon it fails loudly instead.
  class Held extends Error {}
  let result: SendRunResult;
  try {
    result = await sendReminderRun(admin, run, {
      beforeSend: async () => {
        const stale = await checkSourcesFresh(admin, run.date);
        if (!stale.length) return;
        const list = stale.join(", ");
        if (easternHour(now) < LAST_ATTEMPT_HOUR) {
          throw new Held(`Held until today's data is in: waiting on ${list}. Trying again at the next slot.`);
        }
        throw new Error(
          `Not sent: ${list} did not finish syncing today, so the briefings would use old numbers. Once it has run, use "Run now" on this routine.`,
        );
      },
    });
  } catch (error) {
    if (error instanceof Held) return { status: "attention", headline: error.message, findings: [] };
    throw error;
  }
  if (result.failures.length) {
    throw new Error(
      `${result.sent.length} sent, ${result.failures.length} failed: ${result.failures
        .map((f) => `${f.accountName} (${f.error})`)
        .join("; ")}`,
    );
  }

  const findings: RoutineFinding[] = result.sent.map(({ reminder }) => ({
    group: "Reminders sent",
    label: reminder.accountName,
    meta: `to ${reminder.to.map((t) => t.name).join(" & ")}`,
    href: "/follow-ups",
  }));
  const label = run.slot === "first" ? "first-Monday" : "third-Monday";
  return {
    status: "ok",
    headline:
      result.sent.length === 0 && result.alreadySent > 0
        ? `The ${label} run (${run.date}) had already gone out: ${result.alreadySent} reminders.`
        : `Sent ${result.sent.length} client update reminders for the ${label} run (${run.date}).${
            result.alreadySent ? ` ${result.alreadySent} had already gone out.` : ""
          }`,
    findings,
  };
}
