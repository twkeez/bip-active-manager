import { createHmac } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendGmailAs } from "@/lib/email/gmail-send";
import type { ClientSnapshot, SnapshotMetric } from "./load";
import { hashToken, latestPublication, portalBaseUrl } from "./portal";

/**
 * The monthly "your snapshot is ready" email (step 2b).
 *
 * It is sent by an admin pressing Send, from that admin's own Gmail, so
 * replies come straight back to them. It always points at the client's latest
 * *published* snapshot, and every attempt, sent or failed, is logged.
 */

export const MAX_RECIPIENTS = 10;

/**
 * The email link's token, recomputed from the link id with a private key, so
 * the same address goes out every month while only its hash is stored. The
 * key is derived from the server's Supabase service key: rotating that key
 * changes every email link, which is then re-sent with the next email.
 */
function emailLinkToken(linkId: number): string {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!secret) throw new Error("The server key is missing, so email links cannot be made.");
  const key = createHmac("sha256", secret).update("bip-client-snapshot-email-link-v1").digest();
  return createHmac("sha256", key).update(`link:${linkId}`).digest("base64url");
}

/** Recipients typed by an admin: comma, space or line separated, checked, de-duplicated. */
export function parseRecipients(raw: string): string[] {
  const emails = raw
    .split(/[\s,;]+/)
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  const bad = emails.filter((email) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
  if (bad.length) throw new Error(`Not an email address: ${bad.join(", ")}`);
  const unique = [...new Set(emails)];
  if (unique.length > MAX_RECIPIENTS) throw new Error(`At most ${MAX_RECIPIENTS} recipients per client.`);
  return unique;
}

function failed(context: string, error: { message: string } | null): never {
  const message = error?.message ?? "unknown error";
  if (/could not find the table|does not exist|column .*kind/i.test(message)) {
    throw new Error(`${context}: the snapshot email tables do not exist yet. Run supabase/migrations/20261008130000_client_snapshot_email.sql.`);
  }
  throw new Error(`${context}: ${message}`);
}

export async function getRecipients(admin: SupabaseClient, clientId: number): Promise<string[]> {
  const { data, error } = await admin.from("client_snapshot_recipients").select("emails").eq("client_id", clientId).maybeSingle();
  if (error) failed("Could not read recipients", error);
  return (data?.emails as string[] | undefined) ?? [];
}

export async function setRecipients(admin: SupabaseClient, clientId: number, raw: string, email: string): Promise<string[]> {
  const emails = parseRecipients(raw);
  const { data, error } = await admin
    .from("client_snapshot_recipients")
    .upsert({ client_id: clientId, emails, updated_at: new Date().toISOString(), updated_by_email: email })
    .select("emails")
    .single();
  if (error) failed("Could not save recipients", error);
  return data.emails as string[];
}

export type SendRow = { id: number; recipients: string[]; status: "sent" | "failed"; error: string | null; sent_at: string; sent_by_email: string };

export async function recentSends(admin: SupabaseClient, clientId: number): Promise<SendRow[]> {
  const { data, error } = await admin
    .from("client_snapshot_sends")
    .select("id,recipients,status,error,sent_at,sent_by_email")
    .eq("client_id", clientId)
    .order("sent_at", { ascending: false })
    .limit(5);
  if (error) failed("Could not read past emails", error);
  return (data ?? []) as SendRow[];
}

/** The client's email link: the existing one, or a new one made now. */
async function emailLinkUrl(admin: SupabaseClient, clientId: number, email: string): Promise<{ linkId: number; url: string }> {
  const base = portalBaseUrl();
  if (!base) throw new Error("CLIENT_PORTAL_URL is not set, so there is no address to email.");
  const { data: existing, error } = await admin
    .from("client_snapshot_links")
    .select("id")
    .eq("client_id", clientId)
    .eq("kind", "email")
    .is("revoked_at", null)
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) failed("Could not read the email link", error);
  let linkId = (existing?.[0] as { id: number } | undefined)?.id;
  if (!linkId) {
    // Insert first to get the id the token is made from, then store its hash.
    const placeholder = `pending-${clientId}-${Date.now()}-${Math.random()}`;
    const { data: created, error: createError } = await admin
      .from("client_snapshot_links")
      .insert({ client_id: clientId, kind: "email", token_hash: hashToken(placeholder), created_by_email: email })
      .select("id")
      .single();
    if (createError || !created) failed("Could not create the email link", createError);
    linkId = created.id as number;
    const { error: hashError } = await admin
      .from("client_snapshot_links")
      .update({ token_hash: hashToken(emailLinkToken(linkId)) })
      .eq("id", linkId);
    if (hashError) failed("Could not finish the email link", hashError);
  }
  return { linkId, url: `${base}/s/${emailLinkToken(linkId)}` };
}

function headline(metric: SnapshotMetric): string {
  const value =
    metric.format === "money"
      ? metric.value.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })
      : metric.format === "rating"
        ? metric.value.toFixed(1)
        : Math.round(metric.value).toLocaleString("en-US");
  return `${metric.label}: ${value}`;
}

/** The email itself: short, plain text, with the link and three highlights. */
export function buildSnapshotEmail(snapshot: ClientSnapshot, url: string, monthLabel: string): { subject: string; body: string } {
  const picks: SnapshotMetric[] = [];
  const want: [string, string][] = [
    ["ads", "Calls from your ads"],
    ["ads", "Leads (calls and forms)"],
    ["website", "Visitors"],
    ["listing", "Google reviews"],
    ["social", "Facebook followers"],
  ];
  for (const [key, label] of want) {
    const metric = snapshot.sections.find((section) => section.key === key)?.metrics.find((m) => m.label === label);
    if (metric && metric.value > 0 && picks.length < 3) picks.push(metric);
  }
  const lines = [
    `Hi ${snapshot.clientName} team,`,
    "",
    `Your ${monthLabel} snapshot from Beyond Indigo Pets is ready: what we worked on for you, and how your marketing is doing.`,
    "",
    ...(picks.length ? ["A few highlights:", ...picks.map((metric) => `• ${headline(metric)}`), ""] : []),
    "See your snapshot:",
    url,
    "",
    "This link is just for your practice and works on any phone or computer. Questions? Just reply to this email.",
    "",
    "Beyond Indigo Pets",
  ];
  return { subject: `Your ${monthLabel} marketing snapshot from Beyond Indigo Pets`, body: lines.join("\n") };
}

/**
 * Send the latest published snapshot to the client's recipients from the
 * sender's Gmail. Refuses when there is nothing to send or no one to send it
 * to; logs the outcome either way.
 */
export async function sendSnapshotEmail(
  admin: SupabaseClient,
  clientId: number,
  sender: { userId: string; email: string },
): Promise<{ recipients: string[]; url: string }> {
  const recipients = await getRecipients(admin, clientId);
  if (!recipients.length) throw new Error("Add at least one recipient first.");
  const publication = await latestPublication(admin, clientId);
  if (!publication) throw new Error("Publish the snapshot first: the email links to the published version.");
  const { linkId, url } = await emailLinkUrl(admin, clientId, sender.email);
  const monthLabel = new Date(publication.published_at).toLocaleDateString("en-US", { month: "long", timeZone: "America/Chicago" });
  const email = buildSnapshotEmail(publication.snapshot, url, monthLabel);
  const log = (status: "sent" | "failed", error: string | null) =>
    admin.from("client_snapshot_sends").insert({
      client_id: clientId,
      publication_id: publication.id,
      link_id: linkId,
      recipients,
      status,
      error,
      sent_by_email: sender.email,
    });
  try {
    await sendGmailAs(admin, sender.userId, { to: recipients.join(", "), subject: email.subject, body: email.body });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await log("failed", message);
    throw new Error(`Not sent: ${message}`);
  }
  const { error: logError } = await log("sent", null);
  if (logError) throw new Error(`The email was sent, but logging it failed: ${logError.message}`);
  return { recipients, url };
}
