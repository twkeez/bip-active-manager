"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronDown, ChevronRight, FileSearch, Loader2, RefreshCw } from "lucide-react";
import type { SeoCrawlPageFact, SeoCrawlSnapshot, SeoSchemaGap } from "@/lib/types/client";

/**
 * Titles, meta descriptions and schema.org markup across a client's whole site.
 *
 * Reads what the crawler already stores rather than re-crawling to display —
 * a crawl is up to 250 page fetches, so it happens on demand and the result is
 * kept. Defaults to what's wrong or missing; the page-by-page detail is behind
 * the expander because a screen of correct titles is not a report.
 */

type Props = { clientId: number; website: string | null };

type CrawlResponse = {
  snapshot: SeoCrawlSnapshot | null;
  error?: string;
};

const TITLE_MAX = 60;
const META_MAX = 160;

/** What's wrong with one page, in the order a person would care. */
function pageFlags(page: SeoCrawlPageFact): Array<{ label: string; critical: boolean }> {
  const flags: Array<{ label: string; critical: boolean }> = [];
  if (page.status >= 400 || page.status === 0) {
    flags.push({ label: `HTTP ${page.status || "failed"}`, critical: true });
  }
  if (!page.title) flags.push({ label: "No title", critical: true });
  else if (page.title.length > TITLE_MAX) {
    flags.push({ label: `Title ${page.title.length}`, critical: false });
  }
  if (!page.metaDescription) flags.push({ label: "No meta", critical: false });
  else if (page.metaDescription.length > META_MAX) {
    flags.push({ label: `Meta ${page.metaDescription.length}`, critical: false });
  }
  if (page.schemaTypes.length === 0) flags.push({ label: "No schema", critical: false });
  if (page.noindex) flags.push({ label: "noindex", critical: true });
  if (!page.canonical) flags.push({ label: "No canonical", critical: false });
  return flags;
}

function whenRun(value: string | null | undefined): string {
  if (!value) return "Never run";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "Never run";
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (days <= 0) return "Crawled today";
  if (days === 1) return "Crawled yesterday";
  if (days < 60) return `Crawled ${days} days ago`;
  return `Crawled ${d.toLocaleDateString()}`;
}

function GapRow({ gap }: { gap: SeoSchemaGap }) {
  return (
    <li className="flex items-start gap-2">
      <span
        className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
          gap.severity === "critical" ? "bg-red-400" : "bg-amber-400"
        }`}
      />
      <span className="min-w-0">
        <span className="text-bip-text">{gap.label}</span>
        <span className="text-bip-muted">
          {gap.status === "missing"
            ? " — missing. "
            : gap.status === "mismatched"
              ? " — wrong type. "
              : " — incomplete. "}
          {gap.suggestion}
        </span>
        <span className="block text-[11px] text-bip-muted/80">{gap.why}</span>
      </span>
    </li>
  );
}

export default function ClientSiteContentCard({ clientId, website }: Props) {
  const [snapshot, setSnapshot] = useState<SeoCrawlSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [showClean, setShowClean] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/seo/crawl?clientId=${clientId}`, { cache: "no-store" });
      const payload = (await res.json()) as CrawlResponse;
      if (res.ok) setSnapshot(payload.snapshot);
    } catch {
      // A missing previous crawl is not an error worth showing.
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function runCrawl() {
    setRunning(true);
    setMessage(null);
    try {
      const res = await fetch("/api/seo/crawl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId }),
      });
      const payload = (await res.json()) as CrawlResponse;
      if (!res.ok) throw new Error(payload.error ?? "Crawl failed");
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Crawl failed");
    } finally {
      setRunning(false);
    }
  }

  const pages = snapshot?.pages ?? [];
  const gaps = snapshot?.schema_gaps ?? [];
  const flagged = pages.filter((p) => pageFlags(p).length > 0);
  const criticalCount = pages.filter((p) => pageFlags(p).some((f) => f.critical)).length;
  const visiblePages = showClean ? pages : flagged;

  return (
    <div className="rounded-xl border border-bip-border bg-bip-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <FileSearch className="mt-0.5 h-4 w-4 shrink-0 text-bip-accent" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-bip-text">On-page &amp; schema</p>
            <p className="mt-0.5 text-xs text-bip-muted">
              Title tags, meta descriptions and schema.org markup across the whole site.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-[11px] text-bip-muted">{whenRun(snapshot?.finished_at)}</span>
          {website ? (
            <button
              type="button"
              disabled={running}
              onClick={() => void runCrawl()}
              className="inline-flex items-center gap-1 rounded-md bg-bip-accent px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-60"
            >
              {running ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              {running ? "Crawling…" : snapshot ? "Re-crawl" : "Crawl site"}
            </button>
          ) : (
            <span className="text-[11px] text-bip-muted">No website on file</span>
          )}
        </div>
      </div>

      <div className="mt-3 border-t border-bip-border pt-3 text-xs text-bip-muted">
        {loading ? (
          <span className="inline-flex items-center gap-1.5">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
          </span>
        ) : !snapshot ? (
          <p>
            Not crawled yet. Fetches up to 250 pages and records what each one says. Large sites
            can take a few minutes.
          </p>
        ) : (
          <div className="space-y-3">
            {snapshot.stopped_because && snapshot.stopped_because !== "complete" && (
              <p className="rounded-md bg-amber-500/10 px-2 py-1 text-amber-300">
                Stopped at {pages.length} pages
                {snapshot.stopped_because === "time-limit"
                  ? " on the time budget"
                  : " on the page limit"}
                — this site is bigger than the crawl. Findings cover what was reached, not
                the whole site.
              </p>
            )}

            <p className="text-bip-text">
              {pages.length} page{pages.length === 1 ? "" : "s"} ·{" "}
              {flagged.length === 0 ? (
                <span className="text-emerald-400">nothing flagged</span>
              ) : (
                <>
                  <span className={criticalCount > 0 ? "text-red-400" : ""}>
                    {flagged.length} with issues
                  </span>
                  {criticalCount > 0 && <span className="text-red-400"> · {criticalCount} critical</span>}
                </>
              )}
            </p>

            {gaps.length > 0 ? (
              <div>
                <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-bip-muted">
                  Schema gaps
                </p>
                <ul className="space-y-1.5">
                  {gaps.map((gap) => (
                    <GapRow key={gap.key} gap={gap} />
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-emerald-400">
                Schema covers the practice, organization, website and breadcrumb markup we expect.
              </p>
            )}

            {pages.length > 0 && (
              <div>
                <button
                  type="button"
                  onClick={() => setExpanded((v) => !v)}
                  className="inline-flex items-center gap-1 text-xs text-bip-text hover:underline"
                >
                  {expanded ? (
                    <ChevronDown className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5" />
                  )}
                  {expanded ? "Hide pages" : `Show ${flagged.length || pages.length} page${(flagged.length || pages.length) === 1 ? "" : "s"}`}
                </button>

                {expanded && (
                  <>
                    {flagged.length > 0 && flagged.length < pages.length && (
                      <label className="mt-2 flex items-center gap-1.5 text-[11px] text-bip-muted">
                        <input
                          type="checkbox"
                          checked={showClean}
                          onChange={(e) => setShowClean(e.target.checked)}
                        />
                        Include the {pages.length - flagged.length} clean page
                        {pages.length - flagged.length === 1 ? "" : "s"}
                      </label>
                    )}
                    <div className="mt-2 overflow-x-auto">
                      <table className="w-full min-w-[640px] border-collapse text-left text-[11px]">
                        <thead>
                          <tr className="border-b border-bip-border text-bip-muted">
                            <th className="py-1.5 pr-3 font-medium">Page</th>
                            <th className="py-1.5 pr-3 font-medium">Title</th>
                            <th className="py-1.5 pr-3 font-medium">Meta description</th>
                            <th className="py-1.5 pr-3 font-medium">Schema</th>
                            <th className="py-1.5 font-medium">Flags</th>
                          </tr>
                        </thead>
                        <tbody>
                          {visiblePages.map((page) => {
                            const flags = pageFlags(page);
                            return (
                              <tr key={page.url} className="border-b border-bip-border/50 align-top">
                                <td className="max-w-[180px] truncate py-1.5 pr-3">
                                  <a
                                    href={page.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-bip-text hover:underline"
                                    title={page.url}
                                  >
                                    {page.url.replace(/^https?:\/\/[^/]+/, "") || "/"}
                                  </a>
                                </td>
                                <td className="max-w-[200px] py-1.5 pr-3">
                                  {page.title ? (
                                    <span className="text-bip-muted">{page.title}</span>
                                  ) : (
                                    <span className="text-red-400">—</span>
                                  )}
                                </td>
                                <td className="max-w-[240px] py-1.5 pr-3">
                                  {page.metaDescription ? (
                                    <span className="text-bip-muted">{page.metaDescription}</span>
                                  ) : (
                                    <span className="text-amber-400">—</span>
                                  )}
                                </td>
                                <td className="max-w-[140px] py-1.5 pr-3 text-bip-muted">
                                  {page.schemaTypes.length > 0 ? page.schemaTypes.join(", ") : "—"}
                                </td>
                                <td className="py-1.5">
                                  {flags.length === 0 ? (
                                    <span className="text-emerald-400">ok</span>
                                  ) : (
                                    <span className="flex flex-wrap gap-1">
                                      {flags.map((f) => (
                                        <span
                                          key={f.label}
                                          className={`rounded px-1 py-0.5 ${
                                            f.critical
                                              ? "bg-red-500/10 text-red-300"
                                              : "bg-amber-500/10 text-amber-300"
                                          }`}
                                        >
                                          {f.label}
                                        </span>
                                      ))}
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {message && <p className="mt-2 text-xs text-amber-300">{message}</p>}
    </div>
  );
}
