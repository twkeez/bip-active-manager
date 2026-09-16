import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth/require-admin";
import { readProjectThreads, resolveBasecampProject, summariseBackground } from "@/lib/onboarding/background";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * Reads a practice's Basecamp project into background for onboarding research.
 *
 * Links the project first when the client record has none and the name matches
 * exactly (see resolveBasecampProject). Threads named for access details are
 * never read, and only Claude's summary is stored.
 */

export const maxDuration = 300;

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const clientId = Number((await context.params).id);
  if (!Number.isInteger(clientId) || clientId <= 0) {
    return NextResponse.json({ error: "Invalid client id" }, { status: 400 });
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // A Claude call per run, like the other onboarding research.
  if (!(await isAdmin(supabase))) return NextResponse.json({ error: "Admins only" }, { status: 403 });

  const admin = createAdminClient();
  const { data: client } = await admin
    .from("clients")
    .select("id, account_name, basecamp_project_id")
    .eq("id", clientId)
    .maybeSingle();
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  try {
    const project = await resolveBasecampProject(admin, {
      id: client.id as number,
      account_name: client.account_name as string,
      basecamp_project_id: (client.basecamp_project_id as string | null) ?? null,
    });
    // Not an error: plenty of practices have no project yet. The page says why.
    if (!project.projectId) return NextResponse.json({ ok: false, reason: project.reason });

    const { threads, skipped } = await readProjectThreads(project.projectId);
    if (threads.length === 0) {
      return NextResponse.json({ ok: false, reason: "The Basecamp project has no message threads to read yet.", skipped });
    }

    const source = threads.map((thread) => `### ${thread.title}\n${thread.text}`).join("\n\n");
    const background = await summariseBackground(source, {
      clientName: client.account_name as string,
      sourceLabel: "the practice's Basecamp message threads (website and account team)",
    });

    const at = new Date().toISOString();
    const { error } = await admin.from("client_onboarding_intake").upsert(
      {
        client_id: clientId,
        basecamp_background: background,
        basecamp_background_at: at,
        basecamp_threads_read: threads.length,
        updated_at: at,
      },
      { onConflict: "client_id" },
    );
    if (error) throw new Error(error.message);

    return NextResponse.json({
      ok: true,
      linked: project.linked,
      projectName: project.projectName,
      threadsRead: threads.length,
      skipped,
      background,
      at,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not read Basecamp" },
      { status: 500 },
    );
  }
}
