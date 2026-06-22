import { NextResponse } from "next/server";
import mammoth from "mammoth";
import { createClient } from "@/lib/supabase/server";
import { htmlToBlocks } from "@/lib/reporting/doc-blocks";

const MAX_BYTES = 8 * 1024 * 1024; // 8MB

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected a file upload." }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided." }, { status: 400 });
  }

  const isDocx =
    file.name.toLowerCase().endsWith(".docx") ||
    file.type.includes("wordprocessingml");
  if (!isDocx) {
    return NextResponse.json(
      { error: "Upload a .docx file (export your Google Doc as Word)." },
      { status: 400 },
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File must be 8MB or smaller." }, { status: 400 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const { value: html } = await mammoth.convertToHtml({ buffer });
    const blocks = htmlToBlocks(html);
    if (blocks.length === 0) {
      return NextResponse.json({ error: "The document had no readable content." }, { status: 400 });
    }
    const title = file.name.replace(/\.docx$/i, "").trim() || "Untitled document";
    return NextResponse.json({ title, blocks });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to read the document." },
      { status: 400 },
    );
  }
}
