import type { GridKeywordSummary, LocalRankGridCellRow } from "@/lib/local-rank/types";
import { listingMatchesPractice } from "@/lib/local-rank/match";

export interface CompetitorSummary {
  title: string;
  domain: string | null;
  areas: number; // number of grid points where this competitor appears
  rating: number | null;
  reviewCount: number | null;
}

// The practice's own rating / review count, read from any pack listing where it
// was matched. Null when the practice never appears in the scanned packs.
export function getPracticeStats(
  cells: LocalRankGridCellRow[],
  businessName: string,
  websiteUrl?: string | null,
): { rating: number | null; reviewCount: number | null } {
  for (const cell of cells) {
    for (const listing of cell.pack_listings ?? []) {
      if (listingMatchesPractice({ businessName, websiteUrl, listing })) {
        if (listing.reviewCount != null || listing.rating != null) {
          return { rating: listing.rating, reviewCount: listing.reviewCount };
        }
      }
    }
  }
  return { rating: null, reviewCount: null };
}

// Tallies the competitors that show up in the local pack across a keyword's
// grid, excluding the practice itself, ranked by how many of the areas they
// appear in. Uses pack_listings (full pack) captured per cell.
export function summarizeCompetitors(
  cells: LocalRankGridCellRow[],
  keyword: string,
  businessName: string,
  websiteUrl?: string | null,
): CompetitorSummary[] {
  const counts = new Map<string, CompetitorSummary>();
  for (const cell of cells) {
    if (cell.keyword !== keyword) continue;
    for (const listing of cell.pack_listings ?? []) {
      if (listingMatchesPractice({ businessName, websiteUrl, listing })) continue;
      const key = (listing.domain ?? listing.title).trim().toLowerCase();
      if (!key) continue;
      const existing = counts.get(key);
      if (existing) {
        existing.areas += 1;
        // Keep the highest review count / rating seen for this competitor.
        if ((listing.reviewCount ?? 0) > (existing.reviewCount ?? 0)) {
          existing.reviewCount = listing.reviewCount;
          existing.rating = listing.rating;
        }
      } else {
        counts.set(key, {
          title: listing.title,
          domain: listing.domain,
          areas: 1,
          rating: listing.rating,
          reviewCount: listing.reviewCount,
        });
      }
    }
  }
  return [...counts.values()].sort((a, b) => b.areas - a.areas);
}

export function summarizeKeywordGrid(
  keyword: string,
  cells: LocalRankGridCellRow[],
): GridKeywordSummary {
  const keywordCells = cells.filter((cell) => cell.keyword === keyword);
  const ranked = keywordCells.filter((cell) => cell.rank != null);
  const avgRank =
    ranked.length > 0
      ? ranked.reduce((sum, cell) => sum + (cell.rank ?? 0), 0) / ranked.length
      : null;
  const topThree = keywordCells.filter((cell) => cell.rank != null && cell.rank <= 3);
  const inPack = keywordCells.filter((cell) => cell.in_local_pack);

  const byRank = [...keywordCells].sort((left, right) => {
    const leftRank = left.rank ?? 999;
    const rightRank = right.rank ?? 999;
    return leftRank - rightRank;
  });

  return {
    keyword,
    avgRank: avgRank != null ? Math.round(avgRank * 10) / 10 : null,
    topThreePct:
      keywordCells.length > 0
        ? Math.round((topThree.length / keywordCells.length) * 100)
        : 0,
    cellsInPack: inPack.length,
    bestCell: byRank[0] ? byRank[0].label : null,
    worstCell: byRank[byRank.length - 1]?.rank == null
      ? byRank[byRank.length - 1]?.label ?? null
      : byRank[byRank.length - 1]?.label ?? null,
  };
}

export function rankHeatClass(rank: number | null): string {
  if (rank == null) return "bg-zinc-700/80 text-white/50";
  if (rank <= 3) return "bg-emerald-600/80 text-white";
  if (rank <= 10) return "bg-amber-500/80 text-bip-page";
  return "bg-red-500/70 text-white";
}
