import { getBasecampClassicConfig } from "@/lib/env";

/**
 * The full text of the most recent message in a Basecamp thread.
 *
 * The sync stores what `topics.json` gives it, and that excerpt is capped at
 * 100 characters — on live data 76 of 97 threads are truncated mid-sentence.
 * Judging "does this need a reply?" on a fragment is guesswork: a message that
 * opens with thanks and closes with a question reads as closed.
 *
 * Fetched only for threads about to be classified, so this costs one request
 * per candidate rather than one per thread in the account.
 */

export type LatestThreadMessage = {
  content: string;
  authorName: string | null;
  authorEmail: string | null;
  createdAt: string | null;
  /** How many comments followed the original post. */
  commentCount: number;
};

type ClassicPerson = { name?: unknown; email_address?: unknown };
type ClassicComment = { content?: unknown; created_at?: unknown; creator?: ClassicPerson };
type ClassicMessage = {
  content?: unknown;
  created_at?: unknown;
  creator?: ClassicPerson;
  comments?: ClassicComment[];
};

function text(value: unknown): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    // Email clients leave inline-image references behind; they are not content.
    .replace(/\[cid:[^\]]+\]/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function person(p: ClassicPerson | undefined) {
  return {
    name: typeof p?.name === "string" ? p.name : null,
    email: typeof p?.email_address === "string" ? p.email_address : null,
  };
}

function classicHeaders() {
  const config = getBasecampClassicConfig();
  const authorization = config.token
    ? `Bearer ${config.token}`
    : `Basic ${Buffer.from(`${config.basicUser}:${config.basicPassword}`, "utf8").toString("base64")}`;
  return {
    accountId: config.accountId,
    headers: {
      Authorization: authorization,
      Accept: "application/json",
      "User-Agent": "BIPClientManager (ops@beyondindigo.com)",
    },
  };
}

/**
 * Returns null rather than throwing when a thread cannot be read — a deleted or
 * permission-denied thread must not take down a whole classification run. The
 * caller falls back to the stored excerpt.
 */
export async function fetchLatestThreadMessage(
  projectId: string,
  messageId: number,
): Promise<LatestThreadMessage | null> {
  try {
    const { accountId, headers } = classicHeaders();
    const res = await fetch(
      `https://basecamp.com/${accountId}/api/v1/projects/${encodeURIComponent(projectId)}/messages/${messageId}.json`,
      { headers, cache: "no-store" },
    );
    if (!res.ok) return null;
    const message = (await res.json()) as ClassicMessage;

    const comments = Array.isArray(message.comments) ? message.comments : [];
    // Comments come back oldest-first; the last one is the current state of the
    // conversation, which is what the verdict is about.
    const last = comments.length > 0 ? comments[comments.length - 1] : null;

    const body = text(last ? last.content : message.content);
    if (!body) return null;

    const who = person(last ? last.creator : message.creator);
    return {
      content: body,
      authorName: who.name,
      authorEmail: who.email,
      createdAt:
        typeof (last ? last.created_at : message.created_at) === "string"
          ? ((last ? last.created_at : message.created_at) as string)
          : null,
      commentCount: comments.length,
    };
  } catch {
    return null;
  }
}

/**
 * Fetches several threads with a small amount of concurrency. Basecamp is
 * rate-limited and these run inside a request, so this stays deliberately
 * modest rather than firing eighty requests at once.
 */
export async function fetchLatestThreadMessages(
  threads: Array<{ key: number; projectId: string; messageId: number }>,
  concurrency = 5,
): Promise<Map<number, LatestThreadMessage>> {
  const out = new Map<number, LatestThreadMessage>();
  const queue = [...threads];

  async function worker() {
    for (;;) {
      const next = queue.shift();
      if (!next) return;
      const latest = await fetchLatestThreadMessage(next.projectId, next.messageId);
      if (latest) out.set(next.key, latest);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, threads.length) }, () => worker()),
  );
  return out;
}
