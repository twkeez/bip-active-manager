import { describe, expect, it } from "vitest";
import { buildClientContext } from "@/lib/strategy-mapper/build-client-context";
import type { StrategyMapperFormData } from "@/types/strategy-mapper";

const form: StrategyMapperFormData = {
  practiceName: "Bayside Animal Hospital",
  practiceOwnerName: "",
  streetAddress: "123 Main St, Howell, NJ",
  locationNotes: "",
  specializations: ["Small Animal"],
  customSpecialization: "",
  activeServices: ["seo"],
  primaryGoal: "General new client acquisition / Market dominance",
  strategicContextNotes: "",
  salesPdfExtract: {
    summary: "",
    painPoints: [],
    goals: [],
    agencyFrustrations: [],
    purchasedServices: ["seo", "ppc"],
    purchasedProductLabels: [],
    clinicalDifferentiator: "",
    primaryProcedures: [],
    clientRunsOwnAds: false,
    adsPerformanceNote: "",
    vendorPlatforms: [],
    ormProgramName: "",
    socialContentThemes: [],
    primarySocialPlatform: "",
    socialAdsHistory: "",
    operationalBottlenecks: [],
    capacityNotes: "",
    vendorFrustrations: [],
    staffConstraints: "",
    doctorCount: "",
    clientPersonaTone: "standard",
  },
};

describe("buildClientContext", () => {
  it("derives active Phase 1 services from form selection", () => {
    const ctx = buildClientContext(form);
    expect(ctx.activePhase1Services).toEqual(["seo"]);
    expect(ctx.unselectedPhase2Upsells).toEqual(["ppc", "orm", "social"]);
    expect(ctx.siteContext).toBe("existing_active");
    expect(ctx.extract?.purchasedServices).toEqual(["seo", "ppc"]);
  });
});
