"use client";

import Link from "next/link";
import { AlertTriangle, CheckCircle2, ExternalLink } from "lucide-react";
import {
  normalizeWebsiteUrl,
  resolveSiteContext,
  websiteUrlRequiredForSiteContext,
} from "@/lib/strategy-mapper/form-options";
import type {
  StrategyMapperFormData,
  StrategyMapperResearch,
  StrategyMapperStagingState,
  WebsiteSeoAuditIssue,
  WebsiteSeoAuditResult,
} from "@/types/strategy-mapper";

const inputClass =
  "w-full rounded-lg border border-bip-border bg-bip-page px-3 py-2.5 text-sm text-bip-text placeholder:text-bip-muted focus:border-bip-accent focus:outline-none focus:ring-2 focus:ring-bip-accent/30";

function IssueRow({ issue }: { issue: WebsiteSeoAuditIssue }) {
  const tone =
    issue.severity === "critical"
      ? "border-bip-danger/30 bg-bip-danger/10 text-bip-danger"
      : "border-amber-500/30 bg-amber-500/10 text-amber-300";

  return (
    <li className={`rounded-lg border px-3 py-2 text-sm ${tone}`}>
      <p className="font-medium">{issue.title}</p>
      <p className="mt-1 text-xs opacity-90">{issue.description}</p>
      {issue.recommendation ? (
        <p className="mt-1 text-xs text-bip-muted">{issue.recommendation}</p>
      ) : null}
      {issue.url ? (
        <p className="mt-1 truncate text-xs text-bip-muted">{issue.url}</p>
      ) : null}
    </li>
  );
}

export function websiteAuditRequired(staging: StrategyMapperStagingState): boolean {
  const url = normalizeWebsiteUrl(staging.form.websiteUrl ?? "");
  const siteContext = resolveSiteContext(staging.form);
  if (websiteUrlRequiredForSiteContext(siteContext)) return true;
  return Boolean(url);
}

export function canBuildReport(staging: StrategyMapperStagingState): boolean {
  if (!websiteAuditRequired(staging)) return true;
  return Boolean(staging.websiteAudit);
}

interface WebsiteAuditPanelProps {
  staging: StrategyMapperStagingState;
  onChange: (next: StrategyMapperStagingState) => void;
  onAudit: () => Promise<void>;
  auditing?: boolean;
  error?: string | null;
}

export default function WebsiteAuditPanel({
  staging,
  onChange,
  onAudit,
  auditing = false,
  error = null,
}: WebsiteAuditPanelProps) {
  const { form, websiteAudit } = staging;
  const siteContext = resolveSiteContext(form);
  const urlRequired = websiteUrlRequiredForSiteContext(siteContext);
  const audit = websiteAudit as WebsiteSeoAuditResult | undefined;

  function updateWebsiteUrl(value: string) {
    onChange({
      ...staging,
      form: { ...form, websiteUrl: value },
      websiteAudit: undefined,
    });
  }

  const modeBanner =
    audit?.auditMode === "fix_now"
      ? {
          title: "Fix on current site",
          body: "Critical findings should be remediated on the live property alongside Phase 1 SEO.",
          className: "border-bip-danger/30 bg-bip-danger/10",
        }
      : {
          title: "Baseline before launch",
          body: "Document current-state gaps now; on-site remediation defers to the launch window.",
          className: "border-bip-accent/30 bg-bip-accent/5",
        };

  return (
    <section className="rounded-xl border border-bip-border bg-bip-card p-5 sm:p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-bip-accent">
            Website SEO Audit
          </h2>
          <p className="mt-1 text-xs text-bip-muted">
            Crawl, Lighthouse, and keyword coverage vs the strategy matrix — run before
            building the report.
          </p>
        </div>
        <Link
          href="/site-audit"
          className="inline-flex items-center gap-1 text-xs text-bip-accent hover:underline"
        >
          Run deep audit
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </div>

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-bip-text">
          Current website URL
          {urlRequired ? <span className="text-bip-danger"> *</span> : null}
        </span>
        <input
          type="url"
          value={form.websiteUrl ?? ""}
          onChange={(e) => updateWebsiteUrl(e.target.value)}
          className={inputClass}
          placeholder="https://examplevet.com"
        />
        <p className="mt-1 text-xs text-bip-muted">
          {urlRequired
            ? "Required for active or replacement sites."
            : "Optional — leave blank to skip audit for ground-up launches."}
        </p>
      </label>

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => void onAudit()}
          disabled={auditing || (urlRequired && !normalizeWebsiteUrl(form.websiteUrl ?? ""))}
          className="inline-flex items-center gap-2 rounded-lg border border-bip-accent/40 bg-bip-accent/10 px-4 py-2.5 text-sm font-medium text-bip-accent transition hover:bg-bip-accent/20 disabled:opacity-60"
        >
          {auditing ? (
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-bip-accent border-t-transparent" />
          ) : null}
          Audit Website
        </button>
        {audit && !audit.skipped ? (
          <span className="inline-flex items-center gap-1.5 self-center text-xs text-emerald-400">
            <CheckCircle2 className="h-4 w-4" />
            Audit complete
          </span>
        ) : null}
        {audit?.skipped ? (
          <span className="inline-flex items-center gap-1.5 self-center text-xs text-bip-muted">
            Audit skipped (no URL)
          </span>
        ) : null}
      </div>

      {error ? (
        <p className="mt-3 rounded-lg border border-bip-danger/30 bg-bip-danger/10 px-3 py-2 text-sm text-bip-danger">
          {error}
        </p>
      ) : null}

      {audit && !audit.skipped ? (
        <div className="mt-5 space-y-5">
          <div className={`rounded-lg border px-4 py-3 text-sm ${modeBanner.className}`}>
            <p className="font-medium text-bip-text">{modeBanner.title}</p>
            <p className="mt-1 text-xs text-bip-muted">{modeBanner.body}</p>
            <p className="mt-2 truncate text-xs text-bip-muted">
              Audited: {audit.finalUrl || audit.url}
            </p>
          </div>

          {audit.redFlagSummary.length > 0 ? (
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-bip-muted">
                Red flags
              </h3>
              <ul className="space-y-1.5 text-sm text-bip-text">
                {audit.redFlagSummary.map((item) => (
                  <li key={item} className="flex gap-2">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-bip-muted">
                Homepage
              </h3>
              <dl className="space-y-1 text-xs text-bip-muted">
                <div>
                  <dt className="text-bip-muted">Title</dt>
                  <dd>{audit.homepage.title ?? "Missing"}</dd>
                </div>
                <div>
                  <dt className="text-bip-muted">Meta description</dt>
                  <dd>{audit.homepage.metaDescription ?? "Missing"}</dd>
                </div>
                <div>
                  <dt className="text-bip-muted">H1 count</dt>
                  <dd>{audit.homepage.h1Count}</dd>
                </div>
              </dl>
              {audit.homepage.issues.length > 0 ? (
                <ul className="mt-3 space-y-2">
                  {audit.homepage.issues.map((issue) => (
                    <IssueRow key={issue.id} issue={issue} />
                  ))}
                </ul>
              ) : null}
            </div>

            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-bip-muted">
                Crawl ({audit.crawl.pagesScanned} pages, {audit.crawl.issueCount} issues)
              </h3>
              {audit.crawl.topIssues.length > 0 ? (
                <ul className="space-y-2">
                  {audit.crawl.topIssues.slice(0, 6).map((issue) => (
                    <IssueRow key={`${issue.id}-${issue.url ?? ""}`} issue={issue} />
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-bip-muted">No crawl issues detected.</p>
              )}
              {audit.lighthouse ? (
                <p className="mt-3 text-xs text-bip-muted">
                  Lighthouse SEO score: {audit.lighthouse.scores.seo ?? "N/A"}
                </p>
              ) : (
                <p className="mt-3 text-xs text-bip-muted">
                  Lighthouse unavailable — homepage and crawl findings only.
                </p>
              )}
            </div>
          </div>

          {audit.keywordAlignment.matrixRows.length > 0 ? (
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-bip-muted">
                Keyword coverage (not literal density)
              </h3>
              <div className="overflow-x-auto rounded-lg border border-bip-border">
                <table className="min-w-full text-left text-xs">
                  <thead className="bg-bip-page/60 text-bip-muted">
                    <tr>
                      <th className="px-3 py-2 font-medium">Target keyword</th>
                      <th className="px-3 py-2 font-medium">Found on</th>
                    </tr>
                  </thead>
                  <tbody>
                    {audit.keywordAlignment.coverage.map((row) => (
                      <tr key={row.keyword} className="border-t border-bip-border">
                        <td className="px-3 py-2 text-bip-text">{row.keyword}</td>
                        <td className="px-3 py-2 text-bip-muted">
                          {row.foundIn.length ? row.foundIn.join(", ") : "Not found"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {audit.keywordAlignment.aiSummary ? (
                <p className="mt-2 text-xs text-bip-muted">{audit.keywordAlignment.aiSummary}</p>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}