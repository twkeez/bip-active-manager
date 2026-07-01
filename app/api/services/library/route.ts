import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/lib/auth/require-admin";
import type { ServiceLibraryItem, ServiceLibraryKind } from "@/lib/services/library-types";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("service_library_items")
    .select("*")
    .order("category", { ascending: true })
    .order("sort_order", { ascending: true })
    .order("id", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: (data ?? []) as ServiceLibraryItem[] });
}

type CreateLinkBody = { label?: string; category?: string; url?: string };

// Adds a link. File uploads go through POST /api/services/library/upload.
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isAdmin(supabase))) {
    return NextResponse.json({ error: "Admins only." }, { status: 403 });
  }

  let body: CreateLinkBody;
  try {
    body = (await request.json()) as CreateLinkBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const label = (body.label ?? "").trim();
  const category = (body.category ?? "General").trim() || "General";
  const url = (body.url ?? "").trim();
  if (!label) return NextResponse.json({ error: "A label is required" }, { status: 400 });
  if (!url) return NextResponse.json({ error: "A URL is required for a link" }, { status: 400 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("service_library_items")
    .insert({ kind: "link" as ServiceLibraryKind, label, category, url, created_by: user.id })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ item: data as ServiceLibraryItem });
}
