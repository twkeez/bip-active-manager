import type { SupabaseClient } from "@supabase/supabase-js";
import { findThreadIssues, type ThreadFinding } from "@/lib/coal-mines/basecamp-threads";
import { loadThreadRows } from "@/lib/coal-mines/load-threads";
import type { RoutineFinding, RoutineResult } from "@/lib/routines/types";

/**
 * The Daily Basecamp Review, as asked for:
 *
 *   "Search my Basecamp threads to determine which need a reply, and which
 *    haven't had anything posted in 14 days or longer."
 *
 * Both answers already exist — the Basecamp sync reads every thread's last
 * message and decides whether it needs a reply — so this reads those verdicts
 * rather than asking Claude again each morning. That keeps the run free and
 * means the routine and the Basecamp canary never disagree about a thread.
 *
 * The one real difference from the canary is the silence threshold: the canary
 * calls a thread stalled at 30 days, and this routine at whatever it was asked
 * for. Settings hold that number so it can change without code.
 */

export type BasecampReviewSettings = {
  /** Days a client may wait on us before a thread needs a reply. */
  replyAfterDays: number;
  /** Days with nothing posted before a thread counts as gone quiet. */
  quietAfterDays: number;
};

export const DEFAULT_BASECAMP_REVIEW: BasecampReviewSettings = {
  replyAfterDays: 3,
  quietAfterDays: 14,
};

export function readSettings(raw: Record<string, unknown>): BasecampReviewSettings {
  const number = (value: unknown, fallback: number) =>
    typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : fallback;
  return {
    replyAfterDays: number(raw.replyAfterDays, DEFAULT_BASECAMP_REVIEW.replyAfterDays),
    quietAfterDays: number(raw.quietAfterDays, DEFAULT_BASECAMP_REVIEW.quietAfterDays),
  };
}

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

function toFinding(group: string, finding: ThreadFinding, flagged = false): RoutineFinding {
  const reason = finding.reason ? ` · ${finding.reason}` : "";
  return {
    group,
    label: finding.title,
    meta: `${finding.clientName} · ${plural(finding.days, "day")}${reason}`,
    href: finding.url,
    flagged: flagged || finding.escalated === true,
  };
}

/**
 * Pure: the verdicts in, the morning's list out.
 *
 * "Gone quiet" is two different situations, named separately because they call
 * for different moves: we asked the client for something and heard nothing
 * (chase them), or nobody can tell what happens next (decide). A thread that
 * ended cleanly — a thank-you, an FYI — is not listed however long it has been
 * silent, because silence is the right outcome there.
 */
export function reviewThreads(
  issues: {
    awaitingUs: ThreadFinding[];
    awaitingThem: ThreadFinding[];
    stalled: ThreadFinding[];
    considered: number;
  },
  settings: BasecampReviewSettings,
): RoutineResult {
  const replyGroup = "Needs a reply from us";
  const chaseGroup = `Waiting on the client, ${settings.quietAfterDays}+ days`;
  const stuckGroup = `No next step, quiet ${settings.quietAfterDays}+ days`;

  // A thread waiting on us is listed once, as needing a reply — the more urgent
  // of the two things true about it.
  const key = (finding: ThreadFinding) => `${finding.projectId}|${finding.title}`;
  const waiting = new Set(issues.awaitingUs.map(key));
  const chase = issues.awaitingThem.filter(
    (finding) => finding.days >= settings.quietAfterDays && !waiting.has(key(finding)),
  );
  const chasing = new Set(chase.map(key));
  const stuck = issues.stalled.filter((finding) => !waiting.has(key(finding)) && !chasing.has(key(finding)));
  const quiet = [...chase, ...stuck];

  const findings = [
    ...issues.awaitingUs.map((finding) => toFinding(replyGroup, finding, finding.days >= 7)),
    ...chase.map((finding) => toFinding(chaseGroup, finding)),
    ...stuck.map((finding) => toFinding(stuckGroup, finding)),
  ];

  if (findings.length === 0) {
    return {
      status: "ok",
      headline: `Nothing needs a reply and no thread has gone quiet — ${plural(issues.considered, "client thread")} checked.`,
      findings: [],
    };
  }

  const parts = [
    issues.awaitingUs.length > 0
      ? `${plural(issues.awaitingUs.length, "thread")} ${issues.awaitingUs.length === 1 ? "needs" : "need"} a reply`
      : null,
    quiet.length > 0 ? `${quiet.length} gone quiet for ${settings.quietAfterDays}+ days` : null,
  ].filter(Boolean);
  return { status: "attention", headline: `${parts.join(", ")}.`, findings };
}

export async function runBasecampReview(
  supabase: SupabaseClient,
  rawSettings: Record<string, unknown>,
  now: Date,
): Promise<RoutineResult> {
  const settings = readSettings(rawSettings);
  const { rows, clientNames, ignoredProjectIds, error } = await loadThreadRows(supabase);
  if (error) throw new Error(`Could not read Basecamp threads: ${error}`);

  const issues = findThreadIssues(rows, clientNames, now, {
    awaitingDays: settings.replyAfterDays,
    // Chase-them threads are only listed once they pass the quiet threshold,
    // so the check should find them from the same point.
    chaseDays: settings.quietAfterDays,
    stalledDays: settings.quietAfterDays,
    ignoredProjectIds,
  });
  return reviewThreads(issues, settings);
}
