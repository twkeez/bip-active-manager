import type { SupabaseClient } from "@supabase/supabase-js";
import type { ClientRow } from "@/lib/types/client";
import type { ClientServiceKey } from "@/lib/clients/types";
import { getClientActiveServices } from "@/lib/clients/service-active";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveStrategistContacts, type StaffProfile } from "@/lib/onboarding/expectation-people";
import { SERVICE_EXPECTATION_LABEL } from "@/lib/onboarding/service-expectations";
import {
  compare,
  MIN_CLICKS,
  MIN_CONVERSIONS,
  MIN_REACH,
  needsAttention,
  postingGapFinding,
  rankFindings,
  reviewFindings,
  signalFindings,
  type StoredSignal,
} from "@/lib/briefing/findings";
import type {
  BriefingBlindSpot,
  BriefingFinding,
  BriefingService,
  ClientBriefing,
} from "@/lib/briefing/types";

/**
 * Everything a briefing needs for one client, read from what we already store.
 *
 * Only local tables: a briefing must not depend on an external API answering,
 * or the fortnightly run becomes the third thing that quietly stopped working.
 * The nightly syncs are what keep these tables current, and where they have
 * not, that is reported as a blind spot rather than read as calm.
 *
 * Website-only clients are not briefed at all — they buy no marketing service,
 * so there is nothing to report and nobody expecting a note.
 */

/** Each period is a month, so a fortnightly note compares like with like. */
const WINDOW_DAYS = 30;
const SEO_WINDOW_DAYS = 28;

/**
 * How old a source may be before we stop treating it as sight. The nightly
 * jobs run every day, so three days means two consecutive failures — past
 * that, silence is not evidence of calm.
 */
const SIGHT_DAYS = 3;

const SOURCE_LABEL: Record<string, string> = {
  ppc: "Google Ads",
  smm: "Facebook and Instagram",
  seo: "Search Console",
  orm: "Google reviews",
  blog: "the blog",
};

const iso = (daysAgo: number) => new Date(Date.now() - daysAgo * 86_400_000).toISOString();
const isoDate = (daysAgo: number) => iso(daysAgo).slice(0, 10);

function planLabel(client: ClientRow, service: ClientServiceKey): string | null {
  const raw = (client[service] as string | null | undefined) ?? null;
  const value = (raw ?? "").trim();
  return value && value.toLowerCase() !== "no" ? value : null;
}

type Freshness = { at: string | null; fresh: boolean };

const freshness = (at: string | null | undefined): Freshness => ({
  at: at ?? null,
  fresh: Boolean(at && Date.parse(at) >= Date.now() - SIGHT_DAYS * 86_400_000),
});

export async function loadClientBriefing(
  admin: SupabaseClient,
  clientId: number,
): Promise<ClientBriefing | null> {
  const { data: clientRaw } = await admin.from("clients").select("*").eq("id", clientId).maybeSingle();
  if (!clientRaw) return null;
  const client = clientRaw as ClientRow;

  const active = getClientActiveServices(client);
  const services: BriefingService[] = (
    ["seo", "ppc", "smm", "blog", "orm"] as ClientServiceKey[]
  )
    .filter((key) => active[key])
    .map((key) => ({
      key,
      label: SERVICE_EXPECTATION_LABEL[key],
      planLabel: planLabel(client, key),
    }));

  // Staff names and emails are read with the service role for the same reason
  // the client document does: otherwise the briefing would name a different
  // strategist depending on who generated it.
  const { data: staffRows } = await createAdminClient().from("profiles").select("full_name, email");
  const strategists = resolveStrategistContacts(
    client.marketing_strategist,
    (staffRows ?? []) as StaffProfile[],
  ).map((contact) => ({ name: contact.name, email: contact.email }));

  const findings: BriefingFinding[] = [];
  const blindSpots: BriefingBlindSpot[] = [];
  const bought = (key: ClientServiceKey) => Boolean(active[key]);

  const blind = (scope: ClientServiceKey, reason: string, lastSeen: string | null) =>
    blindSpots.push({ scope, source: SOURCE_LABEL[scope] ?? scope, reason, lastSeen });

  // --- Google Ads ---------------------------------------------------------
  if (bought("ppc")) {
    const { data: snapshots } = await admin
      .from("client_ads_snapshots")
      .select("id, created_at, totals, run_status")
      .eq("client_id", clientId)
      .eq("run_status", "completed")
      .order("created_at", { ascending: false })
      .limit(2);
    const [latest, previous] = (snapshots ?? []) as Array<{
      id: number;
      created_at: string;
      totals: Record<string, number> | null;
    }>;
    const seen = freshness(latest?.created_at);
    if (!latest) blind("ppc", "No ads data has ever synced for this client", null);
    else if (!seen.fresh) blind("ppc", "Ads data has not refreshed in days", seen.at);

    if (latest?.totals && previous?.totals) {
      const calls = compare({
        id: "ads:conversions",
        scope: "ppc",
        period: {
          current: Number(latest.totals.conversions ?? 0),
          previous: Number(previous.totals.conversions ?? 0),
        },
        floor: MIN_CONVERSIONS,
        noun: "leads from ads",
      });
      if (calls) findings.push(calls);

      const spend = compare({
        id: "ads:cost",
        scope: "ppc",
        period: {
          current: Number(latest.totals.cost_micros ?? 0) / 1_000_000,
          previous: Number(previous.totals.cost_micros ?? 0) / 1_000_000,
        },
        floor: 100,
        noun: "ad spend",
        fallingIsBad: false,
      });
      // Spend rising only matters next to what it bought, so it is a watch item
      // unless the leads finding already says the same thing louder.
      if (spend && !calls) findings.push({ ...spend, level: "watch" });
    }

    if (latest) {
      const { data: signals } = await admin
        .from("client_ads_signals")
        .select("signal_id, severity, title, description, metric_value")
        .eq("snapshot_id", latest.id);
      findings.push(...signalFindings((signals ?? []) as StoredSignal[], "ppc"));
    }
  }

  // --- Social -------------------------------------------------------------
  if (bought("smm")) {
    const { data: daily } = await admin
      .from("client_social_daily_snapshots")
      .select("snapshot_date, reach, engagement, created_at")
      .eq("client_id", clientId)
      .gte("snapshot_date", isoDate(WINDOW_DAYS * 2));
    const rows = (daily ?? []) as Array<{ snapshot_date: string; reach: number | null; engagement: number | null; created_at: string }>;
    const cutoff = isoDate(WINDOW_DAYS);
    const sum = (list: typeof rows, field: "reach" | "engagement") =>
      list.reduce((total, row) => total + Number(row[field] ?? 0), 0);
    const current = rows.filter((row) => row.snapshot_date >= cutoff);
    const earlier = rows.filter((row) => row.snapshot_date < cutoff);

    const newest = rows.map((row) => row.created_at).sort().at(-1) ?? null;
    const seen = freshness(newest);
    if (rows.length === 0) blind("smm", "No social data has synced for this client", null);
    else if (!seen.fresh) blind("smm", "Social data has not refreshed in days", seen.at);

    const reach = compare({
      id: "social:reach",
      scope: "smm",
      period: { current: sum(current, "reach"), previous: sum(earlier, "reach") },
      floor: MIN_REACH,
      noun: "people reached on social",
    });
    if (reach) findings.push(reach);

    const { data: posts } = await admin
      .from("client_social_post_snapshots")
      .select("published_at")
      .eq("client_id", clientId)
      .not("published_at", "is", null)
      .order("published_at", { ascending: false })
      .limit(1);
    const lastPostAt = (posts ?? [])[0]?.published_at as string | undefined;
    const gap = postingGapFinding({ lastPostAt: lastPostAt ?? null });
    if (gap) findings.push(gap);

    const { data: signals } = await admin
      .from("client_social_signals")
      .select("signal_id, severity, title, description, metric_value, created_at")
      .eq("client_id", clientId)
      .gte("created_at", iso(WINDOW_DAYS))
      .order("created_at", { ascending: false });
    findings.push(...signalFindings((signals ?? []) as StoredSignal[], "smm"));
  }

  // --- SEO ----------------------------------------------------------------
  if (bought("seo")) {
    const { data: snapshots } = await admin
      .from("client_gsc_snapshots")
      .select("id, created_at, run_status")
      .eq("client_id", clientId)
      .eq("run_status", "completed")
      .order("created_at", { ascending: false })
      .limit(1);
    const latest = (snapshots ?? [])[0] as { id: number; created_at: string } | undefined;
    const seen = freshness(latest?.created_at);
    if (!latest) {
      // The common case, and the one a strategist must not read as "SEO is
      // fine": Google has not granted us access to most properties.
      blind("seo", "We have no access to this client's Search Console property", null);
    } else if (!seen.fresh) {
      blind("seo", "Search Console data has not refreshed in days", seen.at);
    }

    const { data: dailyRows } = await admin
      .from("client_gsc_daily_metrics")
      .select("metric_date, clicks")
      .eq("client_id", clientId)
      .gte("metric_date", isoDate(SEO_WINDOW_DAYS * 2));
    const rows = (dailyRows ?? []) as Array<{ metric_date: string; clicks: number | null }>;
    // One row per date per snapshot, so the same day can appear twice.
    const byDate = new Map<string, number>();
    for (const row of rows) byDate.set(row.metric_date, Number(row.clicks ?? 0));
    const cutoff = isoDate(SEO_WINDOW_DAYS);
    let currentClicks = 0;
    let previousClicks = 0;
    for (const [date, clicks] of byDate) {
      if (date >= cutoff) currentClicks += clicks;
      else previousClicks += clicks;
    }
    const clicks = compare({
      id: "seo:clicks",
      scope: "seo",
      period: { current: currentClicks, previous: previousClicks },
      floor: MIN_CLICKS,
      noun: "clicks from Google search",
    });
    if (clicks) findings.push(clicks);

    if (latest) {
      const { data: signals } = await admin
        .from("client_gsc_signals")
        .select("signal_id, severity, title, description, metric_value")
        .eq("snapshot_id", latest.id);
      findings.push(...signalFindings((signals ?? []) as StoredSignal[], "seo"));
    }
  }

  // --- Reviews ------------------------------------------------------------
  if (bought("orm")) {
    const { data: snapshots } = await admin
      .from("client_gbp_snapshots")
      .select("created_at, rating, user_ratings_total, run_status")
      .eq("client_id", clientId)
      .eq("run_status", "completed")
      .order("created_at", { ascending: false })
      .limit(2);
    const [latest, previous] = (snapshots ?? []) as Array<{
      created_at: string;
      rating: number | null;
      user_ratings_total: number | null;
    }>;
    const seen = freshness(latest?.created_at);
    if (!latest) blind("orm", "No Google listing data has synced for this client", null);
    else if (!seen.fresh) blind("orm", "Google listing data has not refreshed in days", seen.at);

    const { data: reviews } = await admin
      .from("client_gbp_reviews")
      .select("author_name, rating, review_time_unix")
      .eq("client_id", clientId);
    findings.push(
      ...reviewFindings({
        rating: latest?.rating ?? null,
        previousRating: previous?.rating ?? null,
        reviewCount: latest?.user_ratings_total ?? null,
        previousReviewCount: previous?.user_ratings_total ?? null,
        reviews: (reviews ?? []) as Array<{ author_name: string | null; rating: number | null; review_time_unix: number | null }>,
      }),
    );
  }

  // Blog has no blind spot line. Nothing in the app tracks published posts, so
  // it would appear on every briefing for every blog client for ever, and a
  // paragraph that never changes is one people stop reading past. It is said
  // once on the briefings screen instead.

  const ranked = rankFindings(findings);
  return {
    clientId,
    clientName: client.account_name,
    services,
    strategists,
    findings: ranked,
    blindSpots,
    quiet: !needsAttention(ranked),
    generatedAt: new Date().toISOString(),
  };
}

/** The clients a briefing is written for: anyone buying a marketing service. */
export async function loadBriefableClients(
  admin: SupabaseClient,
): Promise<Array<{ id: number; account_name: string }>> {
  const { data } = await admin
    .from("clients")
    .select("id, account_name, seo, ppc, smm, blog, orm, awaiting_website_launch")
    .order("account_name", { ascending: true });
  return ((data ?? []) as ClientRow[])
    .filter((client) => {
      const active = getClientActiveServices(client);
      return active.seo || active.ppc || active.smm || active.blog || active.orm;
    })
    .map((client) => ({ id: client.id, account_name: client.account_name }));
}
