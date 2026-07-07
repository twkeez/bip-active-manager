// Built-in Services & Tiers reference content, grounded in the service playbook.
// These are SCOPE comparisons ("what you get" at Foundation / Premium / Premium
// Plus) — the actual work per service. Strategist access, calls, reporting, and
// response times live in the Partnership layer (see the Partnership & Boundaries
// page), not here, so we don't double-count them across services.
//
// Prices are intentionally omitted for now — pricing is still being finalized.

export type TierColumn = { key: string; label: string; price?: string };

export type TierRow = {
  label: string;
  /** Optional callout, e.g. "Primary tier differentiator". */
  note?: string;
  /** One bullet list per tier column, in the same order as `tiers`. */
  cells: string[][];
};

export type ServiceTierTable = {
  key: string;
  label: string;
  summary: string;
  tiers: TierColumn[];
  rows: TierRow[];
};

const FPP: TierColumn[] = [
  { key: "foundation", label: "Foundation" },
  { key: "premium", label: "Premium" },
  { key: "premium_plus", label: "Premium Plus" },
];

export const SERVICE_TIER_TABLES: ServiceTierTable[] = [
  {
    key: "seo",
    label: "SEO",
    summary:
      "Search Engine Optimization. Foundation sets up and maintains the essentials; Premium actively optimizes and tracks competitors; Premium Plus expands into content, specialty pages, regional reach, and answer-engine optimization.",
    tiers: FPP,
    rows: [
      {
        label: "Technical Setup",
        cells: [
          ["GSC, GA4 & GTM connected", "Google Business Profile claimed + optimized", "XML sitemap submitted", "Title tag & meta optimization"],
          ["+ Keyword tracking configured", "+ Competitor tracking", "+ Custom reporting dashboard"],
          ["+ Regional keyword tracking", "+ llms.txt / AEO deployed", "+ Specialty landing-page opportunities mapped"],
        ],
      },
      {
        label: "Site Audit",
        cells: [
          ["Semi-annually"],
          ["Quarterly"],
          ["Quarterly"],
        ],
      },
      {
        label: "Monthly Optimization",
        cells: [
          ["Keyword & meta-tag maintenance", "Sitemap health monitoring", "GBP accuracy review"],
          ["+ Monthly on-page optimization", "+ Monthly keyword review", "+ Competitor position check", "+ Monthly GBP posts"],
          ["+ Specialty landing-page optimization", "+ Regional keyword expansion checks"],
        ],
      },
      {
        label: "Content & Reach",
        note: "Primary Premium Plus differentiator",
        cells: [
          ["Local foundation (NAP consistency)"],
          ["Local high-intent keyword targeting"],
          ["Monthly SEO blog", "Dual-radius (local + regional) strategy", "Answer-engine optimization (AEO)"],
        ],
      },
    ],
  },
  {
    key: "ppc",
    label: "PPC — Paid Ads (Google &/or Social)",
    summary:
      "One paid-ads service covering Google and/or social. The tier sets the effort and scope — the client can run Google, social, or both within it. Management fee only; ad spend is billed directly by the client to the platform.",
    tiers: FPP,
    rows: [
      {
        label: "Channels",
        note: "Primary tier differentiator",
        cells: [
          ["1 channel — Google Search or one social platform"],
          ["Up to 2–3 platforms — e.g. Google + Meta"],
          ["Full multi-platform — Google (Search + Shopping/Display + Performance Max) + up to 3 social"],
        ],
      },
      {
        label: "Service Type",
        cells: [
          ["Setup + basic ongoing management", "Single campaign"],
          ["Full ongoing management", "Multiple campaign types"],
          ["Full ongoing management", "Multi-campaign + multi-location/service"],
        ],
      },
      {
        label: "Account Setup",
        cells: [
          ["Account audit or new build", "Conversion / pixel tracking", "1 campaign structure/objective"],
          ["+ Expanded campaign types"],
          ["+ Full-funnel build (Performance Max + social)"],
        ],
      },
      {
        label: "Scope & Research",
        cells: [
          ["Basic keyword research / interest targeting", "1 market", "Up to 2 ad sets/mo"],
          ["Expanded research + negative keywords", "Custom / lookalike audiences", "Up to 1 market/service line", "Up to 5 ad sets/mo"],
          ["Up to 3 markets/service lines", "Up to 10 ad sets/mo"],
        ],
      },
      {
        label: "Optimization & Testing",
        cells: [
          ["Bid adjustments as needed", "No structured A/B testing"],
          ["Bid & budget optimization", "Ad copy + creative A/B testing"],
          ["+ Audience A/B testing", "Landing-page recommendations", "Remarketing"],
        ],
      },
      {
        label: "Ad Spend",
        cells: [
          ["Billed directly by client to the platform; excluded from the management fee at every tier"],
          ["Billed directly by client to the platform"],
          ["Billed directly by client to the platform"],
        ],
      },
    ],
  },
  {
    key: "social",
    label: "Social Media (Organic)",
    summary:
      "Organic social management. Foundation keeps an on-brand presence with content you post; Premium runs a second platform with scheduled content and calendars; Premium Plus runs your whole presence including short-form video, and engages your community for you.",
    tiers: FPP,
    rows: [
      {
        label: "Platforms",
        cells: [
          ["Facebook + Instagram + Google Business Profile", "Consistent social branding"],
          ["+ 1 additional platform (repurposed content)"],
          ["Up to 3 platforms, including a short-form video channel (TikTok / Reels / Shorts)"],
        ],
      },
      {
        label: "Content",
        note: "Primary tier differentiator",
        cells: [
          ["5 posts/month (client posts them)"],
          ["10 posts/month (we create + schedule)", "Custom branded graphics", "Monthly content calendar", "Blog cross-posting"],
          ["~16 posts/month + short-form video / Reels + Stories", "Campaign series"],
        ],
      },
      {
        label: "Community",
        cells: [
          ["Engagement monitoring"],
          ["Engagement monitoring + content approval workflow"],
          ["Proactive community management — we engage & respond on your behalf"],
        ],
      },
      {
        label: "Strategy",
        cells: [
          ["On-brand presence"],
          ["Content calendar + next-month preview"],
          ["Seasonal campaign themes + quarterly social strategy"],
        ],
      },
    ],
  },
];

export function getServiceTierTable(key: string): ServiceTierTable | undefined {
  return SERVICE_TIER_TABLES.find((t) => t.key === key);
}
