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
 * The important subtlety, verified against schema.org 2026-08-28: `VeterinaryCare`
 * is NOT a `LocalBusiness`. Its chain is
 * `Thing > Organization > MedicalOrganization > VeterinaryCare`, so it carries no
 * `openingHours`, `geo`, `priceRange` or `openingHoursSpecification` — those live
 * on `LocalBusiness`. `MedicalClinic` was given both parents; VeterinaryCare was
 * not (schemaorg/schemaorg#1800, still open).
 *
 * A practice therefore needs BOTH: a LocalBusiness type for hours, location and
 * Google's local rich results, plus VeterinaryCare to say what kind of practice
 * it is. Usually expressed as `"@type": ["VeterinaryCare", "LocalBusiness"]`.
 *
 * `accepts` lists the types that satisfy an expectation. Checks are site-wide:
 * these are expected *somewhere*, not on every page.
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
    key: "local_business",
    label: "Local business",
    // Any LocalBusiness descendant carries the local properties.
    accepts: ["LocalBusiness", "MedicalBusiness", "MedicalClinic", "EmergencyService"],
    severity: "critical",
    why: "Where opening hours, geo and price range live, and what Google's local business rich results require. VeterinaryCare does not provide these.",
  },
  {
    key: "veterinary_care",
    label: "VeterinaryCare",
    accepts: ["VeterinaryCare"],
    severity: "watch",
    why: "Says the practice is specifically a vet. Pair it with a LocalBusiness type rather than using it on its own.",
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

export type SchemaGap = {
  key: string;
  label: string;
  severity: "critical" | "watch";
  /**
   * `unpaired`   = the specific type is there but the one carrying hours/geo is not.
   * `mismatched` = the markup describes a human clinic on a veterinary site.
   */
  status: "missing" | "unpaired" | "mismatched";
  found: string | null;
  suggestion: string;
  why: string;
};

/**
 * Compare the types found across a whole site against what a vet practice
 * should have. Returns only the gaps — an empty array means the site is clean.
 */
/**
 * LocalBusiness descendants that describe human healthcare. They satisfy the
 * structural requirement — they are real LocalBusinesses and do publish hours
 * and geo — but they say the wrong thing on a veterinary site. Schema.org does
 * not mark them human-only, yet their medicalSpecialty vocabulary is human
 * medicine, and VeterinaryCare exists precisely because a vet is not one of
 * these.
 */
const HUMAN_MEDICINE_TYPES = ["MedicalClinic", "MedicalBusiness", "Physician", "Hospital", "Dentist"];

export function findSchemaGaps(typesFoundAcrossSite: string[]): SchemaGap[] {
  const found = new Set(typesFoundAcrossSite.map((t) => t.toLowerCase()));
  const has = (type: string) => found.has(type.toLowerCase());
  const gaps: SchemaGap[] = [];

  for (const expectation of VET_SCHEMA_EXPECTATIONS) {
    if (expectation.accepts.some(has)) continue;

    // VeterinaryCare on its own is the trap worth naming: it looks like the
    // practice is marked up, but the hours and location are not published.
    const unpairedVet = expectation.key === "local_business" && has("VeterinaryCare");

    gaps.push({
      key: expectation.key,
      label: expectation.label,
      severity: expectation.severity,
      status: unpairedVet ? "unpaired" : "missing",
      found: unpairedVet ? "VeterinaryCare" : null,
      suggestion: unpairedVet
        ? 'Using VeterinaryCare alone, which carries no opening hours or location. Add LocalBusiness alongside it — "@type": ["VeterinaryCare", "LocalBusiness"].'
        : `Add ${expectation.accepts[0]} markup.`,
      why: expectation.why,
    });
  }

  // Only worth raising when nothing else says "vet": with VeterinaryCare present
  // the species is stated and a human-medicine type alongside it is merely
  // redundant, not misleading.
  const humanType = HUMAN_MEDICINE_TYPES.find(has);
  if (humanType && !has("VeterinaryCare")) {
    gaps.push({
      key: "human_medicine_type",
      label: "Practice type",
      severity: "watch",
      status: "mismatched",
      found: humanType,
      suggestion: `Marked up as ${humanType}, which describes human healthcare. Use LocalBusiness with VeterinaryCare instead.`,
      why: "Its medicalSpecialty vocabulary is human medicine, and VeterinaryCare exists because a veterinary practice is not a human clinic.",
    });
  }

  return gaps;
}
