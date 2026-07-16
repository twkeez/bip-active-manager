// Shape of a parsed BIP pipeline form, mapped to our onboarding model.
// Website is the "web track" (drives webStatus), separate from the marketing
// services (seo/ppc/smm/blog/orm). "Ads" on the form maps to ppc.

export const SERVICE_KEYS = ["seo", "ppc", "smm", "blog", "orm"] as const;
export type ServiceKey = (typeof SERVICE_KEYS)[number];

export const TIERS = ["none", "foundation", "premium", "premium_plus"] as const;
export type Tier = (typeof TIERS)[number];

export const START_TRIGGERS = ["start_now", "at_launch", "on_date"] as const;
export type StartTrigger = (typeof START_TRIGGERS)[number];

export const WEB_STATUSES = [
  "has_site_keep",
  "has_site_rebuild",
  "splash_then_full",
  "wait_for_launch",
  "no_site",
] as const;
export type WebStatus = (typeof WEB_STATUSES)[number];

export const FORM_TYPES = ["new_client", "service_change", "cancellation", "unknown"] as const;
export type FormType = (typeof FORM_TYPES)[number];

export type ServicePlan = {
  tier: Tier;
  startTrigger: StartTrigger;
  startDate: string | null; // ISO yyyy-mm-dd when known
  notes: string | null;
};

export type PipelineIntake = {
  formType: FormType;
  contractSigned: boolean | null;
  practiceName: string | null;
  ownerName: string | null;
  location: string | null;
  primaryContactName: string | null;
  primaryContactEmail: string | null;
  primaryContactPhone: string | null;
  pims: string | null;
  /** The practice's existing/live website URL, if noted on the form. */
  websiteUrl: string | null;
  website: {
    purchased: boolean;
    tier: Tier;
    pages: number | null;
    startDate: string | null;
    notes: string | null;
  } | null;
  webStatus: WebStatus | null;
  websiteLaunchDate: string | null;
  services: Record<ServiceKey, ServicePlan>;
  notes: string | null;
  /** Set when the form's Location field materially disagrees with the location
   * described in the goals/notes (not just neighboring towns) — verify before use. */
  locationConflict: string | null;
};

function str(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length ? t : null;
}

// Canonicalize model output to our snake_case enums: the model often returns
// human-cased values ("New Client", "Premium Plus") despite the prompt.
function canon(v: unknown): string {
  return typeof v === "string" ? v.trim().toLowerCase().replace(/[\s-]+/g, "_") : "";
}

function oneOf<T extends readonly string[]>(v: unknown, allowed: T, fallback: T[number]): T[number] {
  const c = canon(v);
  return (allowed as readonly string[]).includes(c) ? (c as T[number]) : fallback;
}

function boolOrNull(v: unknown): boolean | null {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") {
    const t = v.trim().toLowerCase();
    if (["yes", "true", "y"].includes(t)) return true;
    if (["no", "false", "n"].includes(t)) return false;
  }
  return null;
}

function emptyPlan(): ServicePlan {
  return { tier: "none", startTrigger: "start_now", startDate: null, notes: null };
}

function normalizePlan(v: unknown): ServicePlan {
  const raw = (v ?? {}) as Record<string, unknown>;
  return {
    tier: oneOf(raw.tier, TIERS, "none"),
    startTrigger: oneOf(raw.startTrigger, START_TRIGGERS, "start_now"),
    startDate: str(raw.startDate),
    notes: str(raw.notes),
  };
}

// Coerce the model's JSON into a valid PipelineIntake with safe defaults, so
// downstream UI never sees a malformed shape.
export function normalizePipelineIntake(input: unknown): PipelineIntake {
  const raw = (input ?? {}) as Record<string, unknown>;
  const services = {} as Record<ServiceKey, ServicePlan>;
  const rawServices = (raw.services ?? {}) as Record<string, unknown>;
  for (const key of SERVICE_KEYS) {
    services[key] = normalizePlan(rawServices[key]);
  }

  const rawWebsite = raw.website as Record<string, unknown> | null | undefined;
  const website = rawWebsite
    ? {
        purchased: boolOrNull(rawWebsite.purchased) ?? true,
        tier: oneOf(rawWebsite.tier, TIERS, "none"),
        pages:
          typeof rawWebsite.pages === "number"
            ? rawWebsite.pages
            : Number.isFinite(Number(rawWebsite.pages))
              ? Number(rawWebsite.pages)
              : null,
        startDate: str(rawWebsite.startDate),
        notes: str(rawWebsite.notes),
      }
    : null;

  return {
    formType: oneOf(raw.formType, FORM_TYPES, "unknown"),
    contractSigned: boolOrNull(raw.contractSigned),
    practiceName: str(raw.practiceName),
    ownerName: str(raw.ownerName),
    location: str(raw.location),
    primaryContactName: str(raw.primaryContactName),
    primaryContactEmail: str(raw.primaryContactEmail),
    primaryContactPhone: str(raw.primaryContactPhone),
    pims: str(raw.pims),
    websiteUrl: str(raw.websiteUrl),
    website,
    webStatus: raw.webStatus == null ? null : oneOf(raw.webStatus, WEB_STATUSES, "no_site"),
    websiteLaunchDate: str(raw.websiteLaunchDate),
    services,
    notes: str(raw.notes),
    locationConflict: str(raw.locationConflict),
  };
}
