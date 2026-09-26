// Every scheduled job, and how long it can go without a run before that
// counts as "did not run".
//
// Thresholds come from what GitHub actually delivers, not from the cron
// expression: it drops and delays scheduled runs under load (measured
// 2026-09-14: the half-hourly Basecamp watch had gaps up to 24.3h), so a
// threshold set from the schedule would cry wolf daily. A nightly job is
// overdue when a whole night is missed; frequent jobs when a whole day is.

export type WatchedJob = {
  key: string;
  name: string;
  /** When it is meant to run, in plain words. */
  schedule: string;
  overdueAfterHours: number;
};

export const WATCHED_JOBS: WatchedJob[] = [
  { key: "basecamp-watch", name: "Basecamp watch", schedule: "every 30 min on weekdays, daily at weekends", overdueAfterHours: 26 },
  { key: "routines", name: "Routines", schedule: "hourly", overdueAfterHours: 26 },
  { key: "ads-sync", name: "Google Ads sync", schedule: "nightly", overdueAfterHours: 30 },
  { key: "social-sync", name: "Social sync", schedule: "nightly", overdueAfterHours: 30 },
  { key: "seo-sync", name: "Search Console sync", schedule: "nightly", overdueAfterHours: 30 },
  { key: "ga4-sync", name: "Google Analytics sync", schedule: "nightly", overdueAfterHours: 30 },
  { key: "gbp-sync", name: "Business Profile sync", schedule: "nightly", overdueAfterHours: 30 },
  { key: "job-watch", name: "Job watchdog", schedule: "hourly", overdueAfterHours: 26 },
];

/** Vercel stops a job at 300s. A run still open well after that was killed. */
export const TIMEOUT_AFTER_MINUTES = 10;

export function jobName(key: string): string {
  return WATCHED_JOBS.find((job) => job.key === key)?.name ?? key;
}
