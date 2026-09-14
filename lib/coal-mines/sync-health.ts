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
 *
 * The thresholds below are measured, not assumed. The workflow asks for a run
 * every 30 minutes on weekday daytimes — about 26 a day — and GitHub delivers
 * between one and five, because it de-prioritises scheduled workflows under
 * load and skips runs rather than queuing them. Over the 30 intervals to
 * 2026-09-14 the median gap was 3.2 hours, a third exceeded 6 hours, and the
 * largest was 24.3. Thresholds set from the cron expression would therefore
 * have cried wolf on a third of all intervals, and a canary that is wrong that
 * often stops being read at all.
 */

/**
 * Hours before a gap is genuinely abnormal — above every gap seen in normal
 * operation, so this fires on a fault rather than on GitHub being GitHub.
 * The "ok" headline still reports the age, so the number is never hidden.
 */
export const SYNC_STALE_HOURS = 26;

/** Hours before it is certainly broken: a full day beyond the worst normal gap. */
export const SYNC_OVERDUE_HOURS = 48;

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
      headline: `Last completed sync was ${Math.round(hoursSince)} hours ago; the schedule normally lands several times a day.`,
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
