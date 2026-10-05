import type { ClientLifecycleStatus } from "@/lib/clients/client-status";
import type { BriefClient, BriefTier } from "@/lib/daily-brief/types";

/**
 * The order of the brief, as one pure function.
 *
 * Tom's rule (2026-10-05): onboarding clients first, then clients who are
 * chasing us, then clients with something to do, then clients with something to
 * watch, then everyone else. A client lands in the first tier that applies —
 * an onboarding client with a data drop is still an onboarding client.
 */

export type TierInput = {
  lifecycle: ClientLifecycleStatus;
  /** Basecamp threads the client is chasing or complaining in. */
  escalatedThreads: number;
  /** Findings at the "needs you" level. */
  needsYou: number;
  /** Findings at the "watch" level. */
  watch: number;
  /** Services we sell but cannot see data for. */
  blindSpots: number;
};

export function tierFor(input: TierInput): BriefTier {
  if (input.lifecycle !== "active") return 1;
  if (input.escalatedThreads > 0) return 2;
  if (input.needsYou > 0) return 3;
  if (input.watch > 0 || input.blindSpots > 0) return 4;
  return 5;
}

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

/**
 * Why a client is where it is, in the words a reader would use. Every tier-1
 * client also lists what else was found, because onboarding is the reason for
 * its position, not the only thing worth knowing.
 */
export function reasonsFor(input: TierInput): string[] {
  const reasons: string[] = [];
  if (input.lifecycle === "launch") reasons.push("Onboarding, waiting on the website to launch");
  else if (input.lifecycle === "onboarding") reasons.push("Onboarding");
  if (input.escalatedThreads > 0) {
    reasons.push(`${plural(input.escalatedThreads, "Basecamp thread")} where the client is chasing or complaining`);
  }
  if (input.needsYou > 0) reasons.push(`${plural(input.needsYou, "finding")} ${input.needsYou === 1 ? "needs" : "need"} action`);
  if (input.watch > 0) reasons.push(`${plural(input.watch, "item")} to watch`);
  if (input.blindSpots > 0) reasons.push(`${plural(input.blindSpots, "service")} we cannot see data for`);
  return reasons;
}

/**
 * Tier first. Inside a tier: more chasing threads, then more findings that need
 * action, then more things to watch, then name — so the order is the same every
 * time the same data is read.
 */
export function compareBriefClients(a: BriefClient, b: BriefClient): number {
  const count = (client: BriefClient) => ({
    escalated: client.escalatedThreads.length,
    needsYou: client.findings.filter((finding) => finding.level === "needs_you").length,
    watch: client.findings.filter((finding) => finding.level === "watch").length + client.blindSpots.length,
  });
  const x = count(a);
  const y = count(b);
  return (
    a.tier - b.tier ||
    y.escalated - x.escalated ||
    y.needsYou - x.needsYou ||
    y.watch - x.watch ||
    a.name.localeCompare(b.name, "en", { sensitivity: "base" })
  );
}

export function countByTier(clients: Array<Pick<BriefClient, "tier">>): Record<BriefTier, number> {
  const counts: Record<BriefTier, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const client of clients) counts[client.tier] += 1;
  return counts;
}
