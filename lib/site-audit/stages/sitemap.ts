import type { DiscoveryStageResult, SitemapStageResult } from "@/lib/site-audit/types";
import { collectSitemapEntries } from "@/lib/site-audit/sitemap";

export async function runSitemapStage(
  discovery: DiscoveryStageResult,
): Promise<SitemapStageResult> {
  const base = discovery.finalUrl.replace(/\/$/, "");
  const hinted = discovery.robotsTxt.sitemapHints[0];
  const sitemapUrl = hinted || `${new URL(base).origin}/sitemap.xml`;

  try {
    const entries = await collectSitemapEntries(sitemapUrl);
    return {
      sitemapUrl,
      found: true,
      urlCount: entries.length,
      sampleUrls: entries.slice(0, 15).map((entry) => entry.loc),
      error: null,
    };
  } catch (error) {
    return {
      sitemapUrl,
      found: false,
      urlCount: 0,
      sampleUrls: [],
      error: error instanceof Error ? error.message : "Sitemap fetch failed",
    };
  }
}
