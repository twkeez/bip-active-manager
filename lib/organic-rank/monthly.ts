import type { SupabaseClient } from "@supabase/supabase-js";
import { getDataForSeoConfig } from "@/lib/env";
import { fetchAllRows } from "@/lib/data-integrity/fetch-all";
import { resolvePracticeCenterFromPlaceId } from "@/lib/local-rank/places-center";
import { runOrganicRankScan } from "@/lib/organic-rank/scan";

/**
 * The monthly organic rankings refresh (Tom, Nov 25 2026: "schedule the
 * rankings refresh").
 *
 * The monthly report shows each tracked keyword's organic position at the
 * practice, from the latest two scans. Until this ran on a schedule, those
 * positions were only as fresh as the last time someone pressed the scan
 * button. Now every client with tracked keywords is scanned once on the 1st
 * of each month, before that month's reports are built.
 *
 * Cost: one DataForSEO organic search per active keyword per client. Only the
 * practice location is read, because that is all the report shows; the extra
 * ZIP locations stay on the manual scan button. A client already scanned at
 * the practice this month (by hand or by an earlier run) is skipped, so a run
 * that is retried, or picks up where the last one stopped, never pays twice.
 */

export type RankClient = {
  id: number;
  account_name: string;
  website: string | null;
  google_place_id: string | null;
};

const present = (value: string | null | undefined) => Boolean(value && value.trim());

/** Midnight UTC on the 1st of the month `now` falls in. */
export function monthStart(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/** "Practice", or a row from before locations existed, is the report's baseline. */
export function isPracticeLabel(label: string | null): boolean {
  return label == null || label === "Practice";
}

/**
 * Which clients still need this month's scan, and why the others can't run.
 * A client is due when it has a website, a Google Place ID and at least one
 * active keyword, and hasn't been scanned at the practice since the 1st.
 */
export function planMonthlyScan(input: {
  clients: RankClient[];
  keywordsByClient: Map<number, string[]>;
  scannedThisMonth: Set<number>;
}): { due: Array<RankClient & { keywords: string[] }>; alreadyDone: number; missingSetup: string[] } {
  const due: Array<RankClient & { keywords: string[] }> = [];
  const missingSetup: string[] = [];
  let alreadyDone = 0;
  for (const client of input.clients) {
    const keywords = input.keywordsByClient.get(client.id) ?? [];
    if (keywords.length === 0) continue; // Not tracking organic rankings: nothing to refresh.
    if (input.scannedThisMonth.has(client.id)) {
      alreadyDone += 1;
      continue;
    }
    const missing = [
      present(client.website) ? null : "website",
      present(client.google_place_id) ? null : "Google Place ID",
    ].filter(Boolean);
    if (missing.length) {
      missingSetup.push(`${client.account_name}: no ${missing.join(" or ")}`);
      continue;
    }
    due.push({ ...client, keywords });
  }
  // Fewest keywords first, so a run that hits its time limit finishes as many clients as it can.
  due.sort((a, b) => a.keywords.length - b.keywords.length || a.id - b.id);
  return { due, alreadyDone, missingSetup };
}

export type MonthlyScanSummary = {
  due: number;
  scanned: number;
  searches: number;
  alreadyDone: number;
  leftForNextRun: number;
  missingSetup: string[];
  failed: Array<{ client: string; error: string }>;
};

/**
 * Scan due clients until `budgetMs` has passed since `startedAt`, then stop
 * and leave the rest for the next scheduled run.
 */
export async function runMonthlyOrganicScan(
  admin: SupabaseClient,
  { now = new Date(), startedAt = Date.now(), budgetMs }: { now?: Date; startedAt?: number; budgetMs: number },
): Promise<MonthlyScanSummary> {
  const config = getDataForSeoConfig();
  if (!config) throw new Error("DataForSEO credentials are not configured on the server.");

  const clients = await fetchAllRows<RankClient>(
    (from, to) => admin.from("clients").select("id,account_name,website,google_place_id").order("id").range(from, to),
    "Clients",
  );
  const keywordRows = await fetchAllRows<{ client_id: number; keyword: string }>(
    (from, to) =>
      admin.from("client_keyword_targets").select("id,client_id,keyword").eq("is_active", true).order("id").range(from, to),
    "Tracked keywords",
  );
  const keywordsByClient = new Map<number, string[]>();
  for (const row of keywordRows) {
    const keyword = row.keyword?.trim();
    if (!keyword) continue;
    const list = keywordsByClient.get(row.client_id) ?? [];
    if (!list.includes(keyword)) list.push(keyword);
    keywordsByClient.set(row.client_id, list);
  }
  const recent = await fetchAllRows<{ client_id: number; location_label: string | null }>(
    (from, to) =>
      admin
        .from("client_organic_rank_snapshots")
        .select("id,client_id,location_label")
        .gte("created_at", monthStart(now).toISOString())
        .order("id")
        .range(from, to),
    "This month's rank scans",
  );
  const scannedThisMonth = new Set(recent.filter((row) => isPracticeLabel(row.location_label)).map((row) => row.client_id));

  const plan = planMonthlyScan({ clients, keywordsByClient, scannedThisMonth });
  const summary: MonthlyScanSummary = {
    due: plan.due.length,
    scanned: 0,
    searches: 0,
    alreadyDone: plan.alreadyDone,
    leftForNextRun: 0,
    missingSetup: plan.missingSetup,
    failed: [],
  };

  for (const [index, client] of plan.due.entries()) {
    if (Date.now() - startedAt > budgetMs) {
      summary.leftForNextRun = plan.due.length - index;
      break;
    }
    try {
      const center = await resolvePracticeCenterFromPlaceId(client.google_place_id!.trim());
      if (!center) throw new Error("Couldn't find the practice's location from its Google Place ID.");
      const results = await runOrganicRankScan(config, {
        websiteUrl: client.website,
        keywords: client.keywords,
        locations: [{ label: "Practice", lat: center.lat, lng: center.lng }],
      });
      summary.searches += results.length;
      const checkedAt = new Date().toISOString();
      const { error } = await admin.from("client_organic_rank_snapshots").insert(
        results.map((r) => ({
          created_by: null, // Scheduled: no person pressed the button.
          client_id: client.id,
          keyword: r.keyword,
          position: r.position,
          url: r.url,
          top_domain: r.topDomain,
          location_label: r.location,
          checked_at: checkedAt,
        })),
      );
      if (error) throw new Error(`Couldn't save the rankings: ${error.message}`);
      summary.scanned += 1;
    } catch (error) {
      summary.failed.push({ client: client.account_name, error: error instanceof Error ? error.message : String(error) });
    }
  }
  return summary;
}
