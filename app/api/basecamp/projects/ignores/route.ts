import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { listBasecampProjectIgnores } from "@/lib/clients/basecamp-project-ignores";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const ignores = await listBasecampProjectIgnores(supabase);
    return NextResponse.json({ ok: true, ignores });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to load ignored projects",
      },
      { status: 500 },
    );
  }
}
