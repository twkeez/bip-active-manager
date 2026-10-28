"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, Download, FileText, Loader2, Play } from "lucide-react";
import { StatTile, StatTiles } from "@/components/ui/stat-tile";
import { technicalFindings } from "@/lib/website-audit/findings";
import { AI_PLATFORMS, PLATFORM_LABEL } from "@/lib/website-audit/platforms";
import {
  AUDIT_STAGES,
  type AiVisibilityResults,
  type AuditStage,
  type AuthorityResults,
  type CitabilityScore,
  type ContentResults,
  type WebsiteAuditRow,
} from "@/lib/website-audit/types";

const STAGE_LABEL: Record<AuditStage, { title: string; detail: string }> = {
  authority: {
    title: "Authority & reviews",
    detail: "Backlinks and DataForSEO rank for the site and any competitors; the Google listing's rating, review count and 20 newest reviews. A few cents; up to 3 minutes.",
  },
  "ai-visibility": {
    title: "AI visibility",
    detail: "Asks ChatGPT, Gemini, Perplexity, Claude, Google AI Overview and AI Mode about 25 local, service and pet-care questions, and checks DataForSEO's database of observed AI answers. About $1.50–3; up to 4 minutes, and run again if it says answers are missing.",
  },
  content: {
    title: "Content, trust signals & score",
    detail: "Claude reads every real page (doctors, services, hours, booking, prices, accreditations, FAQs, blog posts, typos, a recommended H1), then writes the differentiators, positioning and ranked fix list from the whole audit. Then the citability score. About 40¢; up to 3 minutes. Run after the other steps.",
  },
  crawl: { title: "Technical crawl", detail: "Every sitemap URL on both hosts, plus pages the site links to but leaves out of its sitemap: status, redirects, titles, H1s, canonicals, schema. Free." },
};

const num = (n: number | null) => (n == null ? "—" : n.toLocaleString());

function AuthorityPanel({ a }: { a: AuthorityResults }) {
  const g = a.google;
  const rows = [a.own, ...a.competitors];
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-bip-text">Authority &amp; reviews</h2>
      <div className="overflow-x-auto rounded-xl border border-bip-border bg-bip-card">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-bip-border text-left text-[11px] uppercase tracking-wide text-bip-muted">
              <th className="px-4 py-2">Website</th>
              <th className="px-4 py-2 text-right">DataForSEO rank (0–1000)</th>
              <th className="px-4 py-2 text-right">Referring domains</th>
              <th className="px-4 py-2 text-right">Backlinks</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.domain} className="border-b border-bip-border/60 last:border-0">
                <td className="px-4 py-2 text-bip-text">
                  {r.domain} {i === 0 && <span className="text-xs text-bip-muted">(this practice)</span>}
                  {r.error && <span className="block text-xs text-red-300">{r.error}</span>}
                </td>
                <td className="px-4 py-2 text-right tabular-nums">{num(r.rank)}</td>
                <td className="px-4 py-2 text-right tabular-nums">{num(r.referringDomains)}</td>
                <td className="px-4 py-2 text-right tabular-nums">{num(r.backlinks)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="rounded-xl border border-bip-border bg-bip-card p-4 text-sm">
        <p className="font-semibold text-bip-text">
          Google: {g.rating != null ? `${g.rating.toFixed(1)}★` : "no rating"} from {num(g.reviewCount)} reviews
        </p>
        <p className="text-xs text-bip-muted">
          {g.listingName ? `Listing: ${g.listingName}${g.listingAddress ? `, ${g.listingAddress}` : ""}` : "No listing details."}
          {g.placeSource === "search" && " · Found by searching the practice name and town: check it's the right listing."}
        </p>
        {g.reviewsError && <p className="mt-1 text-xs text-amber-300">{g.reviewsError}</p>}
        {g.reviews.length > 0 && (
          <details className="mt-2">
            <summary className="cursor-pointer text-xs text-bip-muted">The {g.reviews.length} newest reviews</summary>
            <ul className="mt-2 space-y-2">
              {g.reviews.map((r, i) => (
                <li key={i} className="text-xs text-bip-text">
                  <span className="text-bip-muted">
                    {r.rating ?? "?"}★ · {r.date ? new Date(r.date).toLocaleDateString() : "undated"}
                    {r.ownerAnswered ? " · practice replied" : ""}
                  </span>
                  <span className="block">{r.text || "(rating only, no text)"}</span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
      {a.notes.length > 0 && <p className="text-xs text-amber-300">{a.notes.join(" ")}</p>}
    </section>
  );
}

function AiVisibilityPanel({ v }: { v: AiVisibilityResults }) {
  const m = v.mentions;
  const runFor = (promptId: string, platform: string) => v.runs.find((r) => r.promptId === promptId && r.platform === platform && !r.error);
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-bip-text">AI visibility</h2>
      {!v.complete && (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-200">
          {v.missing} answers are still missing{v.errors.length ? ` (${v.errors.join("; ")})` : ""}. Run this step again to fill them in; answers already in are kept.
        </p>
      )}
      <div className="rounded-xl border border-bip-border bg-bip-card">
        <p className="border-b border-bip-border px-4 py-2 text-xs text-bip-muted">
          <span className="font-semibold text-bip-text">Our prompt set:</span> {v.prompts.length} questions asked on{" "}
          {new Date(v.ranAt).toLocaleDateString()}, Google results for {v.location}.
        </p>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-bip-border text-left text-[11px] uppercase tracking-wide text-bip-muted">
              <th className="px-4 py-2">Platform</th>
              <th className="px-4 py-2">Model</th>
              <th className="px-4 py-2 text-right">Answered</th>
              <th className="px-4 py-2 text-right">Cited the site</th>
              <th className="px-4 py-2 text-right">Named the practice</th>
            </tr>
          </thead>
          <tbody>
            {v.platforms.map((p) => (
              <tr key={p.platform} className="border-b border-bip-border/60 last:border-0">
                <td className="px-4 py-2 text-bip-text">{p.label}</td>
                <td className="px-4 py-2 text-xs text-bip-muted">{p.model ?? "—"}</td>
                <td className="px-4 py-2 text-right tabular-nums">{p.promptsAnswered} of {p.promptsRun}</td>
                <td className="px-4 py-2 text-right tabular-nums">{p.promptsCited} of {p.promptsRun}</td>
                <td className="px-4 py-2 text-right tabular-nums">{p.promptsMentioned} of {p.promptsRun}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="rounded-xl border border-bip-border bg-bip-card p-4 text-sm">
        <p className="text-xs text-bip-muted">
          <span className="font-semibold text-bip-text">Observed in AI answers</span> ({m.window}). A different measurement from the prompt set above: don&apos;t add them together.
        </p>
        {m.error ? (
          <p className="mt-1 text-xs text-red-300">{m.error}</p>
        ) : (
          <p className="mt-1 text-bip-text">
            Website cited as a source in {m.citedAsSource.mentions} answers (AI search volume {m.citedAsSource.aiSearchVolume.toLocaleString()}); practice
            named in {m.namedInAnswers.mentions} answers.
          </p>
        )}
        {m.examples.length > 0 && (
          <details className="mt-2 text-xs">
            <summary className="cursor-pointer text-bip-muted">Questions where the site was cited ({m.examples.length})</summary>
            <ul className="mt-1 space-y-1">
              {m.examples.map((e, i) => (
                <li key={i} className="text-bip-text">
                  {e.question} <span className="text-bip-muted">· {e.platform === "google" ? "AI Overview" : e.platform}{e.aiSearchVolume ? ` · ${e.aiSearchVolume}/mo` : ""}{e.citedUrl ? ` · ${e.citedUrl.split("#")[0]}` : ""}</span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
      {v.topCitedDomains.length > 0 && (
        <p className="text-xs text-bip-muted">
          Other sites AI cited most: {v.topCitedDomains.slice(0, 10).map((d) => `${d.domain} (${d.answers})`).join(", ")}
        </p>
      )}
      <details className="rounded-xl border border-bip-border bg-bip-card">
        <summary className="cursor-pointer p-4 text-sm font-semibold text-bip-text">Every prompt ({v.prompts.length})</summary>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-xs">
            <thead>
              <tr className="border-y border-bip-border text-left text-bip-muted">
                <th className="px-3 py-2">Prompt</th>
                {AI_PLATFORMS.map((p) => (
                  <th key={p} className="px-2 py-2 text-center">{PLATFORM_LABEL[p].replace("Google ", "")}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {v.prompts.map((prompt) => (
                <tr key={prompt.id} className="border-b border-bip-border/50">
                  <td className="px-3 py-1.5 text-bip-text">
                    {prompt.text} <span className="text-bip-muted">({prompt.kind})</span>
                  </td>
                  {AI_PLATFORMS.map((p) => {
                    const r = runFor(prompt.id, p);
                    const mark = !r ? "…" : !r.answered ? "–" : r.cited && r.mentioned ? "cited + named" : r.cited ? "cited" : r.mentioned ? "named" : "no";
                    return (
                      <td key={p} title={r?.answerExcerpt ?? ""} className={`px-2 py-1.5 text-center ${r?.cited || r?.mentioned ? "text-emerald-300" : "text-bip-muted"}`}>
                        {mark}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="px-3 py-2 text-[11px] text-bip-muted">– no answer shown (e.g. Google showed no AI Overview) · … not asked yet · hover a cell for the start of the answer</p>
        </div>
      </details>
    </section>
  );
}

function ScorePanel({ s }: { s: CitabilityScore }) {
  return (
    <section className="space-y-2 rounded-xl border border-bip-border bg-bip-card p-4">
      <div className="flex items-baseline gap-3">
        <p className="text-3xl font-bold text-bip-text">{s.total}</p>
        <p className="text-sm text-bip-muted">/ 100 citability · {s.band}</p>
      </div>
      <p className="text-xs text-bip-muted">
        How ready the website is to be cited: worked out from the crawl, authority and content results, not by AI. Bands: Limited 0–44, Developing 45–64, Established 65–79, Strong 80–100.
      </p>
      <div className="space-y-1.5">
        {s.subScores.map((p) => (
          <details key={p.key} className="rounded-lg border border-bip-border/60 px-3 py-2 text-sm">
            <summary className="flex cursor-pointer justify-between gap-3 text-bip-text">
              <span>{p.label}</span>
              <span className="tabular-nums text-bip-muted">
                {p.points} / {p.weight}
              </span>
            </summary>
            <ul className="mt-1 space-y-0.5 text-xs text-bip-muted">
              {p.details.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          </details>
        ))}
      </div>
    </section>
  );
}

function Evidence({ items }: { items: { source: string; quote: string }[] }) {
  if (!items.length) return null;
  return (
    <ul className="mt-1 space-y-0.5 text-[11px] text-bip-muted">
      {items.map((e, i) => (
        <li key={i}>
          <span className="break-all">{e.source}</span>: “{e.quote}”
        </li>
      ))}
    </ul>
  );
}

function ContentPanel({ c }: { c: ContentResults }) {
  const site = c.site;
  const doctors = new Map<string, string>();
  for (const p of c.pages) for (const d of p.doctors) if (!doctors.has(d.name)) doctors.set(d.name, `${d.credentials ?? "no credentials shown"}${d.hasBio ? ", has a bio" : ""}${d.school ? `, ${d.school}${d.year ? ` ${d.year}` : ""}` : ""}`);
  const typos = c.pages.flatMap((p) => p.typos.map((t) => ({ ...t, url: p.url })));
  const accreditations = [...new Set(c.pages.flatMap((p) => p.accreditations))];
  const prices = [...new Set(c.pages.flatMap((p) => p.pricesShown))];
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-bip-text">Content &amp; messaging</h2>
      <div className="rounded-xl border border-bip-border bg-bip-card p-4 text-sm">
        <p className="text-xs uppercase tracking-wide text-bip-muted">Proposed positioning</p>
        <p className="mt-1 text-bip-text">{site.positioningLine}</p>
        <p className="mt-3 text-xs uppercase tracking-wide text-bip-muted">Proposed homepage H1</p>
        <p className="mt-1 font-semibold text-bip-text">{site.homepageH1}</p>
      </div>
      <div className="rounded-xl border border-bip-border bg-bip-card p-4 text-sm">
        <p className="font-semibold text-bip-text">What to lead with</p>
        <ul className="mt-2 space-y-2">
          {site.differentiators.map((d) => (
            <li key={d.title}>
              <span className="font-medium text-bip-text">{d.title}.</span> <span className="text-bip-muted">{d.detail}</span>
              <Evidence items={d.evidence} />
            </li>
          ))}
        </ul>
      </div>
      <div className="rounded-xl border border-bip-border bg-bip-card p-4 text-sm">
        <p className="font-semibold text-bip-text">What to fix, in order</p>
        <ol className="mt-2 space-y-2">
          {site.fixes.map((f) => (
            <li key={f.rank}>
              <span className="font-medium text-bip-text">
                {f.rank}. {f.fix}
              </span>{" "}
              <span className="text-xs text-bip-muted">({f.area.replace("_", " ")})</span>
              {f.steps && f.steps.length > 0 && (
                <ol className="mt-0.5 list-decimal pl-5 text-bip-text">
                  {f.steps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
              )}
              <p className="text-bip-muted">{f.whyItMatters}</p>
              <Evidence items={f.evidence} />
            </li>
          ))}
        </ol>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-bip-border bg-bip-card p-4 text-xs">
          <p className="text-sm font-semibold text-bip-text">Doctors ({doctors.size})</p>
          <ul className="mt-1 space-y-0.5 text-bip-muted">
            {[...doctors.entries()].map(([name, note]) => (
              <li key={name}>
                <span className="text-bip-text">{name}</span>: {note}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border border-bip-border bg-bip-card p-4 text-xs text-bip-muted">
          <p className="text-sm font-semibold text-bip-text">Services &amp; trust</p>
          <p className="mt-1">Named without a page: {site.servicesWithoutPage.join(", ") || "none"}</p>
          <p>Menu items going nowhere: {site.menuItemsGoingNowhere.join(", ") || "none"}</p>
          <p>Hours that disagree: {site.hoursContradictions.join("; ") || "none"}</p>
          <p>Accreditations shown: {accreditations.join(", ") || "none"}</p>
          <p>Prices shown: {prices.join("; ") || "none"}</p>
        </div>
      </div>
      {typos.length > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-xs">
          <p className="text-sm font-semibold text-bip-text">Typos ({typos.length})</p>
          <ul className="mt-1 space-y-0.5 text-bip-muted">
            {typos.map((t, i) => (
              <li key={i}>
                “{t.text}” → “{t.suggestion}” ({t.where}, <span className="break-all">{t.url}</span>)
              </li>
            ))}
          </ul>
        </div>
      )}
      <details className="rounded-xl border border-bip-border bg-bip-card">
        <summary className="cursor-pointer p-4 text-sm font-semibold text-bip-text">Current vs recommended H1, every page ({c.pages.length})</summary>
        <table className="w-full text-xs">
          <tbody>
            {c.pages.map((p) => (
              <tr key={p.url} className="border-t border-bip-border/50 align-top">
                <td className="max-w-[240px] break-all px-3 py-1.5 text-bip-muted">{new URL(p.url).pathname}</td>
                <td className="px-3 py-1.5 text-bip-muted">{p.currentH1 ?? "(none)"}</td>
                <td className="px-3 py-1.5 text-bip-text">
                  {p.recommendedH1}
                  {p.secondaryLine && <span className="block text-bip-muted">{p.secondaryLine}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
      <p className="text-[11px] text-bip-muted">
        Pages read by {c.pageModel}; strategy by {c.siteModel}; {new Date(c.ranAt).toLocaleString()}.
      </p>
    </section>
  );
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
            {Number(audit.dataforseo_cost_usd) > 0 && ` · DataForSEO so far $${Number(audit.dataforseo_cost_usd).toFixed(2)}`}
            {Number(audit.ai_cost_usd) > 0 && ` · Claude $${Number(audit.ai_cost_usd).toFixed(2)}`}
          </p>
        </div>
        <div className="flex gap-2">
          {audit.results.score && (
            <a
              href={`/website-audit-print/${audit.id}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md bg-bip-accent px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
            >
              <FileText size={14} /> Report (PDF)
            </a>
          )}
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

      {audit.results.score && <ScorePanel s={audit.results.score} />}
      {audit.results.content && <ContentPanel c={audit.results.content} />}
      {audit.results.aiVisibility && <AiVisibilityPanel v={audit.results.aiVisibility} />}
      {audit.results.authority && <AuthorityPanel a={audit.results.authority} />}

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
