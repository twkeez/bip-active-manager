import type { ClientRow } from "@/lib/types/client";
import type { VerifyKey, VerifyResult } from "./types";

const VERIFY_LABELS: Record<VerifyKey, string> = {
  gsc_connected: "Google Search Console connected",
  ads_synced: "Google Ads account linked",
  ga4_connected: "GA4 property connected",
  gbp_connected: "Google Business Profile linked",
  basecamp_linked: "Basecamp project linked",
  harvest_linked: "Harvest project linked",
};

export function verifyClientItem(
  key: VerifyKey,
  client: ClientRow,
): VerifyResult {
  let pass = false;
  switch (key) {
    case "gsc_connected":
      pass = Boolean(client.sc_url);
      break;
    case "ads_synced":
      pass = Boolean(client.ads_customer_id);
      break;
    case "ga4_connected":
      pass = Boolean(client.ga4_property_id);
      break;
    case "gbp_connected":
      pass = Boolean(client.google_place_id);
      break;
    case "basecamp_linked":
      pass = Boolean(client.basecamp_project_id);
      break;
    case "harvest_linked":
      pass = Boolean(client.harvest_project_id);
      break;
  }
  return { key, label: VERIFY_LABELS[key], pass };
}

export function runVerifications(
  keys: (string | null)[],
  client: ClientRow,
): VerifyResult[] {
  return keys
    .filter((k): k is VerifyKey => k !== null && k in VERIFY_LABELS)
    .map((k) => verifyClientItem(k, client));
}
