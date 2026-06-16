import * as cheerio from "cheerio";
import type { DiscoveryStageResult } from "@/lib/site-audit/types";
import { fetchTextWithTimeout, normalizeAuditUrl } from "@/lib/site-audit/shared";

function cleanText(value: string | null | undefined) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function parseRobotsSummary(text: string) {
  const lines = text.split(/\r?\n/);
  const sitemapHints: string[] = [];
  let allowsAll: boolean | null = null;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    if (/^sitemap:/i.test(trimmed)) {
      sitemapHints.push(trimmed.replace(/^sitemap:\s*/i, "").trim());
    }
    if (/^user-agent:\s*\*/i.test(trimmed)) {
      allowsAll = null;
    }
    if (/^disallow:\s*\/\s*$/i.test(trimmed)) {
      allowsAll = false;
    }
    if (/^allow:\s*\/\s*$/i.test(trimmed)) {
      allowsAll = true;
    }
  }
  const summary = allowsAll === false
    ? "robots.txt disallows all crawlers on /"
    : sitemapHints.length
      ? `Found ${sitemapHints.length} sitemap hint(s) in robots.txt`
      : "No blocking rules detected for User-agent: *";
  return { allowsAll, sitemapHints, summary };
}

export async function runDiscoveryStage(inputUrl: string): Promise<DiscoveryStageResult> {
  const normalizedUrl = normalizeAuditUrl(inputUrl);
  if (!normalizedUrl) throw new Error("A valid URL is required.");

  const { response, text } = await fetchTextWithTimeout(normalizedUrl);
  const finalUrl = response.url;
  const $ = cheerio.load(text);

  const origin = new URL(finalUrl).origin;
  let robotsTxt: DiscoveryStageResult["robotsTxt"] = {
    found: false,
    allowsAll: null,
    sitemapHints: [],
    summary: "robots.txt not found",
  };
  try {
    const robots = await fetchTextWithTimeout(`${origin}/robots.txt`, {
      accept: "text/plain,*/*",
    });
    if (robots.response.ok) {
      const parsed = parseRobotsSummary(robots.text);
      robotsTxt = {
        found: true,
        allowsAll: parsed.allowsAll,
        sitemapHints: parsed.sitemapHints,
        summary: parsed.summary,
      };
    }
  } catch {
    // robots optional
  }

  return {
    normalizedUrl,
    finalUrl,
    httpStatus: response.status,
    robotsTxt,
    homepage: {
      title: cleanText($("title").first().text()) || null,
      metaDescription: cleanText($('meta[name="description"]').attr("content")) || null,
      h1Count: $("h1").length,
      canonical: cleanText($('link[rel="canonical"]').attr("href")) || null,
    },
  };
}
