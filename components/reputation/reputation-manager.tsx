"use client";

import Link from "next/link";
import { Fragment, useCallback, useEffect, useState } from "react";
import { ArrowLeft, Loader2, MessageSquareQuote, RefreshCw, Sparkles, Star } from "lucide-react";
import AppHeaderActions, { ModuleHeaderLinks } from "@/components/layout/app-header-actions";

type ClientOption = { id: number; name: string };

type Snapshot = {
  title: string | null;
  rating: number | null;
  votes_count: number | null;
  rating_distribution: Record<string, number>;
  place_topics: Record<string, number>;
  city: string | null;
  region: string | null;
  fetched_at: string;
};

type Report = {
  report_markdown: string;
  generated_at: string;
  model: string | null;
  review_count: number;
};

type StatePayload = {
  error?: string;
  snapshot?: Snapshot | null;
  report?: Report | null;
  reviewCount?: number;
};

// The report uses a small, known subset of Markdown — headings, a table,
// numbered items and bold runs. Rendering it here avoids pulling in a full
// Markdown dependency for one page.
function renderInline(text: string, keyPrefix: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, index) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={`${keyPrefix}-${index}`} className="font-semibold text-bip-text">
        {part.slice(2, -2)}
      </strong>
    ) : (
      <Fragment key={`${keyPrefix}-${index}`}>{part}</Fragment>
    ),
  );
}

function ReportBody({ markdown }: { markdown: string }) {
  const lines = markdown.split("\n");
  const nodes: React.ReactNode[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];

    if (!line.trim()) {
      index += 1;
      continue;
    }

    if (line.startsWith("## ")) {
      nodes.push(
        <h2 key={index} className="mt-6 mb-3 text-base font-semibold text-bip-text first:mt-0">
          {line.slice(3)}
        </h2>,
      );
      index += 1;
      continue;
    }

    // Markdown table: header row, separator, then body rows.
    if (line.trim().startsWith("|") && lines[index + 1]?.includes("---")) {
      const toCells = (row: string) =>
        row.trim().replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim());
      const headers = toCells(line);
      const rows: string[][] = [];
      let cursor = index + 2;
      while (cursor < lines.length && lines[cursor].trim().startsWith("|")) {
        rows.push(toCells(lines[cursor]));
        cursor += 1;
      }
      nodes.push(
        <div key={index} className="my-4 overflow-x-auto rounded-lg border border-bip-border">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-bip-border bg-bip-page text-xs uppercase tracking-wide text-bip-muted">
                {headers.map((header, i) => (
                  <th key={i} className="px-4 py-2 font-semibold">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className="border-b border-bip-border last:border-0 align-top">
                  {row.map((cell, j) => (
                    <td key={j} className="px-4 py-2 text-bip-text">
                      {renderInline(cell, `t-${i}-${j}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      index = cursor;
      continue;
    }

    const numbered = line.match(/^(\d+)\.\s+(.*)$/);
    if (numbered) {
      nodes.push(
        <p key={index} className="mb-3 pl-6 -indent-6 text-sm leading-relaxed text-bip-text">
          <span className="font-semibold">{numbered[1]}. </span>
          {renderInline(numbered[2], `n-${index}`)}
        </p>,
      );
      index += 1;
      continue;
    }

    nodes.push(
      <p key={index} className="mb-3 text-sm leading-relaxed text-bip-text">
        {renderInline(line, `p-${index}`)}
      </p>,
    );
    index += 1;
  }

  return <div>{nodes}</div>;
}

function Distribution({ dist, total }: { dist: Record<string, number>; total: number }) {
  return (
    <div className="space-y-1">
      {[5, 4, 3, 2, 1].map((star) => {
        const count = dist[String(star)] ?? 0;
        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
        return (
          <div key={star} className="flex items-center gap-2 text-xs text-bip-muted">
            <span className="w-3 text-right">{star}</span>
            <Star className="h-3 w-3 shrink-0 text-amber-400" aria-hidden />
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-bip-page">
              <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
            </div>
            <span className="w-8 text-right tabular-nums">{count}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function ReputationManager({
  userEmail,
  clients,
  initialClientId,
}: {
  userEmail?: string;
  clients: ClientOption[];
  initialClientId: number | null;
}) {
  const [clientId, setClientId] = useState<number | null>(initialClientId);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [reviewCount, setReviewCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<null | "reviews" | "report">(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadState = useCallback(async (id: number) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/reputation/${id}`, { cache: "no-store" });
      const payload = (await response.json()) as StatePayload;
      if (!response.ok) throw new Error(payload.error ?? "Could not load reputation data.");
      setSnapshot(payload.snapshot ?? null);
      setReport(payload.report ?? null);
      setReviewCount(payload.reviewCount ?? 0);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (clientId != null) void loadState(clientId);
  }, [clientId, loadState]);

  const post = useCallback(
    async (id: number, body: Record<string, unknown>) => {
      const response = await fetch(`/api/reputation/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Request failed.");
      return payload;
    },
    [],
  );

  // Reviews arrive through a queued DataForSEO task, so this posts the job then
  // polls it — typically ready in about a minute.
  const fetchReviews = useCallback(async () => {
    if (clientId == null || busy) return;
    setBusy("reviews");
    setError(null);
    setStatus("Fetching profile and queueing the review pull…");
    try {
      const refreshed = await post(clientId, { action: "refresh" });
      setSnapshot((current) => ({ ...(current ?? ({} as Snapshot)), ...refreshed.snapshot }));
      setStatus("Google is assembling the reviews — usually about a minute…");

      for (let attempt = 0; attempt < 40; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 8000));
        const collected = await post(clientId, {
          action: "collect",
          taskId: refreshed.taskId,
        });
        if (!collected.pending) {
          setStatus(`Stored ${collected.stored} reviews (${collected.withText} with text).`);
          await loadState(clientId);
          return;
        }
        setStatus(`Still assembling — ${(attempt + 1) * 8}s elapsed…`);
      }
      setStatus(null);
      setError("Google did not return reviews in time. Try again in a few minutes.");
    } catch (actionError) {
      setStatus(null);
      setError(actionError instanceof Error ? actionError.message : "Review fetch failed.");
    } finally {
      setBusy(null);
    }
  }, [clientId, busy, post, loadState]);

  const buildReport = useCallback(async () => {
    if (clientId == null || busy) return;
    setBusy("report");
    setError(null);
    setStatus("Reading the reviews and writing the analysis — this takes a minute…");
    try {
      const result = await post(clientId, { action: "report" });
      setReport(result.report);
      setStatus(null);
    } catch (actionError) {
      setStatus(null);
      setError(actionError instanceof Error ? actionError.message : "Report generation failed.");
    } finally {
      setBusy(null);
    }
  }, [clientId, busy, post]);

  const topics = Object.entries(snapshot?.place_topics ?? {}).sort((a, b) => b[1] - a[1]);

  return (
    <div className="flex min-h-screen flex-col bg-bip-page">
      <header className="flex shrink-0 items-center justify-between border-b border-bip-border bg-bip-card px-6 py-4">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-bip-border bg-bip-card text-bip-text transition hover:bg-bip-page"
            title="Control panel"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
          </Link>
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 text-white">
            <MessageSquareQuote className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-bip-text">Reputation</h1>
            <p className="text-xs text-bip-muted">
              What Google reviews say about a practice · {userEmail ?? "Signed in"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ModuleHeaderLinks />
          <AppHeaderActions />
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-6">
        <div className="mb-5 flex flex-wrap items-end gap-3">
          <label className="flex-1 min-w-64">
            <span className="mb-1 block text-xs uppercase tracking-wide text-bip-muted">
              Client
            </span>
            <select
              value={clientId ?? ""}
              onChange={(event) => setClientId(Number(event.target.value))}
              className="w-full rounded-lg border border-bip-border bg-bip-card px-3 py-2 text-sm text-bip-text focus:outline-none focus:ring-1 focus:ring-bip-accent"
            >
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => void fetchReviews()}
            disabled={busy !== null || clientId == null}
            className="inline-flex items-center gap-2 rounded-lg border border-bip-border bg-bip-card px-4 py-2 text-sm font-medium text-bip-text transition hover:bg-bip-page disabled:opacity-50"
          >
            {busy === "reviews" ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <RefreshCw className="h-4 w-4" aria-hidden />
            )}
            {reviewCount > 0 ? "Refresh reviews" : "Fetch reviews"}
          </button>
          <button
            type="button"
            onClick={() => void buildReport()}
            disabled={busy !== null || reviewCount === 0}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-500 disabled:opacity-50"
          >
            {busy === "report" ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Sparkles className="h-4 w-4" aria-hidden />
            )}
            {report ? "Regenerate report" : "Generate report"}
          </button>
        </div>

        <p className="mb-5 text-xs text-bip-muted">
          {clients.length} clients have a Google Place ID. Fetching reviews costs about 3¢ and
          takes a minute; the report is written from the stored reviews, so you can regenerate it
          without paying for the data again.
        </p>

        {status && (
          <p className="mb-4 rounded-lg border border-bip-border bg-bip-card px-4 py-3 text-sm text-bip-text">
            {status}
          </p>
        )}
        {error && (
          <p className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </p>
        )}

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-bip-muted">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading…
          </div>
        ) : (
          <>
            {snapshot && (
              <div className="mb-5 grid gap-4 rounded-xl border border-bip-border bg-bip-card p-5 sm:grid-cols-[auto_1fr]">
                <div className="sm:w-56">
                  <p className="text-3xl font-semibold text-bip-text">
                    {snapshot.rating ?? "—"}
                    <span className="ml-1 text-base font-normal text-bip-muted">/ 5</span>
                  </p>
                  <p className="mb-3 text-xs text-bip-muted">
                    {snapshot.votes_count ?? 0} reviews
                    {snapshot.city ? ` · ${snapshot.city}, ${snapshot.region ?? ""}` : ""}
                  </p>
                  <Distribution
                    dist={snapshot.rating_distribution ?? {}}
                    total={snapshot.votes_count ?? 0}
                  />
                </div>
                <div>
                  <p className="mb-2 text-xs uppercase tracking-wide text-bip-muted">
                    Google&rsquo;s review topics
                  </p>
                  {topics.length === 0 ? (
                    <p className="text-sm text-bip-muted">None returned for this profile.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {topics.map(([topic, count]) => (
                        <span
                          key={topic}
                          className="rounded-full border border-bip-border bg-bip-page px-3 py-1 text-xs text-bip-text"
                        >
                          {topic} <span className="text-bip-muted">{count}</span>
                        </span>
                      ))}
                    </div>
                  )}
                  <p className="mt-3 text-xs text-bip-muted">
                    {reviewCount} reviews stored · profile checked{" "}
                    {new Date(snapshot.fetched_at).toLocaleString()}
                  </p>
                </div>
              </div>
            )}

            {report ? (
              <div className="rounded-xl border border-bip-border bg-bip-card p-6">
                <p className="mb-4 border-b border-bip-border pb-3 text-xs text-bip-muted">
                  Generated {new Date(report.generated_at).toLocaleString()} from{" "}
                  {report.review_count} reviews with text
                  {report.model ? ` · ${report.model}` : ""}
                </p>
                <ReportBody markdown={report.report_markdown} />
              </div>
            ) : (
              <p className="rounded-lg border border-bip-border bg-bip-card px-4 py-6 text-sm text-bip-muted">
                {reviewCount === 0
                  ? "Fetch reviews for this client, then generate the report."
                  : "Reviews are stored. Generate the report to see the analysis."}
              </p>
            )}
          </>
        )}
      </main>
    </div>
  );
}
