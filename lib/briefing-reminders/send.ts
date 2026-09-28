import { exportBlockedMessage } from "@/components/data-integrity/export-blocked";
import { withIntegrityScope } from "@/lib/data-integrity/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { composeClientMessage, composeStrategistNote } from "@/lib/briefing/compose";
import { loadClientBriefing } from "@/lib/briefing/load";
import { sendGmailAs, userIdForEmail } from "@/lib/email/gmail-send";
import { reminderEmail } from "./email";
import { loadPlanInputs } from "./load-plan";
import { fallbackRecipient, planRun, type PlannedReminder, type ReminderRun } from "./plan";

/** The email for one planned reminder, built from the client's briefing as it stands now. */
export async function buildReminder(
  admin: SupabaseClient,
  reminder: PlannedReminder,
  run: ReminderRun,
): Promise<{ subject: string; body: string }> {
  const { result: briefing, truncated } = await withIntegrityScope(() =>
    loadClientBriefing(admin, reminder.clientId),
  );
  if (!briefing) throw new Error(`Could not build a briefing for ${reminder.accountName}.`);
  // Never send a draft built on a read the database cut short: this throws,
  // the reminder is not sent, and the run reports it (Tom is emailed).
  if (truncated.length) throw new Error(exportBlockedMessage("briefing", truncated));
  return reminderEmail({
    accountName: reminder.accountName,
    cadence: reminder.cadence,
    runDate: run.date,
    recipientNames: reminder.to.map((t) => t.name),
    clientMessage: composeClientMessage(briefing),
    strategistNote: composeStrategistNote(briefing),
    basecampProjectId: reminder.basecampProjectId,
  });
}

export type SendRunResult = {
  sent: Array<{ reminder: PlannedReminder }>;
  alreadySent: number;
  failures: Array<{ accountName: string; error: string }>;
};

const CONCURRENCY = 4;

/**
 * Send one run: one email per client, from Tom's Gmail, each recorded as an
 * open client-update follow-up the moment it goes out. Clients already
 * reminded for this run are skipped, so a re-run or retry never doubles up.
 * Failures are collected, not thrown, so one bad client does not stop the rest.
 */
export async function sendReminderRun(
  admin: SupabaseClient,
  run: ReminderRun,
  options: {
    /** Runs only when something is left to send; throwing stops the run before any email. */
    beforeSend?: () => Promise<void>;
  } = {},
): Promise<SendRunResult> {
  const { clients, staff } = await loadPlanInputs(admin);
  const { reminders } = planRun(clients, staff, run.slot);

  const { data: existing, error: existingError } = await admin
    .from("strategist_followups")
    .select("client_id")
    .eq("reminder_run", run.date);
  if (existingError) throw new Error(`Could not read this run's reminders: ${existingError.message}`);
  const done = new Set((existing ?? []).map((row) => (row as { client_id: number }).client_id));
  const pending = reminders.filter((reminder) => !done.has(reminder.clientId));
  if (pending.length === 0) return { sent: [], alreadySent: reminders.length, failures: [] };
  await options.beforeSend?.();

  const senderEmail = fallbackRecipient();
  const senderId = await userIdForEmail(admin, senderEmail);

  const result: SendRunResult = { sent: [], alreadySent: reminders.length - pending.length, failures: [] };
  let cursor = 0;
  async function worker() {
    while (cursor < pending.length) {
      const reminder = pending[cursor++];
      try {
        const email = await buildReminder(admin, reminder, run);
        await sendGmailAs(admin, senderId, {
          to: reminder.to.map((t) => t.email).join(", "),
          subject: email.subject,
          body: email.body,
        });
        const { error } = await admin.from("strategist_followups").insert({
          kind: "client_update",
          reminder_run: run.date,
          basecamp_project_id: reminder.basecampProjectId,
          project_name: reminder.accountName,
          client_id: reminder.clientId,
          recipient_name: reminder.to.map((t) => t.name).join(" & "),
          recipient_email: reminder.to.map((t) => t.email).join(", "),
          subject: email.subject,
          note: `${reminder.cadence === "monthly" ? "Monthly (Low Contact)" : "Twice-monthly"} client update due.`,
          sent_by_user_id: senderId,
          sent_by_email: senderEmail,
        });
        if (error) throw new Error(`Emailed, but not added to Follow-ups: ${error.message}`);
        result.sent.push({ reminder });
      } catch (error) {
        result.failures.push({
          accountName: reminder.accountName,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, pending.length) }, worker));
  return result;
}
