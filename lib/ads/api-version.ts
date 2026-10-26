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
 *
 * 2026-10-26: v22 started refusing requests ("Version v22 is deprecated");
 * moved to v24 (supported until about May 2027). v24 dropped
 * metrics.auction_insight_search_top_of_page_rate, so the queries no longer ask
 * for it. Google's sunset dates: developers.google.com/google-ads/api/docs/sunset-dates
 */

/** The version this app targets today. */
export const CURRENT_GOOGLE_ADS_API_VERSION = "v24";

/**
 * Versions at or below this are never used, even if configured: v19–v21
 * retired 2026-09-14, v22 on 2026-10-26, and v23 is older than what the
 * queries were last checked against (v24).
 */
const HIGHEST_RETIRED_VERSION = 23;

export function resolveGoogleAdsApiVersion(raw: string | null | undefined): string {
  const value = (raw ?? "").trim().toLowerCase();
  if (!/^v\d+$/.test(value)) return CURRENT_GOOGLE_ADS_API_VERSION;
  const major = Number(value.slice(1));
  if (!Number.isFinite(major) || major <= HIGHEST_RETIRED_VERSION) {
    return CURRENT_GOOGLE_ADS_API_VERSION;
  }
  return value;
}
