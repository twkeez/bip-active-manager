import type {
  SalesLighthouseFinding,
  SalesLogoAnalysis,
  SalesLighthouseMetrics,
  SalesLighthouseScores,
  SalesPromptBrief,
  SalesSeoFindings,
  SalesSiteExtract,
} from "@/lib/types/client";

export function topIssuesList(
  seo: SalesSeoFindings,
  lighthouseFindings: SalesLighthouseFinding[],
) {
  const seoIssues = seo.issues.slice(0, 4).map((issue) => `${issue.severity.toUpperCase()}: ${issue.title}`);
  const lhIssues = lighthouseFindings
    .slice(0, 4)
    .map((issue) => `${issue.severity.toUpperCase()}: ${issue.title}`);
  return [...seoIssues, ...lhIssues].slice(0, 6);
}

type Confidence = "high" | "medium" | "placeholder";
type RankedLine = {
  id: string;
  text: string;
  confidence: Confidence;
  priority: number;
  required?: boolean;
  section: string;
};

const SECTION_LIMITS = {
  valueProps: 3,
  reviews: 3,
  services: 5,
  trustSignals: 4,
  ctas: 4,
  contactPoints: 3,
  competitorGaps: 4,
  reasonsToChoose: 4,
} as const;

const FORBIDDEN_SCRAPED_PATTERNS: RegExp[] = [
  /\bcovid(?:-19)?\b/i,
  /\bemergency notice\b/i,
  /\bprivacy policy\b/i,
  /\blegal\b/i,
  /\bterms(?: of service)?\b/i,
  /\bcookie\b/i,
  /\binfo@email\.com\b/i,
];

const PROMPT_BUDGET = {
  maxLines: 88,
  maxChars: 8800,
} as const;

function cleanForRank(value: string) {
  return value.trim().toLowerCase();
}

function conversionIntentScore(value: string) {
  let score = 0;
  const text = cleanForRank(value);
  if (/\b(book|schedule|call|consult|appointment|today|now|get started)\b/.test(text)) score += 4;
  if (/\btrusted|award|certified|years|family|local|guarantee|emergency|same-day\b/.test(text)) score += 3;
  if (/\bresults|outcomes|faster|friendly|experienced|compassionate\b/.test(text)) score += 2;
  if (text.length >= 35 && text.length <= 180) score += 2;
  if (text.length > 240) score -= 2;
  return score;
}

function dedupeStable<T>(rows: T[], readText: (row: T) => string) {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const row of rows) {
    const key = cleanForRank(readText(row)).replace(/[^\w\s]/g, " ");
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

function shouldExcludeScrapedText(value: string) {
  const normalized = cleanForRank(value);
  if (!normalized) return true;
  return FORBIDDEN_SCRAPED_PATTERNS.some((pattern) => pattern.test(normalized));
}

function rankSnippetRows(
  rows: Array<{ text: string; sourceUrl: string }>,
  limit: number,
) {
  return dedupeStable(rows, (row) => row.text)
    .filter((row) => !shouldExcludeScrapedText(row.text))
    .map((row) => ({ ...row, score: conversionIntentScore(row.text) }))
    .sort((a, b) => b.score - a.score || a.text.localeCompare(b.text))
    .slice(0, limit);
}

function rankTextRows(rows: string[], limit: number) {
  return dedupeStable(rows, (row) => row)
    .filter((row) => !shouldExcludeScrapedText(row))
    .map((row) => ({ value: row, score: conversionIntentScore(row) }))
    .sort((a, b) => b.score - a.score || a.value.localeCompare(b.value))
    .slice(0, limit)
    .map((row) => row.value);
}

function asTaggedLine(line: RankedLine) {
  return `- [${line.confidence}] ${line.text}`;
}

function buildActionFromGap(gap: string) {
  const normalized = gap.replace(/\.$/, "").trim();
  if (!normalized) return "";
  return `Build action: ${normalized}.`;
}

function applyPromptBudget(lines: RankedLine[]) {
  const kept = [...lines];
  const withinBudget = () => {
    const chars = kept.reduce((total, row) => total + row.text.length + 1, 0);
    return kept.length <= PROMPT_BUDGET.maxLines && chars <= PROMPT_BUDGET.maxChars;
  };
  while (!withinBudget()) {
    let removeIndex = -1;
    for (let i = 0; i < kept.length; i += 1) {
      const candidate = kept[i];
      if (candidate.required) continue;
      if (removeIndex === -1) {
        removeIndex = i;
        continue;
      }
      const current = kept[removeIndex];
      if (candidate.priority < current.priority) {
        removeIndex = i;
      } else if (candidate.priority === current.priority) {
        if (candidate.text.length > current.text.length) {
          removeIndex = i;
        } else if (
          candidate.text.length === current.text.length &&
          candidate.id.localeCompare(current.id) > 0
        ) {
          removeIndex = i;
        }
      }
    }
    if (removeIndex === -1) break;
    kept.splice(removeIndex, 1);
  }
  return kept;
}

function hexToRgb(hex: string) {
  const match = hex.trim().match(/^#?([0-9a-fA-F]{6})$/);
  if (!match) return null;
  const raw = match[1];
  return {
    r: Number.parseInt(raw.slice(0, 2), 16),
    g: Number.parseInt(raw.slice(2, 4), 16),
    b: Number.parseInt(raw.slice(4, 6), 16),
  };
}

function isNeutralHex(hex: string) {
  const rgb = hexToRgb(hex);
  if (!rgb) return false;
  return Math.abs(rgb.r - rgb.g) <= 12 && Math.abs(rgb.g - rgb.b) <= 12;
}

function isMonochromeLogo(logoAnalysis?: SalesLogoAnalysis | null) {
  if (!logoAnalysis) return false;
  const samples = [logoAnalysis.primaryHex, logoAnalysis.secondaryHex, logoAnalysis.accentHex];
  const neutralCount = samples.filter((hex) => isNeutralHex(hex)).length;
  return neutralCount >= 2;
}

function detectIndustry(input: {
  prospectName: string;
  targetKeyword?: string | null;
  services: string[];
}) {
  const corpus = `${input.prospectName} ${input.targetKeyword ?? ""} ${input.services.join(" ")}`.toLowerCase();
  if (/\b(vet|veterinar|animal hospital|pet care|canine|feline)\b/.test(corpus)) return "vet";
  if (/\b(dental|dentist|orthodont|periodont|endodont)\b/.test(corpus)) return "dental";
  return "general";
}

function getIndustryFallbackPalette(industry: "dental" | "vet" | "general") {
  if (industry === "dental") {
    return {
      primary: "#008080",
      secondary: "#334155",
      cta: "#0EA5A4",
      label: "Professional Teal + Clean Slate",
    };
  }
  if (industry === "vet") {
    return {
      primary: "#87A96B",
      secondary: "#8B6F47",
      cta: "#2F5D50",
      label: "Sage Green + Warm Earth",
    };
  }
  return {
    primary: "#2563EB",
    secondary: "#1F2937",
    cta: "#3B82F6",
    label: "High-Tech Blue + Deep Charcoal",
  };
}

export function buildHostingerHorizonsPrompt(input: {
  prospectName: string;
  prospectUrl: string;
  seo: SalesSeoFindings;
  lighthouseScores: SalesLighthouseScores;
  lighthouseMetrics: SalesLighthouseMetrics;
  lighthouseFindings: SalesLighthouseFinding[];
  extractedSiteContext?: SalesSiteExtract | null;
  logoUrl?: string | null;
  logoAnalysis?: SalesLogoAnalysis | null;
  brief?: SalesPromptBrief | null;
  competitorExtract?: SalesSiteExtract | null;
}) {
  const extract = input.extractedSiteContext;
  const brief = input.brief;
  const valueProps = rankSnippetRows(extract?.valueProps ?? [], SECTION_LIMITS.valueProps);
  const reviews = rankSnippetRows(extract?.reviews ?? [], SECTION_LIMITS.reviews);
  const services = rankTextRows(extract?.services ?? [], SECTION_LIMITS.services);
  const ctas = rankTextRows(extract?.ctas ?? [], SECTION_LIMITS.ctas);
  const contactPoints = rankTextRows(extract?.contactPoints ?? [], SECTION_LIMITS.contactPoints);
  const serviceAreas = rankTextRows(extract?.serviceAreas ?? [], 4);
  const trustSignals = rankTextRows(extract?.trustSignals ?? [], SECTION_LIMITS.trustSignals);
  const reasonsToChoose = rankTextRows(extract?.reasonsToChoose ?? [], SECTION_LIMITS.reasonsToChoose);
  const competitorServices = new Set(input.competitorExtract?.services ?? []);
  const competitorCtas = new Set((input.competitorExtract?.ctas ?? []).map((row) => row.toLowerCase()));
  const competitorGaps = [...(brief?.competitorGaps ?? [])];
  if (input.competitorExtract) {
    if (reviews.length === 0 && (input.competitorExtract.reviews?.length ?? 0) > 0) {
      competitorGaps.push("Competitor surfaces customer proof more clearly; add testimonial section above the fold.");
    }
    if (ctas.length === 0 && competitorCtas.size > 0) {
      competitorGaps.push("Competitor uses explicit conversion CTAs; add a stronger primary CTA with repeated placement.");
    }
    if (services.length < competitorServices.size) {
      competitorGaps.push("Competitor presents broader service visibility; add service cards with tighter benefit copy.");
    }
  }
  const industry = detectIndustry({
    prospectName: input.prospectName,
    targetKeyword: brief?.targetKeyword ?? null,
    services,
  });
  const monochromeLogo = isMonochromeLogo(input.logoAnalysis);
  const promptStyle = brief?.promptStyle ?? "full";
  const cityHint = serviceAreas[0] ?? "the target city";
  const fallbackPalette = getIndustryFallbackPalette(industry);
  const providedLogoUrl = input.logoUrl?.trim() ? input.logoUrl.trim() : "";
  const explicitLogoInstruction =
    providedLogoUrl
    ? `Use this exact logo asset in header and footer: ${providedLogoUrl}. Preserve original proportions and clear space.`
    : brief?.logoSource === "upload"
      ? "Use the uploaded logo file from this brief as the exact brand mark in header and footer. Do not recreate or substitute it."
      : "Use the primary on-site logo mark from the existing website as the exact brand mark in header and footer. Do not recreate or substitute it.";
  const resolvedPalette = input.logoAnalysis
    ? monochromeLogo
      ? industry === "dental"
        ? { primary: "#008080", secondary: "#334155", cta: "#0EA5A4", source: "monochrome-dental" as const }
        : industry === "vet"
          ? { primary: "#87A96B", secondary: "#8B6F47", cta: "#2F5D50", source: "monochrome-vet" as const }
          : { primary: "#2563EB", secondary: "#1F2937", cta: "#3B82F6", source: "monochrome-general" as const }
      : {
          primary: input.logoAnalysis.primaryHex,
          secondary: input.logoAnalysis.secondaryHex,
          cta: input.logoAnalysis.accentHex,
          source: "logo-extracted" as const,
        }
    : {
        primary: fallbackPalette.primary,
        secondary: fallbackPalette.secondary,
        cta: fallbackPalette.cta,
        source: "industry-fallback" as const,
      };
  const paletteInstruction = `Color palette to apply: Primary ${resolvedPalette.primary}, Secondary ${resolvedPalette.secondary}, CTA ${resolvedPalette.cta}.`;
  const paletteSourceInstruction =
    resolvedPalette.source === "logo-extracted"
      ? "Palette source: extracted directly from provided logo."
      : resolvedPalette.source.startsWith("monochrome")
        ? "Palette source: monochrome logo fallback palette by industry."
        : `Palette source: industry fallback (${fallbackPalette.label}).`;
  if (promptStyle === "short") {
    const topValueProps = valueProps.slice(0, 2).map((row) => row.text);
    const topServices = services.slice(0, 4);
    const topCtas = ctas.slice(0, 3);
    const topProof = reviews.slice(0, 2).map((row) => row.text);
    const topGaps = rankTextRows(competitorGaps, 3).map((gap) => buildActionFromGap(gap));
    return [
      "HOSTINGER HORIZONS MASTER PROMPT",
      "",
      "You are an Expert AI Prompt Engineer, conversion strategist, and premium web designer.",
      `Build a high-fidelity, conversion-first website concept for ${input.prospectName} (${input.prospectUrl}).`,
      `Industry: ${industry}. Target keyword: ${brief?.targetKeyword ?? "not provided"}. City: ${cityHint}.`,
      "",
      "NON-NEGOTIABLE RULES",
      "1) Logo-first visual system.",
      `- ${explicitLogoInstruction}`,
      `- ${paletteInstruction}`,
      `- ${paletteSourceInstruction}`,
      "- Apply palette to primary buttons, icons, hover states, and focus states.",
      "- Maintain accessible contrast and mobile responsiveness.",
      "2) Content sanitization.",
      "- Exclude COVID-19 mentions, outdated emergency notices, privacy/legal footer boilerplate.",
      '- Replace weak headline artifacts like "info@email.com" or "Hours" with benefit-driven headlines.',
      "3) Sales demo architecture.",
      "- Hero must include power headline + high-contrast primary CTA.",
      "- Include services, trust/social proof, and contact conversion sections.",
      "- If social proof/service cards are weak, synthesize best-practice demo gap sections.",
      "- Naturally weave target keyword + city into H1 and at least one H2.",
      "- Include LocalBusiness schema placeholders and NAP consistency in footer/contact sections.",
      "",
      "SOURCE-GROUNDED INPUTS TO USE",
      ...(topValueProps.length > 0
        ? topValueProps.map((row) => `- Value prop: ${row}`)
        : ["- Value prop: [PLACEHOLDER] Add benefit-focused value proposition."]),
      ...(topServices.length > 0
        ? topServices.map((row) => `- Service: ${row}`)
        : ["- Service: [PLACEHOLDER] Add 4-6 core service cards."]),
      ...(topProof.length > 0
        ? topProof.map((row) => `- Proof: ${row}`)
        : ["- Proof: [PLACEHOLDER] Add 1-2 customer quotes with attribution."]),
      ...(topCtas.length > 0
        ? topCtas.map((row) => `- CTA to reuse/improve: ${row}`)
        : ['- CTA: [PLACEHOLDER] "Book now", "Call now", "Request consultation".']),
      ...(topGaps.length > 0 ? topGaps.map((row) => `- ${row}`) : []),
      "",
      "OUTPUT FORMAT",
      "- Return one clean copy-pasteable website brief only.",
      "- Tone must be authoritative, descriptive, and conversion-focused.",
      "- Use concise rewritten copy and clear section hierarchy.",
    ].join("\n");
  }
  const missing = new Set(extract?.missingSections ?? []);
  const rawPromptBlocks: Array<{ title: string; lines: RankedLine[] }> = [
    {
      title: "Visual direction block",
      lines: [
        {
          id: "visual-core",
          text: "Build a premium, modern, conversion-oriented concept suitable for a live sales demo.",
          confidence: "medium",
          priority: 100,
          required: true,
          section: "visual",
        },
        {
          id: "visual-hierarchy",
          text: "Prioritize clean hierarchy, strong spacing rhythm, and high-contrast CTA placement.",
          confidence: "medium",
          priority: 94,
          section: "visual",
        },
        {
          id: "visual-typography",
          text: "Use typography and component styling that feels polished and agency-grade.",
          confidence: "medium",
          priority: 90,
          section: "visual",
        },
        {
          id: "visual-imagery",
          text: "Keep image treatment consistent (hero lifestyle visuals + service-supporting imagery).",
          confidence: "medium",
          priority: 88,
          section: "visual",
        },
        {
          id: "visual-logo-first",
          text: "Logo-first rule: derive brand palette from logo before any layout styling decisions.",
          confidence: "medium",
          priority: 99,
          required: true,
          section: "visual",
        },
        ...(input.logoAnalysis
          ? [
              {
                id: "visual-brand-colors",
                text: `Primary brand color ${input.logoAnalysis.primaryHex}, secondary ${input.logoAnalysis.secondaryHex}, accent ${input.logoAnalysis.accentHex}.`,
                confidence: "high" as const,
                priority: 92,
                section: "visual",
              },
              {
                id: "visual-brand-personality",
                text: `Express this brand personality in layout and tone: ${input.logoAnalysis.brandPersonality}.`,
                confidence: "high" as const,
                priority: 87,
                section: "visual",
              },
              ...(monochromeLogo
                ? [
                    {
                      id: "visual-monochrome-instruction",
                      text:
                        industry === "dental"
                          ? "Logo is monochrome: do not output a black-and-white site. Use Professional Teal (#008080), Clean Slate (#334155), and a high-contrast CTA teal."
                          : industry === "vet"
                            ? "Logo is monochrome: do not output a black-and-white site. Use Sage Green (#87A96B), Warm Earth (#8B6F47), and a deep-forest CTA accent."
                            : "Logo is monochrome: do not output a black-and-white site. Use High-Tech Blue (#2563EB), Deep Charcoal (#1F2937), and vivid CTA blue.",
                      confidence: "medium" as const,
                      priority: 96,
                      required: true,
                      section: "visual",
                    },
                    {
                      id: "visual-monochrome-usage",
                      text: "Apply palette to primary buttons, icons, hover states, and form focus states.",
                      confidence: "medium" as const,
                      priority: 95,
                      required: true,
                      section: "visual",
                    },
                  ]
                : []),
            ]
          : [
              {
                id: "visual-brand-fallback",
                text: "Derive palette from existing brand assets and keep color usage consistent.",
                confidence: "placeholder" as const,
                priority: 70,
                section: "visual",
              },
            ]),
        {
          id: "visual-logo-usage",
          text: explicitLogoInstruction,
          confidence: providedLogoUrl ? "high" : "medium",
          priority: 99,
          required: true,
          section: "visual",
        },
        {
          id: "visual-palette-usage",
          text: paletteInstruction,
          confidence: input.logoAnalysis ? "high" : "medium",
          priority: 98,
          required: true,
          section: "visual",
        },
        {
          id: "visual-palette-source",
          text: paletteSourceInstruction,
          confidence: input.logoAnalysis ? "high" : "medium",
          priority: 97,
          required: true,
          section: "visual",
        },
      ],
    },
    {
      title: "Page structure block",
      lines: [
        {
          id: "structure-home",
          text: "Home page hero must include a power headline (benefit-focused) and one high-contrast primary CTA.",
          confidence: "medium",
          priority: 100,
          required: true,
          section: "structure",
        },
        {
          id: "structure-services",
          text: "Services page: benefit-first service cards with scoped CTAs.",
          confidence: "medium",
          priority: 94,
          section: "structure",
        },
        {
          id: "structure-about",
          text: "About page: credibility narrative, team trust markers, and why-choose-us section.",
          confidence: "medium",
          priority: 90,
          section: "structure",
        },
        {
          id: "structure-reviews",
          text: "Reviews/Proof page: testimonial cards with measurable outcomes.",
          confidence: "medium",
          priority: 89,
          section: "structure",
        },
        {
          id: "structure-gap",
          text: "Gap section: if social proof or service cards are weak/missing, synthesize best-practice demo versions.",
          confidence: "medium",
          priority: 96,
          required: true,
          section: "structure",
        },
        {
          id: "structure-contact",
          text: "Contact page: primary conversion form plus friction-reducing support details.",
          confidence: "medium",
          priority: 95,
          section: "structure",
        },
      ],
    },
    {
      title: "Content sanitization block",
      lines: [
        {
          id: "sanitize-remove",
          text: "Remove any references to COVID-19, outdated emergency notices, privacy-policy/legal footer copy.",
          confidence: "medium",
          priority: 99,
          required: true,
          section: "sanitize",
        },
        {
          id: "sanitize-headline-rewrite",
          text: 'Replace weak headline artifacts like "info@email.com" or "Hours" with benefit-driven headline copy.',
          confidence: "medium",
          priority: 98,
          required: true,
          section: "sanitize",
        },
      ],
    },
    {
      title: "Real extracted messaging and proof block",
      lines:
        [
          ...(brief?.valueProposition
            ? [
                {
                  id: "messaging-owner-value-prop",
                  text: `Owner-provided value proposition: "${brief.valueProposition}"`,
                  confidence: "high" as const,
                  priority: 97,
                  section: "messaging",
                },
              ]
            : []),
          ...(valueProps.length > 0
            ? valueProps
                .map((row, index) => ({
                  id: `messaging-value-prop-${index}-${row.sourceUrl}`,
                  text: `Value proposition: "${row.text}" (source: ${row.sourceUrl})`,
                  confidence: "high" as const,
                  priority: 92 - index,
                  section: "messaging",
                }))
            : [
                {
                  id: "messaging-value-prop-fallback",
                  text: "Add a concrete value proposition focused on outcomes, speed, and trust.",
                  confidence: "placeholder" as const,
                  priority: 74,
                  section: "messaging",
                },
              ]),
          ...(brief?.clientTestimonial
            ? [
                {
                  id: "messaging-owner-testimonial",
                  text: `Owner-provided testimonial: "${brief.clientTestimonial}"`,
                  confidence: "high" as const,
                  priority: 91,
                  section: "messaging",
                },
              ]
            : []),
          ...(reviews.length > 0
            ? reviews
                .map((row, index) => ({
                  id: `messaging-review-${index}-${row.sourceUrl}`,
                  text: `Review proof: "${row.text}" (source: ${row.sourceUrl})`,
                  confidence: "high" as const,
                  priority: 90 - index,
                  section: "messaging",
                }))
            : [
                {
                  id: "messaging-review-fallback",
                  text: "Add one 1-2 sentence customer quote with first name and city.",
                  confidence: "placeholder" as const,
                  priority: 73,
                  section: "messaging",
                },
              ]),
          ...(services.length > 0
            ? services.map((row, index) => ({
                id: `messaging-service-${index}`,
                text: `Service focus: ${row}`,
                confidence: "high" as const,
                priority: 84 - index,
                section: "messaging",
              }))
            : [
                {
                  id: "messaging-service-fallback",
                  text: "Define 4-6 core service cards with action-oriented names.",
                  confidence: "placeholder" as const,
                  priority: 72,
                  section: "messaging",
                },
              ]),
          ...(trustSignals.length > 0
            ? trustSignals.map((row, index) => ({
                id: `messaging-trust-${index}`,
                text: `Trust signal: ${row}`,
                confidence: "high" as const,
                priority: 82 - index,
                section: "messaging",
              }))
            : [
                {
                  id: "messaging-trust-fallback",
                  text: "Add trust badges, guarantees, certifications, and authority markers.",
                  confidence: "placeholder" as const,
                  priority: 70,
                  section: "messaging",
                },
              ]),
          ...(ctas.length > 0
            ? ctas.map((row, index) => ({
                id: `messaging-cta-${index}`,
                text: `Existing CTA to reuse or improve: ${row}`,
                confidence: "high" as const,
                priority: 95 - index,
                section: "messaging",
              }))
            : [
                {
                  id: "messaging-cta-fallback",
                  text: 'Add one primary CTA and one secondary CTA ("Call now", "Book now", "Request consultation").',
                  confidence: "placeholder" as const,
                  priority: 89,
                  required: true,
                  section: "messaging",
                },
              ]),
          ...(contactPoints.length > 0
            ? contactPoints.map((row, index) => ({
                id: `messaging-contact-${index}`,
                text: `Contact/NAP detail found: ${row}`,
                confidence: "high" as const,
                priority: 87 - index,
                section: "messaging",
              }))
            : [
                {
                  id: "messaging-contact-fallback",
                  text: "Add NAP details in footer and contact page for local consistency.",
                  confidence: "placeholder" as const,
                  priority: 86,
                  required: true,
                  section: "messaging",
                },
              ]),
          ...(serviceAreas.length > 0
            ? [
                {
                  id: "messaging-service-areas",
                  text: `Service area mentions to include naturally: ${serviceAreas.join(", ")}.`,
                  confidence: "high" as const,
                  priority: 88,
                  required: true,
                  section: "messaging",
                },
              ]
            : [
                {
                  id: "messaging-service-areas-fallback",
                  text: "Add a service area section with city and nearby communities.",
                  confidence: "placeholder" as const,
                  priority: 87,
                  required: true,
                  section: "messaging",
                },
              ]),
          ...(reasonsToChoose.length > 0
            ? reasonsToChoose.map((row, index) => ({
                id: `messaging-reason-${index}`,
                text: `Why choose us angle: ${row}`,
                confidence: "medium" as const,
                priority: 79 - index,
                section: "messaging",
              }))
            : [
                {
                  id: "messaging-reason-fallback",
                  text: "Build a clear Why Choose Us narrative with concrete differentiators.",
                  confidence: "placeholder" as const,
                  priority: 69,
                  section: "messaging",
                },
              ]),
        ],
    },
    {
      title: "Competitor gap block",
      lines:
        competitorGaps.length > 0
          ? rankTextRows(competitorGaps, SECTION_LIMITS.competitorGaps).map((gap, index) => ({
              id: `competitor-gap-${index}`,
              text: buildActionFromGap(gap),
              confidence: "medium" as const,
              priority: 80 - index,
              section: "competitor",
            }))
          : [
              {
                id: "competitor-gap-fallback",
                text: "Build action: add one FAQ section and one trust/proof section to differentiate from competitors.",
                confidence: "placeholder" as const,
                priority: 66,
                section: "competitor",
              },
            ],
    },
    {
      title: "Required constraints checklist",
      lines: [
        {
          id: "constraints-title",
          text: "These items are required in the generated website.",
          confidence: "medium",
          priority: 100,
          required: true,
          section: "constraints",
        },
        {
          id: "constraints-service-area",
          text: "Include service-area mentions in homepage and contact-page copy.",
          confidence: "medium",
          priority: 100,
          required: true,
          section: "constraints",
        },
        {
          id: "constraints-seo-h1-h2",
          text: `Naturally weave target keyword and city into H1/H2 tags (keyword: ${brief?.targetKeyword ?? "not provided"}, city: ${cityHint}).`,
          confidence: "medium",
          priority: 100,
          required: true,
          section: "constraints",
        },
        {
          id: "constraints-nap",
          text: "Maintain NAP consistency everywhere (footer, contact page, form microcopy).",
          confidence: "medium",
          priority: 100,
          required: true,
          section: "constraints",
        },
        {
          id: "constraints-schema",
          text: "Include LocalBusiness schema placeholders in footer and contact page.",
          confidence: "medium",
          priority: 100,
          required: true,
          section: "constraints",
        },
        {
          id: "constraints-alt",
          text: "Every image needs descriptive alt text with local context where relevant.",
          confidence: "medium",
          priority: 100,
          required: true,
          section: "constraints",
        },
        {
          id: "constraints-mobile",
          text: "Use mobile-first Smart Grid responsiveness with high-contrast controls.",
          confidence: "medium",
          priority: 100,
          required: true,
          section: "constraints",
        },
      ],
    },
    {
      title: "Placeholder fallback block",
      lines: [
        {
          id: "fallback-facts-only",
          text: "Use extracted facts first; do not fabricate specific claims not present in inputs.",
          confidence: "medium",
          priority: 98,
          required: true,
          section: "fallback",
        },
        {
          id: "fallback-placeholders",
          text: "If evidence is missing, keep [PLACEHOLDER] labels so sales can swap in client details quickly.",
          confidence: "medium",
          priority: 68,
          section: "fallback",
        },
        {
          id: "fallback-missing",
          text: `Missing extracted sections: ${missing.size > 0 ? [...missing].join(", ") : "none"}.`,
          confidence: missing.size > 0 ? "placeholder" : "high",
          priority: 85,
          required: true,
          section: "fallback",
        },
      ],
    },
    {
      title: "Demo handoff block",
      lines: [
        {
          id: "handoff-launch-ready",
          text: "Output should feel launch-ready for a live sales walkthrough.",
          confidence: "medium",
          priority: 96,
          required: true,
          section: "handoff",
        },
        {
          id: "handoff-conversion",
          text: "Show copy and hierarchy that demonstrates conversion intent immediately.",
          confidence: "medium",
          priority: 93,
          section: "handoff",
        },
        {
          id: "handoff-polished",
          text: "Provide a polished, visually compelling concept suitable for proposal presentation.",
          confidence: "medium",
          priority: 92,
          section: "handoff",
        },
      ],
    },
  ];
  const budgetedBlocks = rawPromptBlocks.map((block) => ({
    title: block.title,
    lines: applyPromptBudget(block.lines),
  }));

  const promptLines: string[] = [
    "HOSTINGER HORIZONS MASTER PROMPT",
    "",
    "You are an elite website designer and conversion-focused UX strategist.",
    "Create a high-impact sales-demo website concept for this business in Hostinger Horizons.",
    "",
    "Project context:",
    `- [high] Business name: ${input.prospectName}`,
    `- [high] Existing website: ${input.prospectUrl}`,
    `- [high] Existing logo URL: ${input.logoUrl?.trim() ? input.logoUrl.trim() : "Use logo from existing website assets."}`,
    `- [high] Industry detected: ${industry}`,
    `- [${monochromeLogo ? "medium" : "high"}] Logo mode: ${monochromeLogo ? "monochrome fallback palette required" : "colored logo palette extracted"}`,
    `- [high] Crawled source URLs: ${extract?.sourceUrls?.length ?? 0}`,
    `- [high] Crawl mode: ${brief?.crawlMode ?? "all_pages"} (max pages ${brief?.maxPages ?? 50})`,
    `- [${brief?.targetKeyword?.trim() ? "high" : "placeholder"}] Target keyword: ${brief?.targetKeyword?.trim() ? brief.targetKeyword.trim() : "Not provided"}`,
    "",
    "Business objectives:",
    "- [medium] Build trust immediately for first-time visitors.",
    "- [medium] Drive demo-ready conversion flow with clear CTAs and persuasive proof.",
    "- [medium] Keep the concept visually modern while honoring brand direction.",
    "",
    "Prompt blocks:",
    ...budgetedBlocks.flatMap((block) => [
      `${block.title}:`,
      ...block.lines.map(asTaggedLine),
      "",
    ]),
    "Deliverable format in Horizons:",
    "- [medium] Deliver a polished high-fidelity concept that can be shared live in a sales demo.",
    "- [medium] Include realistic, rewritten copy based on extracted site messaging and proof.",
    "- [medium] Keep copy concise, action-focused, and easy for sales to customize quickly.",
    "- [medium] Ensure responsive Smart Grid layout with accessible contrast and descriptive alt text.",
  ];
  return applyPromptBudget(
    promptLines.map((text, index) => ({
      id: `final-${index}`,
      text,
      confidence: "medium",
      priority: text.endsWith(":") || text === "" ? 120 : 80,
      required:
        text === "HOSTINGER HORIZONS MASTER PROMPT" ||
        text === "You are an elite website designer and conversion-focused UX strategist." ||
        text === "Create a high-impact sales-demo website concept for this business in Hostinger Horizons." ||
        text === "Project context:" ||
        text === "Prompt blocks:" ||
        text === "Deliverable format in Horizons:" ||
        text.includes("Target keyword:") ||
        text.includes("Existing website:"),
      section: "final",
    })),
  )
    .map((row) => row.text)
    .join("\n");
}
