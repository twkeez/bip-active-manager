import type { StepModule } from "./types";
import {
  CommsWelcomeStep,
  DefaultStep,
  DiscoveryStep,
  KickoffMeetingStep,
  ProfileStep,
  ServicesStep,
} from "./steps/foundation-steps";
import { BaselineRankingsStep, KeywordsStep, SiteAuditStep } from "./steps/seo-steps";
import { CampaignPlanStep, CompetitorAdsStep } from "./steps/ppc-steps";
import { BlogScheduleStep, BrandAssetsStep } from "./steps/social-blog-steps";

// Every step module except the Default fallback. Order is not significant —
// each module matches its own specific verification string.
export const STEP_MODULES: StepModule[] = [
  ProfileStep,
  ServicesStep,
  DiscoveryStep,
  KickoffMeetingStep,
  CommsWelcomeStep,
  KeywordsStep,
  SiteAuditStep,
  BaselineRankingsStep,
  CompetitorAdsStep,
  CampaignPlanStep,
  BrandAssetsStep,
  BlogScheduleStep,
];

// Resolve a step's verification string to the module that renders its Action,
// falling back to the DefaultStep (manual toggle / self-verifying + actionTab).
export function moduleForVerification(verification: string): StepModule {
  return STEP_MODULES.find((m) => m.match(verification)) ?? DefaultStep;
}
