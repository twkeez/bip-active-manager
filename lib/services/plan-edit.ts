import type { ClientServiceKey } from "@/lib/clients/types";
import { isServiceActive, norm } from "@/lib/clients/service-active";

/**
 * Changing what a client buys, from the client page.
 *
 * The values here are the words the client record already holds — "Premium
 * Plus", "Foundation", a post count for Blog — so that the plan pills, the
 * "What this tier includes" scope lookup and every tier-keyed feature keep
 * reading them without translation. The old editor was free text, which is how
 * one client's Blog field came to say "Foundation": Blog is a number of posts.
 */

/** Stored for a service the client does not buy — matches 700-odd existing rows. */
export const SERVICE_OFF = "N";

export type ServiceChoice = { value: string; label: string };

export type ServicePlanOption = {
  service: ClientServiceKey;
  label: string;
  choices: ServiceChoice[];
};

const FPP: ServiceChoice[] = [
  { value: "Foundation", label: "Foundation" },
  { value: "Premium", label: "Premium" },
  { value: "Premium Plus", label: "Premium Plus" },
];

/**
 * SEO, PPC and Social follow the published scope tables (Foundation, Premium,
 * Premium Plus), so a changed tier still resolves on "What this tier includes".
 * Reputation has two tiers and no scope table yet. Blog is a monthly count.
 */
export const SERVICE_PLAN_OPTIONS: ServicePlanOption[] = [
  { service: "seo", label: "SEO", choices: FPP },
  { service: "ppc", label: "PPC", choices: FPP },
  { service: "smm", label: "Social Media", choices: FPP },
  {
    service: "blog",
    label: "Blog",
    choices: [1, 2, 5, 10].map((n) => ({ value: String(n), label: `${n} post${n === 1 ? "" : "s"}/mo` })),
  },
  {
    service: "orm",
    label: "Reputation (ORM)",
    choices: [
      { value: "Foundation", label: "Foundation" },
      { value: "Premium", label: "Premium" },
    ],
  },
];

export type ServicePlan = Record<ClientServiceKey, string>;

/**
 * What the editor should show selected for a stored value. Anything that is not
 * one of the offered choices — a legacy "P", a stray "Foundation" in Blog — is
 * kept as-is rather than silently snapped to the nearest option, so opening the
 * editor never changes a client by itself.
 */
export function currentChoice(option: ServicePlanOption, stored: string | null | undefined) {
  const raw = norm(stored);
  if (!isServiceActive(raw)) return { value: SERVICE_OFF, unrecognised: false };
  const match = option.choices.find((c) => c.value.toLowerCase() === raw.toLowerCase());
  return match ? { value: match.value, unrecognised: false } : { value: raw, unrecognised: true };
}

export type PlanChange = {
  service: ClientServiceKey;
  label: string;
  from: string;
  to: string;
  /** The service goes from bought to not bought. */
  removed: boolean;
  added: boolean;
};

/** Only the services whose stored value actually changes. */
export function diffPlan(before: ServicePlan, after: ServicePlan): PlanChange[] {
  const changes: PlanChange[] = [];
  for (const option of SERVICE_PLAN_OPTIONS) {
    const from = norm(before[option.service]);
    const to = norm(after[option.service]);
    const wasOn = isServiceActive(from);
    const isOn = isServiceActive(to);
    // "" and "N" both mean not bought; rewriting one as the other is not a
    // change worth sending, and would otherwise re-run the onboarding sync.
    if (!wasOn && !isOn) continue;
    if (from.toLowerCase() === to.toLowerCase()) continue;
    changes.push({
      service: option.service,
      label: option.label,
      from,
      to,
      removed: wasOn && !isOn,
      added: !wasOn && isOn,
    });
  }
  return changes;
}

/**
 * The one change with a cost you cannot see from the client page.
 *
 * While a client is mid-onboarding, turning a service off deletes that
 * service's onboarding checklist — ticked items included — and turning it back
 * on recreates them unticked. A tier change within a service does neither.
 */
export function onboardingItemsAtRisk(
  changes: PlanChange[],
  onboardingStatus: string | null | undefined,
): PlanChange[] {
  if (onboardingStatus !== "active") return [];
  return changes.filter((change) => change.removed);
}
