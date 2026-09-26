import { NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/cron/authorize";
import { createAdminClient } from "@/lib/supabase/admin";

type Handler = (request: Request) => Promise<Response>;

function statusFor(httpStatus: number): "ok" | "partial" | "failed" {
  if (httpStatus === 200) return "ok";
  if (httpStatus === 207) return "partial";
  return "failed";
}

/** A short plain reason for the alert: the error, or what partly failed. */
function summarize(body: unknown, httpStatus: number): string | null {
  if (httpStatus === 200 || !body || typeof body !== "object") return null;
  const record = body as Record<string, unknown>;
  if (typeof record.error === "string" && record.error) return record.error.slice(0, 300);
  if (typeof record.failed === "number" && record.failed > 0) {
    return `${record.failed} ${record.failed === 1 ? "item" : "items"} failed.`;
  }
  return httpStatus === 207 ? "Some of its work failed." : `It answered HTTP ${httpStatus}.`;
}

/**
 * Wrap a scheduled job's route so every authorised run is recorded in
 * job_runs: a row as it starts, completed as it finishes. The job watchdog
 * reads these to tell Tom about failures, timeouts and runs that never came.
 *
 * Recording must never break the job it records, so every write is
 * best-effort. Unauthorised requests are passed straight through and not
 * recorded: they are not runs.
 */
export function watchedCronRoute(jobKey: string, handler: Handler) {
  return async function POST(request: Request): Promise<Response> {
    if (!isAuthorizedCronRequest(request)) return handler(request);

    const admin = createAdminClient();
    let runId: number | null = null;
    try {
      const { data } = await admin
        .from("job_runs")
        .insert({ job_key: jobKey, status: "running" })
        .select("id")
        .single();
      runId = (data as { id: number } | null)?.id ?? null;
    } catch {
      // Table missing or DB unreachable: still run the job.
    }

    let response: Response;
    try {
      response = await handler(request);
    } catch (error) {
      response = NextResponse.json(
        { ok: false, error: error instanceof Error ? error.message : "The job crashed." },
        { status: 500 },
      );
    }

    if (runId != null) {
      let body: unknown = null;
      try {
        body = await response.clone().json();
      } catch {
        // Not JSON; the status code still says how it went.
      }
      try {
        // Keep the full response when small; a huge one is cut to its start.
        const text = body == null ? "" : JSON.stringify(body);
        const detail = body == null ? null : text.length <= 8000 ? body : { truncated: text.slice(0, 8000) };
        await admin
          .from("job_runs")
          .update({
            finished_at: new Date().toISOString(),
            status: statusFor(response.status),
            http_status: response.status,
            summary: summarize(body, response.status),
            detail,
          })
          .eq("id", runId);
      } catch {
        // Left as "running": the watchdog will report it, which is the safe side.
      }
    }

    return response;
  };
}
