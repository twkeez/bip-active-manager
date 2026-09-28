import { NextResponse } from "next/server";
import { detectTruncatedRead } from "@/lib/data-integrity/row-cap";
import { recordTruncatedRead } from "@/lib/data-integrity/server";
import { createClient } from "@/lib/supabase/server";

/**
 * A capped read seen in the browser. The server re-derives the warning from
 * the request itself, so a caller can only report a real capped read, never
 * write arbitrary text into the warnings list.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { url?: unknown; method?: unknown; contentRange?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const read = detectTruncatedRead(
    typeof body.url === "string" ? body.url : "",
    typeof body.method === "string" ? body.method : "GET",
    typeof body.contentRange === "string" ? body.contentRange : null,
  );
  if (!read) return NextResponse.json({ ok: true, recorded: false });
  await recordTruncatedRead(read);
  return NextResponse.json({ ok: true, recorded: true });
}
