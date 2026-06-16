import { NextResponse } from "next/server";
import { runDataForSeoAction } from "@/lib/dataforseo/actions";
import type { DataForSeoRequestBody } from "@/lib/dataforseo/types";
import { getDataForSeoConfig } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const config = getDataForSeoConfig();
  if (!config) {
    return NextResponse.json(
      { error: "DataForSEO credentials are not configured on the server." },
      { status: 503 },
    );
  }

  let body: DataForSeoRequestBody;
  try {
    body = (await request.json()) as DataForSeoRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  try {
    const result = await runDataForSeoAction(config, body);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("DataForSEO pipeline break:", error);
    return NextResponse.json({ error: "Failed to parse live keyword stream." }, { status: 500 });
  }
}
