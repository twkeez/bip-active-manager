import * as cheerio from "cheerio";
import type { SalesSeoFindings } from "@/lib/types/client";

function normalizeTargetUrl(raw: string) {
  const value = raw.trim();
  if (!value) return "";
  if (value.includes("://")) return value;
  return `https://${value}`;
}

function text(value: string | null | undefined) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

async function fetchHtmlWithTimeout(url: string, timeoutMs = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      cache: "no-store",
      headers: {
        "User-Agent": "BIPSalesLabBot/1.0 (+prospect-audit)",
      },
    });
    if (!response.ok) {
      throw new Error(`Prospect page request failed (${response.status}).`);
    }
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) {
      throw new Error("Prospect URL did not return HTML content.");
    }
    return { finalUrl: response.url, html: await response.text() };
  } finally {
    clearTimeout(timer);
  }
}

export async function runSalesSeoAudit(rawUrl: string): Promise<SalesSeoFindings> {
  const normalized = normalizeTargetUrl(rawUrl);
  if (!normalized) {
    throw new Error("A valid URL is required.");
  }
  const { finalUrl, html } = await fetchHtmlWithTimeout(normalized);
  const $ = cheerio.load(html);

  const title = text($("title").first().text()) || null;
  const metaDescription = text($('meta[name="description"]').attr("content")) || null;
  const h1Count = $("h1").length;
  const canonical = text($('link[rel="canonical"]').attr("href")) || null;
  const robotsMeta = text($('meta[name="robots"]').attr("content")) || null;
  const jsonLdNodes = $('script[type="application/ld+json"]').toArray();
  const schemaTypes = new Set<string>();
  for (const node of jsonLdNodes) {
    const raw = text($(node).html());
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw) as
        | Record<string, unknown>
        | Array<Record<string, unknown>>;
      const arr = Array.isArray(parsed) ? parsed : [parsed];
      for (const item of arr) {
        const type = item["@type"];
        if (typeof type === "string" && type.trim()) schemaTypes.add(type.trim());
      }
    } catch {
      // Ignore invalid JSON-LD entries.
    }
  }

  const hasSitemapHint =
    $('link[rel="sitemap"]').length > 0 ||
    /\bsitemap\b/i.test(html);
  const hasRobotsHint =
    /\brobots\.txt\b/i.test(html) || /\bnoindex\b/i.test(robotsMeta ?? "");

  const issues: SalesSeoFindings["issues"] = [];
  const pushIssue = (
    id: string,
    severity: "critical" | "watch",
    titleValue: string,
    description: string,
    recommendation: string,
  ) => {
    issues.push({
      id,
      severity,
      title: titleValue,
      description,
      recommendation,
    });
  };

  if (!title) {
    pushIssue(
      "missing-title",
      "critical",
      "Missing title tag",
      "This page has no <title>, which weakens search relevance and click-through rates.",
      "Add a unique title tag with service and location intent.",
    );
  } else if (title.length > 60) {
    pushIssue(
      "long-title",
      "watch",
      "Title tag too long",
      `Current title is ${title.length} characters and may truncate in search results.`,
      "Keep title tags close to 50-60 characters while preserving intent.",
    );
  }

  if (!metaDescription) {
    pushIssue(
      "missing-meta-description",
      "watch",
      "Missing meta description",
      "No meta description was found, limiting control over SERP snippet messaging.",
      "Add a concise, service-oriented description (120-160 chars).",
    );
  } else if (metaDescription.length > 160) {
    pushIssue(
      "long-meta-description",
      "watch",
      "Meta description too long",
      `Current meta description is ${metaDescription.length} characters.`,
      "Shorten to a clear value proposition with a CTA in 120-160 characters.",
    );
  }

  if (h1Count === 0) {
    pushIssue(
      "missing-h1",
      "critical",
      "Missing H1",
      "No H1 heading was detected, which can reduce topical clarity for crawlers and users.",
      "Add one clear H1 aligned to the primary service intent.",
    );
  } else if (h1Count > 1) {
    pushIssue(
      "multiple-h1",
      "watch",
      "Multiple H1 headings",
      `Detected ${h1Count} H1 headings, which can dilute page hierarchy.`,
      "Keep one H1 and move supporting headings to H2/H3.",
    );
  }

  if (!canonical) {
    pushIssue(
      "missing-canonical",
      "watch",
      "Missing canonical tag",
      "Canonical URL is not declared, which can introduce duplicate-indexation ambiguity.",
      "Add a canonical tag to the preferred final URL.",
    );
  }

  if ((robotsMeta ?? "").toLowerCase().includes("noindex")) {
    pushIssue(
      "noindex-meta",
      "critical",
      "Noindex directive found",
      "The page contains a noindex robots directive.",
      "Remove noindex if this prospect page should rank in search.",
    );
  }

  if (schemaTypes.size === 0) {
    pushIssue(
      "missing-structured-data",
      "watch",
      "Structured data not detected",
      "No parseable JSON-LD schema types were found.",
      "Add Organization/LocalBusiness/Service schema to strengthen rich-result eligibility.",
    );
  }

  return {
    normalized_url: finalUrl,
    title,
    title_length: title?.length ?? 0,
    meta_description: metaDescription,
    meta_description_length: metaDescription?.length ?? 0,
    h1_count: h1Count,
    canonical,
    robots_meta: robotsMeta,
    has_json_ld_schema: schemaTypes.size > 0,
    schema_types: [...schemaTypes],
    has_sitemap_hint: hasSitemapHint,
    has_robots_txt_hint: hasRobotsHint,
    issues,
  };
}
