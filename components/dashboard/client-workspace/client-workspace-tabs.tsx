"use client";
import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import ClientManager from "@/components/dashboard/client-manager";
const ReportingTab = dynamic(() => import("./reporting-tab"));
const ChannelTab = dynamic(() => import("./channel-tab"));
type ClientWorkspaceTabsProps = Omit<
  ComponentProps<typeof ClientManager>,
  "mode" | "ReportingTab" | "ChannelTab"
>;
export default function ClientWorkspaceTabs(props: ClientWorkspaceTabsProps) {
  return (
    <ClientManager
      mode="workspace"
      ReportingTab={ReportingTab}
      ChannelTab={ChannelTab}
      {...props}
    />
  );
}
