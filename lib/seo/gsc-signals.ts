import type { GscMetricRow } from "@/lib/seo/search-console";

export type GscSignalInput = {
  signal_id: string;
  severity: "critical" | "watch";
  title: string;
  description: string | null;
  suggestion: string | null;
  page_url: string | null;
  query: string | null;
  metric_value: string | null;
  occurrence_key: string;
};

function key(signalId: string, parts: Array<string | null | undefined>) {
  return `${signalId}::${parts.map((part) => (part ?? "").trim()).join("::")}`;
}

function pct(value: number) {
  return `${(value * 100).toFixed(2)}%`;
}

export function buildGscSignals(pageRows: GscMetricRow[], queryRows: GscMetricRow[]) {
  const signals: GscSignalInput[] = [];

  for (const row of pageRows) {
    if (row.impressions >= 1000 && row.ctr < 0.01) {
      signals.push({
        signal_id: "page-high-impressions-low-ctr",
        severity: "critical",
        title: "High-impression page has very low CTR",
        description: "A page has strong visibility but weak click-through performance.",
        suggestion: "Improve title and meta description to align with search intent.",
        page_url: row.key,
        query: null,
        metric_value: `impressions=${Math.round(row.impressions)}, ctr=${pct(row.ctr)}, pos=${row.position.toFixed(1)}`,
        occurrence_key: key("page-high-impressions-low-ctr", [row.key]),
      });
      continue;
    }
    if (row.impressions >= 300 && row.ctr < 0.02) {
      signals.push({
        signal_id: "page-medium-impressions-low-ctr",
        severity: "watch",
        title: "Page has low CTR for its impressions",
        description: "A page receives impressions but underperforms on clicks.",
        suggestion: "Test improved SERP snippets and confirm page relevance for target terms.",
        page_url: row.key,
        query: null,
        metric_value: `impressions=${Math.round(row.impressions)}, ctr=${pct(row.ctr)}, pos=${row.position.toFixed(1)}`,
        occurrence_key: key("page-medium-impressions-low-ctr", [row.key]),
      });
    }
  }

  for (const row of queryRows) {
    if (row.impressions >= 250 && row.position > 20) {
      signals.push({
        signal_id: "query-high-impressions-low-rank",
        severity: "watch",
        title: "Query has visibility but low ranking position",
        description: "The query appears often but average ranking is low.",
        suggestion: "Improve page relevance and internal linking for this query intent.",
        page_url: null,
        query: row.key,
        metric_value: `impressions=${Math.round(row.impressions)}, pos=${row.position.toFixed(1)}`,
        occurrence_key: key("query-high-impressions-low-rank", [row.key]),
      });
    }
  }

  return signals;
}
