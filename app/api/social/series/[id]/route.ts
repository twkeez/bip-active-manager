import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProfile, isAdmin } from "@/lib/auth/profile";
import { normaliseSeriesInput, type SeriesInput } from "@/lib/social/series-input";
import type { SocialSeries, SocialSeriesPart, SocialSeriesWithParts } from "@/lib/social/types";

// PUT handles two shapes:
//   - a full series edit (kind + fields, arc parts replaced wholesale)
//   - a bare { is_active: true } restore, mirroring the Idea Bank
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const profile = await getProfile(supabase);
  if (!isAdmin(profile)) return NextResponse.json({ error: "Admins only" }, { status: 403 });

  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  let body: SeriesInput & { is_active?: boolean };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const admin = createAdminClient();

  // Restore-only update.
  if (body.kind === undefined && typeof body.is_active === "boolean") {
    const { data, error } = await admin
      .from("social_series")
      .update({ is_active: body.is_active, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("*")
      .single<SocialSeries>();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const { data: parts } = await admin
      .from("social_series_parts").select("*").eq("series_id", id).order("part_number")
      .returns<SocialSeriesPart[]>();
    return NextResponse.json({ ...data, parts: parts ?? [] } satisfies SocialSeriesWithParts);
  }

  const normalised = normaliseSeriesInput(body);
  if (!normalised.ok) return NextResponse.json({ error: normalised.error }, { status: 400 });

  const { data: series, error } = await admin
    .from("social_series")
    .update({
      ...normalised.row,
      ...(typeof body.is_active === "boolean" ? { is_active: body.is_active } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .single<SocialSeries>();
  if (error || !series) {
    return NextResponse.json({ error: error?.message ?? "Series not found" }, { status: 500 });
  }

  // Parts are replaced wholesale so part_number always ends up contiguous and
  // in the order the strategist arranged them.
  await admin.from("social_series_parts").delete().eq("series_id", id);
  let parts: SocialSeriesPart[] = [];
  if (normalised.parts.length > 0) {
    const { data: inserted, error: partsError } = await admin
      .from("social_series_parts")
      .insert(normalised.parts.map((p, i) => ({ ...p, series_id: id, part_number: i + 1 })))
      .select("*")
      .returns<SocialSeriesPart[]>();
    if (partsError) return NextResponse.json({ error: partsError.message }, { status: 500 });
    parts = inserted ?? [];
  }

  return NextResponse.json({ ...series, parts } satisfies SocialSeriesWithParts);
}

/** Archive, matching the Idea Bank's soft delete. */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const profile = await getProfile(supabase);
  if (!isAdmin(profile)) return NextResponse.json({ error: "Admins only" }, { status: 403 });

  const { id } = await params;
  const admin = createAdminClient();
  const { error } = await admin
    .from("social_series")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("id", Number(id));

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
