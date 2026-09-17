import type { ClientServiceKey } from "@/lib/clients/types";

/**
 * A twice-monthly briefing for one client, written for their strategist.
 *
 * The findings are computed by code, never by a model: a number that appears
 * in a note a strategist may forward has to be reproducible, and testable
 * against a case we chose on purpose. A model may later choose the wording and
 * the order; it never decides what is true.
 */

/** "account" covers findings that are not about one service. */
export type BriefingScope = ClientServiceKey | "account";

/**
 * Three levels, because two would collapse the distinction that matters:
 * something to do, something to keep an eye on, and something good worth
 * saying. A briefing of nothing but problems reads as a complaint.
 */
export type FindingLevel = "needs_you" | "watch" | "good";

export type BriefingFinding = {
  /** Stable across runs, so the same finding twice is recognisable. */
  id: string;
  scope: BriefingScope;
  level: FindingLevel;
  /** One line, plain, no jargon. What a strategist reads first. */
  headline: string;
  detail?: string | null;
  /** The number behind it, formatted for reading: "18 → 7 calls". */
  metric?: string | null;
};

/**
 * Something we sell but cannot currently see.
 *
 * This exists because a client with broken data and a client with nothing
 * wrong both produce no findings. Without saying so, a quiet briefing would
 * quietly reassure a strategist about a client we stopped watching weeks ago.
 */
export type BriefingBlindSpot = {
  scope: BriefingScope;
  /** "Search Console", "Google Ads" — the source, in the strategist's words. */
  source: string;
  reason: string;
  /** When we last had data, ISO, or null if never. */
  lastSeen: string | null;
};

export type BriefingService = {
  key: ClientServiceKey;
  label: string;
  /** "Premium", "4 posts a month" — null when what is stored is not a plan. */
  planLabel: string | null;
};

export type ClientBriefing = {
  clientId: number;
  clientName: string;
  services: BriefingService[];
  strategists: Array<{ name: string; email: string | null }>;
  findings: BriefingFinding[];
  blindSpots: BriefingBlindSpot[];
  /** True when nothing needs the strategist. Said in one line, not padded. */
  quiet: boolean;
  generatedAt: string;
};
