import { describe, expect, it } from "vitest";
import {
  buildMandatorySeoAeoTactic,
  buildSpecializationsForAeo,
  ensureMandatorySeoAeoTactic,
  AEO_TACTIC_MARKER,
} from "@/lib/strategy-mapper/seo-aeo-tactic";
import { calculateDualRadius } from "@/lib/strategy-mapper/radius";
import type { StrategyMapperFormData } from "@/types/strategy-mapper";

const baseForm: StrategyMapperFormData = {
  practiceName: "Howell Animal Hospital",
  practiceOwnerName: "Dr. Hussein",
  streetAddress: "123 Main St, Howell, NJ 07731",
  locationNotes: "",
  specializations: ["Orthopedics / Specialty"],
  customSpecialization: "",
  activeServices: ["seo"],
  primaryGoal: "General new client acquisition / Market dominance",
  strategicContextNotes: "",
};

describe("buildMandatorySeoAeoTactic", () => {
  it("incorporates practice name, specializations, and location", () => {
    const radius = calculateDualRadius({
      ...baseForm,
      siteContext: "brand_new_ground_up",
    });
    const tactic = buildMandatorySeoAeoTactic(
      { ...baseForm, siteContext: "brand_new_ground_up" },
      radius,
    );
    expect(tactic).toContain(AEO_TACTIC_MARKER);
    expect(tactic).toContain("Howell Animal Hospital");
    expect(tactic).toContain("Orthopedics / Specialty");
    expect(tactic).toContain("llms.txt");
    expect(tactic).toContain("llms-full.txt");
    expect(tactic).toContain("ChatGPT, Claude, Perplexity, and Apple Intelligence");
    expect(tactic).toContain("new website");
  });
});

describe("ensureMandatorySeoAeoTactic", () => {
  it("appends tactic when missing and dedupes when present", () => {
    const mandatory = buildMandatorySeoAeoTactic(
      baseForm,
      calculateDualRadius(baseForm),
    );
    const appended = ensureMandatorySeoAeoTactic(["Optimize GBP"], mandatory);
    expect(appended).toHaveLength(2);
    expect(appended[1]).toBe(mandatory);

    const deduped = ensureMandatorySeoAeoTactic(
      ["Optimize GBP", mandatory, "Old duplicate"],
      mandatory,
    );
    expect(deduped.filter((t) => t.includes(AEO_TACTIC_MARKER))).toHaveLength(1);
    expect(deduped[deduped.length - 1]).toBe(mandatory);
  });
});

describe("buildSpecializationsForAeo", () => {
  it("merges form specializations and primary procedures from PDF", () => {
    const specs = buildSpecializationsForAeo({
      ...baseForm,
      salesPdfExtract: {
        summary: "",
        painPoints: [],
        goals: [],
        agencyFrustrations: [],
        purchasedServices: ["seo"],
        purchasedProductLabels: [],
        clinicalDifferentiator: "",
        primaryProcedures: ["TPLO"],
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
    });
    expect(specs).toContain("Orthopedics / Specialty");
    expect(specs).toContain("TPLO");
  });
});
