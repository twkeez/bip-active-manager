// Deterministic email grouping. Maps a sender to a category so noisy automated
// senders can be collapsed into digests, while real people stay in "people"
// (never auto-grouped/summarized). Tweak DOMAIN_RULES as new senders show up.

export type EmailCategory =
  | "google_ads"
  | "basecamp"
  | "reviews"
  | "social"
  | "tools"
  | "promotions"
  | "people";

export const CATEGORY_LABELS: Record<EmailCategory, string> = {
  google_ads: "Google Ads & Payments",
  basecamp: "Basecamp / Projects",
  reviews: "Reviews & Listings",
  social: "Social & Community",
  tools: "Tools & Integrations",
  promotions: "Promotions & Newsletters",
  people: "People",
};

// Categories worth collapsing into a digest (everything except real people).
export const BULK_CATEGORIES: EmailCategory[] = [
  "google_ads",
  "basecamp",
  "reviews",
  "social",
  "tools",
  "promotions",
];

// Matched by exact domain or a ".suffix" match (so subdomains like
// ss.email.nextdoor.com still match nextdoor.com).
const DOMAIN_RULES: Array<[string, EmailCategory]> = [
  ["basecamp.com", "basecamp"],
  ["nextdoor.com", "social"],
  ["linkedin.com", "social"],
  ["yelp.com", "reviews"],
  ["reviewability.com", "reviews"],
  ["gainapp.com", "reviews"],
  ["promoboxx.com", "reviews"],
  ["trellobutler.com", "tools"],
  ["zapier.com", "tools"],
  ["pro-sitemaps.com", "tools"],
  ["zoom.us", "tools"],
  ["docs.google.com", "tools"],
  ["phreesia-mail.com", "tools"],
  ["aldi.us", "promotions"],
  ["dailygolfsteals.com", "promotions"],
  ["simonandschuster.com", "promotions"],
  ["coinbase.com", "promotions"],
  ["thegrint.com", "promotions"],
  ["ocasiocortez.com", "promotions"],
];

export function categorizeEmail(input: {
  fromEmail?: string | null;
  fromName?: string | null;
  subject?: string | null;
}): EmailCategory {
  const email = (input.fromEmail ?? "").toLowerCase().trim();
  const domain = email.split("@")[1] ?? "";
  if (!domain) return "people";
  // google.com covers Google Ads + Google Payments; Docs lives on docs.google.com.
  if (domain === "google.com") return "google_ads";
  for (const [suffix, category] of DOMAIN_RULES) {
    if (domain === suffix || domain.endsWith(`.${suffix}`)) return category;
  }
  return "people";
}
