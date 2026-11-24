import { NextResponse } from "next/server";
import { refreshMasterSheetFromDrive } from "@/lib/clients/master-sheet-refresh";
import { cronSecretConfigured, isAuthorizedCronRequest } from "@/lib/cron/authorize";
import { loadSheetRoster } from "@/lib/basecamp/sheet-roster";
import { watchedCronRoute } from "@/lib/job-watch/record";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Re-reads Master Sheet 2026 every morning, so the roster the Response Report
 * answers for follows the sheet without anyone pressing a button. Reports
 * anything that leaves the roster incomplete (rows it could not match, a name
 * on two rows) as a problem, so the job watchdog raises it.
 */

export const maxDuration = 60;

async function handle(request: Request) {
  if (!isAuthorizedCronRequest(request)) return NextResponse.json({ error: "Unauthorized", configured: cronSecretConfigured() }, { status: 401 });
  const admin = createAdminClient();

  let imported: number;
  let duplicates: string[];
  try {
    ({ imported, duplicates } = await refreshMasterSheetFromDrive(admin, "daily refresh"));
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Could not refresh the master sheet." }, { status: 500 });
  }

  const roster = await loadSheetRoster(admin);
  if (roster.error) return NextResponse.json({ ok: false, imported, error: roster.error }, { status: 500 });

  const unsettled = roster.entries.filter((entry) => entry.state !== "ready");
  const problems = [
    ...(duplicates.length ? [`On the sheet twice (only the first row is read): ${duplicates.join(", ")}`] : []),
    ...(unsettled.length
      ? [`${unsettled.length} roster client(s) not matched to a client with a Basecamp project: ${unsettled.map((entry) => entry.practiceName).join(", ")}`]
      : []),
    ...roster.sharedProjects
      .filter((project) => project.kind === "problem")
      .map(
        (project) =>
          `Basecamp project ${project.projectId} has more than one client record pointing at it: ${project.claimants
            .map((c) => `${c.clientName} (#${c.clientId})`)
            .join(" and ")}`,
      ),
    ...roster.warnings,
  ];
  return NextResponse.json(
    {
      ok: problems.length === 0,
      imported,
      roster: roster.counts,
      needsStrategist: roster.needsStrategist,
      ...(problems.length ? { error: problems.join("; ") } : {}),
    },
    { status: problems.length ? 207 : 200 },
  );
}

// Vercel Cron calls with GET (vercel.json); POST stays for manual runs.
export const GET = watchedCronRoute("master-sheet", handle);
export const POST = GET;
