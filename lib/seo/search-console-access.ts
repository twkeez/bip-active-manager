// When a client's search stats are missing because Search Console hasn't given
// us access, every place that shows those stats says so in the same words,
// rather than showing blanks or a "last synced" date for a sync that failed.
// The nightly sync reads Search Console as this account (see
// lib/seo/search-console.ts), so it is the one that needs adding.

export const SEARCH_CONSOLE_ACCOUNT = "tom@beyondindigo.com";

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
    return `Search Console isn't connected for this client${property}, so its search stats can't be pulled. Add ${SEARCH_CONSOLE_ACCOUNT} as a user on this site in Search Console.`;
  }
  return `The last Search Console sync failed: ${(latest.error_message ?? "no reason given").slice(0, 200)}`;
}
