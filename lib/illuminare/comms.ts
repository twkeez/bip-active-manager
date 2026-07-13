// Pure helpers for Illuminare comms: author classification, the per-client
// "last communication" aggregate, and excerpt building. Kept side-effect-free
// so the classification/aggregate rules are unit-tested independently.

export type IlluminareCommsEventRow = {
  id: number;
  client_id: number;
  basecamp_project_id: string;
  recording_id: number;
  kind: "message" | "comment";
  occurred_at: string;
  author_name: string | null;
  author_email: string | null;
  is_internal: boolean;
  title: string | null;
  excerpt: string | null;
  url: string | null;
  updated_at: string;
};

/**
 * Classifies an author as internal (us) when their email domain is one of ours.
 * Returns null when there's no email to judge by.
 */
export function isInternalAuthor(
  email: string | null | undefined,
  internalDomains: string[],
): boolean | null {
  const normalized = email?.trim().toLowerCase();
  if (!normalized || !normalized.includes("@")) return null;
  const domain = normalized.split("@")[1] ?? "";
  return internalDomains.includes(domain);
}

/** How the author is stored: unknown-with-email → external, unknown-no-email → internal (conservative). */
export function storedIsInternal(
  classified: boolean | null,
  email: string | null | undefined,
): boolean {
  if (classified === true) return true;
  if (classified === false) return false;
  const normalized = email?.trim().toLowerCase();
  return normalized ? false : true;
}

export type LatestCommsEvent = {
  occurred_at: string;
  is_internal: boolean;
};

export type CommsAggregate = {
  last_communication_at: string | null;
  last_comm_is_internal: boolean | null;
  needs_reply: boolean;
  days_stale: number | null;
};

/**
 * Rolls the latest event into the per-client aggregate. `needs_reply` is true
 * when the client spoke last (external) and we haven't replied.
 */
export function computeCommsAggregate(
  latest: LatestCommsEvent | null,
  nowMs: number = Date.now(),
): CommsAggregate {
  const daysStale = latest
    ? Math.floor((nowMs - new Date(latest.occurred_at).getTime()) / 86_400_000)
    : null;
  return {
    last_communication_at: latest?.occurred_at ?? null,
    last_comm_is_internal: latest?.is_internal ?? null,
    needs_reply: Boolean(latest && latest.is_internal === false),
    days_stale: daysStale,
  };
}

/** Strips HTML/whitespace from Basecamp rich text and truncates for a preview. */
export function buildCommsExcerpt(
  html: string | null | undefined,
  maxLength = 180,
): string | null {
  if (!html) return null;
  const text = html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return null;
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}
