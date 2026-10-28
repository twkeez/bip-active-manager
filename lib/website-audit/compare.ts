import type { AuditResults } from "@/lib/website-audit/types";

// "Today vs. last run": the numbers the report compares between two runs of the
// same domain. Each metric is read straight from the saved results, so a change
// in the report traces back to the same field in both JSON documents.

export type Metric = {
  key: string;
  label: string;
  value: number | null;
  /** How to print it. */
  format: "number" | "rating" | "percent" | "points";
  /** Which way is an improvement; null when neither is (e.g. URL count). */
  higherIsBetter: boolean | null;
};

export type MetricComparison = Metric & { last: number | null; change: "better" | "worse" | "same" | "new" | null };

/** Named in the answer or cited as a source, across every answered prompt on every platform. */
export function aiAnswersWithPractice(results: AuditResults): { hits: number; answered: number } | null {
  const runs = results.aiVisibility?.runs;
  if (!runs) return null;
  const answered = runs.filter((r) => r.answered);
  return { hits: answered.filter((r) => r.mentioned || r.cited).length, answered: answered.length };
}

export function headlineMetrics(results: AuditResults): Metric[] {
  const ai = aiAnswersWithPractice(results);
  const g = results.authority?.google;
  return [
    { key: "score", label: "Citability score", value: results.score?.total ?? null, format: "points", higherIsBetter: true },
    { key: "aiShare", label: "AI answers naming or citing the practice", value: ai && ai.answered ? ai.hits / ai.answered : null, format: "percent", higherIsBetter: true },
    { key: "rating", label: "Google rating", value: g?.rating ?? null, format: "rating", higherIsBetter: true },
    { key: "reviews", label: "Google reviews", value: g?.reviewCount ?? null, format: "number", higherIsBetter: true },
  ];
}

export function scoreMetrics(results: AuditResults): Metric[] {
  return (results.score?.subScores ?? []).map((s) => ({ key: `score.${s.key}`, label: `${s.label} (of ${s.weight})`, value: s.points, format: "points", higherIsBetter: true }));
}

export function platformMetrics(results: AuditResults): Metric[] {
  return (results.aiVisibility?.platforms ?? []).flatMap((p) => [
    { key: `ai.${p.platform}.cited`, label: `${p.label}: prompts citing the site`, value: p.promptsCited, format: "number", higherIsBetter: true },
    { key: `ai.${p.platform}.named`, label: `${p.label}: prompts naming the practice`, value: p.promptsMentioned, format: "number", higherIsBetter: true },
  ]);
}

export function technicalMetrics(results: AuditResults): Metric[] {
  const t = results.technical;
  if (!t) return [];
  const s = t.summary;
  const m = (key: string, label: string, value: number, higherIsBetter: boolean | null): Metric => ({ key: `tech.${key}`, label, value, format: "number", higherIsBetter });
  return [
    m("totalUrls", "URLs in the sitemap", s.totalUrls, null),
    m("hosts", "Host names in the sitemap (www and bare)", Object.keys(s.byHost).length, false),
    m("uniquePages", "Distinct pages", s.uniquePages, null),
    m("archives", "Tag, category and author archive pages", s.tagPages + s.categoryPages + s.authorPages, false),
    m("missingCanonical", "Pages with no canonical tag", s.missingCanonical, false),
    m("withSchema", "Pages with structured data", s.withSchema, true),
    m("noH1", "Pages with no H1", s.noH1, false),
    m("multipleH1", "Pages with more than one H1", s.multipleH1, false),
    m("loops", "Redirect loops (incl. trailing-slash variants)", s.redirectLoops.length + s.slashVariants.loops.length, false),
    m("errors", "Server errors, error pages and 404s", s.serverErrors.length + s.softErrors.length + s.notFound.length, false),
    m("insecure", "Redirects to insecure http", s.insecureRedirects.length + s.slashVariants.insecure.length, false),
    m("missingMeta", "Pages with no meta description", s.missingMetaDescription, false),
    m("thin", "Content pages under 300 words", s.thinPages, false),
    m("notInSitemap", "Linked pages missing from the sitemap", (t.notInSitemap ?? []).filter((g) => g.finalStatus === 200 && !g.softError).length, false),
    m("helloWorld", "Sample \"Hello world\" post in the sitemap (1 = yes)", s.helloWorldInSitemap ? 1 : 0, false),
    m("llmsTxt", "llms.txt present (1 = yes)", Object.values(t.llmsTxt).some(Boolean) ? 1 : 0, true),
  ];
}

/** Pairs today's metrics with the same keys from the last run (null when there was none). */
export function compareMetrics(today: Metric[], last: Metric[] | null): MetricComparison[] {
  const lastByKey = new Map((last ?? []).map((m) => [m.key, m.value]));
  return today.map((m) => {
    if (!last) return { ...m, last: null, change: null };
    const was = lastByKey.get(m.key) ?? null;
    if (m.value == null || was == null) return { ...m, last: was, change: was == null && m.value != null ? "new" : null };
    if (Math.abs(m.value - was) < 1e-9) return { ...m, last: was, change: "same" };
    if (m.higherIsBetter == null) return { ...m, last: was, change: null };
    return { ...m, last: was, change: m.value > was === m.higherIsBetter ? "better" : "worse" };
  });
}

export function formatMetric(value: number | null, format: Metric["format"]): string {
  if (value == null) return "—";
  if (format === "percent") return `${Math.round(value * 100)}%`;
  if (format === "rating") return `${value.toFixed(1)}★`;
  if (format === "points") return String(Math.round(value * 10) / 10);
  return value.toLocaleString("en-US");
}
