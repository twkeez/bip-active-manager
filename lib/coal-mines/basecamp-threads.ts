/**
 * Thread-level watch over Basecamp, as opposed to the Comms Monitor's
 * client-level one.
 *
 * The dashboard rolls a client up to a single `last_communication_at` and one
 * `needs_reply` flag, so a client reads as fine the moment anyone posts in any
 * thread. That hides the case that actually costs us: one thread where the
 * client asked something, sitting unanswered, while other threads on the same
 * project stay busy. On live data the client-level view shows 5 clients
 * awaiting a reply; at thread level 16 threads have been waiting over a week.
 *
 * What the stored rows are: the classic Basecamp sync writes one row per thread
 * and keeps it updated, where `occurred_at` is the thread's last activity and
 * `is_internal` describes whoever last spoke in it — not the thread's author.
 * Individual comments are not stored, but their effect is, which is all this
 * needs.
 */

/** Days a client can be left waiting before it is worth flagging. */
export const AWAITING_REPLY_DAYS = 3;

/** Days of silence before a thread counts as stalled. */
export const STALLED_DAYS = 30;

export type ThreadRow = {
  client_id: number;
  thread_title: string | null;
  thread_url: string | null;
  occurred_at: string;
  /** True when we spoke last; false when the client did. */
  is_internal: boolean | null;
  /** Verdict on the last message; null until the thread has been read. */
  reply_need?: "needs_reply" | "fyi" | "closed" | "unclear" | null;
  reply_need_reason?: string | null;
  reply_need_escalated?: boolean | null;
  /** The excerpt the verdict was based on, and the current one. */
  classified_excerpt?: string | null;
  thread_excerpt?: string | null;
};

export type ThreadFinding = {
  clientId: number;
  clientName: string;
  title: string;
  url: string | null;
  days: number;
  /** Why it is here, from the classifier. Null when unread. */
  reason?: string | null;
  escalated?: boolean;
};

/**
 * True when the stored verdict still describes the current last message. A
 * thread that has moved on since it was read is treated as unclassified rather
 * than trusted, which is what stops a stale "closed" hiding a new question.
 */
export function verdictIsCurrent(row: ThreadRow): boolean {
  return (
    row.reply_need != null &&
    (row.classified_excerpt ?? null) === (row.thread_excerpt ?? null)
  );
}

/**
 * Whether a thread should be treated as work.
 *
 * Fails open: an unread thread, or one whose verdict is stale, still counts.
 * Hiding a real request because nothing has classified it yet would be the
 * worst failure this canary could have.
 */
export function stillNeedsReply(row: ThreadRow): boolean {
  if (!verdictIsCurrent(row)) return true;
  return row.reply_need === "needs_reply" || row.reply_need === "unclear";
}

export type ThreadIssues = {
  /** Client spoke last and has been waiting. */
  awaitingUs: ThreadFinding[];
  /** Nobody has said anything for a long time, whoever spoke last. */
  stalled: ThreadFinding[];
  /** Client-facing threads considered, for context on the numbers. */
  considered: number;
};

/**
 * Threads the team titles `INTERNAL: ...` are notes to each other. No client is
 * waiting on them, so they never belong in "awaiting our reply".
 */
export function isInternalThread(title: string | null): boolean {
  return /^\s*INTERNAL\b/i.test(title ?? "");
}

function daysSince(iso: string, now: Date): number {
  return Math.floor((now.getTime() - new Date(iso).getTime()) / 86_400_000);
}

export function findThreadIssues(
  rows: ThreadRow[],
  clientNames: Map<number, string>,
  now: Date = new Date(),
  opts: { awaitingDays?: number; stalledDays?: number } = {},
): ThreadIssues {
  const awaitingDays = opts.awaitingDays ?? AWAITING_REPLY_DAYS;
  const stalledDays = opts.stalledDays ?? STALLED_DAYS;

  const clientFacing = rows.filter((r) => !isInternalThread(r.thread_title));

  const toFinding = (row: ThreadRow): ThreadFinding => ({
    clientId: row.client_id,
    clientName: clientNames.get(row.client_id) ?? `Client ${row.client_id}`,
    title: row.thread_title?.trim() || "(untitled thread)",
    url: row.thread_url,
    days: daysSince(row.occurred_at, now),
    reason: verdictIsCurrent(row) ? row.reply_need_reason : null,
    escalated: verdictIsCurrent(row) ? row.reply_need_escalated === true : false,
  });

  const awaitingUs = clientFacing
    // is_internal === false means the client spoke last. Null is unknown, and
    // guessing "they are waiting" on unknown authorship would invent work.
    .filter((r) => r.is_internal === false && daysSince(r.occurred_at, now) >= awaitingDays)
    // ...and the last message actually left something outstanding. An
    // announcement or a thank-you is not work.
    .filter(stillNeedsReply)
    .map(toFinding)
    // Someone chasing us outranks someone who has merely waited longer.
    .sort((a, b) => Number(b.escalated) - Number(a.escalated) || b.days - a.days);

  // A thread waiting on us for 30 days is both awaiting and stalled. It is one
  // problem, so it gets named once, under the heading that says what to do.
  const awaitingKeys = new Set(awaitingUs.map((f) => `${f.clientId}::${f.title}`));

  const stalled = clientFacing
    .filter((r) => daysSince(r.occurred_at, now) >= stalledDays)
    .map(toFinding)
    .filter((f) => !awaitingKeys.has(`${f.clientId}::${f.title}`))
    .sort((a, b) => b.days - a.days);

  return { awaitingUs, stalled, considered: clientFacing.length };
}
