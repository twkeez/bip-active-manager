import { isLowContactTier, norm } from "@/lib/clients/service-active";
import type { ClientSetupItem } from "@/lib/clients/types";
import type { ClientRow } from "@/lib/types/client";
import type { ClientActiveServices } from "@/lib/clients/types";

function hasText(value: string | null | undefined) {
  return Boolean(norm(value));
}

export function evaluateSetupRequirements(params: {
  client: ClientRow;
  services: ClientActiveServices;
  socialConnectionCount: number;
}): { required: ClientSetupItem[]; recommended: ClientSetupItem[] } {
  const { client, services, socialConnectionCount } = params;
  const required: ClientSetupItem[] = [];
  const recommended: ClientSetupItem[] = [];

  const push = (item: ClientSetupItem) => {
    if (item.severity === "required") required.push(item);
    else recommended.push(item);
  };

  if (!hasText(client.website)) {
    push({
      id: "website",
      label: "Website",
      severity: "required",
      reason: "Website URL is required for all clients.",
      field: "website",
    });
  }

  if (!isLowContactTier(client.tier) && !hasText(client.basecamp_project_id)) {
    push({
      id: "basecamp",
      label: "Basecamp project",
      severity: "required",
      reason: "Basecamp project ID is required unless tier is Low Contact.",
      field: "basecamp_project_id",
    });
  }

  if (services.seo && !hasText(client.sc_url)) {
    push({
      id: "search_console",
      label: "Search Console URL",
      severity: "required",
      reason: "SEO is active — Search Console property URL is required.",
      field: "sc_url",
    });
  }

  if (services.ppc && !hasText(client.ads_customer_id)) {
    push({
      id: "google_ads",
      label: "Google Ads customer ID",
      severity: "required",
      reason: "PPC is active — Google Ads customer ID is required.",
      field: "ads_customer_id",
    });
  }

  if (services.smm && socialConnectionCount <= 0) {
    push({
      id: "social_connection",
      label: "Social connection",
      severity: "required",
      reason: "SMM is active — at least one social platform connection is required.",
      field: "social_connection",
    });
  }

  if (services.seo && !hasText(client.google_place_id)) {
    push({
      id: "google_place_id",
      label: "Google Place ID",
      severity: "recommended",
      reason: "SEO is active — GBP reporting works best with a Place ID.",
      field: "google_place_id",
    });
  }

  if (!hasText(client.ga4_property_id)) {
    push({
      id: "ga4_property_id",
      label: "GA4 property ID",
      severity: "recommended",
      reason: "Prepares this account for GA4 reporting sync.",
      field: "ga4_property_id",
    });
  }

  if (
    hasText(client.marketing_strategist) &&
    !isLowContactTier(client.tier) &&
    (!hasText(client.harvest_project_id) || !hasText(client.harvest_client_id))
  ) {
    push({
      id: "harvest",
      label: "Harvest IDs",
      severity: "recommended",
      reason: "Harvest project/client IDs help with time tracking.",
      field: "harvest_project_id",
    });
  }

  return { required, recommended };
}
