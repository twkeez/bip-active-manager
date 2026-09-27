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
// Only who and when are kept. No post text is stored: the response report does
// not need it, and some threads carry logins.

export type ClassicThreadPost = {
  /** The comment id; for the opening post, the message id itself. */
  recordingId: number;
  occurredAt: string;
  personId: number | null;
  email: string | null;
};

type ClassicPerson = { id?: unknown; email_address?: unknown; email?: unknown } | null | undefined;

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

function personOf(creator: ClassicPerson): { personId: number | null; email: string | null } {
  const raw = creator?.email_address ?? creator?.email;
  return {
    personId: toId(creator?.id),
    email: typeof raw === "string" && raw.trim() ? raw.trim() : null,
  };
}

/** The opening post and every comment of a classic message, from its detail JSON. */
export function classicThreadPosts(messageId: number, detail: unknown): ClassicThreadPost[] {
  if (!detail || typeof detail !== "object") return [];
  const message = detail as {
    created_at?: unknown;
    creator?: ClassicPerson;
    comments?: Array<{ id?: unknown; created_at?: unknown; creator?: ClassicPerson }>;
  };
  const posts: ClassicThreadPost[] = [];
  const openedAt = toIso(message.created_at);
  if (openedAt) posts.push({ recordingId: messageId, occurredAt: openedAt, ...personOf(message.creator) });
  for (const comment of message.comments ?? []) {
    const id = toId(comment?.id);
    const at = toIso(comment?.created_at);
    if (id == null || !at) continue;
    posts.push({ recordingId: id, occurredAt: at, ...personOf(comment.creator) });
  }
  return posts;
}
