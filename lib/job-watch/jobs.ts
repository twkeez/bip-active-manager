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
  /** When the job was first scheduled, if after run recording began: it can't be overdue before its first run is due. */
  watchedFrom?: string;
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
  // Maps rank tracker: its schedule was stopped on 2026-11-25 (Tom: "Kill the
  // maps rank tracker for now"). Its Run now button still works. To turn it
  // back on, restore its line in vercel.json ("40 12 * * *") and this entry:
  // { key: "maps-rank", name: "Maps rank tracker", schedule: "daily check; each client every two weeks", overdueAfterHours: 26 },
  // Hourly 07:05-12:05 UTC on the 1st. Longest normal gap: the 1st at 12:05 to
  // the next 1st at 07:05, 30 days 19h in a 31-day month; plus a day of slack.
  {
    key: "organic-rank",
    name: "Monthly organic rankings",
    schedule: "on the 1st of each month",
    overdueAfterHours: 32 * 24,
    watchedFrom: "2026-12-01T07:00:00Z",
  },
  // Client Watch: weekdays 13:20 and 15:20 UTC (8:20 and 10:20 AM Eastern in
  // winter). Longest normal gap: Friday 15:20 to Monday 13:20, 70h; plus slack.
  {
    key: "client-watch",
    name: "Client Watch refresh",
    schedule: "weekday mornings",
    overdueAfterHours: 72,
    watchedFrom: "2026-11-26T13:20:00Z",
  },
  { key: "master-sheet", name: "Master Sheet roster refresh", schedule: "every morning", overdueAfterHours: 26 },
  { key: "job-watch", name: "Job watchdog", schedule: "hourly", overdueAfterHours: 3 },
  // Mondays 11:20 UTC (7:20 AM Eastern in summer, 6:20 AM in winter): a week plus slack.
  { key: "help-desk-report", name: "Help Desk Report", schedule: "weekly, Monday morning", overdueAfterHours: 170 },
];

/** Vercel stops a job at 800s at most. A run still open well after that was killed. */
export const TIMEOUT_AFTER_MINUTES = 16;

export function jobName(key: string): string {
  return WATCHED_JOBS.find((job) => job.key === key)?.name ?? key;
}
