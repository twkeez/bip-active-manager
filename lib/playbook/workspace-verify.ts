import type { ClientWorkspaceInitialData } from "@/lib/dashboard/client-workspace-types";

export type PlatformCheck = {
  key: string;
  label: string;
  pass: boolean;
  detail: string;
  // When true, render as an informational (grey) row rather than pass/fail —
  // used for rows we always show even when the data source can't provide them.
  neutral?: boolean;
};

function daysSince(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000);
}

function syncedLabel(days: number): string {
  return days === 0 ? "today" : `${days}d ago`;
}

const STALE_DAYS = 10;

export function runSeoPlatformChecks(workspace: ClientWorkspaceInitialData): PlatformCheck[] {
  const { client, gscSnapshot, gscSignals, ga4Snapshot } = workspace;
  const checks: PlatformCheck[] = [];

  // ── Google Search Console ──────────────────────────────────────────────────
  if (!client.sc_url) {
    checks.push({ key: "gsc", label: "Google Search Console", pass: false, detail: "Not connected — add the property URL in client settings" });
  } else if (!gscSnapshot) {
    checks.push({ key: "gsc", label: "Google Search Console", pass: false, detail: "Connected but no data synced yet" });
  } else if (gscSnapshot.run_status === "failed") {
    checks.push({ key: "gsc", label: "Google Search Console", pass: false, detail: gscSnapshot.error_message ?? "Last sync failed" });
  } else {
    const days = daysSince(gscSnapshot.updated_at);
    const criticalSignals = gscSignals.filter((s) => s.severity === "critical");
    if (days > STALE_DAYS) {
      checks.push({ key: "gsc", label: "Google Search Console", pass: false, detail: `Data stale — last sync ${days} days ago` });
    } else if (criticalSignals.length > 0) {
      checks.push({ key: "gsc", label: "Google Search Console", pass: false, detail: `${criticalSignals.length} critical signal${criticalSignals.length > 1 ? "s" : ""} — ${criticalSignals[0].title}` });
    } else {
      checks.push({ key: "gsc", label: "Google Search Console", pass: true, detail: `Data flowing · synced ${syncedLabel(days)}` });
    }
  }

  // ── Google Analytics 4 ────────────────────────────────────────────────────
  if (!client.ga4_property_id) {
    checks.push({ key: "ga4", label: "Google Analytics 4", pass: false, detail: "Not connected — add the property ID in client settings" });
  } else if (!ga4Snapshot) {
    checks.push({ key: "ga4", label: "Google Analytics 4", pass: false, detail: "Connected but no data synced yet" });
  } else if (ga4Snapshot.run_status === "failed") {
    checks.push({ key: "ga4", label: "Google Analytics 4", pass: false, detail: ga4Snapshot.error_message ?? "Last sync failed" });
  } else {
    const days = daysSince(ga4Snapshot.updated_at);
    const sessions = ga4Snapshot.totals.sessions;
    if (days > STALE_DAYS) {
      checks.push({ key: "ga4", label: "Google Analytics 4", pass: false, detail: `Data stale — last sync ${days} days ago` });
    } else if (sessions === 0) {
      checks.push({ key: "ga4", label: "Google Analytics 4", pass: false, detail: "0 sessions recorded — GA4 tag may not be firing" });
    } else {
      checks.push({ key: "ga4", label: "Google Analytics 4", pass: true, detail: `Data flowing · ${sessions.toLocaleString()} sessions · synced ${syncedLabel(days)}` });
    }
  }

  // ── Google Tag Manager ────────────────────────────────────────────────────
  const gtmId = client.gtm_container_id;
  if (!gtmId) {
    checks.push({ key: "gtm", label: "Google Tag Manager", pass: false, detail: "Container ID not on file — add GTM-XXXXXX in client settings" });
  } else {
    checks.push({ key: "gtm", label: "Google Tag Manager", pass: true, detail: `${gtmId} on file — confirm with Tag Assistant if needed` });
  }

  return checks;
}

// ── GBP posts & profile checks ─────────────────────────────────────────────
// These are always rendered (even when the data is unavailable) so the rows
// are a permanent part of the checklist. Last-post and profile-completeness
// data only arrive when the connected Google account manages the listing;
// when it doesn't, we show a neutral "not available" row instead of hiding it.
const GBP_DATA_UNAVAILABLE_HINT =
  "Not available — connect a Google account that manages this listing, then sync";

function gbpPostCheck(snapshot: ClientWorkspaceInitialData["gbpSnapshot"]): PlatformCheck {
  if (snapshot?.last_post_at) {
    const postDays = daysSince(snapshot.last_post_at);
    if (postDays > 30) {
      return { key: "gbp_posts", label: "GBP Posts", pass: false, detail: `No posts in ${postDays} days — aim for at least monthly` };
    }
    return { key: "gbp_posts", label: "GBP Posts", pass: true, detail: `Last post ${syncedLabel(postDays)}` };
  }
  return { key: "gbp_posts", label: "GBP Posts", pass: false, neutral: true, detail: GBP_DATA_UNAVAILABLE_HINT };
}

function gbpProfileCheck(snapshot: ClientWorkspaceInitialData["gbpSnapshot"]): PlatformCheck {
  if (snapshot?.profile_fields) {
    const fields = snapshot.profile_fields as Record<string, boolean>;
    const missing = Object.entries(fields).filter(([, v]) => !v).map(([k]) => k);
    if (missing.length > 0) {
      return { key: "gbp_profile", label: "GBP Profile", pass: false, detail: `Incomplete: missing ${missing.join(", ")}` };
    }
    return { key: "gbp_profile", label: "GBP Profile", pass: true, detail: "Profile fields complete" };
  }
  return { key: "gbp_profile", label: "GBP Profile", pass: false, neutral: true, detail: GBP_DATA_UNAVAILABLE_HINT };
}

// ── GBP checks (used in both SEO and ORM tabs) ────────────────────────────
export function runGbpChecks(workspace: ClientWorkspaceInitialData): PlatformCheck[] {
  const { client, gbpSnapshot, gbpReviews } = workspace;
  const checks: PlatformCheck[] = [];

  // ── Connection ─────────────────────────────────────────────────────────────
  if (!client.google_place_id) {
    // Nothing is configured — the posts/profile rows would be meaningless.
    checks.push({ key: "gbp", label: "Google Business Profile", pass: false, detail: "Place ID not on file — add it in client settings" });
    return checks;
  }

  if (!gbpSnapshot) {
    checks.push({ key: "gbp", label: "Google Business Profile", pass: false, detail: "Place ID on file but no data synced yet" });
  } else if (gbpSnapshot.run_status === "failed") {
    checks.push({ key: "gbp", label: "Google Business Profile", pass: false, detail: gbpSnapshot.error_message ?? "Last sync failed" });
  } else {
    const days = daysSince(gbpSnapshot.updated_at);
    if (days > STALE_DAYS) {
      checks.push({ key: "gbp", label: "Google Business Profile", pass: false, detail: `Data stale — last sync ${days} days ago` });
    } else {
      checks.push({ key: "gbp", label: "Google Business Profile", pass: true, detail: `Connected · synced ${syncedLabel(days)}` });

      // ── Rating ──────────────────────────────────────────────────────────────
      const rating = gbpSnapshot.rating;
      const reviewCount = gbpSnapshot.user_ratings_total ?? 0;
      if (rating === null) {
        checks.push({ key: "gbp_rating", label: "GBP Rating", pass: false, detail: "No rating data — profile may be new or unverified" });
      } else if (rating < 4.0) {
        checks.push({ key: "gbp_rating", label: "GBP Rating", pass: false, detail: `${rating.toFixed(1)} ★ across ${reviewCount.toLocaleString()} reviews — below 4.0 threshold` });
      } else {
        checks.push({ key: "gbp_rating", label: "GBP Rating", pass: true, detail: `${rating.toFixed(1)} ★ · ${reviewCount.toLocaleString()} reviews` });
      }

      // ── Most recent review ──────────────────────────────────────────────────
      const latestReview = gbpReviews[0];
      if (!latestReview?.review_time_unix) {
        checks.push({ key: "gbp_reviews", label: "GBP Reviews", pass: false, detail: "No reviews on record" });
      } else {
        const reviewDays = Math.floor((Date.now() - latestReview.review_time_unix * 1000) / 86_400_000);
        if (reviewDays > 90) {
          checks.push({ key: "gbp_reviews", label: "GBP Reviews", pass: false, detail: `No new reviews in ${reviewDays} days — encourage clients to ask for reviews` });
        } else {
          checks.push({ key: "gbp_reviews", label: "GBP Reviews", pass: true, detail: `Most recent review ${syncedLabel(reviewDays)}` });
        }
      }
    }
  }

  // ── Last post & profile completeness — always shown, even when unavailable ──
  checks.push(gbpPostCheck(gbpSnapshot));
  checks.push(gbpProfileCheck(gbpSnapshot));

  return checks;
}
