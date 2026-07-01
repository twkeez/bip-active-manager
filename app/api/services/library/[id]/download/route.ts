import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { SERVICE_LIBRARY_BUCKET, type ServiceLibraryItem } from "@/lib/services/library-types";

// Returns a short-lived signed URL for a library file. Any authenticated user
// can open shared files; the signed URL is minted with the service-role client.
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
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

  const admin = createAdminClient();
  const { data: item } = await admin
    .from("service_library_items")
    .select("*")
    .eq("id", id)
    .maybeSingle<ServiceLibraryItem>();
  if (!item || item.kind !== "file" || !item.storage_path) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  const { data, error } = await admin.storage
    .from(SERVICE_LIBRARY_BUCKET)
    .createSignedUrl(item.storage_path, 3600);
  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: error?.message ?? "Could not sign URL" }, { status: 500 });
  }
  return NextResponse.json({ url: data.signedUrl });
}
