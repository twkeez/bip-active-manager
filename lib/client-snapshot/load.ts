import type { SupabaseClient } from "@supabase/supabase-js";
import { withIntegrityScope } from "@/lib/data-integrity/server";
import { loadBasecampActivity } from "@/lib/poobah/basecamp";
import { PoobahError } from "@/lib/poobah/validate";
import { pickKeywordPeriods } from "@/lib/reporting/keyword-periods";

/**
 * A client's Monthly Snapshot: a few basic numbers and the work we did, in
 * plain words, meant to replace the AgencyAnalytics dashboards (Tom,
 * 2026-10-08: "most don't look; I just want to give them some basic metrics",
 * goals "saving money and showing our work").
 *
 * Self-contained on purpose: it takes a client id and returns only what is
 * safe to show that client. The BIP Control preview renders it today; the
 * separate client-facing app will render the same thing.
 *
 * Every number comes from the nightly syncs, compared with the period just
 * before it (never an overlapping window). A number we cannot stand behind
 * is left out with a reason, never shown wrong; if any read behind the page
 * was cut short, the whole snapshot is marked incomplete.
 */

export type SnapshotMetric = {
  label: string;
  value: number;
  previous: number | null;
  format: "count" | "money" | "percent" | "rating";
  /** True when a rise is bad news (cost per lead). */
  lowerIsBetter?: boolean;
  note?: string;
};

export type SnapshotSection = {
  key: "website" | "ads" | "social" | "listing";
  title: string;
  period: string;
  metrics: SnapshotMetric[];
  /** Plain-language breakdown lines, e.g. where visitors came from. */
  details?: { label: string; value: string }[];
};

export type SnapshotWorkItem = { date: string; author: string; thread: string; excerpt: string; url: string | null };

export type ClientSnapshot = {
  clientId: number;
  clientName: string;
  generatedAt: string;
  sections: SnapshotSection[];
  /** Updates our team posted to the client in Basecamp in the last 30 days. */
  work: SnapshotWorkItem[];
  /** Why a section is missing, in words for us, not the client. */
  omitted: string[];
  /** A read behind this page was cut short: do not show it to a client. */
  incomplete: boolean;
};

const WORK_DAYS = 30;
const EXCERPT_CHARS = 280;

type Ga4Totals = { users?: number; sessions?: number };
type AdsTotals = { clicks?: number; cost_micros?: number; conversions?: number; phone_calls?: number; impressions?: number };

function fmtDay(date: string | null | undefined): string {
  if (!date) return "";
  return new Date(`${date.slice(0, 10)}T12:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric" });
}

/** Google Analytics channel names, in words a practice owner uses. */
const CHANNEL_LABEL: Record<string, string> = {
  Direct: "Typed your address or used a bookmark",
  "Organic Search": "Found you on Google and other search",
  "Paid Search": "Your search ads",
  Display: "Your display ads",
  "Cross-network": "Your Google Ads (other placements)",
  "Organic Social": "Social media",
  "Paid Social": "Your social ads",
  Referral: "Links on other websites",
  Email: "Email",
  "Organic Maps": "Google Maps",
};

const periodLabel = (start?: string | null, end?: string | null) => (start && end ? `${fmtDay(start)} – ${fmtDay(end)}` : "Last 30 days");

function excerpt(text: string | null): string {
  const flat = (text ?? "").replace(/\s+/g, " ").trim();
  return flat.length > EXCERPT_CHARS ? `${flat.slice(0, EXCERPT_CHARS).replace(/\s\S*$/, "")}…` : flat;
}

async function website(admin: SupabaseClient, clientId: number, omitted: string[]): Promise<SnapshotSection | null> {
  const { data, error } = await admin
    .from("client_ga4_snapshots")
    .select("start_date,end_date,totals,previous_totals,channel_breakdown")
    .eq("client_id", clientId)
    .eq("run_status", "completed")
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) throw new Error(`Website analytics: ${error.message}`);
  const row = data?.[0] as
    | { start_date: string; end_date: string; totals: Ga4Totals | null; previous_totals: Ga4Totals | null; channel_breakdown: { channel: string; users: number }[] | null }
    | undefined;
  if (!row?.totals) {
    omitted.push("Website: no completed Google Analytics sync for this client.");
    return null;
  }
  const t = row.totals;
  const p = row.previous_totals ?? null;
  const channels = (row.channel_breakdown ?? []).filter((c) => c.users > 0).sort((a, b) => b.users - a.users).slice(0, 4);
  return {
    key: "website",
    title: "Your website",
    period: periodLabel(row.start_date, row.end_date),
    metrics: [
      { label: "Visitors", value: t.users ?? 0, previous: p?.users ?? null, format: "count" },
      { label: "Visits", value: t.sessions ?? 0, previous: p?.sessions ?? null, format: "count" },
    ],
    details: channels.length
      ? channels.map((c) => ({ label: CHANNEL_LABEL[c.channel] ?? c.channel, value: `${c.users.toLocaleString("en-US")} visitors` }))
      : undefined,
  };
}

async function ads(admin: SupabaseClient, clientId: number, omitted: string[]): Promise<SnapshotSection | null> {
  const { data, error } = await admin
    .from("client_ads_snapshots")
    .select("id,start_date,end_date,run_status,created_at,totals")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(90);
  if (error) throw new Error(`Google Ads: ${error.message}`);
  const rows = (data ?? []) as { id: number; start_date: string; end_date: string; run_status: string; created_at: string; totals: AdsTotals | null }[];
  const { current, previous } = pickKeywordPeriods(rows);
  if (!current?.totals) {
    if (rows.length) omitted.push("Google Ads: no completed sync for the latest period.");
    return null;
  }
  const t = current.totals;
  const p = previous?.totals ?? null;
  const spend = (t.cost_micros ?? 0) / 1e6;
  if (spend <= 0 && !(t.clicks ?? 0)) {
    omitted.push("Google Ads: the account had no spend in the period, so the section is left out.");
    return null;
  }
  const prevSpend = p ? (p.cost_micros ?? 0) / 1e6 : null;
  const leads = t.conversions ?? 0;
  const prevLeads = p?.conversions ?? null;
  const metrics: SnapshotMetric[] = [
    { label: "Ad spend", value: spend, previous: prevSpend, format: "money" },
    { label: "Clicks to your site", value: t.clicks ?? 0, previous: p?.clicks ?? null, format: "count" },
  ];
  if ((t.phone_calls ?? 0) > 0 || (p?.phone_calls ?? 0) > 0) {
    metrics.push({ label: "Calls from your ads", value: t.phone_calls ?? 0, previous: p?.phone_calls ?? null, format: "count" });
  }
  if (leads > 0) {
    metrics.push({ label: "Leads (calls and forms)", value: Math.round(leads), previous: prevLeads == null ? null : Math.round(prevLeads), format: "count" });
    metrics.push({
      label: "Cost per lead",
      value: spend / leads,
      previous: prevSpend != null && prevLeads ? prevSpend / prevLeads : null,
      format: "money",
      lowerIsBetter: true,
    });
  }
  return { key: "ads", title: "Google Ads", period: periodLabel(current.start_date, current.end_date), metrics };
}

async function social(admin: SupabaseClient, clientId: number, omitted: string[]): Promise<SnapshotSection | null> {
  const since = new Date(Date.now() - 40 * 86_400_000).toISOString().slice(0, 10);
  const { data, error } = await admin
    .from("client_social_daily_snapshots")
    .select("platform,snapshot_date,follows")
    .eq("client_id", clientId)
    .gte("snapshot_date", since)
    .order("snapshot_date", { ascending: false })
    .order("id", { ascending: false });
  if (error) throw new Error(`Social: ${error.message}`);
  const rows = (data ?? []) as { platform: string; snapshot_date: string; follows: number | null }[];
  const metrics: SnapshotMetric[] = [];
  let latestDate = "";
  for (const platform of ["facebook", "instagram"]) {
    const own = rows.filter((r) => r.platform === platform && typeof r.follows === "number");
    const now = own[0];
    if (!now || !now.follows) continue;
    if (now.snapshot_date > latestDate) latestDate = now.snapshot_date;
    // The count about 30 days earlier: the newest reading at least 28 days older.
    const cutoff = new Date(Date.parse(`${now.snapshot_date}T00:00:00Z`) - 28 * 86_400_000).toISOString().slice(0, 10);
    const then = own.find((r) => r.snapshot_date <= cutoff);
    metrics.push({
      label: platform === "facebook" ? "Facebook followers" : "Instagram followers",
      value: now.follows,
      previous: then?.follows ?? null,
      format: "count",
    });
  }
  if (!metrics.length) {
    omitted.push("Social: no follower counts synced in the last 40 days.");
    return null;
  }
  return { key: "social", title: "Social media", period: latestDate ? `As of ${fmtDay(latestDate)}` : "", metrics };
}

async function listing(admin: SupabaseClient, clientId: number, omitted: string[]): Promise<SnapshotSection | null> {
  const { data, error } = await admin
    .from("client_gbp_snapshots")
    .select("created_at,rating,user_ratings_total")
    .eq("client_id", clientId)
    .eq("run_status", "completed")
    .order("created_at", { ascending: false })
    .limit(60);
  if (error) throw new Error(`Google listing: ${error.message}`);
  const rows = (data ?? []) as { created_at: string; rating: number | null; user_ratings_total: number | null }[];
  const now = rows.find((r) => r.rating != null);
  if (!now?.rating) {
    omitted.push("Google listing: no rating synced.");
    return null;
  }
  const cutoff = new Date(Date.parse(now.created_at) - 28 * 86_400_000).toISOString();
  const then = rows.find((r) => r.created_at <= cutoff && r.user_ratings_total != null);
  const ageDays = (Date.now() - Date.parse(now.created_at)) / 86_400_000;
  return {
    key: "listing",
    title: "Your Google listing",
    period: `As of ${fmtDay(now.created_at)}`,
    metrics: [
      { label: "Star rating", value: now.rating, previous: null, format: "rating" },
      { label: "Google reviews", value: now.user_ratings_total ?? 0, previous: then?.user_ratings_total ?? null, format: "count" },
    ],
    details:
      ageDays > 8
        ? [{ label: "Note", value: `Last checked ${fmtDay(now.created_at)}; listings refresh nightly only for reputation clients.` }]
        : undefined,
  };
}

async function work(admin: SupabaseClient, clientId: number, omitted: string[]): Promise<SnapshotWorkItem[]> {
  try {
    const activity = await loadBasecampActivity(admin, clientId, WORK_DAYS);
    return activity.threads
      .filter((thread) => !/^\s*internal\b/i.test(thread.title))
      .flatMap((thread) =>
        thread.posts
          .filter((post) => post.side === "Beyond Indigo" && post.text)
          .map((post) => ({
            date: post.at,
            author: post.author.split("|")[0].trim().split(/\s+/)[0],
            thread: thread.title,
            excerpt: excerpt(post.text),
            url: thread.url,
          })),
      )
      .sort((a, b) => b.date.localeCompare(a.date));
  } catch (error) {
    if (error instanceof PoobahError && error.status === 404) {
      omitted.push("Our work: no Basecamp project is linked to this client.");
      return [];
    }
    throw error;
  }
}

export async function loadClientSnapshot(admin: SupabaseClient, clientId: number): Promise<ClientSnapshot> {
  const { result, truncated } = await withIntegrityScope(async () => {
    const { data: client, error } = await admin.from("clients").select("id,account_name,public_name").eq("id", clientId).maybeSingle();
    if (error) throw new Error(`Client: ${error.message}`);
    if (!client) throw new PoobahError(`No client with id ${clientId}.`, 404);
    const omitted: string[] = [];
    const [w, a, s, l, items] = await Promise.all([
      website(admin, clientId, omitted),
      ads(admin, clientId, omitted),
      social(admin, clientId, omitted),
      listing(admin, clientId, omitted),
      work(admin, clientId, omitted),
    ]);
    return {
      clientId,
      clientName: (client.public_name as string | null)?.trim() || (client.account_name as string),
      generatedAt: new Date().toISOString(),
      sections: [w, a, s, l].filter((section): section is SnapshotSection => Boolean(section)),
      work: items,
      omitted,
    };
  });
  return { ...result, incomplete: truncated.length > 0 };
}
