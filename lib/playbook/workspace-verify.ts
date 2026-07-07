import type { ClientWorkspaceInitialData } from "@/lib/dashboard/client-workspace-types";

export type PlatformCheck = {
  key: string;
  label: string;
  pass: boolean;
  detail: string;
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
