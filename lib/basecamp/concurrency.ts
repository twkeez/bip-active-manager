/**
 * Run an async job over a list, a few at a time.
 *
 * The Basecamp sync walked 164 projects one after another and took 203 seconds
 * to do it on a run that had almost no new data to fetch — the cost is the
 * per-project round trip, not the volume. The cron function is capped at 300
 * seconds, so sequential walking was already most of the way to timing out, and
 * a timed-out run writes no last_synced_at and silently stops covering anything.
 *
 * Kept deliberately modest. Basecamp is rate-limited and the point is to stop
 * being slow, not to be as fast as possible.
 */
export async function runWithConcurrency<T>(
  items: readonly T[],
  limit: number,
  job: (item: T) => Promise<void>,
): Promise<void> {
  const queue = [...items];
  const failures: unknown[] = [];

  async function worker() {
    for (;;) {
      const next = queue.shift();
      if (next === undefined) return;
      try {
        await job(next);
      } catch (error) {
        // Collected rather than thrown, so one bad item cannot strand the
        // items still queued behind it.
        failures.push(error);
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, () => worker()),
  );

  if (failures.length > 0) {
    throw new AggregateError(failures, `${failures.length} of ${items.length} jobs failed`);
  }
}
