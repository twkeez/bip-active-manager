import { createSearchStreamContext, searchStream } from "@/lib/ads/google-ads-stream";
import { getGoogleAdsConfig } from "@/lib/env";
import { normalizeCustomerId } from "@/lib/ads/customer-id";

/**
 * Every Google Ads account under our manager account, by name.
 *
 * Written to close a gap the briefings exposed: sixteen clients bought ads and
 * had no reporting, ten of them because the customer ID field held a note
 * ("Needs added", "Check on services") rather than an ID. Finding each ID
 * meant hunting through the Google Ads account switcher and copying digits by
 * hand, which is how the notes got there in the first place.
 *
 * Listing is read-only and suggests matches; attaching an account to a client
 * stays a decision someone makes, because attaching the wrong one would show a
 * practice another practice's spend.
 */

export type AdsAccount = {
  customerId: string;
  name: string;
  /** "ENABLED", "CANCELED", "SUSPENDED" — a cancelled account explains silence. */
  status: string;
  /** Manager accounts hold no campaigns and are never what a client wants. */
  isManager: boolean;
};

type CustomerClientRow = {
  customerClient?: {
    id?: string;
    descriptiveName?: string;
    status?: string;
    manager?: boolean;
  };
};

export async function listAdsAccounts(): Promise<AdsAccount[]> {
  const { loginCustomerId } = getGoogleAdsConfig();
  const manager = normalizeCustomerId(loginCustomerId);
  if (!manager) throw new Error("No GOOGLE_ADS_LOGIN_CUSTOMER_ID is configured.");

  const { ctx } = await createSearchStreamContext(manager);
  const rows = await searchStream<AdsAccount | null>(
    ctx,
    // level <= 2 covers accounts held directly and those under a sub-manager,
    // which is how the larger practice groups are arranged.
    `SELECT customer_client.id, customer_client.descriptive_name, customer_client.status,
            customer_client.manager
     FROM customer_client
     WHERE customer_client.level <= 2`,
    (row) => {
      const client = (row as CustomerClientRow).customerClient;
      if (!client?.id) return null;
      return {
        customerId: String(client.id),
        name: (client.descriptiveName ?? "").trim(),
        status: client.status ?? "UNKNOWN",
        isManager: Boolean(client.manager),
      };
    },
  );

  return rows
    .filter((account): account is AdsAccount => account !== null && !account.isManager)
    .sort((a, b) => a.name.localeCompare(b.name));
}

// ---------------------------------------------------------------------------
// Matching
// ---------------------------------------------------------------------------

const normalise = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Words shared by half the roster, so they cannot be what a match rests on. */
const GENERIC = /(veterinary|animal|hospital|clinic|pet|vet|care|center|centre|the|and)/g;

const distinctive = (value: string) => normalise(value.replace(GENERIC, " "));

/**
 * Accounts that might belong to a client, best first.
 *
 * Deliberately generous with candidates and silent about confidence: two
 * practices in a group share most of their name ("RPVH - Rocklin Ranch" and
 * "RPVH - Rocklin Ranch Urgent Care"), and the only safe outcome there is to
 * show both to someone who knows which is which.
 */
export function suggestAccounts(clientName: string, accounts: AdsAccount[]): AdsAccount[] {
  const target = normalise(clientName);
  const core = distinctive(clientName);

  const scored = accounts
    .map((account) => {
      const name = normalise(account.name);
      const accountCore = distinctive(account.name);
      let score = 0;
      if (name === target) score = 100;
      else if (name.includes(target) || target.includes(name)) score = 80;
      else if (core.length >= 5 && accountCore.length >= 5 && (accountCore.includes(core) || core.includes(accountCore)))
        score = 60;
      // A cancelled account is worth offering — it explains the silence — but
      // never ahead of a live one.
      if (account.status !== "ENABLED") score -= 15;
      return { account, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, 5).map((entry) => entry.account);
}
