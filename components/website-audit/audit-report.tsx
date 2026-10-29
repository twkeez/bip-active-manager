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
import { SIDE_SERVICES, standing } from "@/lib/website-audit/competitors";
import { technicalFindings } from "@/lib/website-audit/findings";
import { PLATFORM_LABEL } from "@/lib/website-audit/platforms";
import type { AiPlatform, AuditResults, CompetitorListing, CompetitorResults, Evidence, PageContent, ServiceComparison, WebsiteAuditRow } from "@/lib/website-audit/types";

// The branded Website, SEO & AI Search Audit report (printed to PDF from
// /website-audit-print/[id]), written for the practice owner, not for us:
// plain words, "you" and "your". Page order follows Tom's spec. Every finding
// shows the page it comes from, or names the part of the audit behind it (the
// exact JSON field is kept in a tooltip), and a re-run of the same domain adds
// a "last run" column. Fixed brand colours, like the team guide and the client
// documents.

const INDIGO = "#3350a2";
const PURPLE = "#603894";
const MAGENTA = "#962583";
const PINK = "#ce2084";
const GRADIENT = `linear-gradient(120deg, ${INDIGO} 0%, ${PURPLE} 55%, ${MAGENTA} 100%)`;
const URL_LIMIT = 8;

export type PreviousRun = { id: number; created_at: string; results: AuditResults };

const PLATFORM_PLAIN: Record<AiPlatform, string> = {
  ai_overview: "The AI summary at the top of a normal Google search",
  ai_mode: "Google's chat-style search",
  chatgpt: "AI assistant (OpenAI)",
  gemini: "AI assistant (Google)",
  perplexity: "AI search engine",
  claude: "AI assistant (Anthropic)",
};

const dateOf = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "—";

/** "https://www.dhah.org/about/" → "www.dhah.org/about/" */
const shortUrl = (url: string) => url.replace(/^https?:\/\//, "");
const isUrl = (s: string) => /^https?:\/\//.test(s);
const clip = (s: string, max = 180) => (s.length > max ? `${s.slice(0, max).replace(/[,;\s]+\S*$/, "")}…` : s);
/** DataForSEO writes locations as "Powder Springs,Georgia,United States". */
const place = (s: string) => s.replace(/,\s*/g, ", ");

/** A field of the audit JSON, in words a client can follow ("review 6" → "Google review 6"). */
function sourceLabel(source: string): string {
  const review = source.match(/^review\s+(\d+)/i);
  if (review) return `Google review ${review[1]}`;
  if (/^aiVisibility\.mentions/.test(source)) return "AI answers recorded over 90 days";
  if (/^aiVisibility/.test(source)) return "Our AI question test";
  if (/^authority\.google/.test(source)) return "Your Google Business Profile";
  if (/^competitors/.test(source)) return "Google Maps search near you";
  if (/^authority/.test(source)) return "Links from other websites";
  if (/^technical/.test(source)) return "Our scan of your website";
  if (/^score/.test(source)) return "Score breakdown";
  if (/^content/.test(source)) return "Our reading of your pages";
  return source;
}

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

function Sources({ items, label = "Found on" }: { items: string[]; label?: string }) {
  if (!items.length) return null;
  const shown = distinct(items.map((s) => (isUrl(s) ? s : sourceLabel(s)))).slice(0, URL_LIMIT);
  const rest = items.length - shown.length;
  return (
    <p className="mt-1 text-[11px] leading-relaxed text-slate-500" title={items.filter((s) => !isUrl(s)).join(", ") || undefined}>
      {label}: {shown.map((s) => (isUrl(s) ? shortUrl(s) : s)).join(" · ")}
      {rest > 0 && ` · and ${rest} more`}
    </p>
  );
}

/** Words quoted from a page or a review get quotation marks; a finding from our own checks reads as a plain sentence. */
const isQuoted = (source: string) => isUrl(source) || /^review\s+\d+/i.test(source);

function EvidenceList({ items }: { items: Evidence[] }) {
  if (!items.length) return null;
  return (
    <ul className="mt-1 space-y-0.5 text-[11px] leading-relaxed text-slate-500">
      {items.map((e, i) => (
        <li key={i} title={isUrl(e.source) ? undefined : e.source}>
          {isQuoted(e.source) ? (
            <>
              <span className="font-medium text-slate-600">{isUrl(e.source) ? shortUrl(e.source) : sourceLabel(e.source)}</span> says: “{e.quote}”
            </>
          ) : (
            <>
              {e.quote} <span className="text-slate-400">({sourceLabel(e.source)})</span>
            </>
          )}
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

/** A metrics table; the last-time columns appear only when there was an earlier audit. */
function MetricTable({ rows, lastDate, heading = "What we measured" }: { rows: MetricComparison[]; lastDate: string | null; heading?: string }) {
  if (!rows.length) return null;
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
          <th className="py-1.5 font-semibold">{heading}</th>
          <th className="py-1.5 pl-3 text-right font-semibold">Today</th>
          {lastDate && <th className="py-1.5 pl-3 text-right font-semibold">Last time ({lastDate})</th>}
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


const stars = (n: number | null) => (n == null ? "—" : `${n.toFixed(1)}★`);
const count = (n: number | null) => (n == null ? "—" : n.toLocaleString("en-US"));
/** "1 of 8" / "all 8" / "none of the 8" */
const ofThem = (n: number, total: number) => (n === total ? `all ${total}` : n === 0 ? `none of the ${total}` : `${n} of ${total}`);

/** One sentence placing the practice among the listings, from the counts alone. */
function standingLine(you: CompetitorResults["you"], listings: CompetitorListing[], noun: string): string | null {
  const st = standing(you, listings);
  if (!st.count || you.rating == null) return null;
  const higher = st.higherRatingThan ?? 0;
  const lower = st.lowerRatingThan ?? 0;
  const tied = st.count - higher - lower;
  const rating =
    lower === 0 && tied === 0
      ? `Your ${stars(you.rating)} is higher than all ${st.count} ${noun} below`
      : lower === 0
        ? `No one below beats your ${stars(you.rating)}: it's higher than ${higher} of the ${st.count} ${noun} and level with ${tied}`
        : `Your ${stars(you.rating)} is higher than ${ofThem(higher, st.count)} ${noun} below${tied ? `, level with ${tied}` : ""} and lower than ${lower}`;
  const reviews = you.reviewCount != null && st.moreReviewsThan != null ? `, and you have more reviews than ${ofThem(st.moreReviewsThan, st.count)}` : "";
  const typical = st.medianRating != null ? ` A typical one has ${stars(st.medianRating)} from ${count(st.medianReviews == null ? null : Math.round(st.medianReviews))} reviews.` : "";
  return `${rating}${reviews}.${typical}`;
}

function CompetitorTable({ you, listings, yourLabel }: { you: CompetitorResults["you"]; listings: CompetitorListing[]; yourLabel: string }) {
  const rows: (CompetitorListing & { main?: boolean })[] = [
    { name: you.name ?? "You", domain: null, category: yourLabel, rating: you.rating, reviewCount: you.reviewCount, miles: null, position: 0, isYou: true, main: true },
    ...listings,
  ];
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
          <th className="py-1.5 font-semibold">Business</th>
          <th className="py-1.5 pl-3 text-right font-semibold">Distance</th>
          <th className="py-1.5 pl-3 text-right font-semibold">Rating</th>
          <th className="py-1.5 pl-3 text-right font-semibold">Reviews</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((l, i) => (
          <tr key={i} className="border-b border-slate-100" style={{ breakInside: "avoid", background: l.isYou ? "#eef2ff" : undefined }}>
            <td className="py-1.5 pr-2 text-slate-800">
              <span className={l.isYou ? "font-semibold" : undefined}>{l.name}</span>
              {l.isYou && !l.main && <span className="text-xs text-slate-500"> (yours)</span>}
              {l.category && <span className="block text-[11px] text-slate-500">{l.category}</span>}
            </td>
            <td className="py-1.5 pl-3 text-right text-slate-600">{l.main ? "—" : l.miles != null ? `${l.miles} mi` : "—"}</td>
            <td className="py-1.5 pl-3 text-right font-medium text-slate-900">{stars(l.rating)}</td>
            <td className="py-1.5 pl-3 text-right text-slate-700">{count(l.reviewCount)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function SideServiceBlock({ comp, you }: { comp: ServiceComparison; you: CompetitorResults["you"] }) {
  const def = SIDE_SERVICES[comp.service as keyof typeof SIDE_SERVICES];
  const service = comp.label.toLowerCase();
  const listedForIt = you.categories.some((cat) => def.category.test(cat));
  const others = comp.listings.filter((l) => !l.isYou);
  const line = standingLine(you, comp.listings, "businesses");
  return (
    <div className="space-y-2 rounded-2xl border border-slate-200 p-4" style={{ breakInside: "avoid" }}>
      <p className="text-sm font-semibold text-slate-800">{comp.label}: you vs. businesses that only do {service}</p>
      <p className="text-xs leading-relaxed text-slate-600">
        You offer {service}, so you compete with businesses that do nothing else. When a pet owner near you searches Google Maps for “{comp.search}”,{" "}
        {comp.yourPosition
          ? `you show up at number ${comp.yourPosition}.`
          : "you don't show up in the first 20 results, even searching from your own address."}{" "}
        Keep in mind: your Google rating covers your whole practice, while theirs is about {service} alone.
      </p>
      {comp.error ? (
        <p className="text-xs text-red-700">We couldn&apos;t complete this search: {comp.error}</p>
      ) : others.length === 0 ? (
        <p className="text-xs text-slate-600">We found no businesses near you that only do {service}.</p>
      ) : (
        <>
          {line && <p className="text-sm text-slate-700">{line}</p>}
          <CompetitorTable you={you} listings={comp.listings} yourLabel="Your practice (one rating for everything you do)" />
        </>
      )}
      {!comp.yourPosition && (
        <p className="text-xs leading-relaxed text-slate-600">
          <span className="font-semibold text-slate-700">To show up: </span>
          {listedForIt ? "" : `add “${def.googleCategory}” as an extra category on your Google listing, `}
          give {service} its own page on your website, and ask {service} clients for a Google review that mentions it.
        </p>
      )}
      <Sources items={comp.offeredBecause} label="We know you offer it from" />
    </div>
  );
}

const yesNo = (v: boolean) => (v ? "Yes" : "No");
/** The score's detail lines start with ✓ / ✗ / ◐ marks; the summary reads better without them. */
const unmarked = (s: string) => s.replace(/^[✓✗◐]\s*/, "");
/** What a few pages say, without repeating every page's wording. */
const firstFew = (items: (string | null)[], count = 2) =>
  distinct(items.filter(Boolean) as string[])
    .slice(0, count)
    .map((x) => clip(x, 160))
    .join(" / ");
const pagesWith = (pages: PageContent[], test: (p: PageContent) => boolean) => pages.filter(test).map((p) => p.url);
function distinct<T>(items: T[]): T[] {
  return [...new Set(items)];
}

export default function AuditReport({ audit, previous }: { audit: WebsiteAuditRow; previous: PreviousRun | null }) {
  const r = audit.results;
  const t = r.technical;
  const a = r.authority;
  const v = r.aiVisibility;
  const c = r.content;
  const s = r.score;
  const comp = r.competitors;
  const vets = comp?.comparisons.find((x) => x.service === "vet");
  const sideServices = comp?.comparisons.filter((x) => x.service !== "vet") ?? [];
  const pages = c?.pages.filter((p) => !p.error) ?? [];
  const runDate = dateOf(s?.computedAt ?? c?.ranAt ?? audit.created_at);
  const lastDate = previous ? dateOf(previous.created_at) : null;
  const prev = previous?.results ?? null;
  const location = [audit.city, audit.state].filter(Boolean).join(", ");
  const town = audit.city ?? "your area";

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
  const kindOf = (promptId: string) => v?.prompts.find((p) => p.id === promptId)?.kind;
  const answeredOfKind = (kind: string) => v?.runs.filter((run) => run.answered && kindOf(run.promptId) === kind) ?? [];
  const informationalRuns = answeredOfKind("informational");
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
  // Claude sometimes files a "no typo here" note as a typo; those aren't findings.
  const typos = pages.flatMap((p) => p.typos.filter((ty) => !/no typo|placeholder/i.test(ty.suggestion)).map((ty) => ({ ...ty, url: p.url })));
  const uniqueTypos = [...new Map(typos.map((ty) => [`${ty.text}→${ty.suggestion}`, ty])).values()];
  const reviews = a?.google.reviews ?? [];
  const answeredReviews = reviews.filter((rv) => rv.ownerAnswered).length;
  const types = new Set(t?.summary.schemaTypes ?? []);
  const homepage = pages.find((p) => p.pageType === "home");

  let n = 0;
  const num = () => String(++n).padStart(2, "0");

  return (
    <article className="mx-auto max-w-3xl space-y-8 text-slate-700">
      {/* Cover */}
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
            { label: "Your score", value: s ? String(s.total) : "—", sub: s ? `out of 100 · ${s.band}` : "Not scored yet", m: byKey.get("score") },
            {
              label: "AI recommends you",
              value: formatMetric(byKey.get("aiShare")?.value ?? null, "percent"),
              sub: ai ? `of the time (${ai.hits} of ${ai.answered} AI answers)` : "Not checked",
              m: byKey.get("aiShare"),
            },
            {
              label: "Google rating",
              value: formatMetric(a?.google.rating ?? null, "rating"),
              sub: a?.google.reviewCount != null ? `from ${a.google.reviewCount.toLocaleString("en-US")} reviews` : "No listing found",
              m: byKey.get("rating"),
            },
            { label: "Website problems", value: t ? String(problems.length) : "—", sub: t ? `that need fixing, across ${t.summary.uniquePages} pages` : "Not checked", m: undefined },
          ].map((tile) => (
            <div key={tile.label} className="rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.12)" }}>
              <p className="text-[11px] font-medium uppercase tracking-wide text-white/75">{tile.label}</p>
              <p className="mt-1 text-3xl font-semibold" style={{ fontFamily: "var(--font-heading)" }}>
                {tile.value}
              </p>
              <p className="text-xs text-white/80">{tile.sub}</p>
              {tile.m?.last != null && <p className="mt-1 text-[11px] text-white/80">Last time: {formatMetric(tile.m.last, tile.m.format)}</p>}
            </div>
          ))}
        </div>
        <p className="mt-6 text-xs text-white/70">Prepared by Beyond Indigo Pets · beyondindigopets.com</p>
      </header>

      <Section n={num()} title="The short version" newPage={false} intro="What's helping you, what's holding you back, and the three things to do first.">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 p-4" style={{ breakInside: "avoid" }}>
            <p className="text-sm font-semibold text-emerald-700">What's working</p>
            <ul className="mt-2 space-y-2 text-[13px] leading-snug">
              {working.map((p) => (
                <li key={p.key}>
                  <span className="font-medium text-slate-800">{p.label}.</span> {unmarked(p.details[0])}
                </li>
              ))}
              {v && ai && ai.hits > 0 && (
                <li>
                  <span className="font-medium text-slate-800">Local searches.</span> When people ask AI for a vet in {town}, you come up in{" "}
                  {answeredOfKind("local").filter((run) => run.cited || run.mentioned).length} of {answeredOfKind("local").length} answers.
                </li>
              )}
              {(c?.site.differentiators ?? []).slice(0, 2).map((d) => (
                <li key={d.title}>
                  <span className="font-medium text-slate-800">{d.title}.</span> Your reviews and website back this up.
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-slate-200 p-4" style={{ breakInside: "avoid" }}>
            <p className="text-sm font-semibold text-red-700">What's holding you back</p>
            <ul className="mt-2 space-y-2 text-[13px] leading-snug">
              {v && informationalRuns.length > 0 && informationalHits === 0 && (
                <li>
                  <span className="font-medium text-slate-800">Everyday pet questions.</span> When people ask AI things like &quot;why is my dog limping?&quot;, it never
                  mentions you. It quotes other websites instead.
                </li>
              )}
              {holding.map((p) => (
                <li key={p.key}>
                  <span className="font-medium text-slate-800">{p.label}.</span> {clip(unmarked(p.details[p.details.length - 1]))}
                </li>
              ))}
              {problems.length > 0 && (
                <li>
                  <span className="font-medium text-slate-800">Website problems.</span> We found {problems.length} that need fixing (see &quot;Website health&quot;).
                </li>
              )}
            </ul>
          </div>
          <div className="rounded-2xl border border-slate-200 p-4" style={{ breakInside: "avoid" }}>
            <p className="text-sm font-semibold" style={{ color: INDIGO }}>
              What to do first
            </p>
            <ol className="mt-2 list-decimal space-y-2 pl-4 text-[13px] leading-snug">
              {fixes.slice(0, 3).map((f) => (
                <li key={f.rank}>{f.fix}</li>
              ))}
            </ol>
          </div>
        </div>
      </Section>

      <Section n={num()} title="Your two numbers, explained" intro="This report gives you two numbers. They measure different things, so it helps to keep them apart.">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl bg-slate-50 p-4" style={{ breakInside: "avoid" }}>
            <p className="text-sm font-semibold" style={{ color: INDIGO }}>
              Your score: {s?.total ?? "—"} out of 100
            </p>
            <p className="mt-1 text-[13px] leading-relaxed text-slate-600">
              Think of this as a home inspection. It checks how well your website is built for Google and AI tools to read, trust and recommend. We add up points
              for things like your reviews, your doctors&apos; bios, your service pages and the technical set-up. The same website always gets the same score: no
              guesswork. <strong>This is the number you can improve directly</strong>, by making the changes in this report.
            </p>
            <p className="mt-2 text-xs text-slate-500">
              {weightsConfig.bands.map((b, i, all) => `${b.label}: ${b.min}${i === 0 ? "–100" : `–${all[i - 1].min - 1}`}`).join(" · ")}
            </p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4" style={{ breakInside: "avoid" }}>
            <p className="text-sm font-semibold" style={{ color: INDIGO }}>
              AI recommends you {formatMetric(byKey.get("aiShare")?.value ?? null, "percent")} of the time
            </p>
            <p className="mt-1 text-[13px] leading-relaxed text-slate-600">
              Think of this as a test drive. We asked six AI tools the questions a pet owner near you might ask, and counted how often the answer mentioned you or
              linked to your website. AI answers change from day to day, so treat this as a snapshot. A better score tends to lift this number over the following
              months.
            </p>
          </div>
        </div>
        {s && (
          <>
            <p className="pt-2 text-sm font-semibold text-slate-800">Where your {s.total} points come from</p>
            <MetricTable rows={compareMetrics(scoreMetrics(r), prev ? scoreMetrics(prev) : null)} lastDate={lastDate} heading="Area (points available)" />
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
          title="How AI search sees you"
          intro={`More and more pet owners ask AI tools instead of scrolling through search results. On ${dateOf(v.ranAt)} we asked six of them the same ${v.prompts.length} questions, as if we were a pet owner in ${place(v.location)}. The full list of questions is at the end of this report.`}
        >
          <div className="grid gap-3 sm:grid-cols-2" style={{ breakInside: "avoid" }}>
            <div className="rounded-xl bg-slate-50 p-3 text-[13px]">
              <p className="font-semibold text-slate-800">&quot;Mentioned you&quot;</p>
              <p className="text-slate-600">The answer said your practice&apos;s name, for example in a list of recommended vets.</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3 text-[13px]">
              <p className="font-semibold text-slate-800">&quot;Linked to your website&quot;</p>
              <p className="text-slate-600">
                The AI used your website as a source and linked to it. This is the stronger result: the AI is treating your site as a trusted reference.
              </p>
            </div>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="py-1.5 font-semibold">AI tool</th>
                <th className="py-1.5 pl-3 text-right font-semibold">Questions it answered</th>
                <th className="py-1.5 pl-3 text-right font-semibold">Linked to your website</th>
                <th className="py-1.5 pl-3 text-right font-semibold">Mentioned you</th>
              </tr>
            </thead>
            <tbody>
              {v.platforms.map((p) => (
                <tr key={p.platform} className="border-b border-slate-100" style={{ breakInside: "avoid" }}>
                  <td className="py-1.5">
                    <span className="text-slate-800">{p.label}</span>
                    <span className="block text-[11px] text-slate-500">{PLATFORM_PLAIN[p.platform]}</span>
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
          {v.platforms.some((p) => p.platform === "ai_overview" && p.promptsAnswered < p.promptsRun) && (
            <p className="text-xs text-slate-500">Google only shows its AI summary for some searches, so it answered fewer questions than the others.</p>
          )}
          <Sources items={["aiVisibility.platforms"]} label="Source" />
          {prev?.aiVisibility && <MetricTable rows={compareMetrics(platformMetrics(r), platformMetrics(prev))} lastDate={lastDate} />}
          <p className="pt-1 text-sm font-semibold text-slate-800">By type of question</p>
          <div className="grid gap-3 sm:grid-cols-3">
            {(
              [
                ["local", "Looking for a vet", `e.g. "best vet in ${town}"`],
                ["service", "Looking for a service", `e.g. "dog dental cleaning near ${town}"`],
                ["informational", "Everyday pet questions", 'e.g. "why is my dog limping"'],
              ] as const
            ).map(([kind, title, example]) => {
              const runs = answeredOfKind(kind);
              const hits = runs.filter((run) => run.cited || run.mentioned).length;
              return (
                <div key={kind} className="rounded-xl bg-slate-50 p-3 text-[13px]" style={{ breakInside: "avoid" }}>
                  <p className="font-semibold text-slate-800">{title}</p>
                  <p className="text-[11px] text-slate-500">{example}</p>
                  <p className="mt-1 text-2xl font-semibold" style={{ color: hits ? INDIGO : "#b91c1c", fontFamily: "var(--font-heading)" }}>
                    {hits} of {runs.length}
                  </p>
                  <p className="text-slate-600">answers included you</p>
                </div>
              );
            })}
          </div>
          {informationalRuns.length > 0 && (
            <p className="text-[13px] leading-relaxed text-slate-600">
              {informationalHits === 0
                ? "Why the everyday questions matter: pet owners ask these long before they choose a vet. Whoever gives the helpful answer earns their trust first. Right now AI gives that answer using other websites."
                : "Pet owners ask everyday questions long before they choose a vet, so being the answer there earns trust early."}
            </p>
          )}
          {v.topCitedDomains.length > 0 && (
            <div className="rounded-xl border border-slate-200 p-3 text-[13px]" style={{ breakInside: "avoid" }}>
              <p className="font-semibold text-slate-800">Websites AI linked to most often in these answers</p>
              <p className="text-slate-600">
                {v.topCitedDomains
                  .slice(0, 6)
                  .map((d) => `${d.domain} (${d.answers} answers)`)
                  .join(", ")}
                .
              </p>
            </div>
          )}
          <div className="rounded-2xl border border-slate-200 p-4" style={{ breakInside: "avoid" }}>
            <p className="text-sm font-semibold text-slate-800">A second, separate check: what AI has said about you lately</p>
            <p className="mt-1 text-[13px] leading-relaxed text-slate-600">
              Our data provider, DataForSEO, records millions of real AI answers. We looked up the ones from about the last 90 days that mention you. These came from
              questions real people asked, not our test questions, so we keep these numbers separate and don&apos;t add them to the table above.
            </p>
            {v.mentions.error ? (
              <p className="mt-2 text-xs text-red-700">We couldn&apos;t check this today: {v.mentions.error}</p>
            ) : (
              <p className="mt-2 text-[13px] text-slate-700">
                Answers that linked to your website: <strong>{v.mentions.citedAsSource.mentions}</strong>
                {Object.keys(v.mentions.citedAsSource.byPlatform).length > 0 &&
                  ` (${Object.entries(v.mentions.citedAsSource.byPlatform)
                    .map(([k, count]) => `${k.charAt(0).toUpperCase()}${k.slice(1)}: ${count}`)
                    .join(", ")})`}
                {" · "}Answers that mentioned you by name: <strong>{v.mentions.namedInAnswers.mentions}</strong>
              </p>
            )}
            <Sources items={["aiVisibility.mentions"]} label="Source" />
          </div>
        </Section>
      )}

      {(c || a) && (
        <Section n={num()} title="Trust signals" intro="The things a pet owner (and Google, and AI tools) look for when deciding whether to trust a practice.">
          <ul>
            <Check
              ok={a?.google.rating != null ? a.google.rating >= 4.5 : null}
              label="A strong Google rating"
              detail={a?.google.rating != null ? `${a.google.rating}★ from ${a.google.reviewCount ?? "?"} reviews.` : "We couldn't find your Google rating."}
              sources={["authority.google"]}
            />
            {reviews.length > 0 && (
              <Check
                ok={answeredReviews / reviews.length >= 0.5}
                label="You reply to reviews"
                detail={`You replied to ${answeredReviews} of your ${reviews.length} most recent reviews.`}
                sources={["authority.google.reviews"]}
              />
            )}
            <Check
              ok={doctors.size > 0}
              label="Your doctors are named"
              detail={`${doctors.size} named; ${[...doctors.values()].filter((d) => d.hasBio).length} with a bio, ${[...doctors.values()].filter((d) => d.credentials).length} with their qualifications.`}
              sources={distinct([...doctors.values()].flatMap((d) => d.urls))}
            />
            <Check
              ok={pages.some((p) => p.accreditations.length)}
              label="Accreditations shown (such as AAHA, Fear Free, Cat Friendly)"
              detail={distinct(pages.flatMap((p) => p.accreditations)).join(", ") || "None shown on any page. If you hold any, show them: pet owners and AI tools both look for them."}
              sources={pagesWith(pages, (p) => p.accreditations.length > 0)}
            />
            <Check ok={pages.some((p) => p.hours)} label="Opening hours shown" sources={pagesWith(pages, (p) => Boolean(p.hours))} />
            <Check
              ok={pages.some((p) => p.booking)}
              label="Clear how to book"
              detail={firstFew(pages.map((p) => p.booking), 1)}
              sources={pagesWith(pages, (p) => Boolean(p.booking))}
            />
            <Check
              ok={pages.some((p) => p.emergencyReferral)}
              label="Says where to go in an emergency"
              detail={firstFew(pages.map((p) => p.emergencyReferral), 1)}
              sources={pagesWith(pages, (p) => Boolean(p.emergencyReferral))}
            />
            <Check ok={pages.some((p) => p.paymentInfo)} label="Payment options explained" sources={pagesWith(pages, (p) => Boolean(p.paymentInfo))} />
            <Check
              ok={pages.some((p) => p.pricesShown.length)}
              label="Some prices shown"
              detail={distinct(pages.flatMap((p) => p.pricesShown))
                .slice(0, 4)
                .join(" · ")}
              sources={pagesWith(pages, (p) => p.pricesShown.length > 0)}
            />
            <Check ok={pages.some((p) => p.hasFaq)} label="Answers to common questions (FAQ)" sources={pagesWith(pages, (p) => p.hasFaq)} />
            {t && (
              <>
                <Check
                  ok={types.has("VeterinaryCare") || types.has("LocalBusiness") || types.has("AnimalHospital")}
                  label="Google can tell you're a veterinary practice"
                  detail="Hidden labels on your pages (called structured data) tell Google and AI tools your name, address, hours and that you're a vet."
                  sources={["technical.summary.schemaTypes"]}
                />
                <Check
                  ok={types.has("Person")}
                  label="Google can tell who your doctors are"
                  detail="The same kind of hidden label, for each doctor."
                  sources={["technical.summary.schemaTypes"]}
                />
              </>
            )}
          </ul>
        </Section>
      )}

      {comp && (
        <Section
          n={num()}
          title="Your reviews vs. the competition"
          intro="When a pet owner looks you up on Google Maps, these are the businesses they see next to you. Star rating and number of reviews are the first two things they compare."
        >
          {vets && (
            <div className="space-y-2" style={{ breakInside: "avoid" }}>
              <p className="text-sm font-semibold text-slate-800">Other vets near you</p>
              {vets.error ? (
                <p className="text-xs text-red-700">We couldn&apos;t complete this search: {vets.error}</p>
              ) : vets.listings.length === 0 ? (
                <p className="text-xs text-slate-600">We found no other vets near you on Google Maps.</p>
              ) : (
                <>
                  {standingLine(comp.you, vets.listings, "vets") && <p className="text-sm text-slate-700">{standingLine(comp.you, vets.listings, "vets")}</p>}
                  <CompetitorTable you={comp.you} listings={vets.listings} yourLabel="Your practice" />
                  <p className="text-[11px] text-slate-500">The first {vets.listings.length} vets Google Maps shows for “{vets.search}” near your address, in Google&apos;s order.</p>
                </>
              )}
            </div>
          )}
          {sideServices.map((x) => (
            <SideServiceBlock key={x.service} comp={x} you={comp.you} />
          ))}
          {comp.notes.length > 0 && <p className="text-xs text-red-700">{comp.notes.join(" ")}</p>}
        </Section>
      )}

      {c && (
        <Section
          n={num()}
          title="Your blog"
          intro="AI tools love to quote blog posts that answer one clear question, show which vet wrote them and when, and point readers to the service that helps."
        >
          {blogPosts.length === 0 ? (
            <p className="text-sm text-slate-600">We didn&apos;t find any blog posts.</p>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-left uppercase tracking-wide text-slate-500">
                  <th className="py-1.5 font-semibold">Post</th>
                  <th className="py-1.5 pl-2 font-semibold">Headline asks a question</th>
                  <th className="py-1.5 pl-2 font-semibold">Written by</th>
                  <th className="py-1.5 pl-2 font-semibold">Date shown</th>
                  <th className="py-1.5 pl-2 font-semibold">Links to a service</th>
                  <th className="py-1.5 pl-2 font-semibold">Labelled as an article for Google</th>
                </tr>
              </thead>
              <tbody>
                {blogPosts.map((p) => {
                  const crawl = crawlByUrl.get(p.url);
                  return (
                    <tr key={p.url} className="border-b border-slate-100 align-top" style={{ breakInside: "avoid" }}>
                      <td className="py-1.5 pr-2 text-slate-700">
                        {p.currentH1 ?? "(no headline)"}
                        <span className="block text-[10px] text-slate-500">{shortUrl(p.url)}</span>
                      </td>
                      <td className="py-1.5 pl-2">{yesNo(Boolean(p.blog?.questionHeading))}</td>
                      <td className="py-1.5 pl-2">{p.blog?.authorNamed ?? "No one named"}</td>
                      <td className="py-1.5 pl-2">{p.blog?.dateShown ?? "No"}</td>
                      <td className="py-1.5 pl-2">{yesNo(Boolean(p.blog?.linksToServicePage))}</td>
                      <td className="py-1.5 pl-2">{yesNo(Boolean(crawl?.schemaTypes.some((x) => /Article|BlogPosting/.test(x))))}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          {blogPosts.some((p) => p.blog?.authorNamed && !/^dr\.?\s|dvm/i.test(p.blog.authorNamed)) && (
            <p className="text-[13px] text-slate-600">
              Tip: posts signed by the practice rather than a named vet carry less weight. A real doctor&apos;s name (with &quot;DVM&quot;) tells readers and AI the advice
              comes from an expert.
            </p>
          )}
        </Section>
      )}

      {t && (
        <Section
          n={num()}
          title="Website health"
          intro={`Things visitors rarely notice but Google and AI tools do. We checked every page you list for Google on ${dateOf(t.crawledAt)}. Red items need fixing; amber items are worth tidying up; green is fine. Your web developer will know what to do with each one.`}
        >
          <ul className="space-y-2">
            {findings.map((f) => (
              <li
                key={f.text}
                className="rounded-xl border-l-4 bg-slate-50 px-3 py-2"
                style={{ borderColor: f.tone === "bad" ? "#dc2626" : f.tone === "warn" ? "#d97706" : "#059669", breakInside: "avoid" }}
              >
                <p className="text-[13px] text-slate-800">{f.text}</p>
                {f.urls && <Sources items={f.urls} label="Pages" />}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {c && (
        <Section n={num()} title="Your doctors and services" intro="Pet owners choose a vet as much as a practice, and AI tools recommend practices whose services they can clearly see.">
          <p className="text-sm font-semibold text-slate-800">Your doctors</p>
          {doctors.size === 0 ? (
            <p className="text-sm text-slate-600">We couldn&apos;t find any doctors named on your website.</p>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-left uppercase tracking-wide text-slate-500">
                  <th className="py-1.5 font-semibold">Name, as written</th>
                  <th className="py-1.5 pl-2 font-semibold">Qualifications</th>
                  <th className="py-1.5 pl-2 font-semibold">Bio</th>
                  <th className="py-1.5 pl-2 font-semibold">Where they trained</th>
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
          {doctors.size > 0 && (
            <p className="text-[13px] text-slate-600">
              A page of their own for each doctor helps people searching for a vet by name, and lets AI tools describe your team accurately.
            </p>
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
                <strong>Mentioned on your site but with no page of their own:</strong> {c.site.servicesWithoutPage.join(", ")}.
              </p>
              <p className="mt-1 text-xs text-slate-600">
                When someone asks AI for &quot;{c.site.servicesWithoutPage[0].toLowerCase()} near {town}&quot;, a dedicated page is what gets you recommended.
              </p>
            </div>
          )}
          {c.site.menuItemsGoingNowhere.length > 0 && (
            <div className="rounded-xl border-l-4 bg-slate-50 px-3 py-2" style={{ borderColor: "#dc2626", breakInside: "avoid" }}>
              <p className="text-[13px] font-medium text-slate-800">Menu items and links that don&apos;t lead anywhere</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-[12px] text-slate-700">
                {c.site.menuItemsGoingNowhere.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          )}
        </Section>
      )}

      {c && (
        <Section n={num()} title="Is it easy to become a client?" intro="Can a new pet owner quickly see when you're open, how to book, what to do in an emergency and how to pay?">
          <ul>
            {(() => {
              const hours = distinct(pages.map((p) => p.hours).filter(Boolean) as string[]);
              return (
                <Check
                  ok={hours.length > 0 && c.site.hoursContradictions.length === 0}
                  label={hours.length === 0 ? "Your hours aren't on the website" : c.site.hoursContradictions.length ? "Your hours don't match from page to page" : "Your hours are clear and consistent"}
                  detail={[...c.site.hoursContradictions, ...hours.slice(0, 1)].join(" / ")}
                  sources={pagesWith(pages, (p) => Boolean(p.hours))}
                />
              );
            })()}
            <Check
              ok={pages.some((p) => p.booking)}
              label="Booking"
              detail={firstFew(pages.map((p) => p.booking)) || "We couldn't find how to book."}
              sources={pagesWith(pages, (p) => Boolean(p.booking))}
            />
            <Check
              ok={pages.some((p) => p.emergencyReferral)}
              label="Emergencies"
              detail={firstFew(pages.map((p) => p.emergencyReferral), 1) || "We couldn't find where to go in an emergency."}
              sources={pagesWith(pages, (p) => Boolean(p.emergencyReferral))}
            />
            <Check
              ok={pages.some((p) => p.paymentInfo)}
              label="Payment"
              detail={firstFew(pages.map((p) => p.paymentInfo)) || "We couldn't find any payment information."}
              sources={pagesWith(pages, (p) => Boolean(p.paymentInfo))}
            />
            <Check
              ok={uniqueTypos.length === 0}
              label={uniqueTypos.length ? `${uniqueTypos.length} spelling mistakes to fix` : "No spelling mistakes found"}
              detail={uniqueTypos
                .slice(0, 10)
                .map((ty) => `"${ty.text}" should be "${ty.suggestion}" (${ty.where === "url" ? "in the page address" : `in the ${ty.where}`})`)
                .join(" · ")}
              sources={distinct(uniqueTypos.map((ty) => ty.url))}
            />
          </ul>
        </Section>
      )}

      {c && c.site.differentiators.length > 0 && (
        <Section
          n={num()}
          title="What makes you different"
          intro="Strengths your website or your Google reviews already show, which most practices nearby can't claim. Lead with these. Under each one is where it comes from."
        >
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
          <p className="text-[11px] text-slate-500">&quot;Google review 6&quot; means your 6th most recent Google review when we ran this audit.</p>
        </Section>
      )}

      {c && (
        <Section n={num()} title="How to say it" intro="A one-sentence description of your practice, and a homepage headline, built from the strengths above.">
          <div className="rounded-2xl p-5 text-white" style={{ background: GRADIENT, breakInside: "avoid" }}>
            <p className="text-xs font-semibold uppercase tracking-wide text-white/75">Your practice in one sentence</p>
            <p className="mt-1 text-lg leading-snug" style={{ fontFamily: "var(--font-heading)" }}>
              {c.site.positioningLine}
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl bg-slate-50 p-4" style={{ breakInside: "avoid" }}>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Your homepage headline today</p>
              <p className="mt-1 text-sm text-slate-800">{homepage?.currentH1 ?? t?.pages.find((p) => p.finalStatus === 200)?.h1s[0] ?? "(none)"}</p>
              {homepage && <Sources items={[homepage.url]} />}
            </div>
            <div className="rounded-2xl bg-slate-50 p-4" style={{ breakInside: "avoid" }}>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Suggested headline</p>
              <p className="mt-1 text-sm font-medium" style={{ color: INDIGO }}>
                {c.site.homepageH1}
              </p>
              {homepage?.secondaryLine && <p className="text-xs text-slate-600">Keep underneath it: {homepage.secondaryLine}</p>}
            </div>
          </div>
          <p className="text-[13px] text-slate-600">
            A good headline says what you do, for whom, and where. That&apos;s exactly what Google and AI tools look for when matching you to someone searching
            nearby.
          </p>
        </Section>
      )}

      {fixes.length > 0 && (
        <Section
          n={num()}
          title="Your action plan"
          intro="Everything we recommend, most important first. Each item says what to do and who does it, why it matters, and what we found that led to it."
        >
          <div className="space-y-3">
            {fixes.map((f) => (
              <div key={f.rank} className="flex gap-3 rounded-2xl border border-slate-200 p-4" style={{ breakInside: "avoid" }}>
                <span
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
                  style={{ background: f.rank <= 3 ? PINK : INDIGO }}
                >
                  {f.rank}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900">{f.fix}</p>
                  {f.steps && f.steps.length > 0 && (
                    <div className="mt-2">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">What to do</p>
                      <ol className="mt-0.5 list-decimal space-y-1 pl-5 text-[13px] leading-snug text-slate-700">
                        {f.steps.map((step) => (
                          <li key={step}>{step}</li>
                        ))}
                      </ol>
                    </div>
                  )}
                  <p className="mt-2 text-[13px] text-slate-600">
                    <span className="font-semibold text-slate-700">Why it matters:</span> {f.whyItMatters}
                  </p>
                  {f.evidence.length > 0 && (
                    <div className="mt-2">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">What we found</p>
                      <EvidenceList items={f.evidence} />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {c && (
        <Section
          n="Appendix A"
          title="Suggested headline for every page"
          intro="Each page's main headline (the big text at the top) is one of the first things Google and AI read. We suggest a headline for every page that says what it is, who it's for, and where."
        >
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-left uppercase tracking-wide text-slate-500">
                <th className="py-1.5 font-semibold">Page</th>
                <th className="py-1.5 pl-2 font-semibold">Headline today</th>
                <th className="py-1.5 pl-2 font-semibold">Suggested headline</th>
              </tr>
            </thead>
            <tbody>
              {pages.map((p) => (
                <tr key={p.url} className="border-b border-slate-100 align-top" style={{ breakInside: "avoid" }}>
                  <td className="py-1.5 pr-2 text-[10px] text-slate-500">{shortUrl(p.url)}</td>
                  <td className="py-1.5 pl-2 text-slate-700">{p.currentH1 ?? "(none)"}</td>
                  <td className="py-1.5 pl-2 text-slate-900">
                    {p.recommendedH1}
                    {p.secondaryLine && <span className="block text-[10px] text-slate-500">Keep underneath: {p.secondaryLine}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}

      {t && (
        <Section
          n="Appendix B"
          title="Technical details for your web developer"
          intro={`The raw numbers behind "Website health", checked ${dateOf(t.crawledAt)}. You don't need to read this page; pass it to whoever looks after your website.`}
        >
          <MetricTable rows={compareMetrics(technicalMetrics(r), prev?.technical ? technicalMetrics(prev) : null)} lastDate={prev?.technical ? lastDate : null} />
          <p className="pt-2 text-[12px] text-slate-600">
            Sitemaps read: {t.sitemapsRead.map(shortUrl).join(", ") || "none"}. Sitemap URLs by host:{" "}
            {Object.entries(t.summary.byHost)
              .map(([host, count]) => `${host} ${count}`)
              .join(", ")}
            . Structured data types: {t.summary.schemaTypes.join(", ") || "none"}. robots.txt: {Object.values(t.robotsTxt).some(Boolean) ? "present" : "missing"}.
            llms.txt: {Object.values(t.llmsTxt).some(Boolean) ? "present" : "missing"}.
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

      <Section n="Appendix C" title="How we did this audit">
        <dl className="grid gap-x-4 gap-y-2 text-[13px] sm:grid-cols-[11rem_1fr]">
          <dt className="font-medium text-slate-800">When</dt>
          <dd>
            Website scan {dateOf(t?.crawledAt)} · Reviews and links {dateOf(a?.checkedAt)} · AI questions {dateOf(v?.ranAt)} · Page reading {dateOf(c?.ranAt)} ·
            Score {dateOf(s?.computedAt)}
          </dd>
          {lastDate && (
            <>
              <dt className="font-medium text-slate-800">Compared with</dt>
              <dd>Our previous audit of your website, on {lastDate}.</dd>
            </>
          )}
          <dt className="font-medium text-slate-800">Your website</dt>
          <dd>
            Our own software visited every page you list for Google, plus pages your site links to that the list leaves out, slowly and politely so your site wasn&apos;t
            affected. It recorded what each page shows and what it tells search engines behind the scenes.
          </dd>
          <dt className="font-medium text-slate-800">Reviews and links</dt>
          <dd>
            Your Google rating, review count and {reviews.length} most recent reviews (we never record reviewers&apos; names). Links from other websites are measured
            on DataForSEO&apos;s 0–1000 scale, which is not the same scale as other tools&apos; &quot;Domain Rating&quot;.
          </dd>
          {comp && (
            <>
              <dt className="font-medium text-slate-800">Competitors</dt>
              <dd>
                Google Maps searches made from your listing&apos;s location on {dateOf(comp.ranAt)}: the results a pet owner near you sees, with ads left out.
                Ratings and review counts are as Google showed them that day. We count you as offering {sideServices.length ? sideServices.map((x) => x.label.toLowerCase()).join(", ") : "a side service such as grooming or boarding"} when
                your Google listing, website menu or service pages say so.
              </dd>
            </>
          )}
          {v && (
            <>
              <dt className="font-medium text-slate-800">AI tools asked</dt>
              <dd>
                {v.platforms.map((p) => `${PLATFORM_LABEL[p.platform]} (${place(v.models[p.platform] ?? p.model ?? "as served")})`).join(" · ")}. Google searches were
                set to {place(v.location)}. {v.profile === "consumer" ? "We used the same versions the public uses." : "We used lower-cost versions of these tools."}
              </dd>
              <dt className="font-medium text-slate-800">AI answers over time</dt>
              <dd>DataForSEO&apos;s record of real AI answers from about the last 90 days (US, English). Kept separate from our own questions.</dd>
            </>
          )}
          {c && (
            <>
              <dt className="font-medium text-slate-800">Reading your pages</dt>
              <dd>
                {c.pages.length} pages were read by an AI model ({c.pageModel}) to note doctors, services, hours, booking, prices and more. A second model ({c.siteModel})
                wrote the strengths, headline and action plan from everything we found. It had to back up every point with a page or a review, and we list them
                under each point.
              </dd>
            </>
          )}
          <dt className="font-medium text-slate-800">Your score</dt>
          <dd>
            Fixed arithmetic, never AI judgement, so the same website always gets the same score. Points available:{" "}
            {Object.entries(weightsConfig.weights)
              .map(([k, w]) => `${s?.subScores.find((p) => p.key === k)?.label ?? k} ${w}`)
              .join(", ")}
            . (Scoring version {s?.weightsVersion ?? weightsConfig.version}.)
          </dd>
          <dt className="font-medium text-slate-800">Not included</dt>
          <dd>Whether Google has added each page to its index. Only your own Google Search Console account can show that reliably.</dd>
        </dl>
        {v && (
          <div className="pt-2">
            <p className="text-sm font-semibold text-slate-800">Every question we asked ({v.prompts.length})</p>
            {(
              [
                ["local", "Looking for a vet"],
                ["service", "Looking for a service"],
                ["informational", "Everyday pet questions"],
              ] as const
            ).map(([kind, title]) => (
              <div key={kind} className="mt-2" style={{ breakInside: "avoid" }}>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
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
