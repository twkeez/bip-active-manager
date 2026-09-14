/**
 * Which Google Ads API version to call.
 *
 * Google retires versions on a schedule, and a retired one does not fail
 * politely: every request returns an HTML 404 page. On 2026-09-14 the app was
 * pinned to v20 by GOOGLE_ADS_API_VERSION with a v21 fallback in code, and both
 * were gone — v19, v20 and v21 all 404, while v22 and v23 answered. Ads
 * reporting had been dead since 17 July and nothing said so.
 *
 * So a configured version is not trusted blindly: anything known to be retired
 * is ignored in favour of the current one, because a stale environment variable
 * can only break the integration, never fix it.
 */

/** The version this app targets today. */
export const CURRENT_GOOGLE_ADS_API_VERSION = "v22";

/** Highest version confirmed retired (v19–v21 returned HTML 404s on 2026-09-14). */
const HIGHEST_RETIRED_VERSION = 21;

export function resolveGoogleAdsApiVersion(raw: string | null | undefined): string {
  const value = (raw ?? "").trim().toLowerCase();
  if (!/^v\d+$/.test(value)) return CURRENT_GOOGLE_ADS_API_VERSION;
  const major = Number(value.slice(1));
  if (!Number.isFinite(major) || major <= HIGHEST_RETIRED_VERSION) {
    return CURRENT_GOOGLE_ADS_API_VERSION;
  }
  return value;
}
