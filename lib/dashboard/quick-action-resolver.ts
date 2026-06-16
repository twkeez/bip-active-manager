import type { DrawerTabId } from "@/lib/dashboard/drawer-tab-alerts";
import type { ReportingActionItem } from "@/lib/reporting/types";

export type QuickActionContext = {
  onAcknowledgeReply: () => void;
  onOpenTab: (tab: DrawerTabId) => void;
  onEditClient: () => void;
  onSyncAds: () => void;
  onSyncSearchConsole: () => void;
  onSyncSitemaps: () => void;
  onSyncSocial: () => void;
  onRefreshLighthouse: () => void;
  onRunSeoCrawl: () => void;
  onSyncGbp: () => void;
  onRunAllReportingSync: () => void;
};

const TAB_LABELS: Record<DrawerTabId, string> = {
  connections: "Connections",
  comms: "Comms",
  reporting: "Reporting",
  seo: "SEO",
  ads: "Ads",
  sitemaps: "Sitemaps",
  social: "Social",
  actions: "Actions",
};

export type ResolvedQuickAction = {
  resolveLabel: string;
  onResolve: () => void;
};

export function resolveQuickAction(
  action: ReportingActionItem,
  context: QuickActionContext,
): ResolvedQuickAction {
  if (action.id === "reply-client") {
    return {
      resolveLabel: "Mark no reply needed",
      onResolve: context.onAcknowledgeReply,
    };
  }

  if (action.id === "set-sc-url" || action.id === "set-ads-id" || action.id === "set-ga4-id") {
    return {
      resolveLabel: "Edit client",
      onResolve: context.onEditClient,
    };
  }

  if (action.id === "sync-ads") {
    return { resolveLabel: "Sync Ads", onResolve: context.onSyncAds };
  }
  if (action.id === "sync-search_console") {
    return { resolveLabel: "Sync Search Console", onResolve: context.onSyncSearchConsole };
  }
  if (action.id === "sync-sitemaps") {
    return { resolveLabel: "Sync sitemaps", onResolve: context.onSyncSitemaps };
  }
  if (action.id === "sync-social") {
    return { resolveLabel: "Sync social", onResolve: context.onSyncSocial };
  }
  if (action.id === "sync-seo") {
    return {
      resolveLabel: "Refresh SEO data",
      onResolve: () => {
        context.onRefreshLighthouse();
        context.onRunSeoCrawl();
      },
    };
  }
  if (action.id === "sync-gbp") {
    return { resolveLabel: "Sync GBP", onResolve: context.onSyncGbp };
  }

  if (action.id.startsWith("sync-")) {
    return {
      resolveLabel: "Refresh reporting",
      onResolve: context.onRunAllReportingSync,
    };
  }

  if (action.id.startsWith("critical-")) {
    const match = action.title.match(/critical (.+) issue/i);
    const raw = (match?.[1] ?? "").toLowerCase();
    let tab: DrawerTabId = "actions";
    if (raw.includes("search") || raw.includes("seo")) tab = "seo";
    else if (raw.includes("ads")) tab = "ads";
    else if (raw.includes("social")) tab = "social";
    else if (raw.includes("sitemap")) tab = "sitemaps";
    return {
      resolveLabel: `Open ${TAB_LABELS[tab]}`,
      onResolve: () => context.onOpenTab(tab),
    };
  }

  return {
    resolveLabel: "View actions",
    onResolve: () => context.onOpenTab("actions"),
  };
}
