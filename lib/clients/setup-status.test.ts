import { describe, expect, it } from "vitest";
import { evaluateClientSetup } from "@/lib/clients/setup-status";
import type { ClientRow } from "@/lib/types/client";

function baseClient(overrides: Partial<ClientRow> = {}): ClientRow {
  return {
    id: 1,
    account_name: "Test Client",
    marketing_strategist: "Alex",
    total_package_hours: 5,
    hours_for_strategist: 3,
    blog: "0",
    smm: "N",
    seo: "Premium Plus",
    ppc: "Foundation",
    orm: "N",
    ads_customer_id: null,
    ga4_id: null,
    sc_url: null,
    website: "example.com",
    ga4_property_id: null,
    google_place_id: null,
    basecamp_project_id: "123",
    harvest_project_id: null,
    harvest_client_id: null,
    tier: "Growth",
    last_communication_at: null,
    last_event_is_internal: null,
    needs_reply: false,
    reply_acknowledged_at: null,
    reply_acknowledged_for_occurred_at: null,
    days_stale: null,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

describe("evaluateClientSetup", () => {
  it("flags missing Search Console when SEO is active", () => {
    const result = evaluateClientSetup(baseClient({ sc_url: null }), {
      socialConnectionCount: 0,
    });
    expect(result.missingRequired.some((item) => item.id === "search_console")).toBe(true);
  });

  it("flags missing Google Ads when PPC is active", () => {
    const result = evaluateClientSetup(baseClient({ ads_customer_id: null }), {
      socialConnectionCount: 0,
    });
    expect(result.missingRequired.some((item) => item.id === "google_ads")).toBe(true);
  });

  it("skips Basecamp for Low Contact tier", () => {
    const result = evaluateClientSetup(
      baseClient({ tier: "Low Contact", basecamp_project_id: null }),
      { socialConnectionCount: 0 },
    );
    expect(result.missingRequired.some((item) => item.id === "basecamp")).toBe(false);
  });

  it("requires social connection when SMM is active", () => {
    const result = evaluateClientSetup(baseClient({ smm: "Premium", seo: "N", ppc: "N" }), {
      socialConnectionCount: 0,
    });
    expect(result.missingRequired.some((item) => item.id === "social_connection")).toBe(true);
  });
});
