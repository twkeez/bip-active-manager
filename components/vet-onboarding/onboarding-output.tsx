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
import type { ClientFormData, OnboardingPlan } from "@/types/onboarding";

interface OnboardingOutputProps {
  plan: OnboardingPlan;
  clientName: string;
  intakeGoals?: string[];
  clientFormData?: ClientFormData;
  onRunDiscovery?: () => void;
}

export default function OnboardingOutput({
  plan,
  clientName,
  intakeGoals = [],
  clientFormData,
  onRunDiscovery,
}: OnboardingOutputProps) {
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
            priorityFocus={plan.serviceStrategy}
            formattedDate={formattedDate}
            onSwitchView={() => setView("strategy")}
          />
        ) : (
          <StrategyOutputView
            plan={plan}
            practiceName={clientName}
            formattedDate={formattedDate}
            clientFormData={clientFormData}
            onSwitchView={() => setView("client")}
          />
        )}
      </ReportDocumentShell>

      {onRunDiscovery ? (
        <div className="vet-output-no-print mt-6">
          <button
            type="button"
            onClick={onRunDiscovery}
            className="w-full rounded-lg bg-bip-accent px-6 py-3 text-sm font-medium text-bip-page transition hover:brightness-110"
          >
            Run Full Discovery →
          </button>
        </div>
      ) : null}
    </div>
  );
}
