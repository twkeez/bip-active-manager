import { redirect } from "next/navigation";

type LegacyClientSearchParams = {
  clientId?: string;
  tab?: string;
};

export function redirectLegacyClientQuery(params: LegacyClientSearchParams) {
  const parsedClientId = Number(params.clientId);
  if (!Number.isInteger(parsedClientId) || parsedClientId <= 0) {
    return;
  }
  const tabQuery = params.tab ? `?tab=${encodeURIComponent(params.tab)}` : "";
  redirect(`/dashboard/clients/${parsedClientId}${tabQuery}`);
}
