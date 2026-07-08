import type { LocalRankGridCellRow } from "@/lib/local-rank/types";
import { summarizeCompetitors, getPracticeStats } from "@/lib/local-rank/summary";

export type TipPriority = "high" | "medium" | "low";

export interface LocalRankTip {
  priority: TipPriority;
  text: string;
}

const PRIORITY_ORDER: Record<TipPriority, number> = { high: 0, medium: 1, low: 2 };

// Rules-based "how to outrank" tips derived from the scan: geographic coverage
// gaps, the strongest competitor (with review-count comparison), and how close
// the practice is to breaking into the top 3. Kept deterministic and free — an
// AI deep-dive can layer on top later.
export function buildLocalRankTips(
  cells: LocalRankGridCellRow[],
  keywords: string[],
  businessName: string,
  websiteUrl?: string | null,
): LocalRankTip[] {
  const tips: LocalRankTip[] = [];
  if (cells.length === 0 || keywords.length === 0) return tips;

  const total = cells.length;
  const notInPack = cells.filter((c) => c.rank == null).length;
  const amber = cells.filter((c) => c.rank != null && c.rank > 3).length;
  const greyPct = Math.round((notInPack / total) * 100);

  const practice = getPracticeStats(cells, businessName, websiteUrl);

  // Strongest competitor across all keywords (by number of areas they appear in).
  const byCompetitor = new Map<
    string,
    { title: string; areas: number; rating: number | null; reviewCount: number | null }
  >();
  for (const kw of keywords) {
    for (const c of summarizeCompetitors(cells, kw, businessName, websiteUrl)) {
      const key = (c.domain ?? c.title).toLowerCase();
      const existing = byCompetitor.get(key);
      if (existing) {
        existing.areas += c.areas;
        if ((c.reviewCount ?? 0) > (existing.reviewCount ?? 0)) {
          existing.reviewCount = c.reviewCount;
          existing.rating = c.rating;
        }
      } else {
        byCompetitor.set(key, { title: c.title, areas: c.areas, rating: c.rating, reviewCount: c.reviewCount });
      }
    }
  }
  const topCompetitor = [...byCompetitor.values()].sort((a, b) => b.areas - a.areas)[0] ?? null;

  // Coverage gaps → location/service-area pages.
  if (greyPct >= 40) {
    tips.push({
      priority: "high",
      text: `You're absent from the map pack across ${greyPct}% of the area. Build location/service-area pages for the outer neighborhoods and ask clients there to leave reviews that mention their town.`,
    });
  } else if (greyPct >= 15) {
    tips.push({
      priority: "medium",
      text: `Some outer zones (${greyPct}% of the area) show no ranking. A service-area page plus geo-specific reviews can extend your reach there.`,
    });
  }

  // Competitor review-count comparison (the most convincing lever).
  if (topCompetitor && topCompetitor.reviewCount != null && practice.reviewCount != null) {
    if (topCompetitor.reviewCount > practice.reviewCount * 1.2) {
      tips.push({
        priority: "high",
        text: `${topCompetitor.title} leads you across ${topCompetitor.areas} areas with ${topCompetitor.reviewCount.toLocaleString()} reviews${topCompetitor.rating != null ? ` (${topCompetitor.rating}★)` : ""} vs your ${practice.reviewCount.toLocaleString()}${practice.rating != null ? ` (${practice.rating}★)` : ""}. A consistent review-request routine is the fastest way to close that gap.`,
      });
    }
  } else if (topCompetitor) {
    tips.push({
      priority: "medium",
      text: `${topCompetitor.title} is your strongest local competitor (ahead in ${topCompetitor.areas} areas). Audit their GBP categories, photos and review volume, then match or beat them.`,
    });
  }

  // In the pack but below the top 3 → close, needs a prominence push.
  if (amber > 0 && amber >= notInPack) {
    tips.push({
      priority: "medium",
      text: `You show up in the pack but below the top 3 across much of the area — you're close. Fresh reviews and weekly GBP posts are usually what push borderline rankings into the top 3.`,
    });
  }

  // Always-useful baseline.
  tips.push({
    priority: "low",
    text: `Keep the Google Business Profile active: post weekly, add fresh photos, confirm hours/services/categories, and reply to every review — all feed local-pack prominence.`,
  });

  return tips.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);
}
