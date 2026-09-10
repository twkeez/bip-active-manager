import { describe, expect, it } from "vitest";
import {
  SERVICE_OFF,
  SERVICE_PLAN_OPTIONS,
  currentChoice,
  diffPlan,
  onboardingItemsAtRisk,
  type ServicePlan,
} from "@/lib/services/plan-edit";

const option = (service: string) => SERVICE_PLAN_OPTIONS.find((o) => o.service === service)!;
const plan = (over: Partial<ServicePlan>): ServicePlan => ({
  seo: "N",
  ppc: "N",
  smm: "N",
  blog: "",
  orm: "N",
  ...over,
});

describe("currentChoice", () => {
  it("reads every stored spelling of 'not bought' as off", () => {
    for (const stored of ["N", "", "0", null, undefined, "no"]) {
      expect(currentChoice(option("seo"), stored).value, String(stored)).toBe(SERVICE_OFF);
    }
  });

  it("matches a stored tier regardless of case", () => {
    expect(currentChoice(option("seo"), "premium plus")).toEqual({
      value: "Premium Plus",
      unrecognised: false,
    });
  });

  // One live client has "Foundation" in its Blog field. Snapping it to a post
  // count on open would change the client just by looking at it.
  it("keeps a value it does not recognise, and says so", () => {
    expect(currentChoice(option("blog"), "Foundation")).toEqual({
      value: "Foundation",
      unrecognised: true,
    });
  });
});

describe("diffPlan", () => {
  it("reports nothing when nothing changed", () => {
    expect(diffPlan(plan({ seo: "Premium" }), plan({ seo: "Premium" }))).toEqual([]);
  });

  it("does not count a casing difference as a change", () => {
    expect(diffPlan(plan({ seo: "premium" }), plan({ seo: "Premium" }))).toEqual([]);
  });

  it("does not count blank-to-N as a change — both mean not bought", () => {
    expect(diffPlan(plan({ blog: "" }), plan({ blog: "N" }))).toEqual([]);
  });

  it("reports a tier change as neither added nor removed", () => {
    const [change] = diffPlan(plan({ seo: "Premium" }), plan({ seo: "Premium Plus" }));
    expect(change).toMatchObject({ service: "seo", removed: false, added: false });
  });

  it("marks a service being dropped and one being taken up", () => {
    const changes = diffPlan(
      plan({ seo: "Premium", ppc: "N" }),
      plan({ seo: "N", ppc: "Foundation" }),
    );
    expect(changes.find((c) => c.service === "seo")?.removed).toBe(true);
    expect(changes.find((c) => c.service === "ppc")?.added).toBe(true);
  });
});

describe("onboardingItemsAtRisk", () => {
  const removeSeo = diffPlan(plan({ seo: "Premium" }), plan({ seo: "N" }));
  const upgradeSeo = diffPlan(plan({ seo: "Premium" }), plan({ seo: "Premium Plus" }));

  // The case the warning exists for: the sync deletes a dropped service's
  // onboarding items, ticked ones included.
  it("flags dropping a service while onboarding is under way", () => {
    expect(onboardingItemsAtRisk(removeSeo, "active")).toHaveLength(1);
  });

  it("does not flag a tier change, which leaves the checklist alone", () => {
    expect(onboardingItemsAtRisk(upgradeSeo, "active")).toEqual([]);
  });

  it("does not flag anything once onboarding is complete — the sync no longer runs", () => {
    expect(onboardingItemsAtRisk(removeSeo, "complete")).toEqual([]);
    expect(onboardingItemsAtRisk(removeSeo, null)).toEqual([]);
  });
});
