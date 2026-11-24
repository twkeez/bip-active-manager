import { codeForName, regionName } from "@/lib/onboarding/research-location";

// Where a practice is, read from its own website, so an audit doesn't depend
// on a town someone typed. Q1 Veterinary Hospital's audit (#10, 2026-11-12) was
// started with "Oshawa, Ontario, Canada" in the city box; its website says
// 1392 Gerrard Street East, Toronto, ON. Every AI question then asked about
// vets "near Oshawa", and both Google tools refused the location outright.
//
// The website's address wins when one can be read. Canadian practices are
// flagged: the AI step asks every tool from the United States, so they are run
// separately until the step can ask from Canada.

export type SiteLocation = {
  city: string;
  /** Two-letter code: "GA", "ON". */
  state: string;
  country: "USA" | "Canada";
  /** Where on the page it was read: structured data or the visible address. */
  source: "structured data" | "address on the page";
};

const US_ZIP = /^\d{5}(-\d{4})?$/;
const CA_POSTAL = /^[A-Z]\d[A-Z]\s?\d[A-Z]\d$/i;

/** "Georgia" or "ga" → "GA"; null when it isn't a US state or Canadian province. */
function regionCode(value: string | null | undefined): string | null {
  const raw = (value ?? "").trim().replace(/\.$/, "");
  if (!raw) return null;
  const upper = raw.toUpperCase();
  if (upper.length === 2 && regionName(upper)) return upper;
  return codeForName(raw);
}

function located(city: string, stateRaw: string, source: SiteLocation["source"]): SiteLocation | null {
  const state = regionCode(stateRaw);
  const town = city.replace(/\s+/g, " ").trim();
  if (!state || !town || town.length > 40 || /\d/.test(town)) return null;
  return { city: town, state, country: regionName(state)!.country, source };
}

/** Every PostalAddress-like object in the page's JSON-LD blocks. */
function structuredAddresses(html: string): { locality?: unknown; region?: unknown }[] {
  const found: { locality?: unknown; region?: unknown }[] = [];
  const walk = (value: unknown) => {
    if (Array.isArray(value)) value.forEach(walk);
    else if (value && typeof value === "object") {
      const record = value as Record<string, unknown>;
      if ("addressLocality" in record || "addressRegion" in record) found.push({ locality: record.addressLocality, region: record.addressRegion });
      Object.values(record).forEach(walk);
    }
  };
  for (const match of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      walk(JSON.parse(match[1]));
    } catch {
      // A broken block is skipped; the visible address is read instead.
    }
  }
  return found;
}

/** The page as text, one line per block, for reading the address the visitor sees. */
function visibleText(html: string): string {
  return html
    .replace(/<(script|style|noscript|svg)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>|<\/(p|div|li|h\d|address|span|a|td|section|footer)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/[ \t]+/g, " ");
}

/**
 * Addresses written the usual way: "5067 Dallas Hwy, Powder Springs, GA 30127"
 * or "1392 Gerrard Street East, Toronto, ON M4L 1Z4". The town is the words
 * between a comma (or the start of a line) and ", ST" + a ZIP or postal code.
 */
function writtenAddresses(text: string): SiteLocation[] {
  const out: SiteLocation[] = [];
  const pattern = /(?:^|,|\n)[ \t]*([A-Z][A-Za-z.'\- ]{1,38}?)[ \t]*,[ \t]*([A-Z]{2}|[A-Z][a-z]+(?: [A-Z][a-z]+)*)\.?,?[ \t]+(\d{5}(?:-\d{4})?|[A-Z]\d[A-Z][ \t]?\d[A-Z]\d)\b/gm;
  for (const m of text.matchAll(pattern)) {
    const code = m[3];
    const place = located(m[1], m[2], "address on the page");
    if (!place) continue;
    // The code must fit the country: a US ZIP with a US state, a postal code with a province.
    if ((place.country === "USA" && !US_ZIP.test(code)) || (place.country === "Canada" && !CA_POSTAL.test(code))) continue;
    out.push(place);
  }
  return out;
}

/** The practice's town and state from its home page HTML, or null when none can be read. */
export function locationFromHtml(html: string): SiteLocation | null {
  for (const address of structuredAddresses(html)) {
    if (typeof address.locality === "string" && typeof address.region === "string") {
      const place = located(address.locality, address.region, "structured data");
      if (place) return place;
    }
  }
  // The address the visitor sees, usually in the footer on every page. When a
  // practice lists more than one location, the one written most often wins.
  const seen = new Map<string, { place: SiteLocation; count: number }>();
  for (const place of writtenAddresses(visibleText(html))) {
    const key = `${place.city.toLowerCase()}|${place.state}`;
    const was = seen.get(key);
    seen.set(key, { place, count: (was?.count ?? 0) + 1 });
  }
  return [...seen.values()].sort((a, b) => b.count - a.count)[0]?.place ?? null;
}

/** Fetches the home page and reads the address on it. Never throws: no address is null. */
export async function locationFromWebsite(domain: string, fetcher: typeof fetch = fetch): Promise<SiteLocation | null> {
  for (const url of [`https://${domain}/`, `https://www.${domain}/`]) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12_000);
    try {
      const response = await fetcher(url, {
        redirect: "follow",
        signal: controller.signal,
        headers: { "User-Agent": "BeyondIndigoAuditBot/1.0 (+https://beyondindigopets.com)", Accept: "text/html,*/*;q=0.8" },
        cache: "no-store",
      });
      if (!response.ok) continue;
      const place = locationFromHtml(await response.text());
      if (place) return place;
    } catch {
      // Try the other address, then give up quietly.
    } finally {
      clearTimeout(timer);
    }
  }
  return null;
}

/**
 * A typed location read the way older records hold it: "Oshawa, Ontario, Canada"
 * or "Parkville, MD" in the city box, with or without a state.
 */
export function splitTypedLocation(city: string | null | undefined, state: string | null | undefined): { city: string | null; state: string | null } {
  let town = (city ?? "").trim();
  let region = regionCode(state) ?? ((state ?? "").trim() || null);
  const parts = town.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length > 1) {
    const rest = parts.slice(1).filter((p) => !/^(usa|us|united states|canada)$/i.test(p));
    const code = rest.length ? regionCode(rest[0].replace(/\s+\d{5}(-\d{4})?$/, "")) : null;
    if (code) {
      town = parts[0];
      region = region && regionCode(region) ? region : code;
    }
  }
  return { city: town || null, state: region };
}

/** Is this practice in Canada? Read from its province code, or "Canada" written in the city box. */
export function isCanadian(city: string | null | undefined, state: string | null | undefined): boolean {
  if (/\bcanada\b/i.test(city ?? "") || /\bcanada\b/i.test(state ?? "")) return true;
  const code = regionCode(splitTypedLocation(city, state).state);
  return code ? regionName(code)?.country === "Canada" : false;
}
