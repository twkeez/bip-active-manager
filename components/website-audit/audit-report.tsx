import { Children, type ReactNode } from "react";
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
import { doctorKeys } from "@/lib/website-audit/doctors";
import { crawlLimits, jobOf, notChecked, shortTitle, technicalFindings, type FindingDetail } from "@/lib/website-audit/findings";
import { PLATFORM_LABEL } from "@/lib/website-audit/platforms";
import { promotedServicesWithoutPage } from "@/lib/website-audit/services";
import { realTypos } from "@/lib/website-audit/typos";
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
const URL_LIMIT = 4;

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

/**
 * Where each AI tool searched from, as ai-visibility.ts sends it: only
 * Google's two take a town; the scrapers and Perplexity take a country, and
 * Claude (and the economy API calls) take none.
 */
function aiLocationNote(v: { location: string; profile: "consumer" | "economy" }): string {
  const elsewhere =
    v.profile === "consumer"
      ? "ChatGPT, Gemini and Perplexity can only be set to the United States, and Claude has no location setting"
      : "Perplexity can only be set to the United States, and ChatGPT, Gemini and Claude have no location setting";
  return `Google's AI Overview and AI Mode searched from ${place(v.location)}. ${elsewhere}, so those four only know where you are when the question names your town.`;
}

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
  if (/^(content|pages|servicePages|site|doctors|blog)\b/.test(source)) return "Our reading of your pages";
  // Anything else that looks like a field name from the audit's data is ours, not something to show a client.
  if (/^[\w.[\]]+$/.test(source) && /[.[\]]|[a-z][A-Z]/.test(source)) return "This audit's findings";
  return source;
}

/**
 * Sections follow one another down the page; only `newPage` ones (the
 * appendices) start a fresh sheet. The heading and intro never sit alone at
 * the foot of a page: they stay with whatever comes next.
 */
function Section({ n, title, intro, children, newPage = false, keepFirst = false }: { n: string; title: string; intro?: string; children: ReactNode; newPage?: boolean; keepFirst?: boolean }) {
  // `keepFirst`: the first block under the heading (a card, a pair of cards) moves to the next page with it.
  // Otherwise (a table or a long list follows) room for a few lines is reserved under the heading.
  const [first, ...rest] = keepFirst ? Children.toArray(children) : [];
  return (
    <section className="space-y-3 border-t border-slate-200 pt-5 first-of-type:border-t-0 first-of-type:pt-2" style={newPage ? { breakBefore: "page" } : undefined}>
      {/* The extra padding (taken back by the margin) reserves room under the heading, so it can't be the last thing on a page. */}
      <div className={keepFirst ? "space-y-3" : "space-y-2"} style={keepFirst ? { breakInside: "avoid" } : { breakInside: "avoid", paddingBottom: 110, marginBottom: -110 + 12 }}>
        <h2 className="flex items-center gap-2 text-lg font-semibold" style={{ fontFamily: "var(--font-heading)", color: "#0f172a", breakAfter: "avoid" }}>
          <span className="inline-block h-5 w-1.5 rounded-full" style={{ background: PINK }} aria-hidden="true" />
          <span style={{ color: INDIGO }}>{n}</span> {title}
        </h2>
        {intro && <p className="text-sm leading-relaxed text-slate-600">{intro}</p>}
        {first}
      </div>
      {keepFirst ? rest : children}
    </section>
  );
}

/** A web address as a link that still works in the saved PDF; shown without "https://". */
function UrlLink({ url }: { url: string }) {
  return (
    <a href={url} className="break-all text-indigo-700 underline decoration-indigo-200 underline-offset-2">
      {shortUrl(url)}
    </a>
  );
}

/** Text with any web addresses in it made into links. */
function LinkedText({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/[^\s)"]+)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (!isUrl(part)) return part;
        const trailing = /[.,;:]$/.test(part) ? part.slice(-1) : "";
        return (
          <span key={i}>
            <UrlLink url={trailing ? part.slice(0, -1) : part} />
            {trailing}
          </span>
        );
      })}
    </>
  );
}

function Sources({ items, label = "Found on", of }: { items: string[]; label?: string; of?: number }) {
  if (!items.length) return null;
  // On (nearly) every page it's in the site's header or footer: say that, not the same addresses again.
  if (of && of >= 5 && items.every(isUrl) && distinct(items).length >= Math.ceil(of * 0.8)) {
    const count = distinct(items).length;
    return <p className="mt-1 text-[12px] leading-relaxed text-slate-600">{label}: {count >= of ? `every page (${of})` : `nearly every page (${count} of ${of})`}, so it&apos;s in the site&apos;s header or footer.</p>;
  }
  const shown = distinct(items.map((s) => (isUrl(s) ? s : sourceLabel(s)))).slice(0, URL_LIMIT);
  const rest = items.length - shown.length;
  return (
    <p className="mt-1 text-[12px] leading-relaxed text-slate-600" title={items.filter((s) => !isUrl(s)).join(", ") || undefined}>
      {label}:{" "}
      {shown.map((s, i) => (
        <span key={s}>
          {i > 0 && " · "}
          {isUrl(s) ? <UrlLink url={s} /> : s}
        </span>
      ))}
      {rest > 0 && ` · and ${rest} more ${items.every(isUrl) ? "pages" : ""}`.trimEnd()}
    </p>
  );
}

/** Roughly how many lines an issue's details take: a short one stays together on a page, a long one may run over. */
const detailLines = (details?: FindingDetail[]) => (details ?? []).reduce((n, d) => n + 1 + (d.items?.length ?? 0) + (d.linkedFrom?.length ? 1 : 0), 0);

/** Every place an issue shows up: the page as a link, what's wrong there, the specifics, and the pages linking to it. */
function FindingDetails({ details }: { details: FindingDetail[] }) {
  if (!details.length) return null;
  return (
    <ul className="mt-1.5 space-y-1 border-t border-slate-200 pt-1.5 text-[12px] leading-relaxed text-slate-600">
      {details.map((d, i) => (
        // A place with a long list under it may run onto the next page; each line of the list stays whole.
        <li key={i} style={{ breakInside: (d.items?.length ?? 0) > 3 ? "auto" : "avoid" }}>
          {d.title && <span className="font-medium text-slate-700">{d.title} </span>}
          {d.url ? <UrlLink url={d.url} /> : <span className="font-medium text-slate-700">{d.label}</span>}
          {d.note && (
            <span className="text-slate-600">
              {" "}
              · <LinkedText text={d.note} />
            </span>
          )}
          {d.items && d.items.length > 0 && (
            <ol className="ml-4 list-decimal text-slate-600">
              {d.items.map((item, j) => (
                <li key={j} style={{ breakInside: "avoid" }}>
                  <LinkedText text={item} />
                </li>
              ))}
            </ol>
          )}
          {d.linkedFrom && d.linkedFrom.length > 0 && (
            <p className="ml-4 text-slate-600">
              Linked from:{" "}
              {d.linkedFrom.map((u, j) => (
                <span key={u}>
                  {j > 0 && " · "}
                  <LinkedText text={u} />
                </span>
              ))}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}

/** Words quoted from a page or a review get quotation marks; a finding from our own checks reads as a plain sentence. */
const isQuoted = (source: string) => isUrl(source) || /^review\s+\d+/i.test(source);

/** Where on a page a quote sits, when that isn't simply "in the text": a visitor can't see a page title or search the page for it. */
type Locate = (source: string, quote: string) => string | null;

function EvidenceList({ items, locate }: { items: Evidence[]; locate?: Locate }) {
  if (!items.length) return null;
  return (
    <ul className="mt-1 space-y-0.5 text-[12px] leading-relaxed text-slate-600">
      {items.map((e, i) => (
        <li key={i} title={isUrl(e.source) ? undefined : e.source} style={{ breakInside: "avoid" }}>
          {isQuoted(e.source) ? (
            <>
              <span className="font-medium text-slate-600">{isUrl(e.source) ? shortUrl(e.source) : sourceLabel(e.source)}</span> says: “{e.quote}”
              {locate?.(e.source, e.quote) && <span className="block pl-3 text-slate-600">{locate(e.source, e.quote)}</span>}
            </>
          ) : (
            <>
              {e.quote} <span className="text-slate-500">({sourceLabel(e.source)})</span>
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
  if (!m.change) return <td className="py-1.5 pl-3 text-right text-xs text-slate-500">—</td>;
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
        <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-600">
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

function Check({ ok, label, detail, sources, details, of }: { ok: boolean | null; label: string; detail?: string; sources?: string[]; details?: FindingDetail[]; of?: number }) {
  return (
    <li className="flex gap-3 border-b border-slate-100 py-2" style={{ breakInside: detailLines(details) > 4 ? "auto" : "avoid" }}>
      <span className="mt-0.5 w-4 shrink-0 text-center font-semibold" style={{ color: ok == null ? "#94a3b8" : ok ? "#047857" : "#b91c1c" }}>
        {ok == null ? "–" : ok ? "✓" : "✗"}
      </span>
      <div className="min-w-0">
        <p className="text-sm text-slate-800">{label}</p>
        {detail && <p className="text-xs text-slate-600">{detail}</p>}
        {sources && <Sources items={sources} of={of} />}
        {details && <FindingDetails details={details} />}
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
        <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-600">
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
              {l.isYou && !l.main && <span className="text-xs text-slate-600"> (yours)</span>}
              {l.category && <span className="block text-[12px] text-slate-600">{l.category}</span>}
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
const unmarked = (s: string) => oneOf(s.replace(/^[✓✗◐]\s*/, ""));
/** Score lines saved before 2026-11-11 say "on 1 pages", "1 doctors named": read them back correctly. */
const oneOf = (s: string) =>
  s
    .replace(/\bon 1 pages\b/g, "on 1 page")
    .replace(/\b1 doctors named\b/g, "1 doctor named")
    .replace(/\b1 services have\b/g, "1 service has")
    .replace(/\b1 of those go\b/g, "1 of those goes")
    .replace(/\b1 blog posts\b/g, "1 blog post")
    // Who signs a post is no longer part of the report.
    .replace(/,? ?\d+% name an author/g, "");
/** What a few pages say, without repeating every page's wording. */
/**
 * Does a page's booking / payment / emergency note say something a visitor
 * could act on? Notes like "Payment Options menu link only; no payment
 * details on this page" or a bare "Request an Appointment" describe a link,
 * not the information itself.
 */
const saysSomething = (value: string | null | undefined): value is string =>
  Boolean(value) && !/menu link|link only|no (\w+ )?(details|information|info)\b|not (stated|found|mentioned|given|shown)|is linked in the menu|link to \//i.test(value!);
/** …and for payment and emergencies a bare menu label ("Payment Options", "Emergencies") isn't the information either. */
const informative = (value: string | null | undefined): value is string =>
  saysSomething(value) && (value.trim().split(/\s+/).length >= 5 || /\d{3}/.test(value));
/** The fullest of what the pages say, without repeating every page's wording. */
const firstFew = (items: (string | null)[], count = 2) =>
  distinct((items.filter(saysSomething) as string[]).sort((a, b) => b.length - a.length))
    .slice(0, count)
    .map((x) => clip(x, 160))
    .join(" / ");
const pagesWith = (pages: PageContent[], test: (p: PageContent) => boolean) => pages.filter(test).map((p) => p.url);
function distinct<T>(items: T[]): T[] {
  return [...new Set(items)];
}

/**
 * Who the report is written for. A client's website is ours to look after, so
 * "your web developer" is Beyond Indigo and the plan ends with what we'll do
 * and what we need from them. A prospect has someone else looking after it.
 */
export type Audience = "client" | "prospect" | "team";

/** A box to tick on the printed worklist. */
const Tick = () => <span className="mt-0.5 inline-block h-3.5 w-3.5 shrink-0 rounded border border-slate-400" aria-hidden="true" />;

const DEV_STEP = /^(your )?web developer:\s*/i;
const OWNER_STEP = /^you:\s*/i;

export default function AuditReport({ audit, previous, audience }: { audit: WebsiteAuditRow; previous: PreviousRun | null; audience?: Audience }) {
  const mode: Audience = audience ?? (audit.client_id != null ? "client" : "prospect");
  // The team worklist is ours too, so it speaks as Beyond Indigo. Only the client's own copy leaves the developer detail out.
  const forClient = mode !== "prospect";
  const lean = mode === "client";
  /** Plan wording as saved ("Your web developer: …") read for this audience. */
  const voice = (text: string) =>
    forClient
      ? text
          .replace(DEV_STEP, "Beyond Indigo: ")
          .replace(/\b(ask|have|tell|send|give|email) your web developer\b/gi, (_, verb: string) => `${verb} us`)
          .replace(/\byour web developer\b/g, "Beyond Indigo")
          .replace(/\bYour web developer\b/g, "Beyond Indigo")
      : text;
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
  // Plans written before 2026-11-11 may tell the practice to have a vet sign blog posts; that advice is no longer given.
  const aboutAuthors = (x: string) => /\bauthor|\bbyline|\bsign(s|ed)? (each|every|the|your|all)? ?(blog )?posts?\b|["“]By Dr\./i.test(x);
  const fixes = (c?.site.fixes ?? [])
    .filter((f) => !aboutAuthors(f.fix))
    .map((f) => ({ ...f, steps: f.steps?.filter((step) => !aboutAuthors(step)), evidence: f.evidence.filter((e) => !aboutAuthors(e.quote)) }));
  // For a client: the decisions only the practice can make, and the goals that have work for us in them.
  const neededFromClient = fixes.flatMap((f) => (f.steps ?? []).filter((step) => OWNER_STEP.test(step)).map((step) => ({ rank: f.rank, goal: f.fix, ask: step.replace(OWNER_STEP, "") })));
  const ourWork = fixes.map((f) => ({ rank: f.rank, goal: f.fix, tasks: (f.steps ?? []).filter((step) => DEV_STEP.test(step)).length })).filter((f) => f.tasks > 0);

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
  const doctorOf = doctorKeys(pages.flatMap((p) => p.doctors.map((d) => d.name)));
  for (const p of pages)
    for (const d of p.doctors) {
      const key = doctorOf(d.name);
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

  // Services the site names on several pages (the menu, usually) that have no page: counted, so it's the same on every run.
  const missingServices = promotedServicesWithoutPage(pages, new Map((t?.pages ?? []).map((p) => [p.finalUrl, p.title ?? ""])));
  const blogPosts = pages.filter((p) => p.pageType === "blog_post" && p.blog);
  // Posts the site links to but leaves out of its sitemap: the content step never read them, so say so.
  const unreadPosts = (t?.notInSitemap ?? []).filter((g) => g.finalStatus === 200 && !g.softError && /\/(blog|news|posts?|articles?)\/[^/]+/i.test(g.url) && !/hello-world/i.test(g.url));
  const crawlByUrl = new Map((t?.pages ?? []).map((p) => [p.finalUrl, p]));
  const servicePages = pages.filter((p) => p.pageType === "service");
  // Claude files notes and rewrites as typos too; saved audits still have them.
  // A mistake is reported only if the crawl's copy of the page shows those words.
  const crawled = new Map((t?.pages ?? []).map((p) => [p.finalUrl, p]));
  // Says where a quoted bit of a page is when it isn't in the page's own text: its title, headline or menu.
  const squash = (x: string) => x.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, " ").trim().toLowerCase();
  /** The words around a phrase in a page's text, to search the page for ("…is commited to providing…"). */
  const around = (url: string, phrase: string): string | null => {
    const page = crawled.get(url) ?? crawled.get(url.replace(/\/$/, "")) ?? crawled.get(`${url}/`);
    const text = (page?.text ?? "").replace(/\s+/g, " ");
    const at = text.toLowerCase().replace(/[‘’]/g, "'").replace(/[“”]/g, '"').indexOf(squash(phrase));
    if (at < 0) return null;
    const SIDE = 70;
    let start = Math.max(0, at - SIDE);
    let end = Math.min(text.length, at + phrase.length + SIDE);
    // Whole words only, and stop at a sentence end when one is close.
    if (start > 0) start = text.indexOf(" ", start) + 1;
    if (end < text.length) end = text.lastIndexOf(" ", end);
    const snippet = text.slice(start, end).trim();
    if (snippet.length <= phrase.trim().length + 8) return null; // Nothing around it to search for.
    return `${start > 0 ? "…" : ""}${snippet}${end < text.length ? "…" : ""}`;
  };
  const locate: Locate = (source, quote) => {
    const page = crawled.get(source) ?? crawled.get(source.replace(/\/$/, "")) ?? crawled.get(`${source}/`);
    const q = squash(quote);
    if (!page || q.length < 3) return null;
    const inText = squash(page.text).includes(q);
    if (page.title && squash(page.title).includes(q) && !inText)
      return `Where: the page title, which is the text on the browser tab and the link in Google results, not on the page itself. It reads "${page.title}".`;
    if (page.h1s.some((h) => squash(h).includes(q))) return "Where: the main headline at the top of the page.";
    if (page.navLinks.some((l) => squash(l.text) === q || (!inText && squash(l.text).includes(q)))) return "Where: the website menu.";
    // A word or two in the page text is hard to spot: give the words around it.
    if (inText && q.split(" ").length <= 4) {
      const near = around(source, quote);
      if (near) return `Where: in the page text. Search the page for: "${near}"`;
    }
    return null;
  };
  const typos = pages.flatMap((p) => realTypos(p.typos, crawled.get(p.url)).map((ty) => ({ ...ty, url: p.url })));
  const uniqueTypos = [...new Map(typos.map((ty) => [`${ty.text}→${ty.suggestion}`, ty])).values()];
  // Each mistake once, with every page it's on: a menu typo is on every page.
  const typoDetails: FindingDetail[] = uniqueTypos.map((ty) => {
    const on = distinct(typos.filter((x) => x.text === ty.text && x.suggestion === ty.suggestion).map((x) => x.url));
    const where =
      ty.where === "url"
        ? "in the page address"
        : ty.where === "title"
          ? "in the page title: the text on the browser tab and in Google results, not on the page itself"
          : `in the ${ty.where}`;
    const fix = `"${ty.text}" should be "${ty.suggestion}"`;
    if (on.length === 1) {
      const near = ty.where === "text" || ty.where === "heading" ? around(on[0], ty.text) : null;
      return { url: on[0], note: `${fix} (${where})${near ? `. Search the page for: "${near}"` : ""}` };
    }
    // On several pages because they all list one page's title (a "recent posts" box): name that page, where the one fix is.
    const needle = ty.text.toLowerCase();
    const slug = needle.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const byHeadline = (t?.pages ?? []).filter((p) => p.h1s.some((h) => h.toLowerCase().includes(needle))).map((p) => p.finalUrl);
    const byAddress = slug.length >= 8 ? [...(t?.pages ?? []).map((p) => p.finalUrl), ...(t?.notInSitemap ?? []).map((g) => g.url)].filter((u) => u.toLowerCase().includes(slug)) : [];
    const origin = distinct(byHeadline).length === 1 ? byHeadline[0] : distinct(byAddress).length === 1 ? byAddress[0] : null;
    if (origin && ty.where !== "menu") {
      const others = on.filter((u) => u !== origin).length;
      return { label: fix, note: `in the headline of one page: ${origin}. It also shows on ${others} other ${others === 1 ? "page" : "pages"} that list that page's title (in a "recent posts" box, for example). Fix it once, in that page's headline.` };
    }
    // The same menu on every page: one fix in the menu, not a page list.
    if (ty.where === "menu" && on.length >= 5) return { label: fix, note: `in the website menu, so it shows on ${on.length} pages; fix it once in the menu` };
    return { label: fix, note: `${where}, on ${on.length} pages`, items: on };
  });
  const reviews = a?.google.reviews ?? [];
  const answeredReviews = reviews.filter((rv) => rv.ownerAnswered).length;
  const types = new Set(t?.summary.schemaTypes ?? []);
  const homepage = pages.find((p) => p.pageType === "home");

  let n = 0;
  const num = () => String(++n).padStart(2, "0");

  if (mode === "team") {
    type Job = { job: string; note?: string; items?: string[]; linkedFrom?: string[] };
    const siteJobs: { job: string; text: string; fix?: string; details?: FindingDetail[] }[] = [];
    const pageJobs = new Map<string, Job[]>();
    const howTo = new Map<string, string>();
    const onPage = (url: string, job: Job) => pageJobs.set(url, [...(pageJobs.get(url) ?? []), job]);
    for (const f of findings.filter((x) => x.tone !== "good")) {
      const { job, scope } = jobOf(f);
      if (scope === "site" || !f.details?.length) {
        siteJobs.push({ job, text: f.text, fix: f.fix, details: f.details });
        continue;
      }
      if (f.fix) howTo.set(job, f.fix);
      // A place that isn't one page ("On 27 pages (the menu)") is a fix-once job.
      const loose = f.details.filter((d) => !d.url);
      for (const d of f.details) if (d.url) onPage(d.url, { job, note: d.note, items: d.items, linkedFrom: d.linkedFrom });
      if (loose.length) siteJobs.push({ job, text: f.text, fix: f.fix, details: loose });
    }
    const spellingOnce = typoDetails.filter((d) => !d.url);
    for (const d of typoDetails) if (d.url) onPage(d.url, { job: "Spelling", note: d.note });
    if (spellingOnce.length) siteJobs.push({ job: "Spelling", text: "Mistakes that show on several pages but are fixed in one place.", details: spellingOnce });
    // Headline suggestions: not for blog posts (the plan wants those as questions) or policy pages.
    for (const p of pages) {
      if (!p.recommendedH1 || p.recommendedH1 === p.currentH1 || p.pageType === "blog_post" || /privacy|terms|polic/i.test(p.url)) continue;
      onPage(p.url, { job: "Suggested headline (once the client agrees)", note: `Change "${p.currentH1 ?? "(none)"}" to "${p.recommendedH1}".${p.secondaryLine ? ` Keep underneath: "${p.secondaryLine}"` : ""}` });
    }
    const isHome = (u: string) => {
      try {
        return new URL(u).pathname === "/";
      } catch {
        return false;
      }
    };
    const pageList = [...pageJobs.entries()].sort(([a], [b]) => Number(isHome(b)) - Number(isHome(a)) || a.localeCompare(b));
    const planJobs = fixes.map((f) => ({ ...f, ours: (f.steps ?? []).filter((x) => DEV_STEP.test(x)), theirs: (f.steps ?? []).filter((x) => OWNER_STEP.test(x)) }));
    const limits = t ? crawlLimits(t) : null;
    const jobCount = pageList.reduce((sum, [, jobs]) => sum + jobs.length, 0);
    return (
      <article className="mx-auto max-w-3xl space-y-8 text-slate-700">
        <header className="rounded-2xl border-2 px-6 py-5" style={{ borderColor: INDIGO, breakInside: "avoid" }}>
          <p className="text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: PINK }}>
            Team worklist · internal, not for the client
          </p>
          <h1 className="mt-1 text-2xl font-semibold" style={{ fontFamily: "var(--font-heading)", color: "#0f172a" }}>
            {audit.practice_name}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {audit.domain}
            {location && ` · ${location}`} · audit #{audit.id}
            {t && ` · website checked ${dateOf(t.crawledAt)}`}
          </p>
          <p className="mt-3 text-[13px] text-slate-700">
            {`${planJobs.reduce((sum, f) => sum + f.ours.length, 0)} jobs from the action plan · ${siteJobs.length} to fix once for the whole site · ${jobCount} on ${pageList.length} ${pageList.length === 1 ? "page" : "pages"}`}
          </p>
          <p className="mt-1 text-[12px] text-slate-600">Everything here comes from the same audit as the client&apos;s report. Tick each job off as it&apos;s done, then run the technical crawl again to confirm.</p>
        </header>

        {planJobs.length > 0 && (
          <Section n={num()} title="Jobs from the action plan" intro="What the client's report says Beyond Indigo will do, in the plan's order. Jobs marked 'client' wait on them.">
            {planJobs.map((f) => (
              <div key={f.rank} className="rounded-xl border border-slate-200 px-4 py-3" style={{ boxDecorationBreak: "clone", WebkitBoxDecorationBreak: "clone" }}>
                <p className="text-sm font-semibold text-slate-900" style={{ breakAfter: "avoid" }}>
                  {f.rank}. {voice(f.fix)}
                </p>
                <ul className="mt-1.5 space-y-1.5 text-[13px] leading-snug">
                  {f.ours.map((step) => (
                    <li key={step} className="flex gap-2" style={{ breakInside: "avoid" }}>
                      <Tick />
                      <span>{step.replace(DEV_STEP, "").replace(/^./, (ch) => ch.toUpperCase())}</span>
                    </li>
                  ))}
                  {f.theirs.map((step) => (
                    <li key={step} className="flex gap-2 text-slate-600" style={{ breakInside: "avoid" }}>
                      <span className="mt-0.5 shrink-0 rounded bg-slate-100 px-1 text-[11px] font-semibold uppercase text-slate-600">client</span>
                      <span>{voice(step.replace(OWNER_STEP, "")).replace(/^./, (ch) => ch.toUpperCase())}</span>
                    </li>
                  ))}
                </ul>
                {f.evidence.length > 0 && <EvidenceList items={f.evidence} locate={locate} />}
              </div>
            ))}
          </Section>
        )}

        {siteJobs.length > 0 && (
          <Section n={num()} title="Fix once for the whole site" intro="Server, template, menu and sitemap settings: one change each, however many pages they touch.">
            {siteJobs.map((j, i) => (
              <div key={i} className="rounded-xl border border-slate-200 px-4 py-3" style={{ boxDecorationBreak: "clone", WebkitBoxDecorationBreak: "clone" }}>
                <p className="flex gap-2 text-sm font-semibold text-slate-900" style={{ breakAfter: "avoid" }}>
                  <Tick />
                  <span>{j.job}</span>
                </p>
                <p className="mt-1 text-[13px] text-slate-700">{j.text}</p>
                {j.fix && (
                  <p className="mt-0.5 text-[12px] text-slate-600">
                    <span className="font-semibold text-slate-700">How to fix:</span> {j.fix}
                  </p>
                )}
                {j.details && <FindingDetails details={j.details} />}
              </div>
            ))}
          </Section>
        )}

        {pageList.length > 0 && (
          <Section n={num()} title="Page by page" intro="Every job that belongs to one page, so each page is opened once. The home page first, then in address order.">
            {howTo.size > 0 && (
              <div className="rounded-xl bg-slate-50 px-4 py-3 text-[12px] leading-relaxed text-slate-600" style={{ breakInside: "avoid" }}>
                <p className="font-semibold text-slate-700">How to fix each kind of job</p>
                <ul className="mt-1 space-y-0.5">
                  {[...howTo.entries()].map(([job, fix]) => (
                    <li key={job}>
                      <span className="font-medium text-slate-700">{job}:</span> {fix}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {pageList.map(([url, jobs]) => (
              <div key={url} className="rounded-xl border border-slate-200 px-4 py-3" style={{ boxDecorationBreak: "clone", WebkitBoxDecorationBreak: "clone" }}>
                <p className="text-sm font-semibold text-slate-900" style={{ breakAfter: "avoid" }}>
                  {shortTitle(crawled.get(url)?.title ?? t?.notInSitemap?.find((g) => g.url === url)?.title) ?? shortUrl(url).replace(/^[^/]+/, "") } <span className="text-[12px] font-normal"><UrlLink url={url} /></span>
                </p>
                <ul className="mt-1.5 space-y-1.5 text-[12px] leading-relaxed text-slate-600">
                  {jobs.map((j, i) => (
                    <li key={i} className="flex gap-2" style={{ breakInside: (j.items?.length ?? 0) > 3 ? "auto" : "avoid" }}>
                      <Tick />
                      <div className="min-w-0">
                        <span className="font-semibold text-slate-800">{j.job}</span>
                        {j.note && (
                          <>
                            {" · "}
                            <LinkedText text={j.note} />
                          </>
                        )}
                        {j.items && j.items.length > 0 && (
                          <ol className="ml-4 list-decimal">
                            {j.items.map((item, k) => (
                              <li key={k} style={{ breakInside: "avoid" }}>
                                <LinkedText text={item} />
                              </li>
                            ))}
                          </ol>
                        )}
                        {j.linkedFrom && j.linkedFrom.length > 0 && (
                          <p>
                            Linked from:{" "}
                            {j.linkedFrom.map((u, k) => (
                              <span key={u}>
                                {k > 0 && " · "}
                                <LinkedText text={u} />
                              </span>
                            ))}
                          </p>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </Section>
        )}

        {t && limits && (
          <Section n={num()} title="What this check covered" intro="So nobody assumes the lists above are everything.">
            <div className="rounded-xl border border-slate-200 px-4 py-3 text-[12px] leading-relaxed text-slate-600" style={{ breakInside: "avoid" }}>
              {limits.hit.length > 0 ? (
                <>
                  <p className="font-semibold text-amber-700">Cut short on this run, so some problems may be missing:</p>
                  <ul className="list-disc pl-4">
                    {limits.hit.map((l) => (
                      <li key={l}>
                        <LinkedText text={l} />
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p>{limits.recorded ? "Nothing was cut short on this run." : "This crawl ran before limits were recorded; run the technical crawl again to see whether anything was cut short."}</p>
              )}
              <p className="mt-1 font-semibold text-slate-700">Not checked, or not certain:</p>
              <ul className="list-disc pl-4">
                {notChecked(t).map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
              <p className="mt-1">The page-by-page numbers (status, headlines, word counts) are in the spreadsheet download on the audit screen.</p>
            </div>
          </Section>
        )}
        <p className="border-t border-slate-200 pt-3 text-center text-[12px] text-slate-600">
          Beyond Indigo Pets · team worklist · audit #{audit.id}, {runDate}
        </p>
      </article>
    );
  }

  return (
    <article className="mx-auto max-w-3xl space-y-8 text-slate-700">
      {/* Cover */}
      <header className="overflow-hidden rounded-3xl px-8 py-7 text-white" style={{ background: GRADIENT, breakInside: "avoid" }}>
        <BeyondIndigoLogo className="h-8 w-auto" />
        <p className="mt-6 text-xs font-semibold uppercase tracking-[0.18em] text-white/75">Website, SEO & AI Search Audit</p>
        <h1 className="mt-1 text-3xl font-semibold leading-tight" style={{ fontFamily: "var(--font-heading)", color: "#ffffff" }}>
          {audit.practice_name}
        </h1>
        <p className="mt-2 text-sm text-white/80">
          {audit.domain}
          {location && ` · ${location}`} · {runDate}
        </p>
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
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
              <p className="text-[12px] font-medium uppercase tracking-wide text-white/75">{tile.label}</p>
              <p className="mt-1 text-3xl font-semibold" style={{ fontFamily: "var(--font-heading)" }}>
                {tile.value}
              </p>
              <p className="text-xs text-white/80">{tile.sub}</p>
              {tile.m?.last != null && <p className="mt-1 text-[12px] text-white/80">Last time: {formatMetric(tile.m.last, tile.m.format)}</p>}
            </div>
          ))}
        </div>
        <p className="mt-5 text-xs text-white/70">Prepared by Beyond Indigo Pets · beyondindigopets.com</p>
      </header>

      <Section n={num()} title="The short version" intro="What's helping you, what's holding you back, and the three things to do first.">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 p-4" style={{ boxDecorationBreak: "clone", WebkitBoxDecorationBreak: "clone" }}>
            <p className="text-sm font-semibold text-emerald-700">What's working</p>
            <ul className="mt-2 space-y-2 text-[13px] leading-snug [&>li]:break-inside-avoid">
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
          <div className="rounded-2xl border border-slate-200 p-4" style={{ boxDecorationBreak: "clone", WebkitBoxDecorationBreak: "clone" }}>
            <p className="text-sm font-semibold text-red-700">What's holding you back</p>
            <ul className="mt-2 space-y-2 text-[13px] leading-snug [&>li]:break-inside-avoid">
              {v && informationalRuns.length > 0 && informationalHits === 0 && (
                <li>
                  <span className="font-medium text-slate-800">Everyday pet questions.</span>
                  {/* In a string: the production build drops the space before text that holds a &quot; */}
                  {` When people ask AI things like "why is my dog limping?", it never mentions you. It quotes other websites instead.`}
                </li>
              )}
              {holding.map((p) => (
                <li key={p.key}>
                  <span className="font-medium text-slate-800">{p.label}.</span> {clip(unmarked(p.details[p.details.length - 1]))}
                </li>
              ))}
              {problems.length > 0 && (
                <li>
                  <span className="font-medium text-slate-800">Website problems.</span> {`We found ${problems.length} that need fixing (see "Website health").`}
                </li>
              )}
            </ul>
          </div>
          <div className="rounded-2xl border border-slate-200 p-4" style={{ boxDecorationBreak: "clone", WebkitBoxDecorationBreak: "clone" }}>
            <p className="text-sm font-semibold" style={{ color: INDIGO }}>
              What to do first
            </p>
            <ol className="mt-2 list-decimal space-y-2 pl-4 text-[13px] leading-snug">
              {fixes.slice(0, 3).map((f) => (
                <li key={f.rank}>{voice(f.fix)}</li>
              ))}
            </ol>
          </div>
        </div>
      </Section>

      {fixes.length > 0 && (
        <Section
          n={num()}
          title="Your action plan"
          intro={
            forClient
              ? "Everything we recommend, most important first. Each item says what Beyond Indigo will do and what we need from you, why it matters, and what we found that led to it."
              : "Everything we recommend, most important first. Each item says what to do and who does it, why it matters, and what we found that led to it."
          }
        >
            {fixes.map((f) => (
              <div key={f.rank} className="flex gap-3 rounded-2xl border border-slate-200 p-4" style={{ boxDecorationBreak: "clone", WebkitBoxDecorationBreak: "clone" }}>
                <span
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
                  style={{ background: f.rank <= 3 ? PINK : INDIGO }}
                >
                  {f.rank}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900" style={{ breakInside: "avoid", breakAfter: "avoid" }}>{voice(f.fix)}</p>
                  {f.steps && f.steps.length > 0 && (
                    <div className="mt-2">
                      <p className="text-[12px] font-semibold uppercase tracking-wide text-slate-600" style={{ breakAfter: "avoid" }}>What to do</p>
                      <ol className="mt-0.5 list-decimal space-y-1 pl-5 text-[13px] leading-snug text-slate-700">
                        {f.steps.map((step) => (
                          <li key={step} style={{ breakInside: "avoid" }}>{voice(step)}</li>
                        ))}
                      </ol>
                    </div>
                  )}
                  <p className="mt-2 text-[13px] text-slate-600" style={{ breakInside: "avoid" }}>
                    <span className="font-semibold text-slate-700">Why it matters:</span> {voice(f.whyItMatters)}
                  </p>
                  {f.evidence.length > 0 && (
                    <div className="mt-2">
                      <p className="text-[12px] font-semibold uppercase tracking-wide text-slate-600" style={{ breakAfter: "avoid" }}>What we found</p>
                      <EvidenceList items={f.evidence} locate={locate} />
                    </div>
                  )}
                </div>
              </div>
            ))}
        </Section>
      )}

      {forClient && fixes.length > 0 && (neededFromClient.length > 0 || ourWork.length > 0) && (
        <Section n={num()} title="What happens next" intro="The plan above, sorted by who does what. Reply with your answers to the first list and we can get started.">
          {neededFromClient.length > 0 && (
            <div className="rounded-2xl border border-slate-200 p-4" style={{ boxDecorationBreak: "clone", WebkitBoxDecorationBreak: "clone" }}>
              <p className="text-sm font-semibold" style={{ color: PINK, breakAfter: "avoid" }}>
                What we need from you ({neededFromClient.length})
              </p>
              <p className="text-[12px] text-slate-600" style={{ breakAfter: "avoid" }}>Decisions and jobs only your practice can do. The number shows which part of the plan each belongs to.</p>
              <ul className="mt-2 space-y-1.5 text-[13px] leading-snug text-slate-700">
                {neededFromClient.map((x, i) => (
                  <li key={i} className="flex gap-2" style={{ breakInside: "avoid" }}>
                    <span className="mt-0.5 inline-block h-3.5 w-3.5 shrink-0 rounded border border-slate-400" aria-hidden="true" />
                    <span>
                      {voice(x.ask.charAt(0).toUpperCase() + x.ask.slice(1))} <span className="text-[12px] text-slate-600">(plan item {x.rank})</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {ourWork.length > 0 && (
            <div className="rounded-2xl border border-slate-200 p-4" style={{ boxDecorationBreak: "clone", WebkitBoxDecorationBreak: "clone" }}>
              <p className="text-sm font-semibold" style={{ color: INDIGO, breakAfter: "avoid" }}>
                What Beyond Indigo will do
              </p>
              <p className="text-[12px] text-slate-600" style={{ breakAfter: "avoid" }}>We work through the plan in order. Where a job waits on one of your decisions above, we start it as soon as we hear from you.</p>
              <ol className="mt-2 space-y-1 text-[13px] leading-snug text-slate-700">
                {ourWork.map((x) => (
                  <li key={x.rank} style={{ breakInside: "avoid" }}>
                    <span className="font-medium text-slate-800">{x.rank}.</span> {voice(x.goal)} <span className="text-[12px] text-slate-600">({x.tasks} {x.tasks === 1 ? "job" : "jobs"} for us)</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </Section>
      )}

      <Section n={num()} title="Your two numbers, explained" intro="This report gives you two numbers. They measure different things, so it helps to keep them apart.">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl bg-slate-50 p-4" style={{ boxDecorationBreak: "clone", WebkitBoxDecorationBreak: "clone" }}>
            <p className="text-sm font-semibold" style={{ color: INDIGO }}>
              Your score: {s?.total ?? "—"} out of 100
            </p>
            <p className="mt-1 text-[13px] leading-relaxed text-slate-600">
              Think of this as a home inspection. It checks how well your website is built for Google and AI tools to read, trust and recommend. We add up points
              for things like your reviews, your doctors&apos; bios, your service pages and the technical set-up. The same website always gets the same score: no
              guesswork. <strong>This is the number you can improve directly</strong>, by making the changes in this report.
            </p>
            <p className="mt-2 text-xs text-slate-600">
              {weightsConfig.bands.map((b, i, all) => `${b.label}: ${b.min}${i === 0 ? "–100" : `–${all[i - 1].min - 1}`}`).join(" · ")}
            </p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4" style={{ boxDecorationBreak: "clone", WebkitBoxDecorationBreak: "clone" }}>
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
                  <span className="font-medium text-slate-800">{p.label}:</span> {oneOf(p.details.join(" "))}
                </li>
              ))}
            </ul>
          </>
        )}
      </Section>

      {v && (
        <Section
          keepFirst
          n={num()}
          title="How AI search sees you"
          intro={`More and more pet owners ask AI tools instead of scrolling through search results. On ${dateOf(v.ranAt)} we asked six of them the same ${v.prompts.length} questions. ${aiLocationNote(v)} The full list of questions is at the end of this report.`}
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
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-600">
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
                    <span className="block text-[12px] text-slate-600">{PLATFORM_PLAIN[p.platform]}</span>
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
          {v.platforms
            .filter((p) => p.promptsPlanned > p.promptsRun)
            .map((p) => (
              <p key={p.platform} className="text-xs font-medium text-amber-700">
                {`${p.label}: ${p.promptsPlanned - p.promptsRun} of the ${p.promptsPlanned} questions couldn't be checked on this run${v.errors.some((e) => e.startsWith(p.label)) ? " (the service returned an error)" : ""}, so its numbers here cover ${p.promptsRun} questions. Run the AI visibility step again to fill them in.`}
              </p>
            ))}
          {v.platforms.some((p) => p.platform === "ai_overview" && p.promptsAnswered < p.promptsRun) && (
            <p className="text-xs text-slate-600">Google only shows its AI summary for some searches, so it answered fewer questions than the others.</p>
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
                  <p className="text-[12px] text-slate-600">{example}</p>
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
                {" · "}Answers that named a practice called &ldquo;{audit.practice_name}&rdquo;: <strong>{v.mentions.namedInAnswers.mentions}</strong>
                <span className="block text-xs text-slate-600">
                  This counts the name anywhere in the US, so it can include other practices with the same name. Links to your website are the reliable measure.
                </span>
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
              of={pages.length} sources={pagesWith(pages, (p) => p.accreditations.length > 0)}
            />
            <Check ok={pages.some((p) => p.hours)} label="Opening hours shown" of={pages.length} sources={pagesWith(pages, (p) => Boolean(p.hours))} />
            <Check
              ok={pages.some((p) => saysSomething(p.booking))}
              label="Clear how to book"
              detail={firstFew(pages.map((p) => p.booking), 1)}
              of={pages.length} sources={pagesWith(pages, (p) => saysSomething(p.booking))}
            />
            <Check
              ok={pages.some((p) => informative(p.emergencyReferral))}
              label="Says where to go in an emergency"
              detail={firstFew(pages.map((p) => p.emergencyReferral), 1)}
              of={pages.length} sources={pagesWith(pages, (p) => informative(p.emergencyReferral))}
            />
            <Check ok={pages.some((p) => informative(p.paymentInfo))} label="Payment options explained" of={pages.length} sources={pagesWith(pages, (p) => informative(p.paymentInfo))} />
            <Check
              ok={pages.some((p) => p.pricesShown.length)}
              label="Some prices shown"
              detail={distinct(pages.flatMap((p) => p.pricesShown))
                .slice(0, 4)
                .join(" · ")}
              of={pages.length} sources={pagesWith(pages, (p) => p.pricesShown.length > 0)}
            />
            <Check ok={pages.some((p) => p.hasFaq)} label="Answers to common questions (FAQ)" of={pages.length} sources={pagesWith(pages, (p) => p.hasFaq)} />
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
                  <p className="text-[12px] text-slate-600">The first {vets.listings.length} vets Google Maps shows for “{vets.search}” near your address, in Google&apos;s order.</p>
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
          intro="AI tools love to quote blog posts that answer one clear question, show when they were written, and point readers to the service that helps."
        >
          {blogPosts.length === 0 ? (
            <p className="text-sm text-slate-600">We didn&apos;t find any blog posts.</p>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-left uppercase tracking-wide text-slate-600">
                  <th className="py-1.5 font-semibold">Post</th>
                  <th className="py-1.5 pl-2 font-semibold">Headline asks a question</th>
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
                        <span className="block text-[12px] text-slate-600">{shortUrl(p.url)}</span>
                      </td>
                      <td className="py-1.5 pl-2">{yesNo(Boolean(p.blog?.questionHeading))}</td>
                      <td className="py-1.5 pl-2">{p.blog?.dateShown ?? "No"}</td>
                      <td className="py-1.5 pl-2">{yesNo(Boolean(p.blog?.linksToServicePage))}</td>
                      <td className="py-1.5 pl-2">{yesNo(Boolean(crawl?.schemaTypes.some((x) => /Article|BlogPosting/.test(x))))}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          {unreadPosts.length > 0 && (
            <p className="text-[13px] text-slate-600">
              {`This table covers the posts listed in your sitemap. ${unreadPosts.length === 1 ? "1 more post isn't" : `${unreadPosts.length} more posts aren't`} in the sitemap, so ${unreadPosts.length === 1 ? "it wasn't" : "they weren't"} read for this section (see "Website health").`}
            </p>
          )}
        </Section>
      )}

      {t && (
        <Section
          n={num()}
          title="Website health"
          intro={`Things visitors rarely notice but Google and AI tools do. We checked every page you list for Google on ${dateOf(t.crawledAt)}. Red items need fixing; amber items are worth tidying up; green is fine. ${lean ? "Our web team works from a page-by-page list of every one of these, so there's nothing here you need to do." : `Each one says how to fix it and lists every page affected, so ${forClient ? "our team" : "your web developer"} can go straight to it.`}`}
        >
          <ul className="space-y-2">
            {findings.map((f) => (
              <li
                key={f.text}
                className="rounded-xl border-l-4 bg-slate-50 px-3 py-2"
                // A long list may run onto the next page; a short item stays together.
                style={{ borderColor: f.tone === "bad" ? "#dc2626" : f.tone === "warn" ? "#d97706" : "#059669", breakInside: detailLines(f.details) > 4 ? "auto" : "avoid" }}
              >
                {/* Keep the line with what's under it; a line with nothing under it must not hold on to the next item. */}
                <p className="text-[13px] text-slate-800" style={!lean && (f.fix || f.details?.length) ? { breakAfter: "avoid" } : undefined}>{f.text}</p>
                {!lean && f.fix && (
                  <p className="mt-0.5 text-[12px] text-slate-600" style={f.details?.length ? { breakAfter: "avoid" } : undefined}>
                    <span className="font-semibold text-slate-700">How to fix:</span> {f.fix}
                  </p>
                )}
                {!lean && f.details && <FindingDetails details={f.details} />}
              </li>
            ))}
          </ul>
          {!lean && (() => {
            const limits = crawlLimits(t);
            return (
              <div className="rounded-xl border border-slate-200 px-3 py-2 text-[12px] leading-relaxed text-slate-600" style={{ breakInside: "avoid" }}>
                <p className="font-semibold text-slate-700">What this check covers</p>
                <p>
                  Every page in your sitemap, every link between your own pages on them, and every address those links point to
                  {t.offSitemap ? `; the links on ${t.offSitemap.pagesRead} pages outside your sitemap` : ""}
                  {t.files ? `; ${t.files.checked} PDFs, images and documents` : ""}
                  {t.external ? `; and ${t.external.checked} links to other websites` : ""}.
                  {limits.hit.length === 0 && limits.recorded && " Nothing was cut short on this run."}
                </p>
                {limits.hit.length > 0 && (
                  <>
                    <p className="mt-1 font-semibold text-amber-700">Cut short on this run, so some problems may be missing:</p>
                    <ul className="list-disc pl-4">
                      {limits.hit.map((l) => (
                        <li key={l}>
                          <LinkedText text={l} />
                        </li>
                      ))}
                    </ul>
                  </>
                )}
                {!limits.recorded && <p className="mt-1">This crawl ran before we recorded every limit; run the technical crawl again to see whether anything was cut short.</p>}
                <p className="mt-1 font-semibold text-slate-700">Not checked, or not certain:</p>
                <ul className="list-disc pl-4">
                  {notChecked(t).map((l) => (
                    <li key={l}>{l}</li>
                  ))}
                </ul>
              </div>
            );
          })()}
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
                <tr className="border-b border-slate-200 text-left uppercase tracking-wide text-slate-600">
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
                    <td className="py-1.5 pl-2 text-[12px] text-slate-600">{d.urls.slice(0, 3).map(shortUrl).join(" · ")}</td>
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
                {p.currentH1 ?? shortUrl(p.url)} <span className="text-[12px] text-slate-600">{shortUrl(p.url)}</span>
              </li>
            ))}
          </ul>
          {missingServices.length > 0 && (
            <div className="rounded-xl border-l-4 bg-slate-50 px-3 py-2" style={{ borderColor: "#d97706", breakInside: "avoid" }}>
              <p className="text-[13px] text-slate-800">
                <strong>Named across your site but with no page of their own:</strong> {missingServices.join(", ")}.
              </p>
              <p className="mt-1 text-xs text-slate-600">
                When someone asks AI for &quot;{missingServices[0].toLowerCase()} near {town}&quot;, a dedicated page is what gets you recommended.
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
                  of={pages.length} sources={pagesWith(pages, (p) => Boolean(p.hours))}
                />
              );
            })()}
            <Check
              ok={pages.some((p) => saysSomething(p.booking))}
              label="Booking"
              detail={firstFew(pages.map((p) => p.booking)) || "We couldn't find how to book."}
              of={pages.length} sources={pagesWith(pages, (p) => saysSomething(p.booking))}
            />
            <Check
              ok={pages.some((p) => informative(p.emergencyReferral))}
              label="Emergencies"
              detail={firstFew(pages.map((p) => p.emergencyReferral), 1) || "We couldn't find where to go in an emergency."}
              of={pages.length} sources={pagesWith(pages, (p) => informative(p.emergencyReferral))}
            />
            <Check
              ok={pages.some((p) => informative(p.paymentInfo))}
              label="Payment"
              detail={firstFew(pages.map((p) => p.paymentInfo)) || "We couldn't find any payment information."}
              of={pages.length} sources={pagesWith(pages, (p) => informative(p.paymentInfo))}
            />
            <Check
              ok={uniqueTypos.length === 0}
              label={uniqueTypos.length ? `${uniqueTypos.length} spelling mistakes to fix` : "No spelling mistakes found"}
              details={lean ? uniqueTypos.map((ty) => ({ label: `"${ty.text}" should be "${ty.suggestion}"` })) : typoDetails}
            />
          </ul>
        </Section>
      )}

      {c && c.site.differentiators.length > 0 && (
        <Section
          keepFirst
          n={num()}
          title="What makes you different"
          intro="Strengths your website or your Google reviews already show, which most practices nearby can't claim. Lead with these. Under each one is where it comes from."
        >
            {c.site.differentiators.map((d) => (
              <div key={d.title} className="rounded-2xl border border-slate-200 p-4" style={{ breakInside: "avoid" }}>
                <p className="text-sm font-semibold" style={{ color: INDIGO }}>
                  {d.title}
                </p>
                <p className="mt-1 text-[13px] leading-relaxed text-slate-700">{d.detail}</p>
                <EvidenceList items={d.evidence} locate={locate} />
              </div>
            ))}
          <p className="text-[12px] text-slate-600">&quot;Google review 6&quot; means your 6th most recent Google review when we ran this audit.</p>
        </Section>
      )}

      {c && (
        <Section keepFirst n={num()} title="How to say it" intro="A one-sentence description of your practice, and a homepage headline, built from the strengths above.">
          <div className="rounded-2xl p-5 text-white" style={{ background: GRADIENT, breakInside: "avoid" }}>
            <p className="text-xs font-semibold uppercase tracking-wide text-white/75">Your practice in one sentence</p>
            <p className="mt-1 text-lg leading-snug" style={{ fontFamily: "var(--font-heading)" }}>
              {c.site.positioningLine}
            </p>
          </div>
          <div className="space-y-3" style={{ breakInside: "avoid" }}>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl bg-slate-50 p-4" style={{ breakInside: "avoid" }}>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Your homepage headline today</p>
              <p className="mt-1 text-sm text-slate-800">{homepage?.currentH1 ?? t?.pages.find((p) => p.finalStatus === 200)?.h1s[0] ?? "(none)"}</p>
              {homepage && <Sources items={[homepage.url]} />}
            </div>
            <div className="rounded-2xl bg-slate-50 p-4" style={{ breakInside: "avoid" }}>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Suggested headline</p>
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
          </div>
        </Section>
      )}

      {c && !lean && (
        <Section
          n="Appendix A"
          title="Suggested headline for each main page"
          intro="Each page's main headline (the big text at the top) is one of the first things Google and AI read. We suggest a headline for each main page that says what it is, who it's for, and where. Blog posts are left out: their headlines work best as the question a pet owner would ask."
        >
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-left uppercase tracking-wide text-slate-600">
                <th className="py-1.5 font-semibold">Page</th>
                <th className="py-1.5 pl-2 font-semibold">Headline today</th>
                <th className="py-1.5 pl-2 font-semibold">Suggested headline</th>
              </tr>
            </thead>
            <tbody>
              {/* Not blog posts (the plan asks for those as questions) or policy pages (nobody searches for them). */}
              {pages.filter((p) => p.pageType !== "blog_post" && !/privacy|terms|polic/i.test(p.url)).map((p) => (
                <tr key={p.url} className="border-b border-slate-100 align-top" style={{ breakInside: "avoid" }}>
                  <td className="py-1.5 pr-2 text-[12px] text-slate-600">{shortUrl(p.url)}</td>
                  <td className="py-1.5 pl-2 text-slate-700">{p.currentH1 ?? "(none)"}</td>
                  <td className="py-1.5 pl-2 text-slate-900">
                    {p.recommendedH1}
                    {p.secondaryLine && <span className="block text-[12px] text-slate-600">Keep underneath: {p.secondaryLine}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}

      {t && !lean && (
        <Section
          n="Appendix B"
          title={forClient ? "Technical details for our web team" : "Technical details for your web developer"}
          intro={`The raw numbers behind "Website health", checked ${dateOf(t.crawledAt)}. You don't need to read this page; ${forClient ? "it's what our web team works from" : "pass it to whoever looks after your website"}.`}
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
          <table className="w-full text-[11px]">
            <thead>
              <tr className="border-b border-slate-200 text-left uppercase tracking-wide text-slate-600">
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
                    {p.chain.length > 1 && <span className="text-slate-500"> → {shortUrl(p.finalUrl)}</span>}
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

      <Section n={lean ? "Appendix" : "Appendix C"} title="How we did this audit">
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
            {`Your Google rating, review count and ${reviews.length} most recent reviews (we never record reviewers' names).`} Links from other websites are measured
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
                {v.platforms.map((p) => `${PLATFORM_LABEL[p.platform]} (${place(v.models[p.platform] ?? p.model ?? "as served")})`).join(" · ")}. {aiLocationNote(v)}{" "}
                {v.profile === "consumer"
                  ? "ChatGPT and Gemini were read from their public apps; Claude and Perplexity were asked through their developer versions with web search on."
                  : "We used lower-cost developer versions of these tools, with web search on."}
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
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">{title}</p>
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

      <footer className="border-t border-slate-200 pt-4 text-center text-xs text-slate-600">
        Beyond Indigo Pets · beyondindigopets.com · Audit #{audit.id}, {runDate}
      </footer>
    </article>
  );
}
