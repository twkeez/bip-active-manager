import type { GmailMessageDetail } from "@/lib/gmail/types";

function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  return Buffer.from(padded, "base64").toString("utf8");
}

function headerValue(
  headers: Array<{ name?: string; value?: string }> | undefined,
  targetName: string,
) {
  const row = headers?.find(
    (header) => (header.name ?? "").toLowerCase() === targetName.toLowerCase(),
  );
  return row?.value?.trim() ?? "";
}

function parseFrom(rawFrom: string) {
  const trimmed = rawFrom.trim();
  if (!trimmed) return { fromName: null as string | null, fromEmail: null as string | null };
  const angleMatch = trimmed.match(/^(.*)<([^>]+)>$/);
  if (angleMatch) {
    const name = angleMatch[1]?.trim().replace(/^"|"$/g, "") || null;
    const email = angleMatch[2]?.trim().toLowerCase() || null;
    return { fromName: name, fromEmail: email };
  }
  if (trimmed.includes("@")) {
    return { fromName: null, fromEmail: trimmed.toLowerCase() };
  }
  return { fromName: trimmed, fromEmail: null };
}

function parseToEmails(rawTo: string) {
  if (!rawTo.trim()) return [] as string[];
  return rawTo
    .split(",")
    .map((item) => {
      const match = item.match(/<([^>]+)>/);
      const email = (match?.[1] ?? item).trim().toLowerCase();
      return email.includes("@") ? email : "";
    })
    .filter(Boolean);
}

function extractPartBodies(
  parts: Array<{
    mimeType?: string;
    body?: { data?: string };
    parts?: Array<{
      mimeType?: string;
      body?: { data?: string };
      parts?: unknown[];
    }>;
  }> | undefined,
) {
  const out: { text: string | null; html: string | null } = {
    text: null,
    html: null,
  };
  const visit = (part: { mimeType?: string; body?: { data?: string }; parts?: unknown[] }) => {
    const bodyData = part.body?.data;
    if (bodyData && typeof bodyData === "string") {
      if (!out.text && part.mimeType === "text/plain") out.text = decodeBase64Url(bodyData);
      if (!out.html && part.mimeType === "text/html") out.html = decodeBase64Url(bodyData);
    }
    if (Array.isArray(part.parts)) {
      for (const child of part.parts as Array<{ mimeType?: string; body?: { data?: string }; parts?: unknown[] }>) {
        visit(child);
      }
    }
  };
  for (const part of parts ?? []) visit(part);
  return out;
}

export function normalizeGmailMessage(detail: GmailMessageDetail) {
  const headers = detail.payload?.headers ?? [];
  const subject = headerValue(headers, "Subject") || null;
  const fromRaw = headerValue(headers, "From");
  const toRaw = headerValue(headers, "To");
  const { fromName, fromEmail } = parseFrom(fromRaw);
  const toEmails = parseToEmails(toRaw);
  const multipartBodies = extractPartBodies(
    detail.payload?.parts as Parameters<typeof extractPartBodies>[0],
  );
  const topBody = detail.payload?.body?.data
    ? decodeBase64Url(detail.payload.body.data)
    : null;
  const bodyText = multipartBodies.text ?? (detail.payload?.mimeType === "text/plain" ? topBody : null);
  const bodyHtml = multipartBodies.html ?? (detail.payload?.mimeType === "text/html" ? topBody : null);
  const internalDate =
    detail.internalDate && /^\d+$/.test(detail.internalDate)
      ? new Date(Number(detail.internalDate)).toISOString()
      : null;
  const labels = detail.labelIds ?? [];

  return {
    gmailMessageId: detail.id ?? "",
    gmailThreadId: detail.threadId ?? "",
    gmailHistoryId: detail.historyId ?? null,
    subject,
    fromEmail,
    fromName,
    toEmails,
    snippet: detail.snippet ?? null,
    bodyText,
    bodyHtml,
    internalDate,
    labelIds: labels,
    isRead: !labels.includes("UNREAD"),
    isStarred: labels.includes("STARRED"),
    rawPayload: detail as unknown as Record<string, unknown>,
  };
}
