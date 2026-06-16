import { describe, expect, it } from "vitest";
import { isClientMarketingTracked } from "@/lib/clients/marketing-tracked";
import type { ClientRow } from "@/lib/types/client";

function client(overrides: Partial<ClientRow> = {}): ClientRow {
  return {
    id: 1,
    account_name: "Test Client",
    marketing_strategist: null,
    total_package_hours: null,
    hours_for_strategist: null,
    blog: "N",
    smm: "N",
    seo: "N",
    ppc: "N",
    orm: "N",
    ads_customer_id: null,
    ga4_id: null,
    sc_url: null,
    website: null,
    ga4_property_id: null,
    google_place_id: null,
    basecamp_project_id: null,
    harvest_project_id: null,
    harvest_client_id: null,
    tier: null,
    last_communication_at: null,
    last_event_is_internal: null,
    needs_reply: false,
    reply_acknowledged_at: null,
    reply_acknowledged_for_occurred_at: null,
    days_stale: null,
    onboarding_status: null,
    onboarding_started_at: null,
    onboarding_completed_at: null,
    onboarding_target_date: null,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

describe("isClientMarketingTracked", () => {
  it("returns false for Low Contact tier with no active services", () => {
    expect(
      isClientMarketingTracked(
        client({
          tier: "Low Contact",
          seo: "N",
          ppc: "N",
          smm: "N",
          blog: "N",
          orm: "N",
        }),
      ),
    ).toBe(false);
  });

  it("returns true when any marketing service is active", () => {
    expect(isClientMarketingTracked(client({ seo: "Premium" }))).toBe(true);
    expect(isClientMarketingTracked(client({ ppc: "Yes" }))).toBe(true);
  });

  it("returns true when onboarding is active even without services", () => {
    expect(
      isClientMarketingTracked(
        client({
          tier: "Low Contact",
          onboarding_status: "active",
        }),
      ),
    ).toBe(true);
  });

  it("returns false for non-low-contact client with no active services and no onboarding", () => {
    expect(
      isClientMarketingTracked(
        client({
          tier: "Enterprise",
          seo: "N",
          ppc: "N",
        }),
      ),
    ).toBe(false);
  });
});
