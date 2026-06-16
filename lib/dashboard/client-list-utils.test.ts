import { describe, expect, it } from "vitest";
import { computeListUrgencyScore, buildListTechnicalSummary } from "@/lib/dashboard/client-list-utils";
import type { ClientFreshness, SignalSummary } from "@/lib/dashboard/snapshot-queries";
import type { ClientRow } from "@/lib/types/client";

function client(overrides: Partial<ClientRow> = {}): ClientRow {
  return {
    id: 1,
    account_name: "Test Client",
    marketing_strategist: null,
    total_package_hours: null,
    hours_for_strategist: null,
    blog: null,
    smm: null,
    seo: null,
    ppc: null,
    orm: null,
    ads_customer_id: "123",
    ga4_id: null,
    sc_url: "https://example.com",
    website: null,
    ga4_property_id: null,
    google_place_id: null,
    basecamp_project_id: null,
    harvest_project_id: null,
    harvest_client_id: null,
    tier: null,
    needs_reply: false,
    reply_acknowledged_at: null,
    reply_acknowledged_for_occurred_at: null,
    days_stale: null,
    last_communication_at: null,
    last_event_is_internal: null,
    onboarding_status: null,
    onboarding_started_at: null,
    onboarding_completed_at: null,
    onboarding_target_date: null,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

describe("computeListUrgencyScore", () => {
  it("scores higher when ads and gsc have critical signals", () => {
    const baseClient = client();
    const technical = buildListTechnicalSummary(baseClient);
    const gscSignals: SignalSummary = {
      total: 2,
      criticalCount: 1,
      watchCount: 1,
      hasCritical: true,
    };
    const adsSignals: SignalSummary = {
      total: 1,
      criticalCount: 1,
      watchCount: 0,
      hasCritical: true,
    };
    const score = computeListUrgencyScore({
      client: baseClient,
      technical,
      gscSignals,
      adsSignals,
      freshness: {
        adsUpdatedAt: null,
        gscUpdatedAt: null,
        lighthouseFetchedAt: null,
        crawlUpdatedAt: null,
        sitemapUpdatedAt: null,
        socialCreatedAt: null,
        gbpUpdatedAt: null,
      },
    });
    expect(score).toBeGreaterThan(20);
  });

  it("adds stale source weight from freshness timestamps", () => {
    const staleDate = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString();
    const freshness: ClientFreshness = {
      adsUpdatedAt: staleDate,
      gscUpdatedAt: staleDate,
      lighthouseFetchedAt: null,
      crawlUpdatedAt: null,
      sitemapUpdatedAt: null,
      socialCreatedAt: null,
      gbpUpdatedAt: null,
    };
    const withStale = computeListUrgencyScore({
      client: client(),
      technical: buildListTechnicalSummary(client()),
      gscSignals: undefined,
      adsSignals: undefined,
      freshness,
    });
    const withoutStale = computeListUrgencyScore({
      client: client(),
      technical: buildListTechnicalSummary(client()),
      gscSignals: undefined,
      adsSignals: undefined,
      freshness: {
        adsUpdatedAt: null,
        gscUpdatedAt: null,
        lighthouseFetchedAt: null,
        crawlUpdatedAt: null,
        sitemapUpdatedAt: null,
        socialCreatedAt: null,
        gbpUpdatedAt: null,
      },
    });
    expect(withStale).toBeGreaterThan(withoutStale);
  });
});
