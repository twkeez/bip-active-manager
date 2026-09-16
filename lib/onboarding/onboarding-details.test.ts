import { describe, expect, it } from "vitest";
import type { PipelineIntake } from "@/lib/onboarding/pipeline-intake";
import {
  DetailsError,
  detailsFromPipeline,
  intakeFieldsFromDetails,
  parseDetails,
  splitLocation,
  websiteHost,
} from "./onboarding-details";

const tiburon: PipelineIntake = {
  formType: "new_client",
  contractSigned: true,
  practiceName: "The Vet's Pet Hospital of Tiburon",
  ownerName: "Dr. Louise Rathjen",
  location: "Tiburon, CA",
  primaryContactName: "Kristina Kolenko",
  primaryContactEmail: null,
  primaryContactPhone: null,
  pims: null,
  websiteUrl: null,
  website: null,
  webStatus: "splash_then_full",
  websiteLaunchDate: null,
  services: {
    seo: { tier: "premium", startTrigger: "at_launch", startDate: null, notes: null },
    ppc: { tier: "premium", startTrigger: "at_splash", startDate: null, notes: null },
    smm: { tier: "none", startTrigger: "start_now", startDate: null, notes: null },
    blog: { tier: "none", startTrigger: "start_now", startDate: null, notes: null },
    orm: { tier: "none", startTrigger: "start_now", startDate: null, notes: null },
  },
  notes: "Opening date ~3 months out.",
  locationConflict: null,
} as PipelineIntake;

describe("splitLocation", () => {
  // Tiburon's client record holds "Tiburon, CA" in the town field.
  it("separates a trailing state", () => {
    expect(splitLocation("Tiburon, CA")).toEqual({ city: "Tiburon", state: "CA" });
    expect(splitLocation("Oshawa, Ontario, Canada")).toEqual({ city: "Oshawa, Ontario, Canada", state: "" });
    expect(splitLocation(null)).toEqual({ city: "", state: "" });
  });
});

describe("detailsFromPipeline", () => {
  it("turns the parsed form into stored values and timing", () => {
    const details = detailsFromPipeline(tiburon);
    expect(details.accountName).toBe("The Vet's Pet Hospital of Tiburon");
    expect(details).toMatchObject({ city: "Tiburon", state: "CA", webStatus: "splash_then_full" });
    expect(details.services).toEqual({ seo: "Premium", ppc: "Premium", smm: "N", blog: "N", orm: "N" });
    expect(details.starts.ppc.startTrigger).toBe("at_splash");
  });
});

describe("parseDetails", () => {
  it("accepts what the page sends and fills the gaps", () => {
    const details = parseDetails({
      ...detailsFromPipeline(tiburon),
      state: "ca",
      kickoffDate: "2026-09-16",
      injected: "ignored",
    });
    expect(details.state).toBe("CA");
    expect(details.kickoffDate).toBe("2026-09-16");
    expect(details).not.toHaveProperty("injected");
  });

  it("insists on a name and on real dates", () => {
    expect(() => parseDetails({ accountName: "  " })).toThrow(DetailsError);
    expect(() => parseDetails({ accountName: "X", kickoffDate: "next week" })).toThrow(/date/);
  });

  it("treats an unknown start trigger as starting now rather than storing it", () => {
    expect(parseDetails({ accountName: "X", starts: { seo: { startTrigger: "whenever" } } }).starts.seo.startTrigger).toBe(
      "start_now",
    );
  });
});

describe("intakeFieldsFromDetails", () => {
  it("keeps each service's timing beside its plan", () => {
    const fields = intakeFieldsFromDetails(detailsFromPipeline(tiburon));
    expect(fields.service_start_plan.ppc).toEqual({ tier: "premium", startTrigger: "at_splash", startDate: null });
    expect(fields.service_start_plan.smm.tier).toBe("none");
    expect(fields.web_status).toBe("splash_then_full");
    expect(fields.kickoff_meeting_at).toBeNull();
  });
});

describe("websiteHost", () => {
  it("normalises a website for duplicate checks", () => {
    expect(websiteHost("https://www.PawsVC.com/")).toBe("pawsvc.com");
    expect(websiteHost("pawsvc.com")).toBe("pawsvc.com");
    expect(websiteHost("")).toBe("");
  });
});
