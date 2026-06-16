export type DrawerTabId =
  | "connections"
  | "comms"
  | "reporting"
  | "seo"
  | "ads"
  | "sitemaps"
  | "social"
  | "actions";

export type DrawerTabAlertState = {
  hasAlert?: boolean;
  notificationCount?: number;
};

export function countCriticalFindings(
  findings: Array<{ channel: string; severity: string }>,
  channel?: string,
) {
  return findings.filter(
    (finding) =>
      finding.severity === "critical" && (channel == null || finding.channel === channel),
  ).length;
}

export function computeDrawerTabAlerts(params: {
  needsReply: boolean;
  reportingAlertCount: number;
  staleSourceCount: number;
  seoCriticalCount: number;
  adsCriticalCount: number;
  sitemapCriticalCount: number;
  socialCriticalCount: number;
  totalCriticalCount: number;
}): Record<DrawerTabId, DrawerTabAlertState> {
  const commsCount = params.needsReply ? 1 : 0;
  const reportingCount = params.reportingAlertCount + params.staleSourceCount;
  const seoCount = params.seoCriticalCount;
  const adsCount = params.adsCriticalCount;
  const sitemapCount = params.sitemapCriticalCount;
  const socialCount = params.socialCriticalCount;
  const actionsCount = params.totalCriticalCount;

  return {
    connections: {},
    comms: {
      hasAlert: commsCount > 0,
      notificationCount: commsCount > 0 ? commsCount : undefined,
    },
    reporting: {
      hasAlert: reportingCount > 0,
      notificationCount: reportingCount > 0 ? reportingCount : undefined,
    },
    seo: {
      hasAlert: seoCount > 0,
      notificationCount: seoCount > 0 ? seoCount : undefined,
    },
    ads: {
      hasAlert: adsCount > 0,
      notificationCount: adsCount > 0 ? adsCount : undefined,
    },
    sitemaps: {
      hasAlert: sitemapCount > 0,
      notificationCount: sitemapCount > 0 ? sitemapCount : undefined,
    },
    social: {
      hasAlert: socialCount > 0,
      notificationCount: socialCount > 0 ? socialCount : undefined,
    },
    actions: {
      hasAlert: actionsCount > 0,
      notificationCount: actionsCount > 0 ? actionsCount : undefined,
    },
  };
}
