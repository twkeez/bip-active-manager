import { redirect } from "next/navigation";
import DataHealthView from "@/components/data-integrity/data-health-view";
import { getProfile } from "@/lib/auth/profile";
import type { DataWarning } from "@/lib/data-integrity/warnings";
import { jobHealthRows, type JobHealthRow, type JobRunWithDetail } from "@/lib/job-watch/job-health";
import { WATCHED_JOBS } from "@/lib/job-watch/jobs";
import { loadJobState } from "@/lib/job-watch/run-watch";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/** Each job's last run, with the counts its response carried; login alerts still open. */
async function loadJobHealth(): Promise<{ rows: JobHealthRow[]; loginProblems: string[] }> {
  const admin = createAdminClient();
  const { runs, problems } = await loadJobState(admin, new Date());
  const lastIds = WATCHED_JOBS.map(
    (job) => runs.filter((run) => run.job_key === job.key).sort((a, b) => b.started_at.localeCompare(a.started_at))[0]?.id,
  ).filter((id): id is number => id != null);
  const [details, logins] = await Promise.all([
    admin.from("job_runs").select("id,detail").in("id", lastIds.length ? lastIds : [-1]),
    // A login alert is deleted by the watchdog once the login works again, so
    // any row here is a login that is broken right now.
    admin.from("job_alerts").select("message").like("problem_key", "cred:%"),
  ]);
  if (details.error) throw new Error(`Could not read job results: ${details.error.message}`);
  if (logins.error) throw new Error(`Could not read login alerts: ${logins.error.message}`);
  const detailById = new Map((details.data ?? []).map((row) => [row.id as number, row.detail as unknown]));
  const withDetail: JobRunWithDetail[] = runs.map((run) => ({ ...run, detail: detailById.get(run.id) ?? null }));
  return {
    rows: jobHealthRows(WATCHED_JOBS, withDetail, problems),
    loginProblems: (logins.data ?? []).map((row) => String(row.message)),
  };
}

export default async function DataHealthPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const profile = await getProfile(supabase);
  if (profile?.role !== "admin") redirect("/dashboard");

  const [{ data, error }, jobs] = await Promise.all([
    supabase
      .from("data_warnings")
      .select("*")
      .order("resolved_at", { ascending: false, nullsFirst: true })
      .order("last_seen_at", { ascending: false }),
    loadJobHealth().then(
      (value) => ({ ...value, error: null as string | null }),
      (jobError: Error) => ({ rows: [] as JobHealthRow[], loginProblems: [] as string[], error: jobError.message }),
    ),
  ]);

  return (
    <DataHealthView
      warnings={(data ?? []) as DataWarning[]}
      jobs={jobs}
      loadError={
        error
          ? /could not find the table|does not exist/i.test(error.message)
            ? "The data warnings table does not exist yet. Run supabase/migrations/20260928120000_data_warnings.sql, then reload."
            : error.message
          : null
      }
    />
  );
}
