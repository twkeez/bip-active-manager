import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProfile, isAdmin } from "@/lib/auth/profile";
import { normaliseSeriesInput, type SeriesInput } from "@/lib/social/series-input";
import type { SocialSeries, SocialSeriesPart, SocialSeriesWithParts } from "@/lib/social/types";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const [{ data: series, error }, { data: parts }] = await Promise.all([
    admin.from("social_series").select("*").order("title").returns<SocialSeries[]>(),
    admin.from("social_series_parts").select("*").order("series_id").order("part_number").returns<SocialSeriesPart[]>(),
  ]);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const bySeries = new Map<number, SocialSeriesPart[]>();
  for (const part of parts ?? []) {
    const list = bySeries.get(part.series_id) ?? [];
    list.push(part);
    bySeries.set(part.series_id, list);
  }
  const withParts: SocialSeriesWithParts[] = (series ?? []).map((s) => ({
    ...s,
    parts: bySeries.get(s.id) ?? [],
  }));

  return NextResponse.json(withParts);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const profile = await getProfile(supabase);
  if (!isAdmin(profile)) return NextResponse.json({ error: "Admins only" }, { status: 403 });

  let body: SeriesInput;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const normalised = normaliseSeriesInput(body);
  if (!normalised.ok) return NextResponse.json({ error: normalised.error }, { status: 400 });

  const admin = createAdminClient();
  const { data: series, error } = await admin
    .from("social_series")
    .insert({ ...normalised.row, created_by: user.email })
    .select("*")
    .single<SocialSeries>();
  if (error || !series) {
    return NextResponse.json({ error: error?.message ?? "Failed to create series" }, { status: 500 });
  }

  let parts: SocialSeriesPart[] = [];
  if (normalised.parts.length > 0) {
    const { data: inserted, error: partsError } = await admin
      .from("social_series_parts")
      .insert(normalised.parts.map((p, i) => ({ ...p, series_id: series.id, part_number: i + 1 })))
      .select("*")
      .returns<SocialSeriesPart[]>();
    if (partsError) {
      // Don't leave a headless arc behind.
      await admin.from("social_series").delete().eq("id", series.id);
      return NextResponse.json({ error: partsError.message }, { status: 500 });
    }
    parts = inserted ?? [];
  }

  return NextResponse.json({ ...series, parts } satisfies SocialSeriesWithParts);
}
