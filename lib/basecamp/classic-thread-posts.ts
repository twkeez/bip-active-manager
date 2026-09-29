// Every post in a classic Basecamp thread: the opening message and each reply.
//
// The classic topics list only says who posted LAST in each thread, and the
// sync used to store just that, overwritten on every run. A reply from us that
// the client then answered vanished: on 2026-09-27 Travelers Rest, Northside
// Paws and Minnesota Vet Neurology all showed "no reply from us" though our
// strategists had posted in the very thread the client answered. The thread's
// own endpoint (/projects/{p}/messages/{id}.json) lists the opening post and
// every comment (email-in replies arrive as comments), so each becomes its own
// row.
//
// Since 2026-09-29 the words are kept too, so Poobah Client Watch can see what
// clients are asking for, credential-safe (lib/onboarding/background-safety.ts):
// posts in threads named for access or logins are never stored, and any line
// that looks like a password, login or key is removed first.

import { htmlToText, isAccessThread, redactCredentials } from "@/lib/onboarding/background-safety";

/** Longest post text kept; a longer post is cut here and says so. */
export const POST_TEXT_MAX = 20_000;

export type ClassicThreadPost = {
  /** The comment id; for the opening post, the message id itself. */
  recordingId: number;
  occurredAt: string;
  personId: number | null;
  email: string | null;
  name: string | null;
  /** Readable, credential-scrubbed text; null when withheld or empty. */
  text: string | null;
  redactedLines: number;
  /** Why the text was not kept, when it was not. */
  withheld: "access_thread" | null;
};

type ClassicPerson = { id?: unknown; email_address?: unknown; email?: unknown; name?: unknown } | null | undefined;

function toId(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value === "string" && /^\d+$/.test(value.trim())) return Number(value.trim());
  return null;
}

function toIso(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = new Date(value.trim());
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function personOf(creator: ClassicPerson): { personId: number | null; email: string | null; name: string | null } {
  const raw = creator?.email_address ?? creator?.email;
  return {
    personId: toId(creator?.id),
    email: typeof raw === "string" && raw.trim() ? raw.trim() : null,
    name: typeof creator?.name === "string" && creator.name.trim() ? creator.name.trim() : null,
  };
}

/** A post's words, safe to store: none for an access thread, credential lines removed otherwise. */
export function safePostText(
  html: unknown,
  threadTitle: string | null,
): { text: string | null; redactedLines: number; withheld: "access_thread" | null } {
  if (isAccessThread(threadTitle)) return { text: null, redactedLines: 0, withheld: "access_thread" };
  const { text, removed } = redactCredentials(htmlToText(typeof html === "string" ? html : ""));
  const trimmed = text.trim();
  if (!trimmed) return { text: null, redactedLines: removed, withheld: null };
  return {
    text: trimmed.length > POST_TEXT_MAX ? `${trimmed.slice(0, POST_TEXT_MAX)}\n[… cut at ${POST_TEXT_MAX} characters]` : trimmed,
    redactedLines: removed,
    withheld: null,
  };
}

/** The opening post and every comment of a classic message, from its detail JSON. */
export function classicThreadPosts(messageId: number, detail: unknown, threadTitle: string | null = null): ClassicThreadPost[] {
  if (!detail || typeof detail !== "object") return [];
  const message = detail as {
    created_at?: unknown;
    creator?: ClassicPerson;
    subject?: unknown;
    content?: unknown;
    comments?: Array<{ id?: unknown; created_at?: unknown; creator?: ClassicPerson; content?: unknown }>;
  };
  const title = threadTitle ?? (typeof message.subject === "string" ? message.subject : null);
  const posts: ClassicThreadPost[] = [];
  const openedAt = toIso(message.created_at);
  if (openedAt) {
    posts.push({ recordingId: messageId, occurredAt: openedAt, ...personOf(message.creator), ...safePostText(message.content, title) });
  }
  for (const comment of message.comments ?? []) {
    const id = toId(comment?.id);
    const at = toIso(comment?.created_at);
    if (id == null || !at) continue;
    posts.push({ recordingId: id, occurredAt: at, ...personOf(comment.creator), ...safePostText(comment.content, title) });
  }
  return posts;
}
