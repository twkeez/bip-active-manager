import { createHash, randomBytes } from "node:crypto";

export type EmailForwardPayload = {
  to?: string | string[];
  toToken?: string;
  from?: string;
  subject?: string;
  date?: string;
  messageId?: string;
  text?: string;
  html?: string;
};

function normalize(value: string | null | undefined) {
  return (value ?? "").trim();
}

export function normalizeMessageId(value: string | undefined) {
  const normalized = normalize(value).replace(/^<|>$/g, "").toLowerCase();
  return normalized || null;
}

export function stripHtml(value: string | undefined) {
  const normalized = normalize(value);
  if (!normalized) return "";
  return normalized
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function buildEmailExcerpt(payload: EmailForwardPayload) {
  const textBody = normalize(payload.text);
  const htmlBody = stripHtml(payload.html);
  const body = textBody || htmlBody;
  if (!body) return null;
  return body.length > 280 ? `${body.slice(0, 277)}...` : body;
}

export function buildEmailExternalId(payload: EmailForwardPayload) {
  const messageId = normalizeMessageId(payload.messageId);
  if (messageId) return `message:${messageId}`;
  const seed = [
    normalize(payload.from).toLowerCase(),
    normalize(payload.subject).toLowerCase(),
    normalize(payload.date).toLowerCase(),
    buildEmailExcerpt(payload) ?? "",
  ].join("|");
  const digest = createHash("sha256").update(seed).digest("hex");
  return `fallback:${digest}`;
}

export function extractTokenFromToAddresses(payload: EmailForwardPayload) {
  if (payload.toToken && normalize(payload.toToken)) {
    return normalize(payload.toToken).toLowerCase();
  }

  const addresses = Array.isArray(payload.to)
    ? payload.to
    : payload.to
      ? [payload.to]
      : [];
  for (const address of addresses) {
    const normalized = normalize(address).toLowerCase();
    if (!normalized) continue;
    const plusMatch = normalized.match(/[a-z0-9._%+-]+\+([a-z0-9_-]{10,})@/);
    if (plusMatch?.[1]) return plusMatch[1];
    const local = normalized.split("@")[0] ?? "";
    if (local && /^[a-z0-9_-]{16,}$/.test(local)) return local;
  }
  return null;
}

export function buildEmailTaskTitle(payload: EmailForwardPayload) {
  const subject = normalize(payload.subject);
  if (subject) return subject;
  const from = normalize(payload.from);
  return from ? `Follow up: ${from}` : "Follow up on forwarded email";
}

export function generateInboxToken() {
  return randomBytes(16).toString("hex");
}
