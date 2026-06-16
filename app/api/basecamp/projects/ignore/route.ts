import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ignoreBasecampProject } from "@/lib/clients/basecamp-project-ignores";

type IgnoreBody = {
  projectId?: string;
  projectName?: string;
  reason?: string;
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: IgnoreBody;
  try {
    body = (await request.json()) as IgnoreBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const projectId = body.projectId?.trim();
  const projectName = body.projectName?.trim();
  if (!projectId || !projectName) {
    return NextResponse.json(
      { error: "projectId and projectName are required" },
      { status: 400 },
    );
  }

  try {
    const ignored = await ignoreBasecampProject(supabase, {
      projectId,
      projectName,
      reason: body.reason,
      ignoredBy: user.email ?? user.id,
    });
    return NextResponse.json({ ok: true, ignored });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to ignore project",
      },
      { status: 500 },
    );
  }
}
