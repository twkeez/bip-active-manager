import { fetchAllRows } from "@/lib/data-integrity/fetch-all";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const GENERIC = new Set(["blog", "page", "category", "tag", "author", "index", "home", "news"]);

function topicFromUrl(url: string): string | null {
  try {
    const path = new URL(url).pathname;
    const segs = path.split("/").filter(Boolean);
    let slug = segs[segs.length - 1] ?? "";
    slug = slug.replace(/\.(html?|php|aspx)$/i, "");
    const words = slug.replace(/[-_]+/g, " ").trim();
    if (!words || /^\d+$/.test(words) || GENERIC.has(words.toLowerCase())) return null;
    return words;
  } catch {
    return null;
  }
}

// Top-performing blog topics across all clients (by GSC clicks) — proven
// starters to suggest for a new blog client.
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Every blog page row, in pages (the 3000 limit was really 1000, and
  // repeats across nightly snapshots filled it with the same pages).
  let rows: Array<{ page_url: string; clicks: number; client_id: number }>;
  try {
    rows = await fetchAllRows<{ page_url: string; clicks: number; client_id: number }>(
      (from, to) =>
        supabase
          .from("client_gsc_page_metrics")
          .select("page_url, clicks, client_id, id")
          .ilike("page_url", "%/blog/%")
          .order("clicks", { ascending: false })
          .order("id", { ascending: false })
          .range(from, to),
      "blog page metrics",
    );
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "failed" }, { status: 500 });
  }

  // Dedupe by page (highest-clicks snapshot wins, since ordered desc).
  const pageBest = new Map<string, { clicks: number; clientId: number }>();
  for (const r of rows ?? []) {
    const url = r.page_url as string;
    if (!pageBest.has(url)) pageBest.set(url, { clicks: Number(r.clicks) || 0, clientId: r.client_id as number });
  }

  const topics = new Map<string, { clicks: number; clients: Set<number> }>();
  for (const [url, v] of pageBest) {
    const topic = topicFromUrl(url);
    if (!topic) continue;
    const key = topic.toLowerCase();
    const entry = topics.get(key) ?? { clicks: 0, clients: new Set<number>() };
    entry.clicks += v.clicks;
    entry.clients.add(v.clientId);
    topics.set(key, entry);
  }

  const result = [...topics.entries()]
    .map(([topic, e]) => ({ topic, clicks: Math.round(e.clicks), clients: e.clients.size }))
    .sort((a, b) => b.clicks - a.clicks)
    .slice(0, 12);

  return NextResponse.json({ topics: result });
}
