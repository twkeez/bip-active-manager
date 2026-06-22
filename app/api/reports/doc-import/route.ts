import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchGoogleDoc } from "@/lib/reporting/google-doc";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { url?: string };
  try {
    body = (await req.json()) as { url?: string };
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const url = (body.url ?? "").trim();
  if (!url) {
    return NextResponse.json({ error: "Provide a Google Doc URL." }, { status: 400 });
  }

  try {
    const doc = await fetchGoogleDoc(url);
    return NextResponse.json(doc);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to import the Google Doc." },
      { status: 400 },
    );
  }
}
