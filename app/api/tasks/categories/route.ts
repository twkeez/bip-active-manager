import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  ensureDefaultTaskCategories,
  listTaskCategories,
  validateCategoryName,
} from "@/lib/tasks/categories";
import type { UserTaskCategory } from "@/lib/types/client";

type CreateCategoryBody = {
  name?: string;
};

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const categories = await ensureDefaultTaskCategories(supabase, user.id);
    return NextResponse.json({ categories });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to load categories",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: CreateCategoryBody;
  try {
    body = (await request.json()) as CreateCategoryBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const validation = validateCategoryName(body.name);
  if (!validation.valid) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const existing = await listTaskCategories(supabase, user.id);
  const existingMatch = existing.find(
    (category) =>
      category.name.trim().toLowerCase() === validation.name.toLowerCase(),
  );
  if (existingMatch) {
    return NextResponse.json({ category: existingMatch, created: false });
  }

  const nowIso = new Date().toISOString();
  const { data: insertedRaw, error: insertError } = await supabase
    .from("user_task_categories")
    .insert({
      owner_user_id: user.id,
      name: validation.name,
      created_at: nowIso,
      updated_at: nowIso,
    })
    .select("*")
    .single();

  if (insertError || !insertedRaw) {
    return NextResponse.json(
      { error: insertError?.message ?? "Failed to create category" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    category: insertedRaw as UserTaskCategory,
    created: true,
  });
}
