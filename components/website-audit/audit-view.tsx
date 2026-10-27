"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, Download, Loader2, Play } from "lucide-react";
import { StatTile, StatTiles } from "@/components/ui/stat-tile";
import { AUDIT_STAGES, type AuditStage, type TechnicalCrawl, type WebsiteAuditRow } from "@/lib/website-audit/types";

const STAGE_LABEL: Record<AuditStage, { title: string; detail: string }> = {
  crawl: { title: "Technical crawl", detail: "Every sitemap URL on both hosts: status, redirects, titles, H1s, canonicals, schema. Free." },
};

type Finding = { tone: "bad" | "warn" | "good"; text: string; urls?: string[] };

/** Plain-English technical findings, each traceable to the URLs behind it. */
function technicalFindings(t: TechnicalCrawl): Finding[] {
  const s = t.summary;
  const hosts = Object.entries(s.byHost).map(([host, n]) => `${n} on ${host}`).join(", ");
  const list: Finding[] = [];
  list.push({
    tone: Object.keys(s.byHost).length > 1 ? "warn" : "good",
    text: `The sitemap lists ${s.totalUrls} URLs (${hosts}): ${s.uniquePages} distinct pages once redirects are followed.`,
  });
  if (s.tagPages + s.categoryPages + s.authorPages > 0)
    list.push({ tone: "warn", text: `${s.tagPages} tag, ${s.categoryPages} category and ${s.authorPages} author archive pages are in the sitemap.` });
  if (s.serverErrors.length) list.push({ tone: "bad", text: `${s.serverErrors.length} URLs return a server error.`, urls: s.serverErrors });
  if (s.softErrors?.length)
    list.push({ tone: "bad", text: `${s.softErrors.length} sitemap URLs answer "200 OK" but show an error message instead of the page.`, urls: s.softErrors });
  if (s.notFound.length) list.push({ tone: "bad", text: `${s.notFound.length} URLs return 404.`, urls: s.notFound });
  if (s.redirectLoops.length) list.push({ tone: "bad", text: `${s.redirectLoops.length} URLs are stuck in a redirect loop.`, urls: s.redirectLoops });
  if (s.slashVariants.loops.length)
    list.push({ tone: "bad", text: `${s.slashVariants.loops.length} pages break when the trailing slash is removed or added: the site shows its own "redirect loop detected" error, served as "200 OK", so status-only checkers miss it.`, urls: s.slashVariants.loops });
  if (s.insecureRedirects.length || s.slashVariants.insecure.length)
    list.push({
      tone: "bad",
      text: "Some redirects send visitors from https to insecure http.",
      urls: [...s.insecureRedirects, ...s.slashVariants.insecure],
    });
  if (s.slashVariants.broken?.length)
    list.push({ tone: "bad", text: `${s.slashVariants.broken.length} pages show a server error when the trailing slash is changed.`, urls: s.slashVariants.broken });
  if (s.slashVariants.duplicates.length)
    list.push({
      tone: "warn",
      text: `${s.slashVariants.duplicates.length} of ${s.slashVariants.checked} pages also answer at the other trailing-slash address, so search engines see two copies.`,
      urls: s.slashVariants.duplicates,
    });
  list.push(
    s.missingCanonical
      ? { tone: "warn", text: `${s.missingCanonical} of ${s.uniquePages} pages have no canonical tag.`, urls: s.missingCanonicalUrls }
      : { tone: "good", text: "Every page has a canonical tag." },
  );
  list.push(
    s.withSchema
      ? { tone: s.withSchema === s.uniquePages ? "good" : "warn", text: `${s.withSchema} of ${s.uniquePages} pages have structured data (${s.schemaTypes.join(", ")}).` }
      : { tone: "bad", text: "No page has structured data (schema)." },
  );
  if (s.repeatedH1OnPage.length) list.push({ tone: "warn", text: "The same H1 appears twice on a page.", urls: s.repeatedH1OnPage });
  if (s.noH1) list.push({ tone: "warn", text: `${s.noH1} pages have no H1.` });
  if (s.multipleH1) list.push({ tone: "warn", text: `${s.multipleH1} pages have more than one H1.` });
  if (s.duplicateH1AcrossPages.length)
    list.push({ tone: "warn", text: `${s.duplicateH1AcrossPages.length} H1s are shared by more than one page.`, urls: s.duplicateH1AcrossPages.map((d) => `${d.h1} (${d.pages} pages)`) });
  if (s.missingMetaDescription) list.push({ tone: "warn", text: `${s.missingMetaDescription} pages have no meta description.` });
  if (s.thinPages) list.push({ tone: "warn", text: `${s.thinPages} content pages have under 300 words.` });
  if (s.helloWorldInSitemap) list.push({ tone: "warn", text: "The WordPress \"Hello world\" sample post is still in the sitemap." });
  const robots = Object.values(t.robotsTxt).some(Boolean);
  const llms = Object.values(t.llmsTxt).some(Boolean);
  list.push({ tone: robots ? "good" : "warn", text: robots ? "robots.txt is present." : "No robots.txt." });
  list.push({ tone: llms ? "good" : "warn", text: llms ? "llms.txt is present." : "No llms.txt (a short guide for AI tools)." });
  if (s.noViewport) list.push({ tone: "warn", text: `${s.noViewport} pages lack a mobile viewport tag.` });
  if (t.stoppedBecause !== "done") list.push({ tone: "warn", text: `The crawl stopped early (${t.stoppedBecause === "time" ? "time limit" : "500-URL limit"}); results are partial.` });
  return list;
}

const toneClass = { bad: "border-red-500/30 bg-red-500/5", warn: "border-amber-500/30 bg-amber-500/5", good: "border-emerald-500/30 bg-emerald-500/5" };

export default function WebsiteAuditView({ audit }: { audit: WebsiteAuditRow }) {
  const router = useRouter();
  const [running, setRunning] = useState<AuditStage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const t = audit.results.technical;

  async function run(stage: AuditStage) {
    setRunning(stage);
    setError(null);
    try {
      const response = await fetch(`/api/website-audits/${audit.id}/stages/${stage}`, { method: "POST" });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? `The step failed (${response.status}).`);
      router.refresh();
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : "The step failed.");
    } finally {
      setRunning(null);
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-6">
      <Link href="/website-audits" className="inline-flex items-center gap-1 text-sm text-bip-muted hover:text-bip-text">
        <ArrowLeft size={14} /> All audits
      </Link>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-bip-text">{audit.practice_name}</h1>
          <p className="text-sm text-bip-muted">
            {audit.domain} · {[audit.city, audit.state].filter(Boolean).join(", ")} · started {new Date(audit.created_at).toLocaleDateString()}
          </p>
        </div>
        <div className="flex gap-2">
          <a href={`/api/website-audits/${audit.id}/json`} className="inline-flex items-center gap-1.5 rounded-md border border-bip-border px-3 py-1.5 text-sm text-bip-text hover:bg-bip-card">
            <Download size={14} /> JSON
          </a>
          {t && (
            <a href={`/api/website-audits/${audit.id}/csv`} className="inline-flex items-center gap-1.5 rounded-md border border-bip-border px-3 py-1.5 text-sm text-bip-text hover:bg-bip-card">
              <Download size={14} /> Crawl CSV
            </a>
          )}
        </div>
      </header>

      <section className="space-y-2">
        {AUDIT_STAGES.map((stage) => {
          const state = audit.stage_status?.[stage];
          return (
            <div key={stage} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-bip-border bg-bip-card p-4">
              <div>
                <p className="text-sm font-semibold text-bip-text">{STAGE_LABEL[stage].title}</p>
                <p className="text-xs text-bip-muted">{STAGE_LABEL[stage].detail}</p>
                {state && (
                  <p className={`mt-1 text-xs ${state.status === "failed" ? "text-red-300" : "text-bip-muted"}`}>
                    {state.status === "done" ? "Done" : state.status === "failed" ? `Failed: ${state.error}` : "Running"} ·{" "}
                    {new Date(state.at).toLocaleString()}
                  </p>
                )}
              </div>
              <button
                type="button"
                disabled={running !== null}
                onClick={() => void run(stage)}
                className="inline-flex items-center gap-1.5 rounded-md bg-bip-accent px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
              >
                {running === stage ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                {running === stage ? "Running… (up to 5 minutes)" : state?.status === "done" ? "Run again" : "Run"}
              </button>
            </div>
          );
        })}
        {error && <p className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}
      </section>

      {t && (
        <>
          <StatTiles>
            <StatTile label="Sitemap URLs" value={String(t.summary.totalUrls)} sub={Object.entries(t.summary.byHost).map(([h, n]) => `${n} ${h}`).join(" · ")} />
            <StatTile label="Distinct pages" value={String(t.summary.uniquePages)} />
            <StatTile label="Tag pages" value={String(t.summary.tagPages)} />
            <StatTile label="Crawled" value={new Date(t.crawledAt).toLocaleDateString()} sub={`${Math.round(t.ms / 1000)}s`} />
          </StatTiles>

          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-bip-text">Technical findings</h2>
            {technicalFindings(t).map((f) => (
              <div key={f.text} className={`rounded-lg border p-3 text-sm text-bip-text ${toneClass[f.tone]}`}>
                {f.text}
                {f.urls && f.urls.length > 0 && (
                  <details className="mt-1 text-xs text-bip-muted">
                    <summary className="cursor-pointer">Which ones ({f.urls.length})</summary>
                    <ul className="mt-1 space-y-0.5">
                      {f.urls.map((u) => (
                        <li key={u} className="break-all">
                          {u}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            ))}
          </section>

          <details className="rounded-xl border border-bip-border bg-bip-card">
            <summary className="cursor-pointer p-4 text-sm font-semibold text-bip-text">Every URL ({t.pages.length})</summary>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-xs">
                <thead>
                  <tr className="border-y border-bip-border text-left uppercase tracking-wide text-bip-muted">
                    <th className="px-3 py-2">URL</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Title</th>
                    <th className="px-3 py-2">H1s</th>
                    <th className="px-3 py-2">Canonical</th>
                    <th className="px-3 py-2">Schema</th>
                    <th className="px-3 py-2 text-right">Words</th>
                  </tr>
                </thead>
                <tbody>
                  {t.pages.map((p) => (
                    <tr key={p.url} className="border-b border-bip-border/50 align-top">
                      <td className="max-w-[280px] break-all px-3 py-1.5 text-bip-text">{p.url}</td>
                      <td className="px-3 py-1.5 text-bip-muted">
                        {p.redirectLoop ? "loop" : p.chain.map((h) => h.status).join(" → ")}
                      </td>
                      <td className="px-3 py-1.5 text-bip-muted">{p.title ? `${p.titleLength} chars` : "—"}</td>
                      <td className="px-3 py-1.5 text-bip-muted">{p.h1s.length}</td>
                      <td className="px-3 py-1.5 text-bip-muted">{p.canonical ? (p.canonicalMatches ? "matches" : "differs") : "none"}</td>
                      <td className="px-3 py-1.5 text-bip-muted">{p.schemaTypes.slice(0, 3).join(", ") || "—"}</td>
                      <td className="px-3 py-1.5 text-right text-bip-muted">{p.wordCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}
    </div>
  );
}
