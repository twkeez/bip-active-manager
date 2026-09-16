import type { ClientServiceKey } from "@/lib/clients/types";
import {
  START_TRIGGERS,
  WEB_STATUSES,
  type PipelineIntake,
  type StartTrigger,
  type WebStatus,
} from "@/lib/onboarding/pipeline-intake";
import { SERVICE_OFF } from "@/lib/services/plan-edit";

/**
 * The facts a client document and Basecamp message are built from, as one
 * editable set.
 *
 * Read from the pipeline form, then confirmed or corrected by a person before
 * anything runs. This is the only place start timing can be set after a client
 * exists — which is how Tiburon's backwards timing went unfixable until it was
 * corrected by hand.
 */

export const SERVICE_KEYS: ClientServiceKey[] = ["seo", "ppc", "smm", "blog", "orm"];

export type ServiceStart = { startTrigger: StartTrigger; startDate: string | null };

export type OnboardingDetails = {
  accountName: string;
  website: string;
  city: string;
  state: string;
  strategist: string;
  /** Stored values, as the client record holds them: "Premium", "2", or "N". */
  services: Record<ClientServiceKey, string>;
  starts: Record<ClientServiceKey, ServiceStart>;
  webStatus: WebStatus | "";
  websiteLaunchDate: string;
  kickoffDate: string;
};

const TIER_LABEL: Record<string, string> = {
  foundation: "Foundation",
  premium: "Premium",
  premium_plus: "Premium Plus",
};

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** "Tiburon, CA" → town and state; anything else stays as the town. */
export function splitLocation(location: string | null | undefined): { city: string; state: string } {
  const trimmed = (location ?? "").trim();
  const match = /^(.+?),\s*([A-Za-z]{2})\.?$/.exec(trimmed);
  return match ? { city: match[1].trim(), state: match[2].toUpperCase() } : { city: trimmed, state: "" };
}

export function detailsFromPipeline(intake: PipelineIntake): OnboardingDetails {
  const { city, state } = splitLocation(intake.location);
  const services = {} as Record<ClientServiceKey, string>;
  const starts = {} as Record<ClientServiceKey, ServiceStart>;
  for (const key of SERVICE_KEYS) {
    const plan = intake.services?.[key];
    const label = plan ? TIER_LABEL[plan.tier] : undefined;
    services[key] = label ?? SERVICE_OFF;
    starts[key] = { startTrigger: plan?.startTrigger ?? "start_now", startDate: plan?.startDate ?? null };
  }
  return {
    accountName: intake.practiceName?.trim() ?? "",
    website: intake.websiteUrl?.trim() ?? "",
    city,
    state,
    strategist: "",
    services,
    starts,
    webStatus: intake.webStatus ?? "",
    websiteLaunchDate: intake.websiteLaunchDate ?? "",
    kickoffDate: "",
  };
}

export class DetailsError extends Error {}

function text(value: unknown, field: string, max = 300): string {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string") throw new DetailsError(`${field} must be text.`);
  const trimmed = value.trim();
  if (trimmed.length > max) throw new DetailsError(`${field} is too long.`);
  return trimmed;
}

function date(value: unknown, field: string): string {
  const raw = text(value, field, 10);
  if (!raw) return "";
  if (!DATE.test(raw) || Number.isNaN(new Date(`${raw}T00:00:00Z`).getTime())) {
    throw new DetailsError(`${field} must be a date.`);
  }
  return raw;
}

/** Validates details sent from the browser. Unknown fields are dropped. */
export function parseDetails(raw: unknown): OnboardingDetails {
  if (!raw || typeof raw !== "object") throw new DetailsError("Send the client's details.");
  const input = raw as Record<string, unknown>;
  const accountName = text(input.accountName, "Practice name");
  if (!accountName) throw new DetailsError("The practice needs a name.");

  const servicesIn = (input.services ?? {}) as Record<string, unknown>;
  const startsIn = (input.starts ?? {}) as Record<string, unknown>;
  const services = {} as Record<ClientServiceKey, string>;
  const starts = {} as Record<ClientServiceKey, ServiceStart>;
  for (const key of SERVICE_KEYS) {
    services[key] = text(servicesIn[key], `${key} plan`, 40) || SERVICE_OFF;
    const start = (startsIn[key] ?? {}) as Record<string, unknown>;
    const trigger = START_TRIGGERS.includes(start.startTrigger as StartTrigger)
      ? (start.startTrigger as StartTrigger)
      : "start_now";
    starts[key] = { startTrigger: trigger, startDate: date(start.startDate, `${key} start date`) || null };
  }

  const webStatus = WEB_STATUSES.includes(input.webStatus as WebStatus) ? (input.webStatus as WebStatus) : "";

  return {
    accountName,
    website: text(input.website, "Website"),
    city: text(input.city, "Town", 120),
    state: text(input.state, "State", 2).toUpperCase(),
    strategist: text(input.strategist, "Strategist", 80),
    services,
    starts,
    webStatus,
    websiteLaunchDate: date(input.websiteLaunchDate, "Website launch date"),
    kickoffDate: date(input.kickoffDate, "Kickoff date"),
  };
}

/** The intake's service_start_plan, which keeps timing next to each plan. */
export function servicePlanForIntake(details: OnboardingDetails) {
  return Object.fromEntries(
    SERVICE_KEYS.map((key) => {
      const value = details.services[key];
      const off = !value || value === SERVICE_OFF;
      const tier = off ? "none" : value.toLowerCase().replace(/\s+/g, "_");
      return [key, { tier, startTrigger: details.starts[key].startTrigger, startDate: details.starts[key].startDate }];
    }),
  );
}

/** The client record's columns these details own. */
export function clientFieldsFromDetails(details: OnboardingDetails) {
  return {
    account_name: details.accountName,
    website: details.website || null,
    city: details.city || null,
    state: details.state || null,
    marketing_strategist: details.strategist || null,
    seo: details.services.seo,
    ppc: details.services.ppc,
    smm: details.services.smm,
    blog: details.services.blog,
    orm: details.services.orm,
  };
}

/** The intake's columns these details own. A bare date is what the kickoff field has always stored. */
export function intakeFieldsFromDetails(details: OnboardingDetails) {
  return {
    web_status: details.webStatus || null,
    website_launch_date: details.websiteLaunchDate || null,
    kickoff_meeting_at: details.kickoffDate || null,
    service_start_plan: servicePlanForIntake(details),
  };
}

/** Normalised for duplicate checks: "https://www.PawsVC.com/" → "pawsvc.com". */
export function websiteHost(website: string | null | undefined): string {
  const raw = (website ?? "").trim().toLowerCase();
  if (!raw) return "";
  try {
    return new URL(raw.includes("://") ? raw : `https://${raw}`).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}
