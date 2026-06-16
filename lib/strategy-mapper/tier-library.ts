import type { SupabaseClient } from "@supabase/supabase-js";
import type { DualRadiusResult, StrategyMapperFormData, StrategyMapperService } from "@/types/strategy-mapper";

export interface ServiceTierTemplate {
  id?: number;
  tierKey: string;
  service: StrategyMapperService;
  tierLabel: string;
  tierRank: number;
  title: string;
  objective: string;
  tactics: string[];
  matchAliases: string[];
  enabled: boolean;
}

export interface TierPlaceholderContext {
  form: StrategyMapperFormData;
  radius: DualRadiusResult;
}

type DbTierRow = {
  id: number;
  tier_key: string;
  service: StrategyMapperService;
  tier_label: string;
  tier_rank: number;
  title: string;
  objective: string;
  tactics: string[];
  match_aliases: string[];
  enabled: boolean;
};

function rowToTemplate(row: DbTierRow): ServiceTierTemplate {
  return {
    id: row.id,
    tierKey: row.tier_key,
    service: row.service,
    tierLabel: row.tier_label,
    tierRank: row.tier_rank,
    title: row.title,
    objective: row.objective,
    tactics: Array.isArray(row.tactics) ? row.tactics : [],
    matchAliases: row.match_aliases ?? [],
    enabled: row.enabled,
  };
}

export const DEFAULT_TIER_FALLBACKS: ServiceTierTemplate[] = [
  {
    tierKey: "seo-foundation",
    service: "seo",
    tierLabel: "SEO Foundation",
    tierRank: 1,
    title: "Search Engine Optimization (SEO) — Foundation",
    objective:
      "Establish baseline digital visibility and search engine compliance for [Practice Name] to ensure local pet parents can accurately find your location, hours, and primary contact details on the web.",
    tactics: [
      "Core Listing Verification: Claim, verify, and lock down the primary Google Business Profile (GBP) for [Practice Name] to prevent unauthorized edits and establish accurate NAP (Name, Address, Phone) tracking data.",
      "Essential Citation Alignment: Build out and sync baseline directory listings across foundational search ecosystems (Yelp, Apple Maps, Bing Places) to create uniform local search trust signals.",
      "Technical Health Pass: Configure essential Google Search Console and tracking profiles to monitor core site indexing and prevent structural web crawl errors.",
    ],
    matchAliases: ["SEO Local", "SEO Foundation", "Local SEO", "Foundation SEO"],
    enabled: true,
  },
  {
    tierKey: "seo-premium",
    service: "seo",
    tierLabel: "SEO Premium",
    tierRank: 2,
    title: "Search Engine Optimization (SEO) — Premium",
    objective:
      "Drive high-intent local organic traffic to [Practice Name] by actively optimizing for everyday wellness and urgent care keywords within your tight [Local Core Radius] territory, outranking immediate neighborhood rivals.",
    tactics: [
      "On-Page Keyword Mapping: Optimize all core website pages with geo-targeted title tags, header hierarchies, and meta descriptions specifically mapped to [Practice Type] keywords.",
      "Local Intent Content Engine: Deploy a monthly custom blog schedule tailored to seasonal veterinary health concerns and local trends unique to [Practice Location] to steadily scale your site's organic search footprint.",
      "GBP Engagement Protocol: Maximize local map pack visibility by implementing active photo updates, attribute tuning, and localized post publishing directly within your Google Business Profile.",
    ],
    matchAliases: ["SEO Premium", "Premium SEO", "SEO Local Premium"],
    enabled: true,
  },
  {
    tierKey: "seo-premium-plus",
    service: "seo",
    tierLabel: "SEO Premium Plus",
    tierRank: 3,
    title: "Search Engine Optimization (SEO) — Premium Plus",
    objective:
      "Establish absolute market dominance across both your [Local Core Radius] for wellness care and an aggressive [Regional Radius] for high-ticket specialized services, capturing long-distance and referral-ready veterinary prospects before they choose corporate alternatives.",
    tactics: [
      "Specialized Landing Page Ecosystem: Architect custom, hyper-optimized service landing pages engineered to rank for regional clinical keywords (e.g., advanced surgeries, diagnostics, specific therapies), capturing high-margin cases outside your immediate neighborhood.",
      "Topical Authority Content Strategy: Produce authoritative, deeply educational clinical articles that address complex patient conditions, exploiting content gaps left open by massive regional referral hospitals.",
      "AI Search & Answer Engine Optimization (AEO) Deployment: Build and embed token-optimized llms.txt and llms-full.txt files into the root directory of the new website. This architecture strips away script and code clutter, formatting [Practice Name]'s core identifiers, specialized clinical capabilities, and credentials into a clean, machine-readable format. This ensures that modern AI search engines and LLM web crawlers (such as ChatGPT, Claude, Perplexity, and Apple Intelligence) can instantly index and accurately cite the practice as the premier recommendation for local and regional pet parents.",
    ],
    matchAliases: ["SEO Premium Plus", "Premium Plus SEO", "SEO Premium+"],
    enabled: true,
  },
  {
    tierKey: "ppc-premium",
    service: "ppc",
    tierLabel: "Ads Premium",
    tierRank: 1,
    title: "Pay-Per-Click Advertising (PPC) — Premium",
    objective:
      "Capture immediate, bottom-of-funnel consumer intent within your local market, utilizing targeted paid search campaigns to fill open appointments and drive high-priority patient appointments directly to [Practice Name].",
    tactics: [
      'Search Campaign Architecture: Build out structured Google Ads campaigns focused on high-intent terms like "veterinarian near me" and "urgent vet care [City]," isolating local ad spend to maximize conversion.',
      "Negative Keyword Defense: Implement rigid negative keyword lists to actively filter out irrelevant clicks, job seekers, and low-value searches, driving down your cost-per-acquisition.",
      "Conversion Asset Deployment: Direct paid traffic to highly targeted, fast-loading landing pages designed with single-action call extensions and form fillouts to maximize new client conversion rates.",
    ],
    matchAliases: ["Google Ads", "PPC Premium", "Ads Premium", "Pay-Per-Click", "PPC"],
    enabled: true,
  },
  {
    tierKey: "ppc-premium-plus",
    service: "ppc",
    tierLabel: "Ads Premium Plus",
    tierRank: 2,
    title: "Pay-Per-Click Advertising (PPC) — Premium Plus",
    objective:
      "Deploy an aggressive, multi-layered paid search and social advertising engine to capture high-ticket specialty procedures regionally while protecting and scaling your local wellness acquisition footprint.",
    tactics: [
      "Dual-Radius Paid Segmentation: Segment budgets into distinct localized campaigns for day-to-day care and expansive regional campaigns optimized specifically to capture high-margin clinical caseloads from up to 50 miles away.",
      "Multi-Channel Social Integration: Layer in paid Meta (Facebook/Instagram) advertising assets to build top-of-mind brand awareness among pet-owning households, combining search intent with visual social audience targeting.",
      "A/B Performance Testing & Conversion Tracking: Utilize robust call-tracking analytics and continuous ad copy testing to isolate the highest-converting variants, scaling performance dynamically across your target geographic grid.",
    ],
    matchAliases: ["Ads Premium Plus", "PPC Premium Plus", "Google Ads Premium Plus"],
    enabled: true,
  },
  {
    tierKey: "social-standard",
    service: "social",
    tierLabel: "Social Media Standard",
    tierRank: 1,
    title: "Social Media Marketing — Standard",
    objective:
      "Maintain a professional, brand-accurate digital footprint across core social networks to ensure existing and prospective clients see an active, accessible veterinary practice.",
    tactics: [
      "Branded Profile Optimization: Set up and visually align your Facebook and Instagram profiles with uniform imagery, contact rules, and brand voice syncs.",
      "Evergreen Content Cadence: Execute a consistent monthly social media calendar focusing on essential pet wellness tips, holiday care hazards, and foundational clinic operational alerts.",
    ],
    matchAliases: ["Social Media", "Social Media Standard", "SMM Standard", "SMM"],
    enabled: true,
  },
  {
    tierKey: "social-premium",
    service: "social",
    tierLabel: "Social Media Premium",
    tierRank: 2,
    title: "Social Media Marketing — Premium",
    objective:
      "Humanize [Practice Name] and build an interactive local pet-community network that actively drives brand loyalty, positive word-of-mouth referrals, and emotional trust before a client ever steps foot in your lobby.",
    tactics: [
      "Clinical Outcome Storytelling: Design a structured system to capture and publish inspiring patient success transformations and clinical outcomes (such as before-and-after orthopedic recovery milestones or video-based healing case profiles), visibly proving your specialized care capabilities to a warm audience.",
      "Behind-The-Scenes Culture Spotlights: Produce authentic team features and medical park updates to showcase the human element of [Practice Name], lowering client barrier-to-trust for complex veterinary stays.",
      "Localized Growth & Engagement Mapping: Actively manage, monitor, and interact with community discussions, review comments, and platform messages to turn digital casual followers into lifelong, active clinic advocates.",
    ],
    matchAliases: ["Social Media Premium", "SMM Premium", "Social Premium"],
    enabled: true,
  },
  {
    tierKey: "orm-foundation",
    service: "orm",
    tierLabel: "ORM Foundation",
    tierRank: 1,
    title: "Online Reputation Management (ORM) — Foundation",
    objective:
      "Establish baseline public review velocity for [Practice Name] by pivoting review generation momentum away from closed-loop platforms (like Demandforce) that keep client feedback internal and invisible, directing satisfied pet parents to your public Google Business Profile across [Practice Location].",
    tactics: [
      "Closed-Loop Platform Transition: Pivot review generation momentum entirely away from closed-loop platforms (like Demandforce) that keep client feedback internal and invisible.",
      "Public GBP Review Workflow: Implement a structured post-visit review request workflow via automated SMS/Email triggers directing satisfied pet parents straight to your public Google Business Profile to aggressively build review velocity and close local star gaps.",
    ],
    matchAliases: ["ORM Foundation", "ORM Local", "Reputation Management Foundation"],
    enabled: true,
  },
  {
    tierKey: "orm-premium",
    service: "orm",
    tierLabel: "ORM Premium",
    tierRank: 2,
    title: "Online Reputation Management (ORM) — Premium",
    objective:
      "Accelerate public review velocity and competitive reputation positioning for [Practice Name] across your [Local Core Radius], closing the gap against neighborhood rivals with sustained GBP review generation.",
    tactics: [
      "Review Velocity Acceleration: Deploy staff-accountable review generation protocols with weekly velocity targets tied to post-visit SMS/Email triggers.",
      "Competitive Reputation Gap Analysis: Monitor local star and review-count gaps against verified competitors and prioritize response management on high-visibility GBP feedback.",
    ],
    matchAliases: [
      "ORM Premium",
      "ORM Premium Plus",
      "Reputation Management Premium",
      "Review Management Premium",
    ],
    enabled: true,
  },
];

export function sortTiers(tiers: ServiceTierTemplate[]): ServiceTierTemplate[] {
  const serviceOrder: StrategyMapperService[] = ["seo", "ppc", "orm", "social"];
  return [...tiers].sort((a, b) => {
    const serviceDiff =
      serviceOrder.indexOf(a.service) - serviceOrder.indexOf(b.service);
    if (serviceDiff !== 0) return serviceDiff;
    return a.tierRank - b.tierRank;
  });
}

export function getTiersForService(
  tiers: ServiceTierTemplate[],
  service: StrategyMapperService,
): ServiceTierTemplate[] {
  return sortTiers(tiers.filter((t) => t.service === service && t.enabled));
}

export function getTierByKey(
  tiers: ServiceTierTemplate[],
  tierKey: string,
): ServiceTierTemplate | undefined {
  return tiers.find((t) => t.tierKey === tierKey);
}

export async function fetchServiceTiers(
  supabase: SupabaseClient,
): Promise<ServiceTierTemplate[]> {
  const { data, error } = await supabase
    .from("strategy_mapper_service_tiers")
    .select("*")
    .order("service")
    .order("tier_rank");

  if (error || !data?.length) {
    return sortTiers(DEFAULT_TIER_FALLBACKS);
  }

  return sortTiers(data.map((row) => rowToTemplate(row as DbTierRow)));
}

export function templateToDbRow(tier: ServiceTierTemplate): Omit<DbTierRow, "id"> {
  return {
    tier_key: tier.tierKey,
    service: tier.service,
    tier_label: tier.tierLabel,
    tier_rank: tier.tierRank,
    title: tier.title,
    objective: tier.objective,
    tactics: tier.tactics,
    match_aliases: tier.matchAliases,
    enabled: tier.enabled,
  };
}
