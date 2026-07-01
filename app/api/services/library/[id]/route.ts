import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/lib/auth/require-admin";
import { SERVICE_LIBRARY_BUCKET, type ServiceLibraryItem } from "@/lib/services/library-types";

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id: idRaw } = await context.params;
  const id = Number(idRaw);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isAdmin(supabase))) {
    return NextResponse.json({ error: "Admins only." }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data: item } = await admin
    .from("service_library_items")
    .select("*")
    .eq("id", id)
    .maybeSingle<ServiceLibraryItem>();

  // Remove the underlying file (best-effort) before deleting the row.
  if (item?.kind === "file" && item.storage_path) {
    await admin.storage.from(SERVICE_LIBRARY_BUCKET).remove([item.storage_path]);
  }

  const { error } = await admin.from("service_library_items").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
