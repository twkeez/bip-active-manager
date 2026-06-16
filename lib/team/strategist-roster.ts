import { FIXED_TASK_ASSIGNEE_NAMES } from "@/lib/tasks/people";
import { toMatchTokens } from "@/lib/dashboard/client-list-utils";
import { openableBasecampUrl, previewText } from "@/lib/basecamp/display";
import type { BasecampThreadEvent, ClientRow } from "@/lib/types/client";

/**
 * Configure strategist name → email pairs in .env.local:
 * STRATEGIST_CONTACTS=Alex:alex@example.com,Stephanie:stephanie@example.com
 */
export type StrategistContact = {
  name: string;
  email: string | null;
};

function normalizePersonName(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

export function parseStrategistContacts(raw: string | undefined): Map<string, string> {
  const map = new Map<string, string>();
  if (!raw?.trim()) return map;

  for (const entry of raw.split(",")) {
    const trimmed = entry.trim();
    if (!trimmed) continue;
    const colon = trimmed.indexOf(":");
    if (colon <= 0) continue;
    const name = trimmed.slice(0, colon).trim();
    const email = trimmed.slice(colon + 1).trim();
    if (name && email.includes("@")) {
      map.set(normalizePersonName(name), email);
    }
  }
  return map;
}

export function getStrategistRoster(contactsRaw?: string): StrategistContact[] {
  const emailByKey = parseStrategistContacts(
    contactsRaw ?? process.env.STRATEGIST_CONTACTS,
  );
  const rosterByKey = new Map<string, StrategistContact>();

  for (const name of FIXED_TASK_ASSIGNEE_NAMES) {
    const key = normalizePersonName(name);
    rosterByKey.set(key, {
      name,
      email: emailByKey.get(key) ?? null,
    });
  }

  for (const [key, email] of emailByKey) {
    if (rosterByKey.has(key)) continue;
    const displayName = key
      .split(" ")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
    rosterByKey.set(key, { name: displayName, email });
  }

  const fixedOrder = new Map(
    FIXED_TASK_ASSIGNEE_NAMES.map((name, index) => [normalizePersonName(name), index]),
  );

  return [...rosterByKey.values()].sort((left, right) => {
    const leftOrder = fixedOrder.get(normalizePersonName(left.name)) ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = fixedOrder.get(normalizePersonName(right.name)) ?? Number.MAX_SAFE_INTEGER;
    if (leftOrder !== rightOrder) return leftOrder - rightOrder;
    return left.name.localeCompare(right.name);
  });
}

export function matchStrategistByName(
  marketingStrategist: string | null | undefined,
  roster: StrategistContact[],
): StrategistContact | null {
  const strategistTokens = toMatchTokens(marketingStrategist);
  if (strategistTokens.length === 0) return null;

  let best: StrategistContact | null = null;
  let bestScore = 0;

  for (const contact of roster) {
    const nameTokens = toMatchTokens(contact.name);
    if (nameTokens.length === 0) continue;

    let score = 0;
    for (const token of strategistTokens) {
      if (nameTokens.some((part) => part.includes(token) || token.includes(part))) {
        score += 1;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      best = contact;
    }
  }

  return bestScore > 0 ? best : null;
}

function formatRelativeDays(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const days = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (days <= 0) return "today";
  if (days === 1) return "1 day ago";
  return String(days) + " days ago";
}

export type BuildStrategistNotifyMailtoInput = {
  to: string;
  client: Pick<ClientRow, "id" | "account_name" | "marketing_strategist">;
  thread: Pick<
    BasecampThreadEvent,
    "occurred_at" | "thread_title" | "thread_excerpt" | "thread_body" | "thread_url"
  >;
  appUrl: string;
  senderEmail?: string | null;
};

export function buildStrategistNotifyMailto(input: BuildStrategistNotifyMailtoInput): string {
  const baseUrl = input.appUrl.replace(/\/$/, "");
  const workspaceUrl = baseUrl + "/dashboard/clients/" + String(input.client.id);
  const basecampUrl = openableBasecampUrl(input.thread.thread_url);
  const relativeDate = formatRelativeDays(input.thread.occurred_at);
  const excerpt = previewText(input.thread, 280);

  const accountName = input.client.account_name;
  const strategistLabel = input.client.marketing_strategist?.trim() || "Unassigned";
  const threadTitle = input.thread.thread_title?.trim();

  const lines = [
    "Hi,",
    "",
    "A client thread needs strategist attention: " + accountName + ".",
    "",
    "Account: " + accountName,
    "Assigned strategist (record): " + strategistLabel,
    relativeDate
      ? "Client last responded: " + relativeDate
      : "Client last responded: recently",
    threadTitle ? "Thread: " + threadTitle : null,
    'Message preview: "' + excerpt + '"',
    "",
    "Open in BIP: " + workspaceUrl,
    basecampUrl ? "Open in Basecamp: " + basecampUrl : null,
    "",
    input.senderEmail
      ? "Sent from BIP by " + input.senderEmail
      : "Sent from BIP Control Panel",
  ].filter((line): line is string => line != null);

  const subject = "Client reply needed - " + input.client.account_name;
  const params = new URLSearchParams({
    subject,
    body: lines.join("\n"),
  });

  return "mailto:" + encodeURIComponent(input.to) + "?" + params.toString();
}
