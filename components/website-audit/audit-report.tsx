import type { ReactNode } from "react";
import BeyondIndigoLogo from "@/components/onboarding/beyond-indigo-logo";
import weightsConfig from "@/lib/website-audit/config/score-weights.json";
import {
  aiAnswersWithPractice,
  compareMetrics,
  formatMetric,
  headlineMetrics,
  platformMetrics,
  scoreMetrics,
  technicalMetrics,
  type MetricComparison,
} from "@/lib/website-audit/compare";
import { technicalFindings } from "@/lib/website-audit/findings";
import { PLATFORM_LABEL } from "@/lib/website-audit/platforms";
import type { AuditResults, Evidence, PageContent, WebsiteAuditRow } from "@/lib/website-audit/types";

// The branded Website, SEO & AI Search Audit report (printed to PDF from
// /website-audit-print/[id]). Page order follows Tom's spec. Every finding
// shows the URL or the field of the audit JSON it comes from, and a re-run of
// the same domain adds a "last run" column. Fixed brand colours, like the
// team guide and the client documents.

const INDIGO = "#3350a2";
const PURPLE = "#603894";
const MAGENTA = "#962583";
const PINK = "#ce2084";
const GRADIENT = `linear-gradient(120deg, ${INDIGO} 0%, ${PURPLE} 55%, ${MAGENTA} 100%)`;
const URL_LIMIT = 8;

export type PreviousRun = { id: number; created_at: string; results: AuditResults };

const dateOf = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "—";

/** "https://www.dhah.org/about/" → "www.dhah.org/about/" */
const shortUrl = (url: string) => url.replace(/^https?:\/\//, "");
const isUrl = (s: string) => /^https?:\/\//.test(s);
const clip = (s: string, max = 180) => (s.length > max ? `${s.slice(0, max).replace(/[,;\s]+\S*$/, "")}…` : s);
/** DataForSEO writes locations as "Powder Springs,Georgia,United States". */
const place = (s: string) => s.replace(/,\s*/g, ", ");

function Section({ n, title, intro, children, newPage = true }: { n: string; title: string; intro?: string; children: ReactNode; newPage?: boolean }) {
  return (
    <section className="space-y-3 pt-2" style={newPage ? { breakBefore: "page" } : undefined}>
      <h2 className="flex items-center gap-2 text-lg font-semibold" style={{ fontFamily: "var(--font-heading)", color: "#0f172a", breakAfter: "avoid" }}>
        <span className="inline-block h-5 w-1.5 rounded-full" style={{ background: PINK }} aria-hidden="true" />
        <span style={{ color: INDIGO }}>{n}</span> {title}
      </h2>
      {intro && <p className="text-sm leading-relaxed text-slate-600">{intro}</p>}
      {children}
    </section>
  );
}

function Sources({ items }: { items: string[] }) {
  if (!items.length) return null;
  const shown = items.slice(0, URL_LIMIT);
  return (
    <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
      Source: {shown.map((s) => (isUrl(s) ? shortUrl(s) : s)).join(" · ")}
      {items.length > shown.length && ` · and ${items.length - shown.length} more (crawl CSV)`}
    </p>
  );
}

function EvidenceList({ items }: { items: Evidence[] }) {
  if (!items.length) return null;
  return (
    <ul className="mt-1 space-y-0.5 text-[11px] leading-relaxed text-slate-500">
      {items.map((e, i) => (
        <li key={i}>
          <span className="font-medium text-slate-600">{isUrl(e.source) ? shortUrl(e.source) : e.source}</span>: “{e.quote}”
        </li>
      ))}
    </ul>
  );
}

const CHANGE_LABEL = { better: "▲ better", worse: "▼ worse", same: "no change", new: "new" } as const;
const CHANGE_COLOR = { better: "#047857", worse: "#b91c1c", same: "#64748b", new: "#64748b" } as const;

function ChangeCell({ m }: { m: MetricComparison }) {
  if (!m.change) return <td className="py-1.5 pl-3 text-right text-xs text-slate-400">—</td>;
  return (
    <td className="py-1.5 pl-3 text-right text-xs font-medium" style={{ color: CHANGE_COLOR[m.change] }}>
      {CHANGE_LABEL[m.change]}
    </td>
  );
}

/** A metrics table; the last-run columns appear only when there is a last run. */
function MetricTable({ rows, lastDate, source }: { rows: MetricComparison[]; lastDate: string | null; source?: string }) {
  if (!rows.length) return null;
  return (
    <div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
            <th className="py-1.5 font-semibold">Measure</th>
            <th className="py-1.5 pl-3 text-right font-semibold">Today</th>
            {lastDate && <th className="py-1.5 pl-3 text-right font-semibold">Last run ({lastDate})</th>}
            {lastDate && <th className="py-1.5 pl-3 text-right font-semibold">Change</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((m) => (
            <tr key={m.key} className="border-b border-slate-100" style={{ breakInside: "avoid" }}>
              <td className="py-1.5 text-slate-700">{m.label}</td>
              <td className="py-1.5 pl-3 text-right font-medium text-slate-900">{formatMetric(m.value, m.format)}</td>
              {lastDate && <td className="py-1.5 pl-3 text-right text-slate-600">{formatMetric(m.last, m.format)}</td>}
              {lastDate && <ChangeCell m={m} />}
            </tr>
          ))}
        </tbody>
      </table>
      {source && <Sources items={[source]} />}
    </div>
  );
}

function Check({ ok, label, detail, sources }: { ok: boolean | null; label: string; detail?: string; sources?: string[] }) {
  return (
    <li className="flex gap-3 border-b border-slate-100 py-2" style={{ breakInside: "avoid" }}>
      <span className="mt-0.5 w-4 shrink-0 text-center font-semibold" style={{ color: ok == null ? "#94a3b8" : ok ? "#047857" : "#b91c1c" }}>
        {ok == null ? "–" : ok ? "✓" : "✗"}
      </span>
      <div className="min-w-0">
        <p className="text-sm text-slate-800">{label}</p>
        {detail && <p className="text-xs text-slate-600">{detail}</p>}
        {sources && <Sources items={sources} />}
      </div>
    </li>
  );
}

const yesNo = (v: boolean) => (v ? "Yes" : "No");
const pagesWith = (pages: PageContent[], test: (p: PageContent) => boolean) => pages.filter(test).map((p) => p.url);
const distinct = <T,>(items: T[]) => [...new Set(items)];

export default function AuditReport({ audit, previous }: { audit: WebsiteAuditRow; previous: PreviousRun | null }) {
  const r = audit.results;
  const t = r.technical;
  const a = r.authority;
  const v = r.aiVisibility;
  const c = r.content;
  const s = r.score;
  const pages = c?.pages.filter((p) => !p.error) ?? [];
  const runDate = dateOf(s?.computedAt ?? c?.ranAt ?? audit.created_at);
  const lastDate = previous ? dateOf(previous.created_at) : null;
  const prev = previous?.results ?? null;
  const location = [audit.city, audit.state].filter(Boolean).join(", ");

  const headline = compareMetrics(headlineMetrics(r), prev ? headlineMetrics(prev) : null);
  const byKey = new Map(headline.map((m) => [m.key, m]));
  const ai = aiAnswersWithPractice(r);
  const findings = t ? technicalFindings(t) : [];
  const problems = findings.filter((f) => f.tone === "bad");
  const fixes = c?.site.fixes ?? [];

  // Executive summary, read from the score parts: strong parts are working, weak ones hold the site back.
  const parts = s?.subScores ?? [];
  const working = parts.filter((p) => p.points / p.weight >= 0.8);
  const holding = parts.filter((p) => p.points / p.weight < 0.5);
  const informationalRuns = v?.runs.filter((run) => run.answered && v.prompts.find((p) => p.id === run.promptId)?.kind === "informational") ?? [];
  const informationalHits = informationalRuns.filter((run) => run.cited || run.mentioned).length;

  // Doctors, merged across pages by name.
  const doctors = new Map<string, { name: string; credentials: string | null; hasBio: boolean; school: string | null; year: string | null; urls: string[] }>();
  for (const p of pages)
    for (const d of p.doctors) {
      const key = d.name.toLowerCase().replace(/^dr\.?\s+/, "").replace(/,.*$/, "").trim();
      const was = doctors.get(key);
      doctors.set(key, {
        name: was && was.name.length >= d.name.length ? was.name : d.name,
        credentials: was?.credentials ?? d.credentials,
        hasBio: Boolean(was?.hasBio || d.hasBio),
        school: was?.school ?? d.school,
        year: was?.year ?? d.year,
        urls: distinct([...(was?.urls ?? []), p.url]),
      });
    }

  const blogPosts = pages.filter((p) => p.pageType === "blog_post" && p.blog);
  const crawlByUrl = new Map((t?.pages ?? []).map((p) => [p.finalUrl, p]));
  const servicePages = pages.filter((p) => p.pageType === "service");
  const typos = pages.flatMap((p) => p.typos.map((ty) => ({ ...ty, url: p.url })));
  const uniqueTypos = [...new Map(typos.map((ty) => [`${ty.text}→${ty.suggestion}`, ty])).values()];
  const reviews = a?.google.reviews ?? [];
  const answeredReviews = reviews.filter((rv) => rv.ownerAnswered).length;
  const types = new Set(t?.summary.schemaTypes ?? []);
  const homepage = pages.find((p) => p.pageType === "home");

  let n = 0;
  const num = () => String(++n).padStart(2, "0");

  return (
    <article className="mx-auto max-w-3xl space-y-8 text-slate-700">
      {/* 01 Cover */}
      <header className="overflow-hidden rounded-3xl px-8 py-9 text-white" style={{ background: GRADIENT, breakInside: "avoid" }}>
        <BeyondIndigoLogo className="h-8 w-auto" />
        <p className="mt-10 text-xs font-semibold uppercase tracking-[0.18em] text-white/75">Website, SEO & AI Search Audit</p>
        <h1 className="mt-1 text-3xl font-semibold leading-tight" style={{ fontFamily: "var(--font-heading)", color: "#ffffff" }}>
          {audit.practice_name}
        </h1>
        <p className="mt-2 text-sm text-white/80">
          {audit.domain}
          {location && ` · ${location}`} · {runDate}
        </p>
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Citability score", value: s ? String(s.total) : "—", sub: s ? `${s.band} · out of 100` : "Not scored yet", m: byKey.get("score") },
            {
              label: "AI answers with the practice",
              value: formatMetric(byKey.get("aiShare")?.value ?? null, "percent"),
              sub: ai ? `${ai.hits} of ${ai.answered} answers, ${v?.platforms.length ?? 0} platforms` : "Not run",
              m: byKey.get("aiShare"),
            },
            {
              label: "Google rating",
              value: formatMetric(a?.google.rating ?? null, "rating"),
              sub: a?.google.reviewCount != null ? `${a.google.reviewCount.toLocaleString("en-US")} reviews` : "No listing found",
              m: byKey.get("rating"),
            },
            { label: "Problems in the crawl", value: t ? String(problems.length) : "—", sub: t ? `${t.summary.uniquePages} pages checked` : "Not run", m: undefined },
          ].map((tile) => (
            <div key={tile.label} className="rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.12)" }}>
              <p className="text-[11px] font-medium uppercase tracking-wide text-white/75">{tile.label}</p>
              <p className="mt-1 text-3xl font-semibold" style={{ fontFamily: "var(--font-heading)" }}>
                {tile.value}
              </p>
              <p className="text-xs text-white/80">{tile.sub}</p>
              {tile.m?.last != null && (
                <p className="mt-1 text-[11px] text-white/80">
                  Last run {formatMetric(tile.m.last, tile.m.format)}
                </p>
              )}
            </div>
          ))}
        </div>
        <p className="mt-6 text-xs text-white/70">Prepared by Beyond Indigo Pets · beyondindigopets.com</p>
      </header>

      <Section n={num()} title="Executive summary" newPage={false} intro="The short version: what's helping, what's holding the site back, and the three changes that matter most.">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 p-4" style={{ breakInside: "avoid" }}>
            <p className="text-sm font-semibold text-emerald-700">Working</p>
            <ul className="mt-2 space-y-2 text-[13px] leading-snug">
              {working.map((p) => (
                <li key={p.key}>
                  <span className="font-medium text-slate-800">{p.label}</span> ({p.points} of {p.weight}). {p.details[0]}
                </li>
              ))}
              {(c?.site.differentiators ?? []).slice(0, 2).map((d) => (
                <li key={d.title}>
                  <span className="font-medium text-slate-800">{d.title}.</span> See section on differentiators.
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-slate-200 p-4" style={{ breakInside: "avoid" }}>
            <p className="text-sm font-semibold text-red-700">Holding it back</p>
            <ul className="mt-2 space-y-2 text-[13px] leading-snug">
              {holding.map((p) => (
                <li key={p.key}>
                  <span className="font-medium text-slate-800">{p.label}</span> ({p.points} of {p.weight}). {clip(p.details[p.details.length - 1])}
                </li>
              ))}
              {v && informationalRuns.length > 0 && informationalHits === 0 && (
                <li>
                  <span className="font-medium text-slate-800">General pet-care questions.</span> AI answered {informationalRuns.length} of these and never named or cited the practice.
                </li>
              )}
              {problems.length > 0 && (
                <li>
                  <span className="font-medium text-slate-800">Technical problems.</span> {problems.length} found in the crawl (see technical findings).
                </li>
              )}
            </ul>
          </div>
          <div className="rounded-2xl border border-slate-200 p-4" style={{ breakInside: "avoid" }}>
            <p className="text-sm font-semibold" style={{ color: INDIGO }}>
              What to change first
            </p>
            <ol className="mt-2 list-decimal space-y-2 pl-4 text-[13px] leading-snug">
              {fixes.slice(0, 3).map((f) => (
                <li key={f.rank}>{f.fix}</li>
              ))}
            </ol>
          </div>
        </div>
      </Section>

      <Section
        n={num()}
        title="How to read the two scores"
        intro="This report uses two different numbers, and they answer different questions. Keep them apart."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl bg-slate-50 p-4" style={{ breakInside: "avoid" }}>
            <p className="text-sm font-semibold" style={{ color: INDIGO }}>
              Citability score ({s?.total ?? "—"} / 100)
            </p>
            <p className="mt-1 text-[13px] leading-relaxed text-slate-600">
              How easy the website makes it for Google and AI tools to understand, trust and quote the practice. It is worked out with fixed arithmetic from what we
              found on the site and around it (reviews, outside links, technical basics, structured data, doctors, services, blog, FAQs, accreditations). No AI
              judgement goes into the number. This is the score the practice controls.
            </p>
            <p className="mt-2 text-xs text-slate-500">
              Bands: {weightsConfig.bands.map((b, i, all) => `${b.label} ${b.min}${i === 0 ? "–100" : `–${all[i - 1].min - 1}`}`).join(" · ")}
            </p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4" style={{ breakInside: "avoid" }}>
            <p className="text-sm font-semibold" style={{ color: INDIGO }}>
              AI visibility ({formatMetric(byKey.get("aiShare")?.value ?? null, "percent")} of answers)
            </p>
            <p className="mt-1 text-[13px] leading-relaxed text-slate-600">
              What AI search actually says today. We asked {v?.prompts.length ?? "a set of"} questions pet owners ask on six AI platforms and counted the answers that
              name the practice or link to its site. It moves with the citability score over time, but also with each platform&apos;s own changes, so a single run is a
              snapshot, not a grade.
            </p>
          </div>
        </div>
        {s && (
          <>
            <p className="pt-2 text-sm font-semibold text-slate-800">What makes up the citability score</p>
            <MetricTable rows={compareMetrics(scoreMetrics(r), prev ? scoreMetrics(prev) : null)} lastDate={lastDate} source="score.subScores" />
            <ul className="space-y-2">
              {s.subScores.map((p) => (
                <li key={p.key} className="text-xs text-slate-600" style={{ breakInside: "avoid" }}>
                  <span className="font-medium text-slate-800">{p.label}:</span> {p.details.join(" ")}
                </li>
              ))}
            </ul>
          </>
        )}
      </Section>

      {v && (
        <Section
          n={num()}
          title="AI visibility by platform"
          intro={`We asked ${v.prompts.length} questions on each platform on ${dateOf(v.ranAt)}, with Google set to ${place(v.location)}. "Cited" means the answer linked to ${audit.domain}; "named" means the answer mentioned the practice by name.`}
        >
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="py-1.5 font-semibold">Platform</th>
                <th className="py-1.5 pl-3 text-right font-semibold">Answered</th>
                <th className="py-1.5 pl-3 text-right font-semibold">Cited the site</th>
                <th className="py-1.5 pl-3 text-right font-semibold">Named the practice</th>
              </tr>
            </thead>
            <tbody>
              {v.platforms.map((p) => (
                <tr key={p.platform} className="border-b border-slate-100" style={{ breakInside: "avoid" }}>
                  <td className="py-1.5">
                    <span className="text-slate-800">{p.label}</span>
                    {p.model && <span className="block text-[11px] text-slate-500">{place(p.model)}</span>}
                  </td>
                  <td className="py-1.5 pl-3 text-right">
                    {p.promptsAnswered} of {p.promptsRun}
                  </td>
                  <td className="py-1.5 pl-3 text-right font-medium text-slate-900">{p.promptsCited}</td>
                  <td className="py-1.5 pl-3 text-right font-medium text-slate-900">{p.promptsMentioned}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Sources items={["aiVisibility.platforms", "aiVisibility.runs"]} />
          {prev?.aiVisibility && (
            <MetricTable rows={compareMetrics(platformMetrics(r), platformMetrics(prev))} lastDate={lastDate} />
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            {(["local", "service", "informational"] as const).map((kind) => {
              const ids = new Set(v.prompts.filter((p) => p.kind === kind).map((p) => p.id));
              const runs = v.runs.filter((run) => ids.has(run.promptId) && run.answered);
              const hits = runs.filter((run) => run.cited || run.mentioned).length;
              return (
                <div key={kind} className="rounded-xl bg-slate-50 p-3 text-[13px]" style={{ breakInside: "avoid" }}>
                  <p className="font-semibold text-slate-800">
                    {kind === "local" ? "Local searches" : kind === "service" ? "Service searches" : "General pet-care questions"}
                  </p>
                  <p className="text-slate-600">
                    The practice appeared in {hits} of {runs.length} answers ({ids.size} questions).
                  </p>
                </div>
              );
            })}
            {v.topCitedDomains.length > 0 && (
              <div className="rounded-xl bg-slate-50 p-3 text-[13px]" style={{ breakInside: "avoid" }}>
                <p className="font-semibold text-slate-800">Sites AI cites most in these answers</p>
                <p className="text-slate-600">
                  {v.topCitedDomains
                    .slice(0, 6)
                    .map((d) => `${d.domain} (${d.answers})`)
                    .join(", ")}
                </p>
              </div>
            )}
          </div>
          <div className="rounded-2xl border border-slate-200 p-4" style={{ breakInside: "avoid" }}>
            <p className="text-sm font-semibold text-slate-800">A separate measurement: what AI has said over time</p>
            <p className="mt-1 text-[13px] leading-relaxed text-slate-600">
              DataForSEO keeps a database of AI answers it has observed ({v.mentions.window}). These are not our questions, so the numbers below are not comparable with
              the table above and are not added to it.
            </p>
            {v.mentions.error ? (
              <p className="mt-2 text-xs text-red-700">The database couldn&apos;t be read: {v.mentions.error}</p>
            ) : (
              <p className="mt-2 text-[13px] text-slate-700">
                Answers linking to the site: <strong>{v.mentions.citedAsSource.mentions}</strong>
                {Object.keys(v.mentions.citedAsSource.byPlatform).length > 0 &&
                  ` (${Object.entries(v.mentions.citedAsSource.byPlatform)
                    .map(([k, n]) => `${k} ${n}`)
                    .join(", ")})`}
                {" · "}Answers naming the practice: <strong>{v.mentions.namedInAnswers.mentions}</strong>
              </p>
            )}
            <Sources items={["aiVisibility.mentions"]} />
          </div>
        </Section>
      )}

      {(c || a) && (
        <Section n={num()} title="Trust-signal checklist" intro="What a pet owner, Google or an AI tool can check to decide whether to trust the practice.">
          <ul>
            <Check
              ok={a?.google.rating != null ? a.google.rating >= 4.5 : null}
              label="Strong Google rating"
              detail={a?.google.rating != null ? `${a.google.rating}★ from ${a.google.reviewCount ?? "?"} reviews (${a.google.listingName ?? "Google listing"})` : "No rating found."}
              sources={["authority.google"]}
            />
            {reviews.length > 0 && (
              <Check
                ok={answeredReviews / reviews.length >= 0.5}
                label="Replies to reviews"
                detail={`The practice replied to ${answeredReviews} of the ${reviews.length} newest reviews.`}
                sources={["authority.google.reviews"]}
              />
            )}
            <Check
              ok={doctors.size > 0}
              label="Doctors named on the site"
              detail={`${doctors.size} named; ${[...doctors.values()].filter((d) => d.hasBio).length} with a bio, ${[...doctors.values()].filter((d) => d.credentials).length} with credentials.`}
              sources={distinct([...doctors.values()].flatMap((d) => d.urls))}
            />
            <Check
              ok={pages.some((p) => p.accreditations.length)}
              label="Accreditations shown (AAHA, Fear Free, Cat Friendly, AAFP)"
              detail={distinct(pages.flatMap((p) => p.accreditations)).join(", ") || "None found on any page."}
              sources={pagesWith(pages, (p) => p.accreditations.length > 0)}
            />
            <Check ok={pages.some((p) => p.hours)} label="Hours shown" sources={pagesWith(pages, (p) => Boolean(p.hours))} />
            <Check ok={pages.some((p) => p.booking)} label="How to book is clear" detail={distinct(pages.map((p) => p.booking).filter(Boolean) as string[]).slice(0, 2).join(" / ")} sources={pagesWith(pages, (p) => Boolean(p.booking))} />
            <Check
              ok={pages.some((p) => p.emergencyReferral)}
              label="Emergency referral stated"
              detail={distinct(pages.map((p) => p.emergencyReferral).filter(Boolean) as string[]).slice(0, 2).join(" / ")}
              sources={pagesWith(pages, (p) => Boolean(p.emergencyReferral))}
            />
            <Check ok={pages.some((p) => p.paymentInfo)} label="Payment information" sources={pagesWith(pages, (p) => Boolean(p.paymentInfo))} />
            <Check ok={pages.some((p) => p.pricesShown.length)} label="Any prices shown" detail={distinct(pages.flatMap((p) => p.pricesShown)).slice(0, 4).join(" · ")} sources={pagesWith(pages, (p) => p.pricesShown.length > 0)} />
            <Check ok={pages.some((p) => p.hasFaq)} label="FAQ content" sources={pagesWith(pages, (p) => p.hasFaq)} />
            {t && (
              <>
                <Check ok={types.has("VeterinaryCare") || types.has("LocalBusiness") || types.has("AnimalHospital")} label="Practice structured data (LocalBusiness / VeterinaryCare)" sources={["technical.summary.schemaTypes"]} />
                <Check ok={types.has("Person")} label="Doctor structured data (Person)" sources={["technical.summary.schemaTypes"]} />
              </>
            )}
          </ul>
        </Section>
      )}

      {c && (
        <Section
          n={num()}
          title="Blog findings"
          intro="AI tools quote blog posts that answer one question clearly, carry a named author and date, and point to the service that solves the problem."
        >
          {blogPosts.length === 0 ? (
            <p className="text-sm text-slate-600">No blog posts were found in the sitemap.</p>
          ) : (
            <>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-left uppercase tracking-wide text-slate-500">
                    <th className="py-1.5 font-semibold">Post</th>
                    <th className="py-1.5 pl-2 font-semibold">Question heading</th>
                    <th className="py-1.5 pl-2 font-semibold">Author</th>
                    <th className="py-1.5 pl-2 font-semibold">Date</th>
                    <th className="py-1.5 pl-2 font-semibold">Links to a service</th>
                    <th className="py-1.5 pl-2 font-semibold">Article schema</th>
                  </tr>
                </thead>
                <tbody>
                  {blogPosts.map((p) => {
                    const crawl = crawlByUrl.get(p.url);
                    return (
                      <tr key={p.url} className="border-b border-slate-100 align-top" style={{ breakInside: "avoid" }}>
                        <td className="py-1.5 pr-2 text-slate-700">
                          {p.currentH1 ?? "(no H1)"}
                          <span className="block text-[10px] text-slate-500">{shortUrl(p.url)}</span>
                        </td>
                        <td className="py-1.5 pl-2">{yesNo(Boolean(p.blog?.questionHeading))}</td>
                        <td className="py-1.5 pl-2">{p.blog?.authorNamed ?? "No"}</td>
                        <td className="py-1.5 pl-2">{p.blog?.dateShown ?? "No"}</td>
                        <td className="py-1.5 pl-2">{yesNo(Boolean(p.blog?.linksToServicePage))}</td>
                        <td className="py-1.5 pl-2">{yesNo(Boolean(crawl?.schemaTypes.some((x) => /Article|BlogPosting/.test(x))))}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {t?.summary.slashVariants.loops.some((u) => /blog/i.test(u)) && (
                <p className="text-[13px] text-red-700">
                  Some blog posts break when the trailing slash is removed (see technical findings).
                </p>
              )}
            </>
          )}
        </Section>
      )}

      {t && (
        <Section n={num()} title="Technical findings" intro={`From our crawl of every sitemap URL on ${dateOf(t.crawledAt)}. The crawl spreadsheet has every page.`}>
          <ul className="space-y-2">
            {findings.map((f) => (
              <li
                key={f.text}
                className="rounded-xl border-l-4 bg-slate-50 px-3 py-2"
                style={{ borderColor: f.tone === "bad" ? "#dc2626" : f.tone === "warn" ? "#d97706" : "#059669", breakInside: "avoid" }}
              >
                <p className="text-[13px] text-slate-800">{f.text}</p>
                {f.urls && <Sources items={f.urls} />}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {c && (
        <Section n={num()} title="Doctors & services">
          <p className="text-sm font-semibold text-slate-800">Doctors</p>
          {doctors.size === 0 ? (
            <p className="text-sm text-slate-600">No doctors are named on any page we read.</p>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-left uppercase tracking-wide text-slate-500">
                  <th className="py-1.5 font-semibold">Name as written</th>
                  <th className="py-1.5 pl-2 font-semibold">Credentials</th>
                  <th className="py-1.5 pl-2 font-semibold">Bio</th>
                  <th className="py-1.5 pl-2 font-semibold">School / year</th>
                  <th className="py-1.5 pl-2 font-semibold">Found on</th>
                </tr>
              </thead>
              <tbody>
                {[...doctors.values()].map((d) => (
                  <tr key={d.name} className="border-b border-slate-100 align-top" style={{ breakInside: "avoid" }}>
                    <td className="py-1.5 text-slate-800">{d.name}</td>
                    <td className="py-1.5 pl-2">{d.credentials ?? "Not shown"}</td>
                    <td className="py-1.5 pl-2">{yesNo(d.hasBio)}</td>
                    <td className="py-1.5 pl-2">{[d.school, d.year].filter(Boolean).join(", ") || "Not stated"}</td>
                    <td className="py-1.5 pl-2 text-[10px] text-slate-500">{d.urls.slice(0, 3).map(shortUrl).join(" · ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="pt-3 text-sm font-semibold text-slate-800">Services with their own page ({servicePages.length})</p>
          <ul className="grid gap-x-4 text-[13px] sm:grid-cols-2">
            {servicePages.map((p) => (
              <li key={p.url}>
                {p.currentH1 ?? shortUrl(p.url)} <span className="text-[10px] text-slate-500">{shortUrl(p.url)}</span>
              </li>
            ))}
          </ul>
          {c.site.servicesWithoutPage.length > 0 && (
            <div className="rounded-xl border-l-4 bg-slate-50 px-3 py-2" style={{ borderColor: "#d97706", breakInside: "avoid" }}>
              <p className="text-[13px] text-slate-800">
                Named on the site but without a page of their own: {c.site.servicesWithoutPage.join(", ")}.
              </p>
              <Sources items={pagesWith(pages, (p) => p.servicesNamed.length > 0)} />
            </div>
          )}
          {c.site.menuItemsGoingNowhere.length > 0 && (
            <div className="rounded-xl border-l-4 bg-slate-50 px-3 py-2" style={{ borderColor: "#dc2626", breakInside: "avoid" }}>
              <p className="text-[13px] text-slate-800">Menu items that lead nowhere: {c.site.menuItemsGoingNowhere.join(", ")}.</p>
            </div>
          )}
        </Section>
      )}

      {c && (
        <Section n={num()} title="Conversion & clarity" intro="Can a new client quickly tell when you're open, how to book, what to do in an emergency and how to pay?">
          <ul>
            {(() => {
              const hours = distinct(pages.map((p) => p.hours).filter(Boolean) as string[]);
              return (
                <Check
                  ok={hours.length > 0 && c.site.hoursContradictions.length === 0}
                  label={hours.length === 0 ? "Hours aren't on the site" : c.site.hoursContradictions.length ? "Hours disagree between pages" : "Hours are consistent"}
                  detail={[...c.site.hoursContradictions, ...hours.slice(0, 2)].join(" / ")}
                  sources={pagesWith(pages, (p) => Boolean(p.hours))}
                />
              );
            })()}
            <Check
              ok={pages.some((p) => p.booking)}
              label="Booking"
              detail={distinct(pages.map((p) => p.booking).filter(Boolean) as string[]).join(" / ") || "No booking method stated."}
              sources={pagesWith(pages, (p) => Boolean(p.booking))}
            />
            <Check
              ok={pages.some((p) => p.emergencyReferral)}
              label="Emergencies"
              detail={distinct(pages.map((p) => p.emergencyReferral).filter(Boolean) as string[]).join(" / ") || "No emergency referral stated."}
              sources={pagesWith(pages, (p) => Boolean(p.emergencyReferral))}
            />
            <Check
              ok={pages.some((p) => p.paymentInfo)}
              label="Payment"
              detail={distinct(pages.map((p) => p.paymentInfo).filter(Boolean) as string[]).join(" / ") || "No payment information."}
              sources={pagesWith(pages, (p) => Boolean(p.paymentInfo))}
            />
            <Check
              ok={uniqueTypos.length === 0}
              label={uniqueTypos.length ? `${uniqueTypos.length} spelling mistakes in addresses, titles, menus or text` : "No spelling mistakes found"}
              detail={uniqueTypos
                .slice(0, 10)
                .map((ty) => `"${ty.text}" → "${ty.suggestion}" (${ty.where})`)
                .join(" · ")}
              sources={distinct(uniqueTypos.map((ty) => ty.url))}
            />
          </ul>
        </Section>
      )}

      {c && c.site.differentiators.length > 0 && (
        <Section n={num()} title="Differentiators to lead with" intro="Strengths the site or the practice's reviews already show, which most competitors can't claim. Each one cites where it comes from.">
          <div className="space-y-3">
            {c.site.differentiators.map((d) => (
              <div key={d.title} className="rounded-2xl border border-slate-200 p-4" style={{ breakInside: "avoid" }}>
                <p className="text-sm font-semibold" style={{ color: INDIGO }}>
                  {d.title}
                </p>
                <p className="mt-1 text-[13px] leading-relaxed text-slate-700">{d.detail}</p>
                <EvidenceList items={d.evidence} />
              </div>
            ))}
          </div>
          <p className="text-[11px] text-slate-500">&quot;Review N&quot; is the Nth newest Google review at the time of the audit (authority.google.reviews).</p>
        </Section>
      )}

      {c && (
        <Section n={num()} title="Messaging" intro="A positioning line and homepage headline built from the differentiators above.">
          <div className="rounded-2xl p-5 text-white" style={{ background: GRADIENT, breakInside: "avoid" }}>
            <p className="text-xs font-semibold uppercase tracking-wide text-white/75">Positioning line</p>
            <p className="mt-1 text-lg leading-snug" style={{ fontFamily: "var(--font-heading)" }}>
              {c.site.positioningLine}
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl bg-slate-50 p-4" style={{ breakInside: "avoid" }}>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Homepage H1 today</p>
              <p className="mt-1 text-sm text-slate-800">{homepage?.currentH1 ?? t?.pages.find((p) => p.finalStatus === 200)?.h1s[0] ?? "(none)"}</p>
              {homepage && <Sources items={[homepage.url]} />}
            </div>
            <div className="rounded-2xl bg-slate-50 p-4" style={{ breakInside: "avoid" }}>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Recommended homepage H1</p>
              <p className="mt-1 text-sm font-medium" style={{ color: INDIGO }}>
                {c.site.homepageH1}
              </p>
              {homepage?.secondaryLine && <p className="text-xs text-slate-600">Keep as a line beneath: {homepage.secondaryLine}</p>}
            </div>
          </div>
        </Section>
      )}

      {fixes.length > 0 && (
        <Section n={num()} title="Prioritized fix list" intro="Ranked by impact on new clients. Each fix says why it matters and what it's based on.">
          <ol className="space-y-3">
            {fixes.map((f) => (
              <li key={f.rank} className="flex gap-3 rounded-2xl border border-slate-200 p-4" style={{ breakInside: "avoid" }}>
                <span
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
                  style={{ background: f.rank <= 3 ? PINK : INDIGO }}
                >
                  {f.rank}
                </span>
                <div className="min-w-0">
                  <p className="text-sm text-slate-800">{f.fix}</p>
                  <p className="mt-1 text-[13px] text-slate-600">
                    <span className="font-medium">Why it matters:</span> {f.whyItMatters}
                  </p>
                  <EvidenceList items={f.evidence} />
                </div>
              </li>
            ))}
          </ol>
        </Section>
      )}

      {c && (
        <Section n="Appendix A" title="Current vs recommended H1, page by page" intro="The H1 is the main headline on a page. The pattern we recommend: what, for whom, in which town.">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-left uppercase tracking-wide text-slate-500">
                <th className="py-1.5 font-semibold">Page</th>
                <th className="py-1.5 pl-2 font-semibold">Today</th>
                <th className="py-1.5 pl-2 font-semibold">Recommended</th>
              </tr>
            </thead>
            <tbody>
              {pages.map((p) => (
                <tr key={p.url} className="border-b border-slate-100 align-top" style={{ breakInside: "avoid" }}>
                  <td className="py-1.5 pr-2 text-[10px] text-slate-500">{shortUrl(p.url)}</td>
                  <td className="py-1.5 pl-2 text-slate-700">{p.currentH1 ?? "(none)"}</td>
                  <td className="py-1.5 pl-2 text-slate-900">
                    {p.recommendedH1}
                    {p.secondaryLine && <span className="block text-[10px] text-slate-500">Below it: {p.secondaryLine}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}

      {t && (
        <Section n="Appendix B" title="Technical signals" intro={`Crawled ${dateOf(t.crawledAt)}. Sitemaps read: ${t.sitemapsRead.map(shortUrl).join(", ") || "none"}.`}>
          <MetricTable rows={compareMetrics(technicalMetrics(r), prev?.technical ? technicalMetrics(prev) : null)} lastDate={prev?.technical ? lastDate : null} source="technical.summary" />
          <p className="pt-2 text-[13px] text-slate-600">
            Sitemap URLs by host: {Object.entries(t.summary.byHost).map(([host, count]) => `${host} ${count}`).join(", ")}. Structured data types found:{" "}
            {t.summary.schemaTypes.join(", ") || "none"}. robots.txt: {Object.values(t.robotsTxt).some(Boolean) ? "present" : "missing"}. llms.txt:{" "}
            {Object.values(t.llmsTxt).some(Boolean) ? "present" : "missing"}.
          </p>
          <table className="w-full text-[10px]">
            <thead>
              <tr className="border-b border-slate-200 text-left uppercase tracking-wide text-slate-500">
                <th className="py-1 font-semibold">Sitemap URL</th>
                <th className="py-1 pl-1 font-semibold">Status</th>
                <th className="py-1 pl-1 font-semibold">H1s</th>
                <th className="py-1 pl-1 font-semibold">Canonical</th>
                <th className="py-1 pl-1 font-semibold">Schema</th>
                <th className="py-1 pl-1 text-right font-semibold">Words</th>
              </tr>
            </thead>
            <tbody>
              {t.pages.map((p) => (
                <tr key={p.url} className="border-b border-slate-100" style={{ breakInside: "avoid" }}>
                  <td className="py-0.5 pr-1 text-slate-700">
                    {shortUrl(p.url)}
                    {p.chain.length > 1 && <span className="text-slate-400"> → {shortUrl(p.finalUrl)}</span>}
                  </td>
                  <td className="py-0.5 pl-1">{p.redirectLoop ? "loop" : p.softError ? "error page" : (p.finalStatus ?? "—")}</td>
                  <td className="py-0.5 pl-1">{p.h1s.length}</td>
                  <td className="py-0.5 pl-1">{p.canonical ? (p.canonicalMatchesIgnoringSlash ? "ok" : "differs") : "none"}</td>
                  <td className="py-0.5 pl-1">{p.schemaTypes.length ? "yes" : "no"}</td>
                  <td className="py-0.5 pl-1 text-right">{p.finalStatus === 200 ? p.wordCount : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}

      <Section n="Appendix C" title="Methodology">
        <dl className="grid gap-x-4 gap-y-1 text-[13px] sm:grid-cols-[12rem_1fr]">
          <dt className="font-medium text-slate-800">Run dates</dt>
          <dd>
            Crawl {dateOf(t?.crawledAt)} · Authority & reviews {dateOf(a?.checkedAt)} · AI visibility {dateOf(v?.ranAt)} · Content {dateOf(c?.ranAt)} · Score{" "}
            {dateOf(s?.computedAt)}
          </dd>
          {lastDate && (
            <>
              <dt className="font-medium text-slate-800">Compared with</dt>
              <dd>The audit of the same domain run on {lastDate}.</dd>
            </>
          )}
          <dt className="font-medium text-slate-800">Technical crawl</dt>
          <dd>
            Our own crawler, at most 3 requests at a time. Every URL in the sitemaps on both the www and bare host, every redirect followed one hop at a time, each
            page also requested with the trailing slash added or removed, and pages the site links to but its sitemap leaves out.
          </dd>
          <dt className="font-medium text-slate-800">Authority & reviews</dt>
          <dd>
            DataForSEO Backlinks (its own 0–1000 rank, not Moz or Ahrefs &quot;Domain Rating&quot;) and Google Business data via DataForSEO: rating, review count and the{" "}
            {reviews.length} newest reviews, read without reviewer names.
          </dd>
          {v && (
            <>
              <dt className="font-medium text-slate-800">AI platforms and models</dt>
              <dd>
                {v.platforms.map((p) => `${PLATFORM_LABEL[p.platform]}: ${v.models[p.platform] ?? p.model ?? "as served"}`).join(" · ")}. Google results located to{" "}
                {place(v.location)}. Settings: {v.profile === "consumer" ? "the models consumers use" : "lower-cost models"}.
              </dd>
              <dt className="font-medium text-slate-800">Observed answers</dt>
              <dd>DataForSEO LLM Mentions, {v.mentions.window}. Reported separately from our questions.</dd>
            </>
          )}
          {c && (
            <>
              <dt className="font-medium text-slate-800">Content reading</dt>
              <dd>
                {c.pages.length} pages read by {c.pageModel}; differentiators, messaging and fixes written by {c.siteModel} from the whole audit and the reviews, each
                required to cite its source.
              </dd>
            </>
          )}
          <dt className="font-medium text-slate-800">Citability score</dt>
          <dd>
            Fixed arithmetic, weights version {s?.weightsVersion ?? weightsConfig.version}:{" "}
            {Object.entries(weightsConfig.weights)
              .map(([k, w]) => `${s?.subScores.find((p) => p.key === k)?.label ?? k} ${w}`)
              .join(", ")}
            .
          </dd>
          <dt className="font-medium text-slate-800">Not measured</dt>
          <dd>Whether Google has indexed each page: that needs the practice&apos;s own Search Console access.</dd>
        </dl>
        {v && (
          <div className="pt-2">
            <p className="text-sm font-semibold text-slate-800">The exact questions asked ({v.prompts.length})</p>
            {(["local", "service", "informational"] as const).map((kind) => (
              <div key={kind} className="mt-2" style={{ breakInside: "avoid" }}>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{kind === "local" ? "Local" : kind === "service" ? "Services" : "General pet care"}</p>
                <ol className="list-decimal pl-5 text-[12px] text-slate-700">
                  {v.prompts
                    .filter((p) => p.kind === kind)
                    .map((p) => (
                      <li key={p.id}>{p.text}</li>
                    ))}
                </ol>
              </div>
            ))}
          </div>
        )}
      </Section>

      <footer className="border-t border-slate-200 pt-4 text-center text-xs text-slate-500">
        Beyond Indigo Pets · beyondindigopets.com · Audit #{audit.id}, {runDate}
      </footer>
    </article>
  );
}
