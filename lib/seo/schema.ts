import * as cheerio from "cheerio";

/**
 * JSON-LD extraction and gap analysis, shared by the quick SEO crawl and the
 * site-audit crawl stage. Lived in the site-audit stage first; moved here when
 * the client Research tab needed the same parsing.
 */

// Real-world JSON-LD is often technically-invalid JSON that lenient validators
// (schema.org, Google) still accept: leading `//` banner comments, `/* */`
// blocks, or trailing commas. Strip those before parsing so we don't report a
// false "no schema" on pages that clearly have it. Operates on the original,
// newline-preserved script text — a collapsed one-liner would let a `//`
// comment swallow the whole object.
function sanitizeJsonLd(raw: string) {
  return raw
    .replace(/^\s*\/\/.*$/gm, "") // full-line // comments (leaves // inside URLs alone)
    .replace(/\/\*[\s\S]*?\*\//g, "") // /* ... */ block comments
    .replace(/,\s*([}\]])/g, "$1") // trailing commas before } or ]
    .trim();
}

/** Every `@type` on the page, including inside the `@graph` wrapper Yoast and RankMath emit. */
export function extractSchemaTypes(html: string): string[] {
  const $ = cheerio.load(html);
  const types = new Set<string>();
  const addType = (type: unknown) => {
    if (typeof type === "string" && type.trim()) types.add(type.trim());
    else if (Array.isArray(type)) type.forEach(addType);
  };
  $('script[type="application/ld+json"]').each((_, node) => {
    const raw = $(node).html();
    if (!raw || !raw.trim()) return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(sanitizeJsonLd(raw));
    } catch {
      // still unparseable after sanitizing — genuinely broken markup
      return;
    }
    const items = Array.isArray(parsed) ? parsed : [parsed];
    for (const item of items) {
      if (!item || typeof item !== "object") continue;
      const record = item as Record<string, unknown>;
      addType(record["@type"]);
      const graph = record["@graph"];
      if (Array.isArray(graph)) {
        for (const entry of graph) {
          if (entry && typeof entry === "object") {
            addType((entry as Record<string, unknown>)["@type"]);
          }
        }
      }
    }
  });
  return [...types];
}

/**
 * What a veterinary practice site should be publishing, and why.
 *
 * `accepts` lists the types that satisfy the expectation — schema.org offers
 * several valid ways to say the same thing, and a site using `LocalBusiness`
 * instead of `VeterinaryCare` is less specific but not missing the markup. The
 * check is site-wide: these are expected *somewhere*, not on every page.
 */
export type SchemaExpectation = {
  key: string;
  label: string;
  accepts: string[];
  severity: "critical" | "watch";
  why: string;
};

export const VET_SCHEMA_EXPECTATIONS: SchemaExpectation[] = [
  {
    key: "practice",
    label: "Practice / local business",
    accepts: ["VeterinaryCare", "LocalBusiness", "MedicalBusiness", "MedicalClinic"],
    severity: "critical",
    why: "Tells Google this is a real practice with a location — the basis for local pack and map results.",
  },
  {
    key: "organization",
    label: "Organization",
    accepts: ["Organization", "Corporation", "NGO"],
    severity: "watch",
    why: "Carries the brand name, logo and social profiles into the knowledge panel.",
  },
  {
    key: "website",
    label: "WebSite",
    accepts: ["WebSite"],
    severity: "watch",
    why: "Required for a sitelinks search box, and anchors the site's identity.",
  },
  {
    key: "breadcrumbs",
    label: "Breadcrumbs",
    accepts: ["BreadcrumbList"],
    severity: "watch",
    why: "Turns the URL line in search results into a readable path.",
  },
];

/** More specific alternatives worth suggesting when the generic type is used. */
const PREFERRED_OVER: Record<string, string> = {
  LocalBusiness: "VeterinaryCare",
  MedicalBusiness: "VeterinaryCare",
  MedicalClinic: "VeterinaryCare",
};

export type SchemaGap = {
  key: string;
  label: string;
  severity: "critical" | "watch";
  /** Present but a more specific type exists, vs. absent entirely. */
  status: "missing" | "imprecise";
  found: string | null;
  suggestion: string;
  why: string;
};

/**
 * Compare the types found across a whole site against what a vet practice
 * should have. Returns only the gaps — an empty array means the site is clean.
 */
export function findSchemaGaps(typesFoundAcrossSite: string[]): SchemaGap[] {
  const found = new Set(typesFoundAcrossSite.map((t) => t.toLowerCase()));
  const gaps: SchemaGap[] = [];

  for (const expectation of VET_SCHEMA_EXPECTATIONS) {
    const match = expectation.accepts.find((t) => found.has(t.toLowerCase()));

    if (!match) {
      gaps.push({
        key: expectation.key,
        label: expectation.label,
        severity: expectation.severity,
        status: "missing",
        found: null,
        suggestion: `Add ${expectation.accepts[0]} markup.`,
        why: expectation.why,
      });
      continue;
    }

    const preferred = PREFERRED_OVER[match];
    if (preferred && !found.has(preferred.toLowerCase())) {
      gaps.push({
        key: expectation.key,
        label: expectation.label,
        severity: "watch",
        status: "imprecise",
        found: match,
        suggestion: `Using ${match}; ${preferred} is more specific for a veterinary practice.`,
        why: expectation.why,
      });
    }
  }

  return gaps;
}
