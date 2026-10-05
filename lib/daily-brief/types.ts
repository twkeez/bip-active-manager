import type { BriefingFinding } from "@/lib/briefing/types";
import type { ClientLifecycleStatus } from "@/lib/clients/client-status";

/**
 * The daily brief: every active client, most pressing first.
 *
 * Built by code from numbers the app already stores, never by a model, so the
 * same data always gives the same page and every line can be checked against
 * its source. It is saved once per day (see supabase/migrations/…daily_briefs)
 * so an earlier morning can be looked up and nobody has to trust that a job ran.
 */

/**
 * Where a client sits in the brief. Lower is more pressing.
 *
 * 1. onboarding — including clients waiting on their website to launch
 * 2. escalated — a Basecamp thread where the client is chasing or complaining
 * 3. needs_you — an active client with something to do (a drop, a gap)
 * 4. watch — something to keep an eye on, or data we cannot see
 * 5. quiet — nothing found
 */
export type BriefTier = 1 | 2 | 3 | 4 | 5;

export const TIER_LABEL: Record<BriefTier, string> = {
  1: "Onboarding",
  2: "A client is chasing us",
  3: "Needs action",
  4: "Keep an eye on",
  5: "Quiet",
};

/** One line under each heading, so the page explains its own order. */
export const TIER_BLURB: Record<BriefTier, string> = {
  1: "Clients still being onboarded, including those waiting on their website to launch.",
  2: "Active clients with a Basecamp thread the classifier read as chasing or complaining.",
  3: "Active clients with a finding that needs somebody: a sharp drop, a posting gap, a poor review.",
  4: "Active clients with something to watch, or a service we currently cannot see data for.",
  5: "Nothing found. Not the same as nothing wrong: see the note on data we could not check.",
};

export type BriefEscalatedThread = {
  title: string;
  days: number;
  reason: string | null;
  url: string | null;
};

export type BriefClient = {
  clientId: number;
  name: string;
  lifecycle: ClientLifecycleStatus;
  tier: BriefTier;
  /** Plain-language reasons this client is in its tier, most important first. */
  reasons: string[];
  services: string[];
  strategists: string[];
  /** Findings that need action or watching. Good news is left to the client briefing. */
  findings: Array<Pick<BriefingFinding, "id" | "scope" | "level" | "headline" | "detail" | "metric">>;
  blindSpots: Array<{ scope: string; source: string; reason: string; lastSeen: string | null }>;
  escalatedThreads: BriefEscalatedThread[];
  /** Threads where the client spoke last and has waited 3+ days. Shown, not ranked. */
  awaitingReplyCount: number;
  /** Poobah Client Watch notes, when this client is on the watch list. */
  watch: { watchId: number; status: string | null; statusSetAt: string | null; openItems: number } | null;
};

/** A client the brief could not check. Said out loud rather than dropped. */
export type BriefUnchecked = { clientId: number; name: string; reason: string };

export type DailyBrief = {
  /** The Eastern calendar date this brief is for. */
  date: string;
  generatedAt: string;
  clients: BriefClient[];
  unchecked: BriefUnchecked[];
  /** Counts by tier, always all five. */
  counts: Record<BriefTier, number>;
  /** Accounts deliberately left out, so the page can say how many and why. */
  excluded: { websiteOnly: number; paused: number; noServices: number };
  /** Nightly syncs that had not finished when this was built. Empty when all were in. */
  staleSources: string[];
  /** Set when the check itself failed, so "none stale" cannot be read as "all fresh". */
  freshnessError: string | null;
  /** Set when Poobah Client Watch could not be read; the brief is complete without it. */
  watchError: string | null;
};
