// Built-in Services & Tiers reference content, transcribed from Tom's tier
// breakdown docs. Rendered as Foundation / Premium / Premium Plus comparison
// tables on the Services & Tiers page. Add more services (SEO, SMM, Blog, ORM)
// here over time — the renderer is generic.

export type TierColumn = { key: string; label: string; price: string };

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

const PPC_TIERS: TierColumn[] = [
  { key: "foundation", label: "Foundation", price: "$499 / mo" },
  { key: "premium", label: "Premium", price: "$899 / mo" },
  { key: "premium_plus", label: "Premium Plus", price: "$1,499 / mo" },
];

const SOCIAL_TIERS: TierColumn[] = [
  { key: "foundation", label: "Foundation", price: "$399 / mo" },
  { key: "premium", label: "Premium", price: "$799 / mo" },
  { key: "premium_plus", label: "Premium Plus", price: "$1,299 / mo" },
];

export const SERVICE_TIER_TABLES: ServiceTierTable[] = [
  {
    key: "google-ads",
    label: "PPC — Google Ads",
    summary:
      "Management fee only — ad spend is billed directly by the client to Google. Mirrors the Foundation / Premium / Premium Plus logic used for SEO and Social Media: contact cadence, strategist access, and campaign/market scope scale together.",
    tiers: PPC_TIERS,
    rows: [
      {
        label: "Service Type",
        cells: [
          ["Setup + basic ongoing management", "Single campaign, one market"],
          ["Full ongoing management", "Multiple campaign types"],
          ["Full ongoing management", "Multi-campaign + multi-location/service"],
        ],
      },
      {
        label: "Account Setup / Audit",
        cells: [
          ["Account audit or new build", "Conversion tracking implementation", "1 campaign structure (Search)"],
          ["Account audit or new build", "Conversion tracking implementation", "Search + Shopping or Display"],
          ["Account audit or new build", "Conversion tracking implementation", "Search + Shopping/Display + Performance Max"],
        ],
      },
      {
        label: "Keyword & Campaign Scope",
        note: "Primary tier differentiator",
        cells: [
          ["Basic keyword research, 1 market"],
          ["Expanded keyword research + negative keyword management", "Up to 1 market / service line"],
          [
            "Expanded keyword research + negative keyword management",
            "Up to 3 markets / service lines",
            "Required if client runs multiple locations or distinct service lines",
          ],
        ],
      },
      {
        label: "Optimization & Testing",
        cells: [
          ["Bid adjustments as needed", "No structured A/B testing"],
          ["Bid & budget optimization", "Ad copy A/B testing"],
          [
            "Bid & budget optimization",
            "Ad copy A/B testing",
            "Landing page recommendations",
            "Audience research & remarketing setup",
          ],
        ],
      },
      {
        label: "Strategist Access",
        cells: [
          ["None", "Low-contact, automated approach"],
          ["Dedicated marketing strategist", "Quarterly meeting"],
          ["Dedicated marketing strategist", "Monthly meeting"],
        ],
      },
      {
        label: "Reporting & Communication",
        cells: [
          ["Monthly performance report", "No proactive strategy calls"],
          ["Monthly reporting from Analytics", "1 message with reporting/metrics", "1 quarterly meeting"],
          ["Monthly reporting from Analytics", "1 message with reporting/metrics", "1 monthly meeting"],
        ],
      },
      {
        label: "Ad Spend",
        cells: [
          ["Billed directly by client to Google", "Not included in the management fee at any tier"],
          ["Billed directly by client to Google"],
          ["Billed directly by client to Google"],
        ],
      },
    ],
  },
  {
    key: "social-ads",
    label: "PPC — Social Ads",
    summary:
      "Management fee only — ad spend is billed directly by the client to the platform. Sold as a separate line item from Google Ads. Platform count and ad-set volume replace keyword volume as the primary tier differentiator.",
    tiers: SOCIAL_TIERS,
    rows: [
      {
        label: "Service Type",
        cells: [
          ["Setup + basic ongoing management", "1 platform"],
          ["Full ongoing management", "Up to 2 platforms"],
          ["Full ongoing management", "Up to 3 platforms"],
        ],
      },
      {
        label: "Account Setup",
        cells: [
          ["Ad account audit or new build (Meta)", "Pixel / conversion tracking setup", "1 campaign objective"],
          ["Ad account audit or new build", "Pixel / conversion tracking setup", "Meta + 1 additional platform (TikTok, LinkedIn, etc.)"],
          ["Ad account audit or new build", "Pixel / conversion tracking setup", "Meta + 2 additional platforms"],
        ],
      },
      {
        label: "Creative & Audience Scope",
        note: "Primary tier differentiator",
        cells: [
          ["Up to 2 ad sets / month", "Client-provided creative used as-is", "Basic interest-based targeting"],
          ["Up to 5 ad sets / month", "Light creative direction on client assets", "Custom + lookalike audiences"],
          [
            "Up to 10 ad sets / month",
            "Creative direction + ad copy variations",
            "Custom + lookalike audiences",
            "Required if client runs multiple offers or locations",
          ],
        ],
      },
      {
        label: "Optimization & Testing",
        cells: [
          ["Bid/budget adjustments as needed", "No structured A/B testing"],
          ["Bid & budget optimization", "Creative A/B testing"],
          ["Bid & budget optimization", "Creative & audience A/B testing", "Landing page recommendations"],
        ],
      },
      {
        label: "Strategist Access",
        cells: [
          ["None", "Low-contact, automated approach"],
          ["Dedicated marketing strategist", "Quarterly meeting"],
          ["Dedicated marketing strategist", "Monthly meeting"],
        ],
      },
      {
        label: "Reporting & Communication",
        cells: [
          ["Monthly performance report", "No proactive strategy calls"],
          ["Monthly reporting from Ads Manager", "1 message with reporting/metrics", "1 quarterly meeting"],
          ["Monthly reporting from Ads Manager", "1 message with reporting/metrics", "1 monthly meeting"],
        ],
      },
      {
        label: "Ad Spend",
        cells: [
          ["Billed directly by client to platform", "Not included in the management fee at any tier"],
          ["Billed directly by client to platform"],
          ["Billed directly by client to platform"],
        ],
      },
    ],
  },
];

export function getServiceTierTable(key: string): ServiceTierTable | undefined {
  return SERVICE_TIER_TABLES.find((t) => t.key === key);
}
