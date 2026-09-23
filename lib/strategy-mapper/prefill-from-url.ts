import * as cheerio from "cheerio";
import { generateClaudeContent } from "@/lib/ai/claude";
import { jsonBlockToObject } from "@/lib/projects/parse";
import { normalizeWebsiteUrl, SPECIALIZATION_OPTIONS } from "@/lib/strategy-mapper/form-options";
import type {
  PrefillConfidence,
  SalesPdfExtract,
  StrategyMapperFormData,
  StrategyMapperPrefillResult,
  StrategyMapperPrefillSignals,
} from "@/types/strategy-mapper";

export interface PrefillPage {
  url: string;
  html: string;
}

const MAX_PAGES = 6;
const FETCH_TIMEOUT_MS = 9000;
const MAX_LOGO_BYTES = 2_000_000;
const LOGO_MIME_ALLOWLIST = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif"]);

/** Pages worth reading for practice identity — everything else is noise for prefill. */
const PRIORITY_PATH = /\/(about|our-?team|team|staff|doctors?|veterinarians?|meet|services?|contact|locations?)/i;
const LOW_VALUE_PATH =
  /\.(pdf|jpe?g|png|gif|svg|webp|zip|mp4|webm)(\?|$)|\/(blog|news|privacy|terms|cart|checkout|account|login|wp-admin|wp-json|feed)/i;

function cleanText(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

// ---------------------------------------------------------------------------
// JSON-LD
// ---------------------------------------------------------------------------

type JsonLdNode = Record<string, unknown>;

/** Flatten every JSON-LD node on a page, following @graph and array wrappers. */
export function collectJsonLdNodes(html: string): JsonLdNode[] {
  const $ = cheerio.load(html);
  const nodes: JsonLdNode[] = [];

  const push = (value: unknown) => {
    if (!value) return;
    if (Array.isArray(value)) {
      for (const entry of value) push(entry);
      return;
    }
    if (typeof value !== "object") return;
    const node = value as JsonLdNode;
    nodes.push(node);
    if (node["@graph"]) push(node["@graph"]);
  };

  $('script[type="application/ld+json"]').each((_, element) => {
    const raw = $(element).contents().text().trim();
    if (!raw) return;
    try {
      push(JSON.parse(raw));
    } catch {
      // Malformed JSON-LD is common on vet sites; skip it silently.
    }
  });

  return nodes;
}

const BUSINESS_TYPES = [
  "veterinarycare",
  "animalhospital",
  "localbusiness",
  "medicalbusiness",
  "medicalorganization",
  "organization",
  "professionalservice",
];

function nodeTypes(node: JsonLdNode): string[] {
  const raw = node["@type"];
  const values = Array.isArray(raw) ? raw : [raw];
  return values.filter((v): v is string => typeof v === "string").map((v) => v.toLowerCase());
}

/** Best business node available, ranked by how specific the @type is. */
export function findBusinessNode(nodes: JsonLdNode[]): JsonLdNode | null {
  let best: { node: JsonLdNode; rank: number } | null = null;
  for (const node of nodes) {
    const types = nodeTypes(node);
    for (const type of types) {
      const rank = BUSINESS_TYPES.indexOf(type);
      if (rank === -1) continue;
      if (!best || rank < best.rank) best = { node, rank };
    }
  }
  return best?.node ?? null;
}

function asString(value: unknown): string {
  if (typeof value === "string") return cleanText(value);
  if (typeof value === "number") return String(value);
  return "";
}

export function formatJsonLdAddress(node: JsonLdNode | null): string {
  if (!node) return "";
  const raw = node.address;
  if (typeof raw === "string") return cleanText(raw);
  if (!raw || typeof raw !== "object") return "";
  const address = (Array.isArray(raw) ? raw[0] : raw) as JsonLdNode;
  const street = asString(address.streetAddress);
  const city = asString(address.addressLocality);
  const region = asString(address.addressRegion);
  const postal = asString(address.postalCode);
  if (!street || !city) return "";
  const tail = [region, postal].filter(Boolean).join(" ");
  return [street, city, tail].filter(Boolean).join(", ");
}

// ---------------------------------------------------------------------------
// Deterministic field extraction
// ---------------------------------------------------------------------------

const NAME_NOISE =
  /^(home|welcome|veterinarian|vet clinic|animal hospital|home page|index)$/i;

/** Title tags are usually "Name | Veterinarian in Town, ST" — keep the first real segment. */
export function practiceNameFromTitle(title: string): string {
  const segments = cleanText(title)
    .split(/\s+[|•·–—]\s+|\s+-\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
  for (const segment of segments) {
    if (NAME_NOISE.test(segment)) continue;
    if (/^(veterinarian|vet|animal hospital|pet)\b/i.test(segment) && segments.length > 1) continue;
    return segment;
  }
  return segments[0] ?? "";
}

const ADDRESS_REGEX =
  /\d{1,6}[A-Za-z]?\s+[A-Za-z0-9.'\- ]{2,60},?\s+[A-Za-z.'\- ]{2,40},\s*(?:A[KLRZ]|C[AOT]|D[CE]|FL|GA|HI|I[ADLN]|K[SY]|LA|M[ADEINOST]|N[CDEHJMVY]|O[HKR]|P[AR]|RI|S[CD]|T[NX]|UT|V[AT]|W[AIVY])\s+\d{5}(?:-\d{4})?/;

export function addressFromText(text: string): string {
  const match = text.match(ADDRESS_REGEX);
  return match ? cleanText(match[0]) : "";
}

const PHONE_REGEX = /(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/;

const SPECIALIZATION_RULES: Array<{ option: (typeof SPECIALIZATION_OPTIONS)[number]; pattern: RegExp }> = [
  { option: "Small Animal", pattern: /\b(small animal|dogs? and cats?|cats? and dogs?|canine|feline|puppy|kitten)\b/i },
  {
    option: "Exotic / Avian",
    pattern: /\b(exotics?|exotic pets?|avian|birds?|reptiles?|rabbits?|ferrets?|guinea pigs?|pocket pets?|bearded dragons?)\b/i,
  },
  {
    option: "Equine / Large Animal",
    pattern: /\b(equine|horses?|large animal|livestock|bovine|cattle|farm animals?)\b/i,
  },
  {
    option: "24/7 Emergency",
    pattern: /\b(24\s?\/\s?7|24[- ]hour|emergency (?:care|services?|vet|veterinary|hospital)|after[- ]hours emergency)\b/i,
  },
  { option: "Urgent Care", pattern: /\burgent care\b/i },
  {
    option: "Surgical & Diagnostics",
    pattern:
      /\b(surgery|surgical suite|soft tissue surgery|diagnostics?|digital (?:x-?rays?|radiograph)|ultrasound|endoscopy|in-?house lab)\b/i,
  },
  {
    option: "Orthopedics / Specialty",
    pattern:
      /\b(orthopedics?|orthopedic surgery|TPLO|cruciate|board[- ]certified|internal medicine|oncology|cardiology|neurology|specialty (?:care|hospital))\b/i,
  },
];

export function detectSpecializations(text: string): string[] {
  return SPECIALIZATION_RULES.filter((rule) => rule.pattern.test(text)).map((rule) => rule.option);
}

const PROCEDURE_RULES: Array<{ label: string; pattern: RegExp }> = [
  { label: "TPLO", pattern: /\bTPLO\b|tibial plateau leveling/i },
  { label: "Cruciate / ACL repair", pattern: /\b(cruciate|ACL (?:tear|repair)|lateral suture)\b/i },
  { label: "Orthopedic surgery", pattern: /\borthopedic surger|\bfracture repair\b|\bluxating patella\b/i },
  { label: "Dental cleaning & extractions", pattern: /\b(dental (?:cleaning|prophylaxis|care|surgery)|dentistry|tooth extraction)\b/i },
  { label: "Soft tissue surgery", pattern: /\bsoft tissue surger/i },
  { label: "Spay & neuter", pattern: /\b(spay|neuter|spays? and neuters?)\b/i },
  { label: "Laser therapy", pattern: /\b(laser therapy|cold laser|therapeutic laser)\b/i },
  { label: "Acupuncture", pattern: /\bacupuncture\b/i },
  { label: "Rehabilitation / physical therapy", pattern: /\b(rehabilitation|physical therapy|hydrotherapy|underwater treadmill)\b/i },
  { label: "Ultrasound", pattern: /\bultrasound|sonograph/i },
  { label: "Endoscopy", pattern: /\bendoscop/i },
  { label: "Digital radiography", pattern: /\b(digital (?:x-?ray|radiograph)|radiology)\b/i },
  { label: "Oncology / chemotherapy", pattern: /\b(oncology|chemotherapy)\b/i },
  { label: "Echocardiography", pattern: /\becho(?:cardiogra)/i },
  { label: "Dermatology / allergy", pattern: /\b(dermatology|allergy testing)\b/i },
];

export function detectProcedures(text: string): string[] {
  return PROCEDURE_RULES.filter((rule) => rule.pattern.test(text)).map((rule) => rule.label);
}

/**
 * Count doctors by unique "Dr. Lastname" / "Name, DVM" mentions. Returns "" when
 * the count looks like a directory scrape rather than one practice's team.
 */
export function countDoctors(text: string): string {
  const names = new Set<string>();
  // The surname group must not swallow the next "Dr." in a team listing, or a
  // whole roster collapses into one name.
  for (const match of text.matchAll(
    /\bDr\.?\s+([A-Z][a-zA-Z'’-]+)(?:\s+(?!Dr\b|DVM\b|VMD\b)([A-Z][a-zA-Z'’-]+))?/g,
  )) {
    const last = match[2] ?? match[1];
    names.add(last.toLowerCase());
  }
  for (const match of text.matchAll(/\b([A-Z][a-zA-Z'’-]+)\s*,\s*(?:DVM|VMD|DACVS|DABVP)\b/g)) {
    names.add(match[1].toLowerCase());
  }
  if (names.size === 0 || names.size > 40) return "";
  return String(names.size);
}

const PLATFORM_FINGERPRINTS: Array<{ label: string; pattern: RegExp }> = [
  // Vet-industry vendors first — these name the incumbent agency.
  { label: "Beyond Indigo", pattern: /beyondindigo/i },
  { label: "Covetrus", pattern: /covetrus/i },
  { label: "Vetstreet", pattern: /vetstreet/i },
  { label: "iVET360", pattern: /ivet360/i },
  { label: "WhiskerCloud", pattern: /whiskercloud/i },
  { label: "GeniusVets", pattern: /geniusvets/i },
  { label: "LifeLearn", pattern: /lifelearn/i },
  { label: "PetDesk", pattern: /petdesk/i },
  { label: "VitusVet", pattern: /vitusvet/i },
  { label: "Vet2Pet", pattern: /vet2pet/i },
  { label: "Weave", pattern: /getweave\.com/i },
  // Generic CMS fallbacks.
  { label: "WordPress", pattern: /wp-content|wp-includes|wp-json/i },
  { label: "Wix", pattern: /wixstatic\.com|_wixCssImports/i },
  { label: "Squarespace", pattern: /squarespace/i },
  { label: "Duda", pattern: /irp\.cdn-website\.com|dudaone/i },
  { label: "Webflow", pattern: /webflow/i },
  { label: "HubSpot", pattern: /hs-scripts\.com|hubspot/i },
  { label: "Shopify", pattern: /cdn\.shopify\.com/i },
  { label: "GoDaddy", pattern: /godaddy|websitebuilder/i },
];

export function detectPlatforms(html: string): string[] {
  return PLATFORM_FINGERPRINTS.filter((entry) => entry.pattern.test(html)).map((entry) => entry.label);
}

const TRACKING_FINGERPRINTS: Array<{ label: string; pattern: RegExp }> = [
  { label: "Google Tag Manager", pattern: /GTM-[A-Z0-9]{4,}/ },
  { label: "GA4", pattern: /\bG-[A-Z0-9]{6,}\b/ },
  { label: "Universal Analytics (legacy)", pattern: /\bUA-\d{4,}-\d+\b/ },
  { label: "Google Ads conversion tag", pattern: /\bAW-\d{9,}\b/ },
  { label: "Meta Pixel", pattern: /connect\.facebook\.net|fbq\(/i },
  { label: "Microsoft Clarity", pattern: /clarity\.ms/i },
  { label: "Hotjar", pattern: /hotjar/i },
  { label: "CallRail", pattern: /callrail/i },
  { label: "CallTrackingMetrics", pattern: /calltrackingmetrics/i },
];

export function detectTrackingTags(html: string): string[] {
  return TRACKING_FINGERPRINTS.filter((entry) => entry.pattern.test(html)).map((entry) => entry.label);
}

const SOCIAL_PLATFORMS: Array<{ label: string; pattern: RegExp }> = [
  { label: "Facebook", pattern: /facebook\.com\//i },
  { label: "Instagram", pattern: /instagram\.com\//i },
  { label: "TikTok", pattern: /tiktok\.com\//i },
  { label: "YouTube", pattern: /youtube\.com\/|youtu\.be\//i },
  { label: "LinkedIn", pattern: /linkedin\.com\//i },
  { label: "X / Twitter", pattern: /twitter\.com\/|x\.com\//i },
];

export function detectSocialLinks(hrefs: string[]): string[] {
  const found: string[] = [];
  for (const { label, pattern } of SOCIAL_PLATFORMS) {
    const match = hrefs.find(
      (href) => pattern.test(href) && !/sharer|share\.php|intent\/tweet/i.test(href),
    );
    if (match) found.push(label);
  }
  return found;
}

// ---------------------------------------------------------------------------
// Page-set extraction (pure — this is what the tests drive)
// ---------------------------------------------------------------------------

export interface DeterministicPrefill {
  practiceName: string;
  streetAddress: string;
  logoUrl: string;
  specializations: string[];
  procedures: string[];
  doctorCount: string;
  signals: StrategyMapperPrefillSignals;
  /** Condensed page text handed to the AI pass */
  condensedText: string;
}

function pageText($: cheerio.CheerioAPI): string {
  $("script, style, noscript, svg").remove();
  return cleanText($("body").text());
}

function condensePage(url: string, $: cheerio.CheerioAPI): string {
  const headings: string[] = [];
  $("h1, h2, h3").each((_, element) => {
    const text = cleanText($(element).text());
    if (text && text.length < 140) headings.push(text);
  });
  const paragraphs: string[] = [];
  $("p").each((_, element) => {
    const text = cleanText($(element).text());
    if (text.length > 60) paragraphs.push(text);
  });
  return [
    `## ${url}`,
    `TITLE: ${cleanText($("title").first().text())}`,
    `HEADINGS: ${unique(headings).slice(0, 25).join(" | ")}`,
    `BODY: ${paragraphs.slice(0, 12).join(" ").slice(0, 2500)}`,
  ].join("\n");
}

export function extractPrefillFromPages(pages: PrefillPage[]): DeterministicPrefill {
  const empty: DeterministicPrefill = {
    practiceName: "",
    streetAddress: "",
    logoUrl: "",
    specializations: [],
    procedures: [],
    doctorCount: "",
    signals: {
      platform: null,
      trackingTags: [],
      socialLinks: [],
      phone: null,
      claimedRating: null,
      claimedReviewCount: null,
    },
    condensedText: "",
  };
  if (pages.length === 0) return empty;

  const homepage = pages[0];
  const allHtml = pages.map((page) => page.html).join("\n");

  const jsonLdNodes = collectJsonLdNodes(allHtml);
  const business = findBusinessNode(jsonLdNodes);

  const $home = cheerio.load(homepage.html);
  const metaSiteName = cleanText($home('meta[property="og:site_name"]').attr("content"));
  const metaImage = cleanText($home('meta[property="og:image"]').attr("content"));
  const title = cleanText($home("title").first().text());

  const practiceName =
    asString(business?.name) || metaSiteName || practiceNameFromTitle(title);

  // Collect link hrefs and combined visible text before the text-destructive pass.
  const hrefs: string[] = [];
  for (const page of pages) {
    const $ = cheerio.load(page.html);
    $("a[href]").each((_, element) => {
      const href = cleanText($(element).attr("href"));
      if (href) hrefs.push(href);
    });
  }

  const texts = pages.map((page) => pageText(cheerio.load(page.html)));
  const combinedText = texts.join("\n");

  const streetAddress =
    formatJsonLdAddress(business) || addressFromText(combinedText);

  let logoUrl = asString(
    typeof business?.logo === "object" && business?.logo !== null
      ? (business.logo as JsonLdNode).url
      : business?.logo,
  );
  if (!logoUrl) {
    const $logoImg = $home("img").filter((_, element) => {
      const attrs = [
        $home(element).attr("alt"),
        $home(element).attr("class"),
        $home(element).attr("id"),
        $home(element).attr("src"),
      ]
        .filter(Boolean)
        .join(" ");
      return /logo/i.test(attrs);
    });
    logoUrl = cleanText($logoImg.first().attr("src") ?? $logoImg.first().attr("data-src"));
  }
  if (!logoUrl) logoUrl = metaImage;

  const ratingNode = business?.aggregateRating as JsonLdNode | undefined;
  const claimedRating = ratingNode ? asString(ratingNode.ratingValue) : "";
  const claimedReviewCount = ratingNode
    ? asString(ratingNode.reviewCount) || asString(ratingNode.ratingCount)
    : "";

  const phoneFromLd = asString(business?.telephone);
  const phoneMatch = phoneFromLd || combinedText.match(PHONE_REGEX)?.[0] || "";

  const platforms = detectPlatforms(allHtml);

  return {
    practiceName,
    streetAddress,
    logoUrl,
    specializations: detectSpecializations(combinedText),
    procedures: detectProcedures(combinedText),
    doctorCount: countDoctors(combinedText),
    signals: {
      platform: platforms[0] ?? null,
      trackingTags: detectTrackingTags(allHtml),
      socialLinks: detectSocialLinks(hrefs),
      phone: phoneMatch ? cleanText(phoneMatch) : null,
      claimedRating: claimedRating || null,
      claimedReviewCount: claimedReviewCount || null,
    },
    condensedText: pages
      .map((page) => condensePage(page.url, cheerio.load(page.html)))
      .join("\n\n")
      .slice(0, 14000),
  };
}

// ---------------------------------------------------------------------------
// AI pass — reads what regexes cannot judge
// ---------------------------------------------------------------------------

interface AiPrefill {
  practiceOwnerName?: string;
  clinicalDifferentiator?: string;
  customSpecialization?: string;
  doctorCount?: string;
  primaryProcedures?: string[];
  specializations?: string[];
}

function buildAiPrompt(condensedText: string): string {
  return [
    "You are reading scraped pages from a veterinary practice website to prefill an internal strategy form.",
    "Return ONLY a JSON object, no prose, no markdown fences, with these keys:",
    '  "practiceOwnerName": string — the owner or founding veterinarian, "" if the site never says who owns it. Do not guess from a list of associates.',
    '  "clinicalDifferentiator": string — one sentence on what this practice claims sets it apart clinically. "" if the site only has generic copy.',
    '  "customSpecialization": string — a focus not covered by the fixed list below (e.g. "Feline-only practice", "Fear Free certified"), else "".',
    '  "doctorCount": string — number of veterinarians on staff as a plain number, "" if unclear.',
    '  "primaryProcedures": string[] — up to 6 named high-ticket or signature procedures this practice actually performs.',
    `  "specializations": string[] — subset of exactly these labels: ${SPECIALIZATION_OPTIONS.join(" | ")}`,
    "",
    "Rules: only state what the pages support. Prefer \"\" over a plausible guess. Do not invent a doctor's name.",
    "",
    "PAGES:",
    condensedText,
  ].join("\n");
}

export async function runPrefillAiPass(condensedText: string): Promise<AiPrefill | null> {
  if (!condensedText.trim()) return null;
  const raw = await generateClaudeContent([{ text: buildAiPrompt(condensedText) }], {
    maxOutputTokens: 1200,
    temperature: 0,
  });
  return jsonBlockToObject<AiPrefill>(raw);
}

// ---------------------------------------------------------------------------
// Crawl
// ---------------------------------------------------------------------------

async function fetchHtml(url: string): Promise<{ finalUrl: string; html: string | null }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      cache: "no-store",
      headers: { "User-Agent": "BIPStrategyMapperBot/1.0 (+strategy-mapper-prefill)" },
    });
    const contentType = response.headers.get("content-type") ?? "";
    if (!response.ok || !contentType.includes("text/html")) {
      return { finalUrl: response.url || url, html: null };
    }
    return { finalUrl: response.url || url, html: await response.text() };
  } finally {
    clearTimeout(timer);
  }
}

function identityPageLinks(html: string, baseUrl: string, host: string): string[] {
  const $ = cheerio.load(html);
  const links = new Set<string>();
  $("a[href]").each((_, element) => {
    const href = cleanText($(element).attr("href"));
    if (!href || href.startsWith("mailto:") || href.startsWith("tel:")) return;
    try {
      const absolute = new URL(href, baseUrl);
      if (!/^https?:$/.test(absolute.protocol)) return;
      if (absolute.host !== host) return;
      absolute.hash = "";
      absolute.search = "";
      const value = absolute.toString();
      if (LOW_VALUE_PATH.test(value)) return;
      if (!PRIORITY_PATH.test(value)) return;
      links.add(value);
    } catch {
      // ignore malformed hrefs
    }
  });
  return [...links];
}

async function fetchLogoDataUrl(rawUrl: string, baseUrl: string): Promise<string> {
  let absolute: string;
  try {
    absolute = new URL(rawUrl, baseUrl).toString();
  } catch {
    return "";
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(absolute, {
      signal: controller.signal,
      redirect: "follow",
      cache: "no-store",
      headers: { "User-Agent": "BIPStrategyMapperBot/1.0 (+strategy-mapper-prefill)" },
    });
    if (!response.ok) return "";
    const mime = (response.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
    if (!LOGO_MIME_ALLOWLIST.has(mime)) return "";
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.byteLength === 0 || buffer.byteLength > MAX_LOGO_BYTES) return "";
    return `data:${mime};base64,${buffer.toString("base64")}`;
  } catch {
    return "";
  } finally {
    clearTimeout(timer);
  }
}

/** Homepage plus up to five identity pages (about / team / services / contact). */
export async function crawlPrefillPages(startUrl: string): Promise<PrefillPage[]> {
  const start = new URL(startUrl);
  const home = await fetchHtml(start.toString());
  if (!home.html) return [];

  const pages: PrefillPage[] = [{ url: home.finalUrl, html: home.html }];
  const host = new URL(home.finalUrl).host;
  const candidates = identityPageLinks(home.html, home.finalUrl, host)
    .filter((link) => link !== home.finalUrl)
    .slice(0, MAX_PAGES * 3);

  const seen = new Set([home.finalUrl.replace(/\/$/, "")]);
  for (const candidate of candidates) {
    if (pages.length >= MAX_PAGES) break;
    const key = candidate.replace(/\/$/, "");
    if (seen.has(key)) continue;
    seen.add(key);
    try {
      const result = await fetchHtml(candidate);
      if (result.html) pages.push({ url: result.finalUrl, html: result.html });
    } catch {
      // A dead identity page should not fail the whole prefill.
    }
  }
  return pages;
}

// ---------------------------------------------------------------------------
// Orchestration
// ---------------------------------------------------------------------------

function plausibleDoctorCount(value: string | undefined): string {
  const parsed = parseInt((value ?? "").replace(/[^\d]/g, ""), 10);
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 40) return "";
  return String(parsed);
}

export async function runStrategyMapperPrefill(
  rawWebsiteUrl: string,
  options?: { useAi?: boolean },
): Promise<StrategyMapperPrefillResult> {
  const websiteUrl = normalizeWebsiteUrl(rawWebsiteUrl);
  if (!websiteUrl) throw new Error("A website URL is required to prefill the form.");

  let parsed: URL;
  try {
    parsed = new URL(websiteUrl);
  } catch {
    throw new Error(`"${rawWebsiteUrl}" is not a valid website URL.`);
  }

  const pages = await crawlPrefillPages(parsed.toString());
  if (pages.length === 0) {
    throw new Error(
      `Could not read ${parsed.host} — the site did not return HTML. Check the URL, or fill the form manually.`,
    );
  }

  const base = extractPrefillFromPages(pages);

  let ai: AiPrefill | null = null;
  if (options?.useAi !== false) {
    try {
      ai = await runPrefillAiPass(base.condensedText);
    } catch {
      ai = null;
    }
  }

  const allowedSpecializations = new Set<string>(SPECIALIZATION_OPTIONS);
  const aiSpecializations = (ai?.specializations ?? []).filter((value) =>
    allowedSpecializations.has(value),
  );

  const form: Partial<StrategyMapperFormData> = {};
  const salesContext: Partial<SalesPdfExtract> = {};
  const confidence: Record<string, PrefillConfidence> = {};
  const notes: string[] = [];

  const setForm = <K extends keyof StrategyMapperFormData>(
    key: K,
    value: StrategyMapperFormData[K],
    level: PrefillConfidence,
  ) => {
    form[key] = value;
    confidence[key as string] = level;
  };

  if (base.practiceName) setForm("practiceName", base.practiceName, "high");
  if (base.streetAddress) {
    // JSON-LD gives a structured address; the regex fallback is easier to get wrong.
    const fromJsonLd = Boolean(formatJsonLdAddress(findBusinessNode(collectJsonLdNodes(pages[0].html))));
    setForm("streetAddress", base.streetAddress, fromJsonLd ? "high" : "medium");
  } else {
    notes.push("No street address found in the site markup — enter it manually before fetching data.");
  }

  const ownerName = cleanText(ai?.practiceOwnerName);
  if (ownerName) setForm("practiceOwnerName", ownerName, "medium");

  const specializations = unique([...base.specializations, ...aiSpecializations]);
  if (specializations.length) {
    setForm("specializations", specializations, aiSpecializations.length ? "high" : "medium");
  }

  const customSpecialization = cleanText(ai?.customSpecialization);
  if (customSpecialization) setForm("customSpecialization", customSpecialization, "medium");

  if (base.logoUrl) {
    const logoDataUrl = await fetchLogoDataUrl(base.logoUrl, pages[0].url);
    if (logoDataUrl) setForm("logoDataUrl", logoDataUrl, "medium");
    else notes.push("Found a logo image but could not download it — upload the logo manually.");
  }

  const procedures = unique([...(ai?.primaryProcedures ?? []).map(cleanText).filter(Boolean), ...base.procedures]).slice(
    0,
    8,
  );
  if (procedures.length) {
    salesContext.primaryProcedures = procedures;
    confidence["sales.primaryProcedures"] = "medium";
  }

  const doctorCount = plausibleDoctorCount(ai?.doctorCount) || base.doctorCount;
  if (doctorCount) {
    salesContext.doctorCount = doctorCount;
    confidence["sales.doctorCount"] = "medium";
  }

  const differentiator = cleanText(ai?.clinicalDifferentiator);
  if (differentiator) {
    salesContext.clinicalDifferentiator = differentiator;
    confidence["sales.clinicalDifferentiator"] = "medium";
  }

  if (base.signals.socialLinks.length) {
    salesContext.primarySocialPlatform = base.signals.socialLinks[0];
    confidence["sales.primarySocialPlatform"] = "high";
  }

  const vendorPlatforms = unique(
    [base.signals.platform, ...base.signals.trackingTags].filter((v): v is string => Boolean(v)),
  );
  if (vendorPlatforms.length) {
    salesContext.vendorPlatforms = vendorPlatforms;
    confidence["sales.vendorPlatforms"] = "high";
  }

  if (base.signals.trackingTags.includes("Google Ads conversion tag")) {
    salesContext.clientRunsOwnAds = true;
    confidence["sales.clientRunsOwnAds"] = "high";
    notes.push("A Google Ads conversion tag (AW-…) is live on the site — they are running their own ads.");
  }

  // Never let the site's own schema markup override live Google research.
  if (base.signals.claimedRating || base.signals.claimedReviewCount) {
    notes.push(
      `Site markup claims ${base.signals.claimedRating ?? "?"}★ from ${base.signals.claimedReviewCount ?? "?"} reviews — left blank on purpose so live research pulls the real Google numbers.`,
    );
  }

  notes.push("Primary goal, core services, and sales context stay blank — those come from the sales call, not the site.");

  return {
    websiteUrl,
    finalUrl: pages[0].url,
    pagesScanned: pages.length,
    scannedUrls: pages.map((page) => page.url),
    form,
    salesContext,
    confidence,
    signals: base.signals,
    notes,
    aiUsed: Boolean(ai),
  };
}
