import { describe, expect, it } from "vitest";
import { applyClientWording, clientWordingValues } from "./client-wording";

const copy =
  "We see which clicks lead to {{conversion_one|a call, booking or form}}. " +
  "{{ad_spend|Most practices on this plan spend between $400 and $1,000 a month on the ads.}} " +
  "Google learns which searches bring in {{conversions_and|calls and bookings}}. " +
  "Each {{conversion_each|call or booking}}. ({{search_cost_note|emergency and specialty searches tend to cost more per click than routine care}}) " +
  "Hi {{client_name}}.";

describe("client wording placeholders", () => {
  it("reads exactly like the house copy when nothing is filled in", () => {
    expect(applyClientWording(copy, clientWordingValues({}))).toBe(
      "We see which clicks lead to a call, booking or form. Most practices on this plan spend between $400 and $1,000 a month on the ads. " +
        "Google learns which searches bring in calls and bookings. Each call or booking. " +
        "(emergency and specialty searches tend to cost more per click than routine care) Hi {{client_name}}.",
    );
  });

  it("uses an urgent care's budget, conversions and search costs", () => {
    const text = applyClientWording(
      copy,
      clientWordingValues({ adBudget: "$400–$700", conversionTypes: ["walk_ins", "phone_calls", "directions"], practiceType: "urgent_care" }),
    );
    expect(text).toContain("lead to a phone call, a walk-in visit or a request for directions.");
    expect(text).toContain("The ad budget we agreed with you is $400–$700 a month.");
    expect(text).toContain("bring in calls, walk-ins and requests for directions.");
    expect(text).toContain("Each call, walk-in or directions request.");
    expect(text).toContain("urgent and emergency searches, the ones your ads will mostly show up for");
    expect(text).not.toContain("booking");
  });

  it("doesn't say 'a month' twice", () => {
    expect(clientWordingValues({ adBudget: "$500/month" }).ad_spend).toBe("The ad budget we agreed with you is $500/month.");
  });
});
