import type { ClientSyncSummary } from "@/lib/sync/run-in-batches";

/**
 * How a nightly sync reports itself: 200 only when every eligible client
 * synced. Failures, refusals ("blocked": no access, an expired or missing
 * login) and clients the time budget did not reach all make it partial (207)
 * with a plain summary, so the job watchdog emails Tom.
 *
 * Blocked clients used to count as fine, which is how 61 Search Console
 * properties and 53 GA4 properties refused access every night unnoticed
 * (found 2026-09-28).
 */
export function nightlyOutcome(summary: ClientSyncSummary): { complete: boolean; summaryText: string | null } {
  const parts: string[] = [];
  const names = (status: "failed" | "blocked") => {
    const list = summary.results.filter((result) => result.status === status).map((result) => result.accountName);
    return list.length ? `, e.g. ${list.slice(0, 3).join(", ")}${list.length > 3 ? "…" : ""}` : "";
  };
  if (summary.failed) parts.push(`${summary.failed} failed${names("failed")}`);
  if (summary.blocked) parts.push(`${summary.blocked} blocked (no access or login)${names("blocked")}`);
  if (summary.deferred) parts.push(`${summary.deferred} not reached in time (they go first next run)`);
  return { complete: parts.length === 0, summaryText: parts.length ? parts.join(" · ") : null };
}
