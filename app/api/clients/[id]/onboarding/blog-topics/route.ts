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

  const { data: rows, error } = await supabase
    .from("client_gsc_page_metrics")
    .select("page_url, clicks, client_id")
    .ilike("page_url", "%/blog/%")
    .order("clicks", { ascending: false })
    .limit(3000);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

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
