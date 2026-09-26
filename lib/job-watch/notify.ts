import type { SupabaseClient } from "@supabase/supabase-js";
import { sendGmailAs, userIdForEmail } from "@/lib/email/gmail-send";

/** Who hears about job problems. Override with JOB_ALERT_EMAIL. */
export function alertRecipient(): string {
  return process.env.JOB_ALERT_EMAIL?.trim() || "tom@beyondindigo.com";
}

/**
 * Email the alert recipient from their own Gmail. Throws when it cannot send,
 * so the watchdog run is marked failed and the alert is retried next hour.
 */
export async function sendAlertEmail(
  admin: SupabaseClient,
  subject: string,
  body: string,
): Promise<void> {
  const to = alertRecipient();
  await sendGmailAs(admin, await userIdForEmail(admin, to), { to, subject, body });
}
