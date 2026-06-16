import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { FIXED_TASK_ASSIGNEE_NAMES, ensureFixedTaskPeople } from "@/lib/tasks/people";

type CreatePersonBody = {
  name?: string;
};

function normalizeName(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim().replace(/\s+/g, " ");
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const people = await ensureFixedTaskPeople(supabase, user.id);
    return NextResponse.json({ people });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load people" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: CreatePersonBody;
  try {
    body = (await request.json()) as CreatePersonBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const name = normalizeName(body.name);
  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  return NextResponse.json(
    {
      error: `Assignee list is fixed: ${FIXED_TASK_ASSIGNEE_NAMES.join(", ")}`,
    },
    { status: 403 },
  );
}
