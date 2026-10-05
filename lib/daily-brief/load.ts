import type { SupabaseClient } from "@supabase/supabase-js";
import { loadClientBriefing } from "@/lib/briefing/load";
import { checkSourcesFresh } from "@/lib/briefing-reminders/freshness";
import { REMINDER_TIMEZONE } from "@/lib/briefing-reminders/plan";
import { findThreadIssues } from "@/lib/coal-mines/basecamp-threads";
import { loadThreadRows } from "@/lib/coal-mines/load-threads";
import { fetchAllRows } from "@/lib/data-integrity/fetch-all";
import { dateInZone } from "@/lib/google/calendar";
import { partitionClients, type EligibilityInput } from "@/lib/daily-brief/eligibility";
import { compareBriefClients, countByTier, reasonsFor, tierFor } from "@/lib/daily-brief/prioritize";
import type { BriefClient, BriefEscalatedThread, BriefUnchecked, DailyBrief } from "@/lib/daily-brief/types";
import { listWatches } from "@/lib/poobah/store";
import type { PoobahSummary } from "@/lib/poobah/types";
import type { ClientRow } from "@/lib/types/client";

/**
 * Builds the daily brief from what the app already stores.
 *
 * It reuses the engines that exist rather than judging anything itself: the
 * per-client briefing for findings and blind spots, the Basecamp thread verdicts
 * for who is chasing us, and Poobah Client Watch for Tom's own notes. A client
 * therefore cannot be told one thing here and another in its briefing.
 */

/** Clients read at once. Each briefing is a handful of queries, so this stays gentle on the database. */
const CONCURRENCY = 5;

/** A thread the client has waited on this long counts as "waiting for a reply" on the card. */
const AWAITING_REPLY_DAYS = 3;

type ClientRecord = ClientRow & EligibilityInput;

async function mapPool<T, R>(items: T[], size: number, work: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (next < items.length) {
        const index = next;
        next += 1;
        results[index] = await work(items[index]);
      }
    }),
  );
  return results;
}

export async function buildDailyBrief(admin: SupabaseClient, now: Date = new Date()): Promise<DailyBrief> {
  const date = dateInZone(now, REMINDER_TIMEZONE);

  const rows = await fetchAllRows<ClientRecord>(
    (from, to) => admin.from("clients").select("*").order("id").range(from, to),
    "clients",
  );
  const { included, excluded } = partitionClients(rows);

  // Basecamp: who is chasing us. awaitingDays 0 so a fresh complaint counts the
  // day it arrives; the 3-day count for the card is filtered from the same read.
  const threads = await loadThreadRows(admin);
  if (threads.error) throw new Error(`Could not read Basecamp threads: ${threads.error}`);
  const issues = findThreadIssues(threads.rows, threads.clientNames, now, {
    awaitingDays: 0,
    ignoredProjectIds: threads.ignoredProjectIds,
  });
  const escalatedByClient = new Map<number, BriefEscalatedThread[]>();
  const awaitingByClient = new Map<number, number>();
  for (const finding of issues.awaitingUs) {
    if (finding.clientId == null) continue;
    if (finding.escalated) {
      const list = escalatedByClient.get(finding.clientId) ?? [];
      list.push({ title: finding.title, days: finding.days, reason: finding.reason ?? null, url: finding.url });
      escalatedByClient.set(finding.clientId, list);
    }
    if (finding.days >= AWAITING_REPLY_DAYS) {
      awaitingByClient.set(finding.clientId, (awaitingByClient.get(finding.clientId) ?? 0) + 1);
    }
  }

  // Tom's own notes. Optional: if they cannot be read the brief says so and goes on.
  const watchByClient = new Map<number, PoobahSummary>();
  let watchError: string | null = null;
  try {
    for (const watch of await listWatches(admin)) {
      if (watch.client_id != null) watchByClient.set(watch.client_id, watch);
    }
  } catch (error) {
    watchError = error instanceof Error ? error.message : "Could not read Poobah Client Watch.";
  }

  const unchecked: BriefUnchecked[] = [];
  const built = await mapPool(included, CONCURRENCY, async ({ row, lifecycle }): Promise<BriefClient | null> => {
    let briefing;
    try {
      briefing = await loadClientBriefing(admin, row.id);
    } catch (error) {
      unchecked.push({
        clientId: row.id,
        name: row.account_name,
        reason: error instanceof Error ? error.message : "The briefing could not be read.",
      });
      return null;
    }
    if (!briefing) {
      unchecked.push({ clientId: row.id, name: row.account_name, reason: "The client record could not be read." });
      return null;
    }

    const escalatedThreads = [...(escalatedByClient.get(row.id) ?? [])].sort((a, b) => b.days - a.days);
    const findings = briefing.findings.filter((finding) => finding.level !== "good");
    const input = {
      lifecycle,
      escalatedThreads: escalatedThreads.length,
      needsYou: findings.filter((finding) => finding.level === "needs_you").length,
      watch: findings.filter((finding) => finding.level === "watch").length,
      blindSpots: briefing.blindSpots.length,
    };
    const watch = watchByClient.get(row.id);
    return {
      clientId: row.id,
      name: row.account_name,
      lifecycle,
      tier: tierFor(input),
      reasons: reasonsFor(input),
      services: briefing.services.map((service) => service.label),
      strategists: briefing.strategists.map((person) => person.name),
      findings: findings.map(({ id, scope, level, headline, detail, metric }) => ({
        id,
        scope,
        level,
        headline,
        detail: detail ?? null,
        metric: metric ?? null,
      })),
      blindSpots: briefing.blindSpots.map(({ scope, source, reason, lastSeen }) => ({ scope, source, reason, lastSeen })),
      escalatedThreads,
      awaitingReplyCount: awaitingByClient.get(row.id) ?? 0,
      watch: watch
        ? { watchId: watch.id, status: watch.status, statusSetAt: watch.status_set_at, openItems: watch.open_items }
        : null,
    };
  });

  const clients = built.filter((client): client is BriefClient => client !== null).sort(compareBriefClients);

  // "Is today's data in?" decides whether a quiet client really is quiet.
  let staleSources: string[] = [];
  let freshnessError: string | null = null;
  try {
    staleSources = await checkSourcesFresh(admin, date);
  } catch (error) {
    freshnessError = error instanceof Error ? error.message : "Could not check whether today's data synced.";
  }

  return {
    date,
    generatedAt: now.toISOString(),
    clients,
    unchecked: unchecked.sort((a, b) => a.name.localeCompare(b.name)),
    counts: countByTier(clients),
    excluded,
    staleSources,
    freshnessError,
    watchError,
  };
}

/** Saved once per Eastern day: a second run the same day replaces the first. */
export async function saveDailyBrief(admin: SupabaseClient, brief: DailyBrief): Promise<void> {
  const { error } = await admin
    .from("daily_briefs")
    .upsert({ brief_date: brief.date, generated_at: brief.generatedAt, payload: brief }, { onConflict: "brief_date" });
  if (error) {
    throw new Error(
      /does not exist|schema cache/i.test(error.message)
        ? "The daily brief table does not exist yet. Run supabase/migrations/20261005120000_daily_briefs.sql."
        : `Could not save the daily brief: ${error.message}`,
    );
  }
}

export type SavedBrief = { date: string; generatedAt: string; brief: DailyBrief };

/** The brief for one date, or the newest when no date is given. Also returns recent dates for the picker. */
export async function loadSavedBrief(
  admin: SupabaseClient,
  date?: string,
): Promise<{ saved: SavedBrief | null; recentDates: string[]; error: string | null }> {
  const dates = await admin.from("daily_briefs").select("brief_date").order("brief_date", { ascending: false }).limit(14);
  if (dates.error) {
    return {
      saved: null,
      recentDates: [],
      error: /does not exist|schema cache/i.test(dates.error.message)
        ? "The daily brief is not set up yet: the database migration needs running."
        : dates.error.message,
    };
  }
  const recentDates = (dates.data ?? []).map((row) => String(row.brief_date));
  const wanted = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : recentDates[0];
  if (!wanted) return { saved: null, recentDates, error: null };

  const { data, error } = await admin
    .from("daily_briefs")
    .select("brief_date, generated_at, payload")
    .eq("brief_date", wanted)
    .maybeSingle();
  if (error) return { saved: null, recentDates, error: error.message };
  if (!data) return { saved: null, recentDates, error: null };
  return {
    saved: { date: String(data.brief_date), generatedAt: String(data.generated_at), brief: data.payload as DailyBrief },
    recentDates,
    error: null,
  };
}
