import { getClientActiveServices, isLowContact } from "@/lib/clients/service-active";
import type { ClientRow } from "@/lib/types/client";

export function isClientMarketingTracked(
  client: Pick<
    ClientRow,
    "blog" | "smm" | "seo" | "ppc" | "orm" | "tier" | "onboarding_status"
  >,
): boolean {
  if (client.onboarding_status === "active") {
    return true;
  }

  const services = getClientActiveServices(client);
  const hasActiveService = Object.values(services).some(Boolean);
  if (hasActiveService) {
    return true;
  }

  if (isLowContact(client)) {
    return false;
  }

  return false;
}
