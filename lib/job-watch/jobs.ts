// Every scheduled job, and how long it can go without a run before that
// counts as "did not run".
//
// Since 2026-09-29 Vercel Cron (vercel.json) runs these on the minute, so a
// threshold is the longest normal gap plus a little slack. (Under GitHub
// Actions they had to be a day or more: it dropped and delayed runs, with gaps
// up to 24.3h on the half-hourly Basecamp watch.)

export type WatchedJob = {
  key: string;
  name: string;
  /** When it is meant to run, in plain words. */
  schedule: string;
  overdueAfterHours: number;
};

export const WATCHED_JOBS: WatchedJob[] = [
  // Longest normal gap: Sunday 15:00 UTC to Monday 11:00 UTC, 20h.
  { key: "basecamp-watch", name: "Basecamp watch", schedule: "every 30 min on weekdays, daily at weekends", overdueAfterHours: 21 },
  { key: "routines", name: "Routines", schedule: "hourly", overdueAfterHours: 3 },
  { key: "ads-sync", name: "Google Ads sync", schedule: "nightly", overdueAfterHours: 26 },
  { key: "social-sync", name: "Social sync", schedule: "nightly", overdueAfterHours: 26 },
  { key: "seo-sync", name: "Search Console sync", schedule: "nightly", overdueAfterHours: 26 },
  { key: "ga4-sync", name: "Google Analytics sync", schedule: "nightly", overdueAfterHours: 26 },
  { key: "gbp-sync", name: "Business Profile sync", schedule: "nightly", overdueAfterHours: 26 },
  { key: "job-watch", name: "Job watchdog", schedule: "hourly", overdueAfterHours: 3 },
];

/** Vercel stops a job at 800s at most. A run still open well after that was killed. */
export const TIMEOUT_AFTER_MINUTES = 16;

export function jobName(key: string): string {
  return WATCHED_JOBS.find((job) => job.key === key)?.name ?? key;
}
