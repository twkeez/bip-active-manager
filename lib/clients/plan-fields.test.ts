import { describe, expect, it } from "vitest";
import { changedPlanFields } from "./plan-fields";

describe("changedPlanFields", () => {
  it("ignores patches that touch no plan field", () => {
    expect(changedPlanFields({ contact_name: "Dr. Riff" }, { seo: "Premium" })).toEqual([]);
  });

  it("ignores a plan field resent with its current value", () => {
    expect(changedPlanFields({ seo: "Premium", ppc: null }, { seo: "Premium", ppc: "" })).toEqual([]);
  });

  it("reports a service being changed, added or removed", () => {
    expect(
      changedPlanFields(
        { seo: "Premium Plus", ppc: "Foundation", smm: null },
        { seo: "Premium", ppc: null, smm: "Premium" },
      ),
    ).toEqual(["seo", "ppc", "smm"]);
  });

  it("covers the tier column too", () => {
    expect(changedPlanFields({ tier: "Enterprise" }, { tier: "Standard" })).toEqual(["tier"]);
  });
});
