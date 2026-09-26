import type { SupabaseClient } from "@supabase/supabase-js";
import { getGmailAccessTokenForUser } from "@/lib/gmail/token-manager";

/** Who hears about job problems. Override with JOB_ALERT_EMAIL. */
export function alertRecipient(): string {
  return process.env.JOB_ALERT_EMAIL?.trim() || "tom@beyondindigo.com";
}

function encodeHeader(value: string): string {
  // Non-ASCII subjects (en dashes, ✓) must be encoded or they arrive garbled.
  return /^[\x20-\x7e]*$/.test(value)
    ? value
    : `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}

export function buildRawEmail(to: string, subject: string, body: string): string {
  const message = [
    `To: ${to}`,
    `Subject: ${encodeHeader(subject)}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    Buffer.from(body, "utf8").toString("base64"),
  ].join("\r\n");
  return Buffer.from(message, "utf8").toString("base64url");
}

/**
 * Email the alert recipient from their own Gmail, through the Gmail
 * connection the app already holds for them. Throws when it cannot send, so
 * the watchdog run is marked failed and the alert is retried next hour.
 */
export async function sendAlertEmail(
  admin: SupabaseClient,
  subject: string,
  body: string,
): Promise<void> {
  const to = alertRecipient();
  const { data: profile, error } = await admin
    .from("profiles")
    .select("id")
    .ilike("email", to)
    .maybeSingle();
  if (error) throw new Error(`Could not look up ${to}: ${error.message}`);
  if (!profile) throw new Error(`No app user with the email ${to}, so there is no Gmail to send from.`);

  const { accessToken } = await getGmailAccessTokenForUser(admin, (profile as { id: string }).id);
  const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ raw: buildRawEmail(to, subject, body) }),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Gmail refused the alert email (HTTP ${response.status}): ${text.slice(0, 200)}`);
  }
}
