import { fetchAllRows } from "@/lib/data-integrity/fetch-all";
import type { SupabaseClient } from "@supabase/supabase-js";
import { assessJobs, jobStatusLines, type JobProblem, type JobRun } from "./assess";
import { checkCredentials } from "./credentials";
import { WATCHED_JOBS } from "./jobs";
import { sendAlertEmail } from "./notify";
import { isActiveWarning, loadOpenWarnings } from "@/lib/data-integrity/warnings";
import { openForLabel, type FollowupRow } from "@/lib/followups/followups";
import { sweepFollowups } from "@/lib/followups/process";

const APP_URL = "https://bip-active-manager.vercel.app";

/** The daily summary goes out on the first check at or after this hour, Eastern. */
export const DAILY_SUMMARY_HOUR_ET = 8;

function easternParts(now: Date): { date: string; hour: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, hour: Number(get("hour")) };
}

export async function loadJobState(admin: SupabaseClient, now: Date) {
  const since = new Date(now.getTime() - 7 * 24 * 3_600_000).toISOString();
  const [runsResult, firstResult] = await Promise.all([
    // Every run in the week, in pages (the jobs make ~600 a week).
    fetchAllRows<JobRun>(
      (from, to) =>
        admin
          .from("job_runs")
          .select("id,job_key,started_at,finished_at,status,http_status,summary")
          .gte("started_at", since)
          .order("started_at", { ascending: false })
          .order("id", { ascending: false })
          .range(from, to),
      "job runs",
    ).then(
      (data) => ({ data, error: null as { message: string } | null }),
      (error: Error) => ({ data: null as JobRun[] | null, error: { message: error.message } }),
    ),
    admin.from("job_runs").select("started_at").order("started_at", { ascending: true }).limit(1),
  ]);
  if (runsResult.error) throw new Error(`Could not read job runs: ${runsResult.error.message}`);
  const runs = (runsResult.data ?? []) as JobRun[];
  const first = (firstResult.data?.[0] as { started_at: string } | undefined)?.started_at;
  const watchingSince = first ? new Date(first) : null;
  return { runs, problems: assessJobs(WATCHED_JOBS, runs, now, watchingSince) };
}

function problemEmail(problems: JobProblem[]): { subject: string; body: string } {
  const count = problems.length;
  return {
    subject: `BIP: ${count} scheduled ${count === 1 ? "job needs" : "jobs need"} attention`,
    body: [
      `${count === 1 ? "Something" : `${count} things`} did not run properly:`,
      "",
      ...problems.map((problem) => `- ${problem.message}`),
      "",
      `Details: ${APP_URL}/coal-mines`,
      "",
      "You get one email per problem. It will not repeat every hour.",
    ].join("\n"),
  };
}

function dailyEmail(
  open: JobProblem[],
  statusLines: string[],
  unrecorded: number,
  overdueFollowups: FollowupRow[],
  now: Date,
): { subject: string; body: string } {
  // "All ran" only when every job has a recorded run: a job that has never
  // reported is not yet overdue, but it has not proven it runs either.
  const allClear = open.length === 0 && unrecorded === 0;
  const subject =
    open.length > 0
      ? `BIP daily check: ${open.length} ${open.length === 1 ? "problem" : "problems"} still open`
      : unrecorded > 0
        ? `BIP daily check: no problems, but ${unrecorded} ${unrecorded === 1 ? "job has" : "jobs have"} not run yet`
        : "BIP daily check: all scheduled jobs ran";
  const followupCount = overdueFollowups.length;
  const followupLines = followupCount
    ? [
        "",
        `Follow-ups still open after 2 days (${followupCount}):`,
        ...overdueFollowups.map(
          (f) =>
            `- ${f.project_name}: asked ${f.recipient_name ?? f.recipient_email} ${openForLabel(f.sent_at, now)} ago${
              f.renudged_at ? " (reminder sent)" : ""
            }`,
        ),
        `See them all: ${APP_URL}/follow-ups`,
      ]
    : [];
  return {
    subject: followupCount
      ? `${subject} · ${followupCount} overdue ${followupCount === 1 ? "follow-up" : "follow-ups"}`
      : subject,
    body: [
      allClear
        ? "Every scheduled job ran as it should in the last day."
        : open.length > 0
          ? "Still wrong:"
          : "Nothing has failed. Jobs marked \"no run recorded yet\" have not run since tracking began; you will be told if one misses its window.",
      ...(allClear ? [] : ["", ...open.map((problem) => `- ${problem.message}`)]),
      ...followupLines,
      "",
      "Each job:",
      ...statusLines.map((line) => `- ${line}`),
      "",
      `Details: ${APP_URL}/coal-mines`,
      "",
      "This email comes every morning. If one ever does not arrive, the watchdog itself has stopped. That is the alarm.",
    ].join("\n"),
  };
}

export type WatchResult = {
  problems: number;
  newlyReported: number;
  dailySummarySent: boolean;
  followupsClosed: number;
  followupsReminded: number;
  /** Anything the follow-up sweep or login check could not do; the route answers 207 so it is reported. */
  followupErrors: string[];
};

/**
 * The hourly watchdog: find every job problem, email the ones not yet
 * reported, and send the once-a-day summary. An alert is recorded only after
 * its email went out, so a failed send is retried next hour, not lost.
 */
export async function runJobWatch(admin: SupabaseClient, now: Date = new Date()): Promise<WatchResult> {
  const { runs, problems: jobProblems } = await loadJobState(admin, now);

  // Data that may be incomplete (lib/data-integrity): each active warning is
  // a problem, keyed by when it (re)opened, so it is emailed once, and again
  // only if it comes back after being resolved.
  const warnings = (await loadOpenWarnings(admin)).filter((warning) => isActiveWarning(warning, now));
  const problems: JobProblem[] = [
    ...jobProblems,
    ...warnings.map((warning) => ({
      key: `datawarn:${warning.id}:${warning.first_seen_at}`,
      jobKey: "data-integrity",
      kind: "data_warning" as const,
      message: `Data may be incomplete. ${warning.detail} Seen ${warning.occurrences} time${
        warning.occurrences === 1 ? "" : "s"
      }, last ${new Date(warning.last_seen_at).toLocaleString("en-US", { timeZone: "America/New_York" })} ET. Details: ${APP_URL}/data-health`,
    })),
  ];

  // Every login the jobs depend on, tried for real. A broken one is emailed
  // once; once it works again its alert is cleared, so a later break is news.
  let credentialErrors: string[] = [];
  try {
    const credentials = await checkCredentials(admin, now);
    for (const check of credentials) {
      if (!check.ok) {
        problems.push({
          key: check.key,
          jobKey: "credentials",
          kind: "credential",
          message: `${check.label}: ${check.problem}`,
        });
      }
    }
    const healthy = credentials.filter((check) => check.ok).map((check) => check.key);
    if (healthy.length) {
      const { error } = await admin.from("job_alerts").delete().in("problem_key", healthy);
      if (error) credentialErrors.push(`Could not clear recovered login alerts: ${error.message}`);
    }
  } catch (error) {
    credentialErrors = [`Login check failed: ${error instanceof Error ? error.message : String(error)}`];
  }

  let sweep: Awaited<ReturnType<typeof sweepFollowups>>;
  try {
    sweep = await sweepFollowups(admin, now);
  } catch (error) {
    sweep = {
      closed: 0,
      renudged: 0,
      overdue: [],
      errors: [error instanceof Error ? error.message : "Follow-up sweep failed."],
    };
  }

  const { data: sentRows, error: sentError } = await admin
    .from("job_alerts")
    .select("problem_key")
    .in("problem_key", problems.length ? problems.map((problem) => problem.key) : ["-"]);
  if (sentError) throw new Error(`Could not read sent alerts: ${sentError.message}`);
  const sent = new Set((sentRows ?? []).map((row) => (row as { problem_key: string }).problem_key));
  const fresh = problems.filter((problem) => !sent.has(problem.key));

  if (fresh.length) {
    const email = problemEmail(fresh);
    await sendAlertEmail(admin, email.subject, email.body);
    await admin.from("job_alerts").insert(
      fresh.map((problem) => ({
        problem_key: problem.key,
        job_key: problem.jobKey,
        message: problem.message,
      })),
    );
  }

  let dailySummarySent = false;
  const eastern = easternParts(now);
  if (eastern.hour >= DAILY_SUMMARY_HOUR_ET) {
    const dailyKey = `daily:${eastern.date}`;
    const { data: already } = await admin
      .from("job_alerts")
      .select("id")
      .eq("problem_key", dailyKey)
      .maybeSingle();
    if (!already) {
      const unrecorded = WATCHED_JOBS.filter((job) => !runs.some((run) => run.job_key === job.key)).length;
      const email = dailyEmail(problems, jobStatusLines(WATCHED_JOBS, runs, now), unrecorded, sweep.overdue, now);
      await sendAlertEmail(admin, email.subject, email.body);
      await admin.from("job_alerts").insert({ problem_key: dailyKey, message: email.subject });
      dailySummarySent = true;
    }
  }

  return {
    problems: problems.length,
    newlyReported: fresh.length,
    dailySummarySent,
    followupsClosed: sweep.closed,
    followupsReminded: sweep.renudged,
    followupErrors: [...sweep.errors, ...credentialErrors],
  };
}
