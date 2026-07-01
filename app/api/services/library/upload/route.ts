import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/lib/auth/require-admin";
import {
  SERVICE_LIBRARY_BUCKET,
  SERVICE_LIBRARY_PREFIX,
  type ServiceLibraryItem,
} from "@/lib/services/library-types";

const MAX_BYTES = 25 * 1024 * 1024; // 25 MB

// Uploads a file to shared storage via the service-role client (bypasses the
// per-user storage RLS) and records a library row. Admin only.
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isAdmin(supabase))) {
    return NextResponse.json({ error: "Admins only." }, { status: 403 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart form data" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "A file is required" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File is too large (max 25 MB)" }, { status: 400 });
  }
  const label = (String(form.get("label") ?? "").trim()) || file.name;
  const category = (String(form.get("category") ?? "General").trim()) || "General";

  const safeName = file.name.replace(/[^\w.\-]+/g, "_");
  const path = `${SERVICE_LIBRARY_PREFIX}/${file.lastModified}-${file.size}-${safeName}`;
  const contentType = file.type || "application/octet-stream";

  const admin = createAdminClient();
  const bytes = new Uint8Array(await file.arrayBuffer());
  const { error: uploadError } = await admin.storage
    .from(SERVICE_LIBRARY_BUCKET)
    .upload(path, bytes, { contentType, upsert: false });
  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data, error } = await admin
    .from("service_library_items")
    .insert({
      kind: "file",
      label,
      category,
      storage_path: path,
      file_name: file.name,
      mime_type: contentType,
      created_by: user.id,
    })
    .select("*")
    .single();
  if (error) {
    // Roll back the orphaned upload.
    await admin.storage.from(SERVICE_LIBRARY_BUCKET).remove([path]);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ item: data as ServiceLibraryItem });
}
