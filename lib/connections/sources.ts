import type { SupabaseClient } from "@supabase/supabase-js";
import { listAdsAccounts } from "@/lib/ads/list-accounts";
import { normalizeCustomerId } from "@/lib/ads/customer-id";
import { getGoogleAdsConfig } from "@/lib/env";
import { getGa4ServiceToken } from "@/lib/ga4/google-analytics";
import { getGoogleAccessTokenForScope } from "@/lib/google/token-manager";
import { getServiceAccountEmail } from "@/lib/google/master-sheet-source";
import { getAccessTokenFor, isStrongPermission, listAccessibleSites } from "@/lib/seo/search-console";
import { mergeOptions, type SourceKey, type SourceOption } from "@/lib/connections/match";

/**
 * What the agency's own Google access can read, for the Connections picker.
 *
 * These are the same identities the syncs use, in the same order, so a site
 * or property the picker lists is one the nightly sync can read:
 *   Search Console: the shared Google login (GOOGLE_OAUTH_REFRESH_TOKEN), then
 *     the service account (lib/seo/search-console.ts).
 *   GA4: the service account, then the stored Google connection that holds
 *     analytics.readonly (lib/ga4/sync-client.ts).
 *   Ads: every account under our manager account (lib/ads/list-accounts.ts).
 *
 * Read-only. Nothing here changes anything at Google.
 */

export type SourceListing = {
  options: SourceOption[];
  /** An identity whose list couldn't be read, with the reason: the list may be missing what it can see. */
  failures: string[];
  /** Exactly what to ask the practice for when what they want isn't listed. */
  grantAccess: string;
};

const SHARED_LOGIN = "the shared Google login the nightly sync uses";
const STORED_CONNECTION = "the stored Google connection used when the service account is refused";
const ADS_MANAGER = "our Google Ads manager account";

function reason(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** "1234567890" -> "123-456-7890", as Google Ads shows it. */
export function formatAdsId(id: string): string {
  const digits = normalizeCustomerId(id);
  return digits.length === 10 ? `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}` : id;
}

export function grantAccessText(source: SourceKey): string {
  const serviceAccount = getServiceAccountEmail();
  if (source === "search_console") {
    return serviceAccount
      ? `In Search Console, open the site's Settings, then Users and permissions, and add ${serviceAccount} with Full permission.`
      : `No service account is set up, so the site has to be shared with ${SHARED_LOGIN} (Full permission).`;
  }
  if (source === "ga4") {
    return serviceAccount
      ? `In Google Analytics, open Admin, then Property access management for the property, and add ${serviceAccount} as a Viewer.`
      : "No service account is set up, so GA4 can only be read through a stored Google connection with access to the property.";
  }
  let manager = "";
  try {
    manager = normalizeCustomerId(getGoogleAdsConfig().loginCustomerId ?? "");
  } catch {
    manager = "";
  }
  return manager
    ? `The account has to be linked under ${ADS_MANAGER} (${formatAdsId(manager)}): send a link request from the manager account, and the client accepts it in their Google Ads account under Access and security.`
    : `The account has to be linked under ${ADS_MANAGER}, and no manager account ID is configured (GOOGLE_ADS_LOGIN_CUSTOMER_ID).`;
}

async function searchConsoleListing(): Promise<SourceListing> {
  const lists: Parameters<typeof mergeOptions>[0] = [];
  const failures: string[] = [];
  const serviceAccount = getServiceAccountEmail();
  const identities = [
    { key: "oauth" as const, label: SHARED_LOGIN },
    { key: "service_account" as const, label: serviceAccount || "the service account" },
  ];
  for (const identity of identities) {
    const token = await getAccessTokenFor(identity.key).catch(() => null);
    if (!token) continue; // Not configured: a normal state, not a failure.
    try {
      const sites = await listAccessibleSites(token);
      lists.push({
        identity: identity.label,
        options: sites
          .filter((site) => site.siteUrl)
          .map((site) => ({
            value: site.siteUrl,
            label: site.siteUrl,
            detail: site.permissionLevel === "siteUnverifiedUser" ? "Not verified" : null,
            // The sync settles only on Owner or Full: a Restricted or
            // unverified user is listed but refused the data.
            usable: isStrongPermission(site.permissionLevel),
          })),
      });
    } catch (error) {
      failures.push(`Couldn't list ${identity.label}'s sites: ${reason(error)}`);
    }
  }
  if (lists.length === 0 && failures.length === 0) failures.push("No Google access is configured for Search Console.");
  return { options: mergeOptions(lists), failures, grantAccess: grantAccessText("search_console") };
}

type AccountSummariesResponse = {
  accountSummaries?: Array<{
    displayName?: string;
    propertySummaries?: Array<{ property?: string; displayName?: string }>;
  }>;
  nextPageToken?: string;
};

/** Every GA4 property a token can read, through the Admin API, page by page. */
async function listGa4Properties(token: string): Promise<Array<Omit<SourceOption, "readableBy">>> {
  const options: Array<Omit<SourceOption, "readableBy">> = [];
  let pageToken = "";
  for (;;) {
    const url = new URL("https://analyticsadmin.googleapis.com/v1beta/accountSummaries");
    url.searchParams.set("pageSize", "200");
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
      throw new Error(`GA4 property list failed (${response.status}): ${body.error?.message ?? response.statusText}`);
    }
    const payload = (await response.json()) as AccountSummariesResponse;
    for (const account of payload.accountSummaries ?? []) {
      for (const property of account.propertySummaries ?? []) {
        const id = (property.property ?? "").replace(/^properties\//, "");
        if (!/^\d+$/.test(id)) continue;
        options.push({
          value: id,
          label: (property.displayName ?? "").trim() || `Property ${id}`,
          detail: [account.displayName?.trim(), id].filter(Boolean).join(" · "),
          usable: true,
        });
      }
    }
    if (!payload.nextPageToken) return options;
    pageToken = payload.nextPageToken;
  }
}

async function ga4Listing(admin: SupabaseClient): Promise<SourceListing> {
  const lists: Parameters<typeof mergeOptions>[0] = [];
  const failures: string[] = [];
  const serviceAccount = getServiceAccountEmail();

  if (serviceAccount) {
    try {
      const token = await getGa4ServiceToken();
      lists.push({ identity: serviceAccount, options: await listGa4Properties(token) });
    } catch (error) {
      failures.push(`Couldn't list the service account's properties: ${reason(error)}`);
    }
  }
  let stored: string | null = null;
  try {
    stored = await getGoogleAccessTokenForScope(admin, "analytics.readonly");
  } catch (error) {
    failures.push(`Couldn't read the stored Google connection: ${reason(error)}`);
  }
  if (stored) {
    try {
      lists.push({ identity: STORED_CONNECTION, options: await listGa4Properties(stored) });
    } catch (error) {
      failures.push(`Couldn't list ${STORED_CONNECTION}'s properties: ${reason(error)}`);
    }
  }
  if (lists.length === 0 && failures.length === 0) failures.push("No Google access is configured for GA4.");
  return { options: mergeOptions(lists), failures, grantAccess: grantAccessText("ga4") };
}

async function adsListing(): Promise<SourceListing> {
  try {
    const accounts = await listAdsAccounts();
    return {
      options: mergeOptions([
        {
          identity: ADS_MANAGER,
          options: accounts.map((account) => ({
            value: normalizeCustomerId(account.customerId),
            label: account.name || formatAdsId(account.customerId),
            detail: [formatAdsId(account.customerId), account.status === "ENABLED" ? null : account.status.toLowerCase()]
              .filter(Boolean)
              .join(" · "),
            usable: true,
          })),
        },
      ]),
      failures: [],
      grantAccess: grantAccessText("ads"),
    };
  } catch (error) {
    return { options: [], failures: [`Couldn't list the Google Ads accounts: ${reason(error)}`], grantAccess: grantAccessText("ads") };
  }
}

export function listSource(source: SourceKey, admin: SupabaseClient): Promise<SourceListing> {
  if (source === "search_console") return searchConsoleListing();
  if (source === "ga4") return ga4Listing(admin);
  return adsListing();
}
