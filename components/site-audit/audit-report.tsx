"use client";
import { useMemo, useState } from "react";
import AuditInspector from "@/components/site-audit/audit-inspector";
import {
  buildInspectorIssuesFromReport,
  estimatePassedChecks,
} from "@/lib/site-audit/inspector-issues";
import type { AuditReportJson, WebsiteAuditRun } from "@/lib/site-audit/types";
import { AUDIT_STAGES } from "@/lib/site-audit/types";
type Props = { run: WebsiteAuditRun };
const STAGE_LABELS: Record<(typeof AUDIT_STAGES)[number], string> = {
  discovery: "Discovery",
  sitemap: "Sitemap",
  crawl: "Crawl (20 pages)",
  schema: "Schema",
  technical_seo: "Technical SEO",
  lighthouse: "Lighthouse",
  keywords: "Keywords",
  summary: "AI Summary",
};
function ScoreCard({
  label,
  value,
}: {
  label: string;
  value: number | null | undefined;
}) {
  const display = value == null ? "—" : `${value}`;
  const tone =
    value == null
      ? "text-bip-muted"
      : value >= 90
        ? "text-emerald-600"
        : value >= 50
          ? "text-amber-600"
          : "text-red-600";
  return (
    <div className="rounded-lg border border-bip-border bg-bip-card p-3">
      
      <p className="text-[11px] uppercase tracking-wide text-bip-muted">
        {label}
      </p>
      <p className={`mt-1 text-2xl font-semibold ${tone}`}>{display}</p>
    </div>
  );
}
function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-bip-border bg-bip-card p-4 shadow-none">
      
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-bip-muted">
        {title}
      </h3>
      {children}
    </section>
  );
}
export default function AuditReport({ run }: Props) {
  const report = run.report_json as AuditReportJson;
  const [tab, setTab] = useState<
    | "overview"
    | "issues"
    | "structure"
    | "sitemap"
    | "schema"
    | "keywords"
    | "lighthouse"
  >("issues");
  const inspectorIssues = useMemo(
    () => buildInspectorIssuesFromReport(report),
    [report],
  );
  const passedChecks = useMemo(
    () => estimatePassedChecks(report.lighthouse),
    [report.lighthouse],
  );
  const tabs = [
    { id: "overview" as const, label: "Overview" },
    { id: "issues" as const, label: "Issue checklist" },
    { id: "structure" as const, label: "Structure" },
    { id: "sitemap" as const, label: "Sitemap" },
    { id: "schema" as const, label: "Schema" },
    { id: "keywords" as const, label: "Keywords" },
    { id: "lighthouse" as const, label: "Lighthouse" },
  ];
  const criticalCount =
    (report.crawl?.issues.filter((i) => i.severity === "critical").length ??
      0) +
    (report.technical_seo?.homepageIssues.filter(
      (i) => i.severity === "critical",
    ).length ?? 0);
  return (
    <div className="space-y-4">
      
      <div className="flex flex-wrap gap-1">
        
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`rounded-md px-2.5 py-1 text-xs font-medium ${tab === item.id ? "bg-bip-accent text-bip-page" : "bg-bip-fill text-white hover:bg-zinc-200"}`}
          >
            
            {item.label}
          </button>
        ))}
      </div>
      <div className="rounded-lg border border-bip-border bg-bip-page p-3">
        
        <p className="text-xs font-medium uppercase tracking-wide text-bip-muted">
          Stage progress
        </p>
        <ul className="mt-2 grid gap-1 sm:grid-cols-2">
          
          {AUDIT_STAGES.map((stage) => {
            const status = run.stage_status?.[stage]?.status ?? "pending";
            return (
              <li
                key={stage}
                className="flex items-center justify-between text-xs"
              >
                
                <span className="text-bip-text">
                  {STAGE_LABELS[stage]}
                </span>
                <span
                  className={
                    status === "done"
                      ? "text-emerald-600"
                      : status === "failed"
                        ? "text-red-600"
                        : status === "running"
                          ? "text-sky-600"
                          : "text-bip-muted"
                  }
                >
                  
                  {status}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
      {tab === "overview" ? (
        <div className="space-y-4">
          
          {report.lighthouse ? (
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              
              <ScoreCard
                label="Performance"
                value={report.lighthouse.scores.performance}
              />
              <ScoreCard label="SEO" value={report.lighthouse.scores.seo} />
              <ScoreCard
                label="Accessibility"
                value={report.lighthouse.scores.accessibility}
              />
              <ScoreCard
                label="Best practices"
                value={report.lighthouse.scores.bestPractices}
              />
            </div>
          ) : null}
          <div className="grid grid-cols-3 gap-2 text-center text-sm">
            
            <div className="rounded-lg border border-bip-border bg-bip-card p-3">
              
              <p className="text-2xl font-semibold text-red-600">
                {criticalCount}
              </p>
              <p className="text-xs text-bip-muted">Critical issues</p>
            </div>
            <div className="rounded-lg border border-bip-border bg-bip-card p-3">
              
              <p className="text-2xl font-semibold">
                {report.crawl?.crawledUrls ?? 0}
              </p>
              <p className="text-xs text-bip-muted">Pages crawled</p>
            </div>
            <div className="rounded-lg border border-bip-border bg-bip-card p-3">
              
              <p className="text-2xl font-semibold">
                {report.sitemap?.urlCount ?? 0}
              </p>
              <p className="text-xs text-bip-muted">Sitemap URLs</p>
            </div>
          </div>
          {report.summary ? (
            <Section title="Executive summary">
              
              <pre className="whitespace-pre-wrap font-sans text-sm text-bip-text">
                
                {report.summary.markdown}
              </pre>
            </Section>
          ) : (
            <p className="text-sm text-bip-muted">
              Run the summary stage for an AI executive overview.
            </p>
          )}
        </div>
      ) : null}
      {tab === "issues" ? (
        <div className="rounded-xl bg-bip-card p-6">
          
          {inspectorIssues.length === 0 ? (
            <p className="text-sm text-bip-muted">
              
              No issues collected yet. Run crawl, technical SEO, and Lighthouse
              stages to populate the checklist.
            </p>
          ) : (
            <AuditInspector
              issues={inspectorIssues}
              passedChecks={passedChecks}
            />
          )}
        </div>
      ) : null}
      {tab === "structure" && report.crawl ? (
        <Section title="Page inventory">
          
          <div className="overflow-x-auto">
            
            <table className="min-w-full text-left text-xs"><thead><tr className="border-b border-bip-border text-bip-muted"><th className="py-2 pr-3">URL</th><th className="py-2 pr-3">Depth</th><th className="py-2 pr-3">Status</th><th className="py-2 pr-3">Words</th><th className="py-2">Title</th></tr></thead><tbody>{report.crawl.pages.map((page) => (
                  <tr key={page.url} className="border-b border-zinc-100"><td className="max-w-xs truncate py-2 pr-3">
                      {page.url}
                    </td><td className="py-2 pr-3">{page.depth}</td><td className="py-2 pr-3">{page.status || "—"}</td><td className="py-2 pr-3">{page.wordCount}</td><td className="max-w-xs truncate py-2">
                      {page.title ?? "—"}
                    </td></tr>
                ))}
              </tbody></table>
          </div>
        </Section>
      ) : null}
      {tab === "sitemap" ? (
        <Section title="Sitemap">
          
          {report.sitemap ? (
            <div className="space-y-2 text-sm">
              
              <p>
                
                <span className="text-bip-muted">URL:</span>
                {report.sitemap.sitemapUrl}
              </p>
              <p>
                
                <span className="text-bip-muted">Found:</span>
                {""} {report.sitemap.found ? "Yes" : "No"}
                {report.sitemap.error ? ` (${report.sitemap.error})` : ""}
              </p>
              <p>
                
                <span className="text-bip-muted">URL count:</span>
                {report.sitemap.urlCount}
              </p>
              {report.sitemap.sampleUrls.length ? (
                <ul className="list-disc pl-5 text-xs text-bip-text">
                  
                  {report.sitemap.sampleUrls.map((url) => (
                    <li key={url} className="truncate">
                      
                      {url}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-bip-muted">Sitemap stage not run yet.</p>
          )}
        </Section>
      ) : null}
      {tab === "schema" && report.schema ? (
        <Section title="Structured data">
          
          <p className="mb-2 text-sm">
            
            Schema on {report.schema.pagesWithSchema} pages · Types:{""}
            {report.schema.allTypes.join(",") || "None"}
          </p>
          <ul className="mb-3 space-y-1 text-xs">
            
            {report.schema.recommendations.map((item) => (
              <li key={item} className="text-amber-700">
                
                {item}
              </li>
            ))}
          </ul>
          <ul className="space-y-1 text-xs text-bip-text">
            
            {report.schema.byPage.map((page) => (
              <li key={page.url}>
                
                <span className="font-medium">{page.url}</span>:
                {page.types.join(",")}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
      {tab === "keywords" && report.keywords ? (
        <Section title={report.keywords.label}>
          
          {report.keywords.source === "gsc" ? (
            <div className="space-y-4">
              
              {report.keywords.topQueries?.length ? (
                <div>
                  
                  <p className="mb-2 text-xs font-semibold uppercase text-bip-muted">
                    Top queries
                  </p>
                  <table className="min-w-full text-left text-xs"><thead><tr className="text-bip-muted"><th className="py-1 pr-2">Query</th><th className="py-1 pr-2">Clicks</th><th className="py-1 pr-2">Impr.</th><th className="py-1">Pos.</th></tr></thead><tbody>{report.keywords.topQueries.map((row) => (
                        <tr
                          key={row.query}
                          className="border-t border-zinc-100"
                        ><td className="py-1 pr-2">{row.query}</td><td className="py-1 pr-2">{row.clicks}</td><td className="py-1 pr-2">{row.impressions}</td><td className="py-1">
                            {row.position.toFixed(1)}
                          </td></tr>
                      ))}
                    </tbody></table>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="space-y-3">
              
              <ul className="space-y-2 text-sm">
                
                {report.keywords.aiKeywords?.map((row) => (
                  <li
                    key={row.keyword}
                    className="rounded border border-bip-border p-2"
                  >
                    
                    <p className="font-medium">{row.keyword}</p>
                    <p className="text-xs text-bip-muted">
                      
                      {row.alignment} · {row.evidence}
                    </p>
                  </li>
                ))}
              </ul>
              {report.keywords.gaps?.length ? (
                <div>
                  
                  <p className="mb-1 text-xs font-semibold uppercase text-bip-muted">
                    Gaps
                  </p>
                  <ul className="list-disc pl-5 text-xs text-bip-text">
                    
                    {report.keywords.gaps.map((gap) => (
                      <li key={gap}>{gap}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          )}
        </Section>
      ) : null}
      {tab === "lighthouse" && report.lighthouse ? (
        <Section title="Lighthouse (mobile)">
          
          <div className="mb-3 grid grid-cols-2 gap-2 text-xs md:grid-cols-5">
            
            <p>FCP: {report.lighthouse.metrics.fcp ?? "—"}</p>
            <p>LCP: {report.lighthouse.metrics.lcp ?? "—"}</p>
            <p>CLS: {report.lighthouse.metrics.cls ?? "—"}</p>
            <p>TBT: {report.lighthouse.metrics.tbt ?? "—"}</p>
            <p>SI: {report.lighthouse.metrics.speedIndex ?? "—"}</p>
          </div>
          <p className="text-xs text-bip-muted">
            
            Full categorized findings are in the Issue checklist tab.
          </p>
        </Section>
      ) : null}
    </div>
  );
}
