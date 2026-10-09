import { CONVERSION_TYPES } from "@/lib/onboarding/client-wording";
import { PRACTICE_TYPES } from "@/lib/onboarding/practice-type";

// The practice facts research and the plan document now use (migration
// 20261009120000), checked before they're saved from the client page.

export const WEBSITE_STAGES = ["not_started", "building", "splash_live", "launched"] as const;
export type WebsiteStage = (typeof WEBSITE_STAGES)[number];

export const WEBSITE_STAGE_LABEL: Record<WebsiteStage, string> = {
  not_started: "Not started",
  building: "Being built",
  splash_live: "Splash page live",
  launched: "Full site launched",
};

/**
 * Where the website is. Clients set before the stages existed fall back to the
 * old switch: "awaiting launch" reads as being built, otherwise launched (what
 * the page showed before).
 */
export function websiteStageOf(client: { website_stage?: string | null; awaiting_website_launch?: boolean | null }): WebsiteStage {
  const stage = client.website_stage;
  if (stage && (WEBSITE_STAGES as readonly string[]).includes(stage)) return stage as WebsiteStage;
  return client.awaiting_website_launch ? "building" : "launched";
}

type Patch = Record<string, string | string[] | boolean | null>;

/**
 * The profile fields in a PATCH body, validated. Returns the columns to write,
 * or an error naming the bad value. Fields not in the body are left alone; an
 * empty value clears the field.
 */
export function profilePatch(body: Record<string, unknown>): { patch: Patch } | { error: string } {
  const patch: Patch = {};
  const has = (key: string) => Object.prototype.hasOwnProperty.call(body, key);
  const text = (value: unknown) => (typeof value === "string" ? value.trim() || null : null);

  if (has("practice_type")) {
    const value = text(body.practice_type);
    if (value && !(PRACTICE_TYPES as readonly string[]).includes(value)) return { error: `Unknown practice type "${value}".` };
    patch.practice_type = value;
  }
  if (has("website_stage")) {
    const value = text(body.website_stage);
    if (value && !(WEBSITE_STAGES as readonly string[]).includes(value)) return { error: `Unknown website stage "${value}".` };
    patch.website_stage = value;
    // Keep the old switch in step: the Clients page's "Pending launch" reads it.
    if (value) patch.awaiting_website_launch = value !== "launched";
  }
  if (has("ad_budget_monthly")) {
    const value = text(body.ad_budget_monthly);
    if (value && value.length > 60) return { error: "Keep the ad budget short, e.g. \"$400–$700\"." };
    patch.ad_budget_monthly = value;
  }
  if (has("practice_opening_date")) {
    const value = text(body.practice_opening_date);
    if (value && !/^\d{4}-\d{2}-\d{2}$/.test(value)) return { error: "The opening date must be a date." };
    patch.practice_opening_date = value;
  }
  if (has("conversion_types")) {
    const value = body.conversion_types;
    if (value !== null && !Array.isArray(value)) return { error: "Conversion types must be a list." };
    const list = (value ?? []) as unknown[];
    const bad = list.filter((item) => !(CONVERSION_TYPES as readonly string[]).includes(String(item)));
    if (bad.length) return { error: `Unknown conversion type: ${bad.join(", ")}.` };
    patch.conversion_types = list.length ? CONVERSION_TYPES.filter((type) => list.includes(type)) : null;
  }
  return { patch };
}
