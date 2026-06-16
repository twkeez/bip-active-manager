import type { CrawlStageResult, SchemaStageResult } from "@/lib/site-audit/types";

const RECOMMENDED_TYPES = [
  "LocalBusiness",
  "VeterinaryCare",
  "MedicalBusiness",
  "Organization",
  "WebSite",
  "FAQPage",
];

export function runSchemaStage(crawl: CrawlStageResult): SchemaStageResult {
  const byPage = crawl.pages
    .filter((page) => page.schemaTypes.length > 0)
    .map((page) => ({ url: page.url, types: page.schemaTypes }));

  const allTypes = [...new Set(crawl.pages.flatMap((page) => page.schemaTypes))];
  const recommendations: string[] = [];

  if (allTypes.length === 0) {
    recommendations.push(
      "No JSON-LD schema detected on crawled pages. Add LocalBusiness or VeterinaryCare schema on the homepage.",
    );
  }
  if (!allTypes.some((type) => /localbusiness|veterinary|medicalbusiness|organization/i.test(type))) {
    recommendations.push(
      "Consider adding LocalBusiness or VeterinaryCare structured data with NAP, hours, and services.",
    );
  }
  if (!allTypes.includes("WebSite") && crawl.pages.some((page) => page.depth === 0)) {
    recommendations.push("Add WebSite schema with SearchAction if site search is available.");
  }
  for (const recommended of RECOMMENDED_TYPES) {
    if (!allTypes.includes(recommended) && recommended !== "WebSite") {
      continue;
    }
  }
  if (byPage.length < crawl.pages.length / 2) {
    recommendations.push(
      `Schema found on ${byPage.length}/${crawl.pages.length} crawled pages. Extend schema to key service and location pages.`,
    );
  }

  return {
    pagesWithSchema: byPage.length,
    allTypes,
    byPage,
    recommendations: [...new Set(recommendations)],
  };
}
