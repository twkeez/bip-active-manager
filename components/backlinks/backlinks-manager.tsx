"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { ArrowLeft, ExternalLink, Link2, Loader2, Search } from "lucide-react";
import AppHeaderActions, { ModuleHeaderLinks } from "@/components/layout/app-header-actions";
import type { BacklinkRow, BacklinkSummary } from "@/lib/dataforseo/types";

type LookupPayload = {
  error?: string;
  summary?: BacklinkSummary | null;
  rows?: BacklinkRow[];
};

function StatTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-bip-border bg-bip-card px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-bip-muted">{label}</p>
      <p className="mt-1 text-xl font-semibold text-bip-text">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-bip-muted">{hint}</p>}
    </div>
  );
}

function formatDate(iso: string | null) {
  return iso ? new Date(iso).toLocaleDateString() : "—";
}

// DataForSEO scores 0-100. Anything above ~30 is worth a human look, but this
// is a reading aid only — the disavow call stays with the strategist.
function spamTone(score: number | null) {
  if (score == null) return "text-bip-muted";
  if (score >= 60) return "text-red-400";
  if (score >= 30) return "text-amber-400";
  return "text-bip-muted";
}

export default function BacklinksManager({
  userEmail,
  clientName,
  initialTarget,
}: {
  userEmail?: string;
  clientName: string | null;
  initialTarget: string;
}) {
  const [target, setTarget] = useState(initialTarget);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<BacklinkSummary | null>(null);
  const [rows, setRows] = useState<BacklinkRow[] | null>(null);

  const runLookup = useCallback(async () => {
    const domain = target.trim();
    if (!domain || loading) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/backlinks?target=${encodeURIComponent(domain)}`, {
        cache: "no-store",
      });
      const payload = (await response.json()) as LookupPayload;
      if (!response.ok) {
        throw new Error(payload.error ?? "Backlink lookup failed.");
      }
      setSummary(payload.summary ?? null);
      setRows(payload.rows ?? []);
    } catch (lookupError) {
      setError(lookupError instanceof Error ? lookupError.message : "Backlink lookup failed.");
      setRows(null);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [target, loading]);

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
            <Link2 className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-bip-text">Backlinks</h1>
            <p className="text-xs text-bip-muted">
              Who links to {clientName ?? "this client"} · {userEmail ?? "Signed in"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ModuleHeaderLinks />
          <AppHeaderActions />
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-6">
        <div className="mb-5 flex flex-wrap items-end gap-3">
          <label className="flex-1 min-w-64">
            <span className="mb-1 block text-xs uppercase tracking-wide text-bip-muted">
              Domain
            </span>
            <input
              value={target}
              onChange={(event) => setTarget(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void runLookup();
              }}
              placeholder="example.com"
              className="w-full rounded-lg border border-bip-border bg-bip-card px-3 py-2 text-sm text-bip-text placeholder:text-bip-muted focus:outline-none focus:ring-1 focus:ring-bip-accent"
            />
          </label>
          <button
            type="button"
            onClick={() => void runLookup()}
            disabled={loading || !target.trim()}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-500 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Search className="h-4 w-4" aria-hidden />
            )}
            {loading ? "Looking up…" : "Look up"}
          </button>
        </div>

        <p className="mb-5 text-xs text-bip-muted">
          Live DataForSEO lookup, one row per linking domain. Each run costs about 5¢, so it
          only fires when you click.
        </p>

        {error && (
          <p className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </p>
        )}

        {summary && (
          <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile
              label="Referring domains"
              value={summary.referringDomains?.toLocaleString() ?? "—"}
              hint={
                summary.referringDomainsNofollow != null
                  ? `${summary.referringDomainsNofollow} nofollow`
                  : undefined
              }
            />
            <StatTile
              label="Total backlinks"
              value={summary.backlinks?.toLocaleString() ?? "—"}
              hint={
                summary.brokenBacklinks != null ? `${summary.brokenBacklinks} broken` : undefined
              }
            />
            <StatTile
              label="Profile spam score"
              value={summary.spamScore != null ? `${summary.spamScore}/100` : "—"}
            />
            <StatTile
              label="Domain rank"
              value={summary.rank?.toLocaleString() ?? "—"}
              hint={summary.firstSeen ? `Tracked since ${formatDate(summary.firstSeen)}` : undefined}
            />
          </div>
        )}

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-bip-muted">
            <Loader2 className="h-4 w-4 animate-spin" />
            Fetching backlinks…
          </div>
        ) : rows == null ? (
          <p className="rounded-lg border border-bip-border bg-bip-card px-4 py-6 text-sm text-bip-muted">
            Run a lookup to see who links to this site.
          </p>
        ) : rows.length === 0 ? (
          <p className="rounded-lg border border-bip-border bg-bip-card px-4 py-6 text-sm text-bip-text">
            No live backlinks found for this domain.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-bip-border bg-bip-card">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-bip-border bg-bip-page text-xs uppercase tracking-wide text-bip-muted">
                  <th className="px-4 py-3 font-semibold">Linking domain</th>
                  <th className="px-4 py-3 font-semibold">Anchor</th>
                  <th className="px-4 py-3 font-semibold">Type</th>
                  <th className="px-4 py-3 font-semibold">Spam</th>
                  <th className="px-4 py-3 font-semibold">Rank</th>
                  <th className="px-4 py-3 font-semibold">First seen</th>
                  <th className="px-4 py-3 font-semibold">Last seen</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={`${row.domainFrom}-${row.id}`}
                    className="border-b border-bip-border last:border-0 hover:bg-bip-hover"
                  >
                    <td className="px-4 py-3">
                      <a
                        href={row.urlFrom}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-medium text-bip-text hover:text-bip-accent"
                      >
                        {row.domainFrom}
                        <ExternalLink className="h-3 w-3 shrink-0" aria-hidden />
                      </a>
                      {row.pageTitle && (
                        <p className="max-w-sm truncate text-xs text-bip-muted">{row.pageTitle}</p>
                      )}
                    </td>
                    <td className="max-w-[14rem] truncate px-4 py-3 text-bip-text">
                      {row.anchor || "—"}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <span className={row.dofollow ? "text-emerald-400" : "text-bip-muted"}>
                        {row.dofollow ? "follow" : "nofollow"}
                      </span>
                      {row.linksFromDomain > 1 && (
                        <span className="text-bip-muted"> · {row.linksFromDomain} links</span>
                      )}
                    </td>
                    <td className={`px-4 py-3 ${spamTone(row.spamScore)}`}>
                      {row.spamScore ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-bip-text">{row.domainRank ?? "—"}</td>
                    <td className="px-4 py-3 text-xs text-bip-muted">
                      {formatDate(row.firstSeen)}
                    </td>
                    <td className="px-4 py-3 text-xs text-bip-muted">
                      {formatDate(row.lastSeen)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
