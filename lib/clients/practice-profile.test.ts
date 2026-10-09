import { describe, expect, it } from "vitest";
import { profilePatch, websiteStageOf } from "./practice-profile";

describe("practice profile fields", () => {
  it("accepts good values, keeps the old switch in step, and clears empties", () => {
    expect(
      profilePatch({ practice_type: "urgent_care", website_stage: "splash_live", ad_budget_monthly: " $400–$700 ", practice_opening_date: "2026-11-02", conversion_types: ["walk_ins", "phone_calls"] }),
    ).toEqual({
      patch: {
        practice_type: "urgent_care",
        website_stage: "splash_live",
        awaiting_website_launch: true,
        ad_budget_monthly: "$400–$700",
        practice_opening_date: "2026-11-02",
        conversion_types: ["phone_calls", "walk_ins"],
      },
    });
    expect(profilePatch({ practice_type: "", conversion_types: [] })).toEqual({ patch: { practice_type: null, conversion_types: null } });
    expect(profilePatch({ website_stage: "launched" })).toEqual({ patch: { website_stage: "launched", awaiting_website_launch: false } });
  });

  it("refuses unknown values", () => {
    expect(profilePatch({ practice_type: "zoo" })).toMatchObject({ error: expect.stringContaining("zoo") });
    expect(profilePatch({ conversion_types: ["fax"] })).toMatchObject({ error: expect.stringContaining("fax") });
    expect(profilePatch({ practice_opening_date: "next week" })).toMatchObject({ error: expect.any(String) });
  });

  it("reads clients from before the stages existed as before", () => {
    expect(websiteStageOf({ awaiting_website_launch: false })).toBe("launched");
    expect(websiteStageOf({ awaiting_website_launch: true })).toBe("building");
    expect(websiteStageOf({ website_stage: "splash_live", awaiting_website_launch: true })).toBe("splash_live");
  });
});
