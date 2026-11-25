// When a client's search stats are missing because Search Console hasn't given
// us access, every place that shows those stats says so in the same words,
// rather than showing blanks or a "last synced" date for a sync that failed.
//
// Until Nov 2026 these notes said to add tom@beyondindigo.com, while the sync's
// own comments said practices are asked to add the service account; the sync
// accepts either (lib/seo/search-console.ts). The notes now point to the
// client's Connections tab, which lists the sites our access can read and
// names the exact account to add (lib/connections/sources.ts), so there is one
// answer in one place.

export const SEARCH_CONSOLE_FIX = "Pick the site, or see which account to add, on the client's Connections tab.";

type LatestRun = { run_status: string; error_message: string | null; property_url?: string | null };

/** Google's answer when the account can't see the property. */
export function isSearchConsoleAccessError(message: string | null | undefined): boolean {
  return /\b403\b|sufficient permission|permission_denied|forbidden|not have access/i.test(message ?? "");
}

/** True when the newest sync attempt failed because we have no access. */
export function searchConsoleNotConnected(latest: LatestRun | null | undefined): boolean {
  return latest?.run_status === "failed" && isSearchConsoleAccessError(latest.error_message);
}

/** The note to show, or null when the latest sync worked (or never ran). */
export function searchConsoleNote(latest: LatestRun | null | undefined): string | null {
  if (!latest || latest.run_status !== "failed") return null;
  if (isSearchConsoleAccessError(latest.error_message)) {
    const property = latest.property_url ? ` (${latest.property_url})` : "";
    return `Search Console isn't connected for this client${property}, so its search stats can't be pulled. ${SEARCH_CONSOLE_FIX}`;
  }
  return `The last Search Console sync failed: ${(latest.error_message ?? "no reason given").slice(0, 200)}`;
}
