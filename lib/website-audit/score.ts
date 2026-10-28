import weightsConfig from "@/lib/website-audit/config/score-weights.json";
import type { AuditResults, CitabilityScore, SubScore } from "@/lib/website-audit/types";

// Section 5: the citability score, worked out from the crawl, authority and
// content results with plain arithmetic (no AI judgement), weights from
// config/score-weights.json. Every part lists what earned or lost points, in
// words a practice owner can read (the details print in the client report).

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
    rating == null ? "We couldn't find a Google rating." : `Rated ${rating}★ on Google.`,
    count == null
      ? "We couldn't find a review count."
      : `${count.toLocaleString("en-US")} reviews (full points at ${config.reviewCountFullMarks.toLocaleString("en-US")}).`,
  ]);
  const rank = results.authority?.own.rank ?? null;
  add("domainRank", "Links from other websites", rank == null ? 0 : rank / config.domainRankFullMarks, [
    rank == null
      ? "We couldn't measure links from other websites."
      : `${rank} on DataForSEO's 0–1000 link-strength scale, which counts how many other websites link to yours and how trusted they are (full points at ${config.domainRankFullMarks}).`,
  ]);

  // Technical basics: seven equal checks.
  const t = results.technical?.summary;
  if (t) {
    const checks: [boolean | number, string][] = [
      [t.notHttps === 0 && t.insecureRedirects.length + t.slashVariants.insecure.length === 0, "Secure (https) on every page, with no links falling back to insecure http"],
      [t.noViewport === 0, "Set up for phones on every page"],
      [t.uniquePages ? 1 - t.missingCanonical / t.uniquePages : 0, `Tells Google which address is a page's main one (${t.uniquePages - t.missingCanonical} of ${t.uniquePages} pages)`],
      [t.uniquePages ? 1 - (t.noH1 + t.multipleH1) / t.uniquePages : 0, `One main headline per page (${t.uniquePages - t.noH1 - t.multipleH1} of ${t.uniquePages})`],
      [t.redirectLoops.length + t.slashVariants.loops.length + t.softErrors.length === 0, `No pages stuck in a loop or showing an error (${t.redirectLoops.length + t.slashVariants.loops.length + t.softErrors.length} found)`],
      [t.serverErrors.length + t.notFound.length === 0, "Every page you list for Google actually loads"],
      [!t.helloWorldInSitemap && t.tagPages + t.categoryPages + t.authorPages <= 5 && Object.keys(t.byHost).length === 1, "A tidy page list for Google (one web address, no filler or sample pages)"],
    ];
    const scores = checks.map(([v]) => (typeof v === "number" ? clamp(v) : v ? 1 : 0));
    add("technical", "Website set-up", scores.reduce((a, b) => a + b, 0) / checks.length, checks.map(([, label], i) => `${scores[i] === 1 ? "✓" : scores[i] === 0 ? "✗" : "◐"} ${label}`));
  } else add("technical", "Website set-up", 0, ["Not checked yet."]);

  // Structured data.
  const types = new Set(t?.schemaTypes ?? []);
  const blogPosts = (results.content?.pages ?? []).filter((p) => p.pageType === "blog_post");
  const crawlByUrl = new Map((results.technical?.pages ?? []).map((p) => [p.finalUrl, p]));
  const postsWithArticle = blogPosts.filter((p) => crawlByUrl.get(p.url)?.schemaTypes.some((s) => /Article|BlogPosting/.test(s))).length;
  const local = types.has("VeterinaryCare") || types.has("LocalBusiness") || types.has("AnimalHospital");
  const sd = [
    [local ? 1 : 0, 0.4, `${local ? "✓" : "✗"} Labelled as a veterinary practice`],
    [types.has("Person") ? 1 : 0, 0.2, `${types.has("Person") ? "✓" : "✗"} Doctors labelled as people`],
    [types.has("FAQPage") ? 1 : 0, 0.2, `${types.has("FAQPage") ? "✓" : "✗"} FAQs labelled as questions and answers`],
    [blogPosts.length ? postsWithArticle / blogPosts.length : 0, 0.2, `Blog posts labelled as articles (${postsWithArticle} of ${blogPosts.length})`],
  ] as const;
  add("structuredData", "Behind-the-scenes labels for Google", sd.reduce((a, [v, weight]) => a + v * weight, 0), sd.map(([, , label]) => label));

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
  const ownPages = new Set(doctorPages.map((p) => p.finalUrl)).size;
  add("doctors", "Your doctors", docs, [
    `${n} doctors named.`,
    `${[...doctors.values()].filter((d) => d.bio).length} with a bio, ${[...doctors.values()].filter((d) => d.credentials).length} with their qualifications shown.`,
    ownPages ? `${ownPages} with a page of their own.` : "None has a page of their own.",
  ]);

  // Services: named services that have a page with real content.
  const servicePages = pages.filter((p) => p.pageType === "service");
  const withContent = servicePages.filter((p) => (crawlByUrl.get(p.url)?.wordCount ?? 0) >= 300).length;
  const missing = results.content?.site.servicesWithoutPage ?? [];
  const named = servicePages.length + missing.length;
  add("services", "Your services", named ? withContent / named : 0, [
    `${servicePages.length} services have their own page; ${withContent} of those go into real detail (300+ words).`,
    missing.length ? `Mentioned but with no page of their own: ${missing.join(", ")}.` : "Every service you mention has its own page.",
  ]);

  // Blog / answer content.
  const b = blogPosts.map((p) => p.blog).filter((x): x is NonNullable<typeof x> => Boolean(x));
  const loops = t?.slashVariants.loops.length ?? 0;
  const share = (f: (x: (typeof b)[number]) => boolean) => (b.length ? b.filter(f).length / b.length : 0);
  const blogParts = [share((x) => x.questionHeading), share((x) => Boolean(x.authorNamed)), share((x) => Boolean(x.dateShown)), share((x) => x.linksToServicePage)];
  add("blog", "Your blog", b.length ? blogParts.reduce((x, y) => x + y, 0) / 4 - (loops ? 0.1 : 0) : 0, [
    `${b.length} blog posts.`,
    `${pct(blogParts[0])} ask a question in the headline, ${pct(blogParts[1])} name an author, ${pct(blogParts[2])} show a date, ${pct(blogParts[3])} link to a service page.`,
    ...(loops ? [`Points taken off: ${loops} posts break when the address is typed without the final "/".`] : []),
  ]);

  const faq = pages.filter((p) => p.hasFaq).map((p) => p.url);
  add("faq", "Frequently asked questions", faq.length ? 1 : 0, [faq.length ? `Questions and answers on ${faq.length} pages.` : "No questions-and-answers section found."]);
  const accreditations = [...new Set(pages.flatMap((p) => p.accreditations))];
  add("accreditations", "Accreditations", accreditations.length ? 1 : 0, [
    accreditations.length ? `Shown: ${accreditations.join(", ")}.` : "No accreditations shown (such as AAHA, Fear Free or Cat Friendly).",
  ]);

  const total = Math.round(parts.reduce((sum, p) => sum + p.points, 0));
  return { computedAt: new Date().toISOString(), total, band: bandFor(total, config.bands), subScores: parts, weightsVersion: config.version };
}
