"use client";
import ClientWorkspaceTabs from "@/components/dashboard/client-workspace/client-workspace-tabs";
import ClientWorkspaceDashboard from "@/components/dashboard/client-workspace-dashboard";
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
};
export default function ClientWorkspace({
  userEmail,
  initialTab = null,
  syncState = null,
  strategistRoster = [],
  appUrl,
  ...data
}: ClientWorkspaceProps) {
  const managerProps = workspaceDataToManagerProps(data);
  const showDetailView = initialTab != null && initialTab !== "profile";
  if (showDetailView) {
    return (
      <ClientWorkspaceTabs
        {...managerProps}
        userEmail={userEmail}
        syncState={syncState}
        initialDetailTab={initialTab}
      />
    );
  }
  return (
    <div className="flex min-h-screen flex-col bg-bip-card">
      
      <ClientWorkspaceDashboard
        data={data}
        userEmail={userEmail}
        strategistRoster={strategistRoster}
        appUrl={appUrl}
      />
    </div>
  );
}
