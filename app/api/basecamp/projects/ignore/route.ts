import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  ignoreBasecampProject,
  restoreBasecampProject,
} from "@/lib/clients/basecamp-project-ignores";

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

// Ignoring is reversible. Without this a mis-click hides a real practice from
// the coverage list permanently, and nothing would ever mention it again.
export async function DELETE(request: Request) {
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
  if (!projectId) {
    return NextResponse.json({ error: "projectId is required" }, { status: 400 });
  }

  try {
    await restoreBasecampProject(supabase, projectId);
    return NextResponse.json({ ok: true, restored: projectId });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to restore project",
      },
      { status: 500 },
    );
  }
}
