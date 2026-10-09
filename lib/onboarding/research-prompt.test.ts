import { describe, expect, it } from "vitest";
import { buildResearchPrompt } from "@/lib/prompt";
import { buildCompetitorOffersPrompt } from "./competitor-offers";
import { competitorGuidance, practiceTypeForPrompt } from "./practice-type";
import { describeLocation, locationInstruction, researchLocationFor } from "./research-location";
import type { ClientFormData } from "@/types/onboarding";

// A made-up client in Parkville, MD. Prompts are built locally; nothing is sent anywhere.
const testClient = { city: "Parkville", state: "MD", street_address: "100 Test Rd", zip: "21234" };

function formData(location: string, practiceType: string): ClientFormData {
  return {
    practiceName: "Test Urgent Care",
    contactName: "",
    location,
    practiceType,
    numVets: "",
    services: "",
    mainGoal: "",
    challenge: "",
    budget: "",
    timeline: "",
    presence: "",
    notes: "",
    websiteUrl: "",
    googleBusinessProfileUrls: "",
    facebookUrl: "",
    instagramUrl: "",
    otherSocialUrls: "",
    practicePhone: "",
    onlineBookingUrl: "",
    serviceAreaNotes: "",
    marketingManagedBy: "",
    previousAgencyName: "",
    intakeGoals: [],
    intakeSummary: "",
  } as unknown as ClientFormData;
}

describe("research prompts carry the full location", () => {
  const located = researchLocationFor(testClient, "Baltimore County");
  if (!located.ok) throw new Error("expected a location");
  const where = located.location;

  it("market research: full address, state spelled out, urgent-care competitors", () => {
    const prompt = buildResearchPrompt(formData(describeLocation(where), practiceTypeForPrompt("urgent_care")), {
      locationInstruction: locationInstruction(where),
      competitorGuidance: competitorGuidance("urgent_care"),
      background: "Opens Nov 2026.",
    });
    expect(prompt).toContain("Location: 100 Test Rd, Parkville, MD 21234 (Baltimore County, Maryland, USA)");
    expect(prompt).toContain("Parkville, Maryland (MD), USA");
    expect(prompt).toContain("Other states may have a town called Parkville; ignore them entirely");
    expect(prompt).toContain("veterinary URGENT CARE");
    expect(prompt).toContain("REFERRAL PARTNERS");
    expect(prompt).toContain("Opens Nov 2026.");
  });

  it("competitor advertising: the same location and instruction", () => {
    const prompt = buildCompetitorOffersPrompt("Test Urgent Care", describeLocation(where), "", {
      locationInstruction: locationInstruction(where),
      practiceType: practiceTypeForPrompt("urgent_care"),
    });
    expect(prompt).toContain("a veterinary URGENT CARE (same-day urgent visits; not a general practice) in 100 Test Rd, Parkville, MD 21234");
    expect(prompt).toContain("Parkville, Maryland (MD), USA");
  });

  it("the standalone Vet Onboarding prompt gets nothing added", () => {
    const prompt = buildResearchPrompt(formData("Austin, TX", "General Practice"));
    expect(prompt).not.toContain("LOCATION (read carefully)");
    expect(prompt.endsWith("Base findings on current web search results.")).toBe(true);
    expect(buildCompetitorOffersPrompt("X", "Austin", "")).not.toContain("LOCATION (read carefully)");
  });
});
