import type { ClientRow } from "@/lib/types/client";

// The client lifecycle drives the unified "Run of Show" view: a client is either
// still being onboarded, or active (graduated, in ongoing service delivery).

export type ClientStage = "onboarding" | "active";

/**
 * Derives the lifecycle stage from onboarding status:
 *  - "complete"           → active (ongoing service delivery)
 *  - "active" / not-set   → onboarding (in progress or not yet started)
 */
export function clientStage(onboardingStatus: ClientRow["onboarding_status"]): ClientStage {
  return onboardingStatus === "complete" ? "active" : "onboarding";
}

export function stageLabel(stage: ClientStage): string {
  return stage === "active" ? "Active" : "Onboarding";
}
