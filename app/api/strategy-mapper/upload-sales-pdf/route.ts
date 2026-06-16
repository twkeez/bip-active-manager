import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const BUCKET = "strategy-mapper-sales-docs";

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 180);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    return NextResponse.json(
      { error: "Expected multipart form with a document file" },
      { status: 400 },
    );
  }

  const formData = await request.formData();
  const file = formData.get("document");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Document file is required" }, { status: 400 });
  }

  const storagePath = `${user.id}/${Date.now()}-${sanitizeFileName(file.name)}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, buffer, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  return NextResponse.json({
    fileName: file.name,
    storagePath,
    uploadedAt: new Date().toISOString(),
  });
}
