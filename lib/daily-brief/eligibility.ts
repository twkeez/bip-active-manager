import { getClientLifecycleStatus, type ClientLifecycleStatus } from "@/lib/clients/client-status";
import { getClientActiveServices, isLowContact, isWebsiteOnly } from "@/lib/clients/service-active";
import type { ClientRow } from "@/lib/types/client";

/**
 * Which clients the daily brief is about.
 *
 * Tom's rule (2026-10-05): all active clients, never website-only accounts.
 * Two more exclusions follow from how the app already treats accounts, and the
 * page says how many of each it left out so nothing disappears silently:
 *
 * - Low-contact accounts are listed as Paused elsewhere in the app (no Basecamp
 *   or Harvest is expected for them), so they would only add "we cannot see"
 *   noise.
 * - An account that is past onboarding and buys no marketing service has nothing
 *   for a brief to say.
 *
 * Onboarding and pending-launch clients are kept whether or not their services
 * have started, because onboarding is exactly what the brief puts first.
 */

export type EligibilityInput = Pick<
  ClientRow,
  "id" | "onboarding_status" | "awaiting_website_launch" | "tier" | "seo" | "ppc" | "smm" | "blog" | "orm"
> & { is_website_only?: boolean | null; is_low_contact?: boolean | null };

export type ExcludedCounts = { websiteOnly: number; paused: number; noServices: number };

export function partitionClients<T extends EligibilityInput>(
  rows: T[],
): { included: Array<{ row: T; lifecycle: ClientLifecycleStatus }>; excluded: ExcludedCounts } {
  const included: Array<{ row: T; lifecycle: ClientLifecycleStatus }> = [];
  const excluded: ExcludedCounts = { websiteOnly: 0, paused: 0, noServices: 0 };

  for (const row of rows) {
    if (isWebsiteOnly(row)) {
      excluded.websiteOnly += 1;
      continue;
    }
    if (isLowContact(row)) {
      excluded.paused += 1;
      continue;
    }
    const lifecycle = getClientLifecycleStatus(row);
    const buysSomething = Object.values(getClientActiveServices(row)).some(Boolean);
    if (lifecycle === "active" && !buysSomething) {
      excluded.noServices += 1;
      continue;
    }
    included.push({ row, lifecycle });
  }
  return { included, excluded };
}
