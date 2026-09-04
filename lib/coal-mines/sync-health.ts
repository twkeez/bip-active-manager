/**
 * Watches the watcher.
 *
 * Every other canary reports on data the Basecamp sync produced, so all of them
 * are silently wrong when the sync stops running. A page full of "all clear"
 * looks identical whether nothing is wrong or nothing has been checked since
 * Tuesday — which is the worst failure a monitoring page can have.
 *
 * The sync writes last_synced_at only after finishing, so a run killed by the
 * function timeout leaves it untouched. Staleness therefore catches a timeout,
 * a broken schedule, an expired secret and a Basecamp outage alike, without
 * needing to know which happened.
 */

/** Hours before a gap is worth mentioning. The schedule runs every 30 minutes. */
export const SYNC_STALE_HOURS = 6;

/**
 * Hours before it is certainly broken. Above a day, because the weekend
 * schedule is once daily and a Sunday gap is normal.
 */
export const SYNC_OVERDUE_HOURS = 26;

export type SyncStateRow = {
  last_synced_at: string | null;
  last_error: string | null;
};

export type SyncHealth = {
  hoursSince: number | null;
  status: "ok" | "stale" | "overdue" | "never";
  /** Errors from the last run, split into readable lines. */
  errors: string[];
  headline: string;
};

function splitErrors(raw: string | null): string[] {
  if (!raw?.trim()) return [];
  // The sync joins per-project failures with "; " into one string.
  return raw
    .split(/;\s+(?=project )/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function assessSyncHealth(
  state: SyncStateRow | null,
  now: Date = new Date(),
): SyncHealth {
  const errors = splitErrors(state?.last_error ?? null);

  if (!state?.last_synced_at) {
    return {
      hoursSince: null,
      status: "never",
      errors,
      headline: "Basecamp has never finished a sync — every other canary is reporting on nothing.",
    };
  }

  const hoursSince = (now.getTime() - new Date(state.last_synced_at).getTime()) / 3_600_000;
  const rounded = Math.round(hoursSince * 10) / 10;

  if (hoursSince >= SYNC_OVERDUE_HOURS) {
    return {
      hoursSince: rounded,
      status: "overdue",
      errors,
      headline: `No completed Basecamp sync for ${Math.round(hoursSince)} hours — everything below is that stale.`,
    };
  }

  if (hoursSince >= SYNC_STALE_HOURS) {
    return {
      hoursSince: rounded,
      status: "stale",
      errors,
      headline: `Last completed sync was ${Math.round(hoursSince)} hours ago; the schedule runs every 30 minutes.`,
    };
  }

  return {
    hoursSince: rounded,
    status: "ok",
    errors,
    headline:
      rounded < 1
        ? "Synced within the last hour."
        : `Last synced ${rounded} hours ago.`,
  };
}
