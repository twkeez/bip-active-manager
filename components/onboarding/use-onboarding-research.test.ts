import { describe, expect, it } from "vitest";
import { researchSteps } from "./use-onboarding-research";
import type { OnboardingDetails } from "@/lib/onboarding/onboarding-details";

const details = (overrides: Partial<OnboardingDetails> = {}): OnboardingDetails => ({
  accountName: "The Vet's Pet Hospital of Tiburon",
  website: "",
  city: "Tiburon",
  state: "CA",
  strategist: "",
  services: { seo: "Premium", ppc: "Premium", smm: "N", blog: "N", orm: "N" },
  starts: {
    seo: { startTrigger: "at_launch", startDate: null },
    ppc: { startTrigger: "at_splash", startDate: null },
    smm: { startTrigger: "start_now", startDate: null },
    blog: { startTrigger: "start_now", startDate: null },
    orm: { startTrigger: "start_now", startDate: null },
  },
  webStatus: "splash_then_full",
  websiteLaunchDate: "",
  kickoffDate: "",
  ...overrides,
});
const none = { discoveryAt: null, competitorAdsAt: null, campaignPlanAt: null, brandElementsAt: null, keywordCount: 0 };

describe("researchSteps", () => {
  it("offers only the research the client's services need", () => {
    const applies = researchSteps(details(), none, null).filter((s) => s.applies).map((s) => s.key);
    // Tiburon: SEO and Ads, no Social — so no brand assets.
    expect(applies).toEqual(["basecamp", "discovery", "competitors", "keywords", "campaign"]);
  });

  it("says what is missing instead of failing later", () => {
    const steps = researchSteps(details({ city: "", website: "", services: { seo: "N", ppc: "N", smm: "Premium", blog: "N", orm: "N" } }), none, null);
    expect(steps.find((s) => s.key === "discovery")?.blockedBy).toBe("Add the town first");
    expect(steps.find((s) => s.key === "brand")?.blockedBy).toBe("Add the website first");
  });

  it("marks research done from what is already saved", () => {
    const steps = researchSteps(details(), { ...none, discoveryAt: "2026-09-16T12:00:00Z", keywordCount: 5 }, "2026-09-16T11:00:00Z");
    expect(steps.filter((s) => s.done).map((s) => s.key)).toEqual(["basecamp", "discovery", "keywords"]);
  });
});
