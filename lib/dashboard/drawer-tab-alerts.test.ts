import { describe, expect, it } from "vitest";
import { computeDrawerTabAlerts, countCriticalFindings } from "@/lib/dashboard/drawer-tab-alerts";

describe("countCriticalFindings", () => {
  it("counts critical findings for a channel", () => {
    const findings = [
      { channel: "seo", severity: "critical" },
      { channel: "seo", severity: "watch" },
      { channel: "ads", severity: "critical" },
    ];
    expect(countCriticalFindings(findings, "seo")).toBe(1);
    expect(countCriticalFindings(findings)).toBe(2);
  });
});

describe("computeDrawerTabAlerts", () => {
  it("maps reply and channel alerts to tab badges", () => {
    const alerts = computeDrawerTabAlerts({
      needsReply: true,
      reportingAlertCount: 2,
      staleSourceCount: 1,
      seoCriticalCount: 3,
      adsCriticalCount: 1,
      sitemapCriticalCount: 0,
      socialCriticalCount: 0,
      totalCriticalCount: 4,
    });

    expect(alerts.comms.notificationCount).toBe(1);
    expect(alerts.seo.notificationCount).toBe(3);
    expect(alerts.reporting.notificationCount).toBe(3);
    expect(alerts.actions.notificationCount).toBe(4);
  });
});
