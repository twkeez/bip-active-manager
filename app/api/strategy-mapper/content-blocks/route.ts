import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  DEFAULT_CONTENT_FALLBACKS,
  fetchContentBlocks,
  sortContentBlocks,
  templateToDbRow,
  type ContentBlockTemplate,
} from "@/lib/strategy-mapper/content-library";

function rowFromTemplate(block: ContentBlockTemplate) {
  return {
    ...templateToDbRow(block),
    updated_at: new Date().toISOString(),
  };
}

function templateFromRow(row: Record<string, unknown>): ContentBlockTemplate {
  return {
    id: row.id as number | undefined,
    blockKey: row.block_key as string,
    category: row.category as ContentBlockTemplate["category"],
    primaryGoal: (row.primary_goal as ContentBlockTemplate["primaryGoal"]) ?? null,
    service: (row.service as ContentBlockTemplate["service"]) ?? null,
    framing: (row.framing as ContentBlockTemplate["framing"]) ?? null,
    sortOrder: row.sort_order as number,
    payload: row.payload as ContentBlockTemplate["payload"],
    enabled: row.enabled as boolean,
  };
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const blocks = await fetchContentBlocks(supabase);
  return NextResponse.json({ blocks });
}

export async function PUT(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: ContentBlockTemplate;
  try {
    body = (await request.json()) as ContentBlockTemplate;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.blockKey?.trim() || !body.category) {
    return NextResponse.json({ error: "blockKey and category are required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("strategy_mapper_content_blocks")
    .upsert(rowFromTemplate(body), { onConflict: "block_key" })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const blocks = await fetchContentBlocks(supabase);
  return NextResponse.json({ block: templateFromRow(data), blocks });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let action: string | undefined;
  try {
    const body = (await request.json()) as { action?: string };
    action = body.action;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (action !== "reset-defaults") {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  const rows = DEFAULT_CONTENT_FALLBACKS.map((block) => ({
    ...rowFromTemplate({ ...block, enabled: true }),
  }));

  const { error } = await supabase
    .from("strategy_mapper_content_blocks")
    .upsert(rows, { onConflict: "block_key" });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const blocks = sortContentBlocks(
    (await supabase.from("strategy_mapper_content_blocks").select("*")).data?.map(
      templateFromRow,
    ) ?? DEFAULT_CONTENT_FALLBACKS,
  );

  return NextResponse.json({ blocks });
}
