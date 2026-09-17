/**
 * Running one job per client, a few at a time, inside a time limit.
 *
 * Every scheduled sync has the same three problems: the upstream API rate-limits
 * per account, a serverless request is capped at 300 seconds, and one broken
 * account must not discard the rest of the run. So work goes out in small
 * batches, and when the deadline arrives the run stops launching new ones and
 * says what it did not reach — rather than being killed mid-flight, which loses
 * the report along with the work.
 *
 * Callers order their clients stalest-first, so the ones a deadline defers are
 * first in line the next night. That is what makes a partial run converge
 * instead of starving the same clients every time.
 */

export type BatchOutcome<T, R> = {
  results: R[];
  /** Items the deadline arrived before. Empty on a full run. */
  deferred: T[];
};

export async function runInBatches<T, R>(
  items: T[],
  batchSize: number,
  fn: (item: T) => Promise<R>,
  /** `now` is injectable so the deadline can be tested without waiting for one. */
  { deadline, now = Date.now }: { deadline?: number; now?: () => number } = {},
): Promise<BatchOutcome<T, R>> {
  const results: R[] = [];
  for (let index = 0; index < items.length; index += batchSize) {
    // Checked before each batch, never mid-batch: a started job is always
    // awaited, so nothing is left running against a closing request.
    if (deadline !== undefined && now() >= deadline) {
      return { results, deferred: items.slice(index) };
    }
    const batch = items.slice(index, index + batchSize);
    results.push(...(await Promise.all(batch.map(fn))));
  }
  return { results, deferred: [] };
}

export type ClientSyncResult = {
  clientId: number;
  accountName: string;
  /**
   * "blocked" is the one worth separating: the job reached the API and was told
   * this account is not ours to read — an unverified Search Console property, a
   * GA4 measurement ID stored where a property ID belongs. Counting those as
   * failures would report 84 failures every night and teach everyone to ignore
   * the alert. They need a person to fix something, not a retry.
   */
  status: "ok" | "failed" | "blocked";
  error?: string;
};

export type ClientSyncSummary = {
  synced: number;
  failed: number;
  /** Reached, and refused: access or setup a person has to sort out. */
  blocked: number;
  /** Clients with nothing configured to sync — normal, not a failure. */
  skipped: number;
  /** Clients the deadline cut off; they lead the next run. */
  deferred: number;
  results: ClientSyncResult[];
};

export function summarise(
  results: ClientSyncResult[],
  { skipped, deferred }: { skipped: number; deferred: number },
): ClientSyncSummary {
  return {
    synced: results.filter((result) => result.status === "ok").length,
    failed: results.filter((result) => result.status === "failed").length,
    blocked: results.filter((result) => result.status === "blocked").length,
    skipped,
    deferred,
    results,
  };
}
