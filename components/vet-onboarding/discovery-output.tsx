"use client";

import { useState } from "react";
import ClientOutputView from "@/components/vet-onboarding/client-output-view";
import { formatDisplayDate } from "@/components/vet-onboarding/output-helpers";
import OutputPrintStyles from "@/components/vet-onboarding/output-print-styles";
import OutputViewToggle, {
  type OutputViewMode,
} from "@/components/vet-onboarding/output-view-toggle";
import { ReportDocumentShell } from "@/components/vet-onboarding/report/report-chrome";
import StrategyOutputView from "@/components/vet-onboarding/strategy-output-view";
import type {
  ClientFormData,
  DiscoveryFormData,
  DiscoveryReport,
  OnboardingPlan,
} from "@/types/onboarding";

interface DiscoveryOutputProps {
  plan: OnboardingPlan;
  discovery: DiscoveryReport;
  clientName: string;
  intakeGoals?: string[];
  clientFormData?: ClientFormData;
  discoveryFormData?: DiscoveryFormData;
}

export default function DiscoveryOutput({
  plan,
  discovery,
  clientName,
  intakeGoals = [],
  clientFormData,
  discoveryFormData,
}: DiscoveryOutputProps) {
  const [view, setView] = useState<OutputViewMode>("client");
  const formattedDate = formatDisplayDate();
  const mainGoal =
    clientFormData?.mainGoal ||
    (intakeGoals.length > 0 ? intakeGoals[0] : undefined);

  return (
    <div
      className="vet-output-shell mx-auto max-w-4xl font-sans"
      data-output-view={view}
    >
      <OutputPrintStyles />

      <OutputViewToggle view={view} onChange={setView} />

      <ReportDocumentShell>
        {view === "client" ? (
          <ClientOutputView
            plan={plan}
            practiceName={clientName}
            contactName={clientFormData?.contactName}
            location={clientFormData?.location}
            mainGoal={mainGoal}
            priorityFocus={discovery.capacityStrategy || plan.serviceStrategy}
            formattedDate={formattedDate}
            discovery={discovery}
            onSwitchView={() => setView("strategy")}
          />
        ) : (
          <StrategyOutputView
            plan={plan}
            practiceName={clientName}
            formattedDate={formattedDate}
            discovery={discovery}
            clientFormData={clientFormData}
            discoveryFormData={discoveryFormData}
            onSwitchView={() => setView("client")}
          />
        )}
      </ReportDocumentShell>
    </div>
  );
}
