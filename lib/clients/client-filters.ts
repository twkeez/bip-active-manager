import type { ClientRow } from "@/lib/types/client";
import { resolveClientStatus, type ClientDisplayStatus } from "@/components/clients/client-status-badge";
import { isServiceActive, norm } from "@/lib/clients/service-active";

export type ClientStatusFilter = "" | ClientDisplayStatus;

export type OnboardingFilter = "" | "active" | "complete" | "not_started";

export type ClientServiceFilterKey = "seo" | "ads" | "comms";

export const CLIENT_SERVICE_FILTER_OPTIONS: Array<{
  key: ClientServiceFilterKey;
  label: string;
}> = [
  { key: "seo", label: "SEO" },
  { key: "ads", label: "Ads" },
  { key: "comms", label: "Comms" },
];

export type ClientListFilterState = {
  search: string;
  statusFilter: ClientStatusFilter;
  serviceFilters: ClientServiceFilterKey[];
  onboardingFilter: OnboardingFilter;
};

export function clientMatchesOnboardingFilter(
  client: Pick<ClientRow, "onboarding_status">,
  onboardingFilter: OnboardingFilter,
) {
  if (!onboardingFilter) return true;
  if (onboardingFilter === "active") return client.onboarding_status === "active";
  if (onboardingFilter === "complete") return client.onboarding_status === "complete";
  if (onboardingFilter === "not_started") return !client.onboarding_status;
  return true;
}

export function clientMatchesServiceFilter(
  client: Pick<ClientRow, "seo" | "ppc" | "basecamp_project_id">,
  service: ClientServiceFilterKey,
) {
  if (service === "seo") return isServiceActive(client.seo);
  if (service === "ads") return isServiceActive(client.ppc);
  return Boolean(norm(client.basecamp_project_id));
}

export function clientMatchesStatusFilter(
  client: Pick<ClientRow, "needs_reply" | "reply_acknowledged_at" | "tier">,
  statusFilter: ClientStatusFilter,
) {
  if (!statusFilter) return true;
  return resolveClientStatus(client) === statusFilter;
}

export function filterClients(
  clients: ClientRow[],
  filters: ClientListFilterState,
): ClientRow[] {
  const search = filters.search.trim().toLowerCase();
  return clients.filter((client) => {
    if (search && !norm(client.account_name).toLowerCase().includes(search)) {
      return false;
    }
    if (!clientMatchesStatusFilter(client, filters.statusFilter)) {
      return false;
    }
    if (filters.serviceFilters.length > 0) {
      const hasService = filters.serviceFilters.some((service) =>
        clientMatchesServiceFilter(client, service),
      );
      if (!hasService) return false;
    }
    if (!clientMatchesOnboardingFilter(client, filters.onboardingFilter)) {
      return false;
    }
    return true;
  });
}

export function toggleServiceFilter(
  current: ClientServiceFilterKey[],
  service: ClientServiceFilterKey,
): ClientServiceFilterKey[] {
  return current.includes(service)
    ? current.filter((item) => item !== service)
    : [...current, service];
}
