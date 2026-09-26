import { describe, expect, it } from "vitest";
import { applyPrefill } from "./apply-prefill";
import { INITIAL_SALES_CONTEXT, INITIAL_STRATEGY_MAPPER_FORM } from "./form-options";
import type { StrategyMapperFormData } from "@/types/strategy-mapper";

function blank(): StrategyMapperFormData {
  return { ...INITIAL_STRATEGY_MAPPER_FORM, salesPdfExtract: { ...INITIAL_SALES_CONTEXT } };
}

describe("applyPrefill", () => {
  it("fills empty fields", () => {
    const { form, filled } = applyPrefill(blank(), {
      form: { practiceName: "Bayside Animal Hospital", streetAddress: "1 Main St, Howell, NJ 07731" },
      salesContext: {},
    });
    expect(form.practiceName).toBe("Bayside Animal Hospital");
    expect(form.streetAddress).toBe("1 Main St, Howell, NJ 07731");
    expect(filled).toEqual(["practiceName", "streetAddress"]);
  });

  it("never overwrites what a person typed", () => {
    const start = { ...blank(), practiceName: "Bayside Vet" };
    const { form, filled } = applyPrefill(start, {
      form: { practiceName: "Bayside Animal Hospital" },
      salesContext: {},
    });
    expect(form.practiceName).toBe("Bayside Vet");
    expect(filled).toEqual([]);
  });

  it("adds found specializations to ones already ticked", () => {
    const start = { ...blank(), specializations: ["Small Animal"] };
    const { form } = applyPrefill(start, {
      form: { specializations: ["Small Animal", "Urgent Care"] },
      salesContext: {},
    });
    expect(form.specializations).toEqual(["Small Animal", "Urgent Care"]);
  });

  it("fills empty sales context and keeps entered sales context", () => {
    const start = blank();
    start.salesPdfExtract = { ...INITIAL_SALES_CONTEXT, doctorCount: "3" };
    const { form, filled } = applyPrefill(start, {
      form: {},
      salesContext: { doctorCount: "5", primaryProcedures: ["TPLO"], clientRunsOwnAds: true },
    });
    expect(form.salesPdfExtract?.doctorCount).toBe("3");
    expect(form.salesPdfExtract?.primaryProcedures).toEqual(["TPLO"]);
    expect(form.salesPdfExtract?.clientRunsOwnAds).toBe(true);
    expect(filled).toEqual(["sales.primaryProcedures", "sales.clientRunsOwnAds"]);
  });

  it("does not mutate the form it was given", () => {
    const start = blank();
    applyPrefill(start, { form: { practiceName: "X" }, salesContext: { doctorCount: "2" } });
    expect(start.practiceName).toBe("");
    expect(start.salesPdfExtract?.doctorCount).toBe("");
  });
});
