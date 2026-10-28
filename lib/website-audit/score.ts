import weightsConfig from "@/lib/website-audit/config/score-weights.json";
import type { AuditResults, CitabilityScore, SubScore } from "@/lib/website-audit/types";

// Section 5: the citability score, worked out from the crawl, authority and
// content results with plain arithmetic (no AI judgement), weights from
// config/score-weights.json. Every part lists what earned or lost points.

type Weights = typeof weightsConfig.weights;
const round1 = (n: number) => Math.round(n * 10) / 10;
const clamp = (n: number) => Math.max(0, Math.min(1, n));
const pct = (n: number) => `${Math.round(n * 100)}%`;

export function bandFor(total: number, bands = weightsConfig.bands): string {
  return bands.find((b) => total >= b.min)?.label ?? bands[bands.length - 1].label;
}

export function computeScore(results: AuditResults, config = weightsConfig): CitabilityScore {
  const w: Weights = config.weights;
  const parts: SubScore[] = [];
  const add = (key: keyof Weights, label: string, fraction: number, details: string[]) =>
    parts.push({ key, label, weight: w[key], points: round1(w[key] * clamp(fraction)), details });

  // Outside authority: reviews (rating and volume) and DataForSEO rank.
  const g = results.authority?.google;
  const rating = g?.rating ?? null;
  const count = g?.reviewCount ?? null;
  const ratingPart = rating == null ? 0 : rating >= 4.8 ? 1 : rating >= 4.5 ? 0.8 : rating >= 4 ? 0.5 : 0.2;
  const countPart = count ? clamp(Math.log10(count) / Math.log10(config.reviewCountFullMarks)) : 0;
  add("reviews", "Google reviews", 0.5 * ratingPart + 0.5 * countPart, [
    rating == null ? "No Google rating found." : `Rating ${rating}★ (${pct(ratingPart)} of the rating half).`,
    count == null ? "No review count found." : `${count} reviews (${pct(countPart)} of the volume half; full marks at ${config.reviewCountFullMarks}).`,
  ]);
  const rank = results.authority?.own.rank ?? null;
  add("domainRank", "Outside links (DataForSEO rank)", rank == null ? 0 : rank / config.domainRankFullMarks, [
    rank == null ? "No DataForSEO rank." : `DataForSEO rank ${rank} of 1000 (full marks at ${config.domainRankFullMarks}).`,
  ]);

  // Technical basics: seven equal checks.
  const t = results.technical?.summary;
  if (t) {
    const checks: [boolean | number, string][] = [
      [t.notHttps === 0 && t.insecureRedirects.length + t.slashVariants.insecure.length === 0, "HTTPS everywhere, no redirects to http"],
      [t.noViewport === 0, "Mobile viewport on every page"],
      [t.uniquePages ? 1 - t.missingCanonical / t.uniquePages : 0, `Canonical tags (${t.uniquePages - t.missingCanonical} of ${t.uniquePages} pages)`],
      [t.uniquePages ? 1 - (t.noH1 + t.multipleH1) / t.uniquePages : 0, `One H1 per page (${t.uniquePages - t.noH1 - t.multipleH1} of ${t.uniquePages})`],
      [t.redirectLoops.length + t.slashVariants.loops.length + t.softErrors.length === 0, `No redirect loops or error pages (${t.redirectLoops.length + t.slashVariants.loops.length + t.softErrors.length} found)`],
      [t.serverErrors.length + t.notFound.length === 0, "No broken sitemap URLs"],
      [!t.helloWorldInSitemap && t.tagPages + t.categoryPages + t.authorPages <= 5 && Object.keys(t.byHost).length === 1, "Clean sitemap (one host, few archive pages, no sample posts)"],
    ];
    const scores = checks.map(([v]) => (typeof v === "number" ? clamp(v) : v ? 1 : 0));
    add("technical", "Technical basics", scores.reduce((a, b) => a + b, 0) / checks.length, checks.map(([, label], i) => `${scores[i] === 1 ? "✓" : scores[i] === 0 ? "✗" : "◐"} ${label}`));
  } else add("technical", "Technical basics", 0, ["No crawl yet."]);

  // Structured data.
  const types = new Set(t?.schemaTypes ?? []);
  const blogPosts = (results.content?.pages ?? []).filter((p) => p.pageType === "blog_post");
  const crawlByUrl = new Map((results.technical?.pages ?? []).map((p) => [p.finalUrl, p]));
  const postsWithArticle = blogPosts.filter((p) => crawlByUrl.get(p.url)?.schemaTypes.some((s) => /Article|BlogPosting/.test(s))).length;
  const local = types.has("VeterinaryCare") || types.has("LocalBusiness") || types.has("AnimalHospital");
  const sd = [
    [local ? 1 : 0, 0.4, `${local ? "✓" : "✗"} LocalBusiness / VeterinaryCare`],
    [types.has("Person") ? 1 : 0, 0.2, `${types.has("Person") ? "✓" : "✗"} Person (doctors)`],
    [types.has("FAQPage") ? 1 : 0, 0.2, `${types.has("FAQPage") ? "✓" : "✗"} FAQPage`],
    [blogPosts.length ? postsWithArticle / blogPosts.length : 0, 0.2, `Article on blog posts (${postsWithArticle} of ${blogPosts.length})`],
  ] as const;
  add("structuredData", "Structured data", sd.reduce((a, [v, weight]) => a + v * weight, 0), sd.map(([, , label]) => label));

  // Doctors, read from the content pass.
  const pages = results.content?.pages ?? [];
  const doctors = new Map<string, { credentials: boolean; bio: boolean }>();
  for (const p of pages)
    for (const d of p.doctors) {
      const key = d.name.toLowerCase().replace(/^dr\.?\s+/, "").replace(/,.*$/, "").trim();
      const was = doctors.get(key) ?? { credentials: false, bio: false };
      doctors.set(key, { credentials: was.credentials || Boolean(d.credentials), bio: was.bio || d.hasBio });
    }
  const doctorPages = (results.technical?.pages ?? []).filter((p) => p.finalStatus === 200 && /\/(dr-|doctors?\/)[a-z]/i.test(new URL(p.finalUrl).pathname));
  const n = doctors.size;
  const docs = n
    ? 0.25 + 0.3 * ([...doctors.values()].filter((d) => d.bio).length / n) + 0.2 * ([...doctors.values()].filter((d) => d.credentials).length / n) + 0.25 * Math.min(1, new Set(doctorPages.map((p) => p.finalUrl)).size / n)
    : 0;
  add("doctors", "Doctors readable", docs, [
    `${n} doctors named.`,
    `${[...doctors.values()].filter((d) => d.bio).length} with a bio, ${[...doctors.values()].filter((d) => d.credentials).length} with credentials shown.`,
    `${new Set(doctorPages.map((p) => p.finalUrl)).size} doctor pages of their own.`,
  ]);

  // Services: named services that have a page with real content.
  const servicePages = pages.filter((p) => p.pageType === "service");
  const withContent = servicePages.filter((p) => (crawlByUrl.get(p.url)?.wordCount ?? 0) >= 300).length;
  const missing = results.content?.site.servicesWithoutPage ?? [];
  const named = servicePages.length + missing.length;
  add("services", "Service coverage", named ? withContent / named : 0, [
    `${servicePages.length} service pages, ${withContent} with 300+ words.`,
    missing.length ? `Named without a page: ${missing.join(", ")}.` : "Every named service has a page.",
  ]);

  // Blog / answer content.
  const b = blogPosts.map((p) => p.blog).filter((x): x is NonNullable<typeof x> => Boolean(x));
  const loops = t?.slashVariants.loops.length ?? 0;
  const share = (f: (x: (typeof b)[number]) => boolean) => (b.length ? b.filter(f).length / b.length : 0);
  const blogParts = [share((x) => x.questionHeading), share((x) => Boolean(x.authorNamed)), share((x) => Boolean(x.dateShown)), share((x) => x.linksToServicePage)];
  add("blog", "Blog / answer content", b.length ? blogParts.reduce((x, y) => x + y, 0) / 4 - (loops ? 0.1 : 0) : 0, [
    `${b.length} blog posts read.`,
    `Question headings ${pct(blogParts[0])}, author named ${pct(blogParts[1])}, date shown ${pct(blogParts[2])}, links to a service page ${pct(blogParts[3])}.`,
    ...(loops ? [`−10%: ${loops} posts break without the trailing slash.`] : []),
  ]);

  const faq = pages.filter((p) => p.hasFaq).map((p) => p.url);
  add("faq", "FAQ content", faq.length ? 1 : 0, [faq.length ? `FAQ content on ${faq.length} pages.` : "No FAQ content found."]);
  const accreditations = [...new Set(pages.flatMap((p) => p.accreditations))];
  add("accreditations", "Accreditations shown", accreditations.length ? 1 : 0, [
    accreditations.length ? `Shown: ${accreditations.join(", ")}.` : "No accreditations (AAHA, Fear Free, Cat Friendly) shown.",
  ]);

  const total = Math.round(parts.reduce((sum, p) => sum + p.points, 0));
  return { computedAt: new Date().toISOString(), total, band: bandFor(total, config.bands), subScores: parts, weightsVersion: config.version };
}
