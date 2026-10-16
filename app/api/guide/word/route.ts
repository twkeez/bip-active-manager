import { NextResponse } from "next/server";
import { GUIDE } from "@/lib/guide/content";
import { renderGuideWord } from "@/lib/guide/word";
import { createClient } from "@/lib/supabase/server";

/** The team guide as an editable Word document, from the same content as /guide. */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  return new NextResponse(renderGuideWord(GUIDE), {
    status: 200,
    headers: {
      "Content-Type": "application/msword; charset=utf-8",
      "Content-Disposition": `attachment; filename="BIP-Control-team-guide.doc"`,
      "Cache-Control": "no-store",
    },
  });
}
