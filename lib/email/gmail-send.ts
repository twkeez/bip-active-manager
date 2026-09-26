import type { SupabaseClient } from "@supabase/supabase-js";
import { getGmailAccessTokenForUser } from "@/lib/gmail/token-manager";

export type OutgoingEmail = {
  to: string;
  cc?: string | null;
  subject: string;
  body: string;
};

function encodeHeader(value: string): string {
  // Non-ASCII subjects (en dashes, ✓) must be encoded or they arrive garbled.
  return /^[\x20-\x7e]*$/.test(value)
    ? value
    : `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}

/** A plain-text email as Gmail's send API wants it: base64url of the RFC 822 message. */
export function buildRawEmail(email: OutgoingEmail): string {
  const message = [
    `To: ${email.to}`,
    ...(email.cc ? [`Cc: ${email.cc}`] : []),
    `Subject: ${encodeHeader(email.subject)}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    Buffer.from(email.body, "utf8").toString("base64"),
  ].join("\r\n");
  return Buffer.from(message, "utf8").toString("base64url");
}

/**
 * Send from a person's own Gmail, through the Gmail connection the app holds
 * for them, so replies come straight back to them. Throws when it cannot send.
 */
export async function sendGmailAs(
  admin: SupabaseClient,
  userId: string,
  email: OutgoingEmail,
): Promise<void> {
  let accessToken: string;
  try {
    ({ accessToken } = await getGmailAccessTokenForUser(admin, userId));
  } catch (error) {
    throw new Error(
      `Your Gmail is not connected to the app, so it cannot send email for you. ${
        error instanceof Error ? error.message : ""
      }`.trim(),
    );
  }
  const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ raw: buildRawEmail(email) }),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Gmail refused the email (HTTP ${response.status}): ${text.slice(0, 200)}`);
  }
}

/** The app user behind an email address, for sending from their Gmail. */
export async function userIdForEmail(admin: SupabaseClient, email: string): Promise<string> {
  const { data, error } = await admin.from("profiles").select("id").ilike("email", email).maybeSingle();
  if (error) throw new Error(`Could not look up ${email}: ${error.message}`);
  if (!data) throw new Error(`No app user with the email ${email}, so there is no Gmail to send from.`);
  return (data as { id: string }).id;
}
