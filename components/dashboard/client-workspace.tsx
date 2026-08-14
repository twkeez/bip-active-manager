"use client";
import ClientWorkspaceTabs from "@/components/dashboard/client-workspace/client-workspace-tabs";
import ClientSimpleTabView, { SIMPLE_TABS } from "@/components/dashboard/client-simple-tab-view";
import ClientOverview from "@/components/dashboard/client-overview";
import type { ClientOverviewExtras } from "@/lib/dashboard/load-client-overview-extras";
import type { BasecampSyncState } from "@/lib/types/client";
import { workspaceDataToManagerProps } from "@/lib/dashboard/load-client-workspace-data";
import type {
  ClientDetailTab,
  ClientWorkspaceInitialData,
} from "@/lib/dashboard/client-workspace-types";
import type { StrategistContact } from "@/lib/team/strategist-roster";

type ClientWorkspaceProps = ClientWorkspaceInitialData & {
  userEmail?: string;
  initialTab?: ClientDetailTab | null;
  syncState?: BasecampSyncState | null;
  strategistRoster?: StrategistContact[];
  appUrl?: string;
  isAdminUser?: boolean;
  overviewExtras: ClientOverviewExtras;
};

export default function ClientWorkspace({
  userEmail,
  initialTab = null,
  syncState = null,
  strategistRoster = [],
  appUrl,
  isAdminUser = false,
  overviewExtras,
  ...data
}: ClientWorkspaceProps) {
  // Simple tabs — clean shell, no client-manager
  if (initialTab && SIMPLE_TABS.has(initialTab)) {
    return (
      <ClientSimpleTabView
        data={data}
        activeTab={initialTab}
        userEmail={userEmail}
        strategistRoster={strategistRoster}
        appUrl={appUrl}
      />
    );
  }

  // Data-heavy tabs — existing system handles sync operations and state
  if (initialTab && !SIMPLE_TABS.has(initialTab)) {
    const managerProps = workspaceDataToManagerProps(data);
    return (
      <ClientWorkspaceTabs
        {...managerProps}
        userEmail={userEmail}
        syncState={syncState}
        initialDetailTab={initialTab === "overview" ? null : initialTab}
      />
    );
  }

  // Default landing: the redesigned widget-driven client overview.
  return (
    <ClientOverview data={data} extras={overviewExtras} isAdminUser={isAdminUser} />
  );
}
