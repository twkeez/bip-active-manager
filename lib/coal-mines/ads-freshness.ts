/**
 * Watches the ads sync.
 *
 * Ads reporting is the one place in this app where stale data reads as fact: a
 * client page showing $4,577 and 55% impression share looks identical whether
 * those numbers are from last night or from July. They were from July for two
 * months, and nothing said so.
 *
 * So this canary answers one question — when did each account last complete a
 * refresh — and treats "never" and "failed" as the same class of problem as
 * "old", because from the client page they are indistinguishable.
 */

/** Days before an account's numbers are worth questioning. The job runs nightly. */
export const ADS_STALE_DAYS = 2;

/** Days before the schedule itself is the likely cause rather than one account. */
export const ADS_OVERDUE_DAYS = 5;

export type AdsSnapshotRow = {
  client_id: number;
  run_status: string;
  created_at: string;
  error_message: string | null;
};

export type AdsAccountRow = {
  id: number;
  account_name: string;
};

export type AdsAccountFreshness = {
  clientId: number;
  accountName: string;
  /** Days since the last completed snapshot; null when there has never been one. */
  days: number | null;
  /** The error from a later failed attempt, when one exists. */
  lastError: string | null;
};

export type AdsFreshness = {
  /** Accounts whose last completed refresh is older than ADS_STALE_DAYS. */
  stale: AdsAccountFreshness[];
  /** Accounts that have never completed a refresh at all. */
  never: AdsAccountFreshness[];
  /** Accounts whose most recent attempt failed, whatever their last good one says. */
  failing: AdsAccountFreshness[];
  /** Total accounts with a usable customer ID. */
  considered: number;
  /** Days since the freshest account in the whole roster refreshed. */
  freshestDays: number | null;
  /** Days since the oldest account refreshed; null when any has never synced. */
  oldestDays: number | null;
  status: "ok" | "attention" | "overdue";
};

function daysBetween(from: string, now: Date): number {
  return Math.floor((now.getTime() - new Date(from).getTime()) / 86_400_000);
}

/**
 * `snapshots` must be every snapshot for the accounts in `accounts`, newest
 * first. A "running" row is neither success nor failure — it is an attempt that
 * never came back, which is exactly what a timeout looks like, so it counts as
 * a failure only when it is the newest row and is older than a day.
 */
export function assessAdsFreshness(
  accounts: AdsAccountRow[],
  snapshots: AdsSnapshotRow[],
  now: Date = new Date(),
): AdsFreshness {
  const byClient = new Map<number, AdsSnapshotRow[]>();
  for (const row of snapshots) {
    const list = byClient.get(row.client_id);
    if (list) list.push(row);
    else byClient.set(row.client_id, [row]);
  }

  const stale: AdsAccountFreshness[] = [];
  const never: AdsAccountFreshness[] = [];
  const failing: AdsAccountFreshness[] = [];
  const allDays: number[] = [];
  let anyNever = false;

  for (const account of accounts) {
    const rows = byClient.get(account.id) ?? [];
    const completed = rows.find((row) => row.run_status === "completed");
    const newest = rows[0];
    const days = completed ? daysBetween(completed.created_at, now) : null;

    // A failed newest attempt is worth naming even when yesterday's succeeded:
    // it is the reason tomorrow's numbers will be wrong.
    const newestFailed =
      newest &&
      newest !== completed &&
      (newest.run_status === "failed" ||
        (newest.run_status === "running" && daysBetween(newest.created_at, now) >= 1));

    const entry: AdsAccountFreshness = {
      clientId: account.id,
      accountName: account.account_name,
      days,
      lastError: newestFailed ? (newest.error_message ?? "Attempt did not finish") : null,
    };

    if (days === null) {
      anyNever = true;
      never.push(entry);
    } else {
      allDays.push(days);
      if (days >= ADS_STALE_DAYS) stale.push(entry);
    }
    if (newestFailed) failing.push(entry);
  }

  const byAge = (a: AdsAccountFreshness, b: AdsAccountFreshness) => (b.days ?? 0) - (a.days ?? 0);
  stale.sort(byAge);
  failing.sort(byAge);

  const freshestDays = allDays.length > 0 ? Math.min(...allDays) : null;
  const oldestDays = anyNever || allDays.length === 0 ? null : Math.max(...allDays);

  // The distinction that matters: when the *freshest* account is stale, nothing
  // ran at all — the schedule is broken. When only some accounts are stale, the
  // job is running and those accounts are failing inside it.
  const scheduleStopped =
    accounts.length > 0 && (freshestDays === null || freshestDays >= ADS_OVERDUE_DAYS);
  const status: AdsFreshness["status"] = scheduleStopped
    ? "overdue"
    : stale.length > 0 || never.length > 0 || failing.length > 0
      ? "attention"
      : "ok";

  return {
    stale,
    never,
    failing,
    considered: accounts.length,
    freshestDays,
    oldestDays,
    status,
  };
}
