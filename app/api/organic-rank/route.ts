import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type SnapshotRow = {
  keyword: string;
  position: number | null;
  url: string | null;
  top_domain: string | null;
  checked_at: string;
};

function parseClientId(value: unknown) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

// Latest organic position per keyword plus the prior one, with movement.
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const clientId = parseClientId(new URL(request.url).searchParams.get("clientId"));
  if (!clientId) {
    return NextResponse.json({ error: "Valid clientId is required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("client_organic_rank_snapshots")
    .select("keyword, position, url, top_domain, checked_at")
    .eq("owner_user_id", user.id)
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Rows are newest-first; keep the two most recent per keyword.
  const byKeyword = new Map<string, SnapshotRow[]>();
  for (const row of (data ?? []) as SnapshotRow[]) {
    const arr = byKeyword.get(row.keyword) ?? [];
    if (arr.length < 2) {
      arr.push(row);
      byKeyword.set(row.keyword, arr);
    }
  }

  const results = [...byKeyword.entries()].map(([keyword, rows]) => {
    const current = rows[0];
    const previous = rows[1] ?? null;
    // Positive delta = improved (moved up = smaller position number).
    const delta =
      current.position != null && previous?.position != null ? previous.position - current.position : null;
    return {
      keyword,
      position: current.position,
      url: current.url,
      topDomain: current.top_domain,
      checkedAt: current.checked_at,
      previousPosition: previous?.position ?? null,
      delta,
    };
  });

  return NextResponse.json({ results });
}
