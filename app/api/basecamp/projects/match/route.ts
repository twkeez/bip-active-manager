import { NextResponse } from "next/server";
import { loadBasecampProjectsForMatch } from "@/lib/basecamp/client";
import { matchClientsToBasecampProjects } from "@/lib/clients/basecamp-match";
import { listBasecampProjectIgnores } from "@/lib/clients/basecamp-project-ignores";
import { normalizeClientName } from "@/lib/clients/normalize-name";
import { createClient } from "@/lib/supabase/server";
import type { ClientRow } from "@/lib/types/client";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { data: clientsRaw, error } = await supabase
      .from("clients")
      .select("*")
      .order("account_name", { ascending: true });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const [{ mode, projects }, ignores] = await Promise.all([
      loadBasecampProjectsForMatch(normalizeClientName),
      listBasecampProjectIgnores(supabase),
    ]);
    const ignoredProjectIds = new Set(
      ignores.map((row) => row.basecamp_project_id),
    );
    const match = matchClientsToBasecampProjects(
      (clientsRaw ?? []) as ClientRow[],
      projects,
      { ignoredProjectIds, marketingTrackedClientsOnly: true },
    );

    return NextResponse.json({
      ok: true,
      mode,
      projectCount: projects.length,
      match: {
        matched: match.matched,
        conflicts: match.conflicts,
        ambiguous: match.ambiguous,
        missingClients: match.missingClients,
        alreadySet: match.alreadySet,
        unmatchedProjects: match.unmatchedProjects,
        ignoredProjects: match.ignoredProjects,
        stats: match.stats,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to match Basecamp projects";
    const isNotConnected = /not connected/i.test(message);
    return NextResponse.json(
      {
        error: message,
        hint: isNotConnected
          ? "Connect Basecamp OAuth from the dashboard, or add Basecamp 2 credentials (BASECAMP_ACCOUNT_ID plus email/password) to .env.local."
          : undefined,
      },
      { status: isNotConnected ? 400 : 500 },
    );
  }
}
