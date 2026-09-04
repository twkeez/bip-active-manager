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
};

export type ThreadFinding = {
  clientId: number;
  clientName: string;
  title: string;
  url: string | null;
  days: number;
};

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
  });

  const awaitingUs = clientFacing
    // is_internal === false means the client spoke last. Null is unknown, and
    // guessing "they are waiting" on unknown authorship would invent work.
    .filter((r) => r.is_internal === false && daysSince(r.occurred_at, now) >= awaitingDays)
    .map(toFinding)
    .sort((a, b) => b.days - a.days);

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
