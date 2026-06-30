import { describe, expect, it } from "vitest";
import { evaluateClientOnboarding } from "@/lib/clients/onboarding";
import type { ClientOnboardingItem } from "@/lib/clients/types";
import type { ClientRow } from "@/lib/types/client";

function baseClient(overrides: Partial<ClientRow> = {}): ClientRow {
  return {
    id: 1,
    account_name: "Test Client",
    marketing_strategist: "Alex",
    total_package_hours: 10,
    hours_for_strategist: 8,
    blog: "N",
    smm: "N",
    seo: "Premium",
    ppc: "N",
    orm: "N",
    ads_customer_id: null,
    ga4_id: null,
    sc_url: "https://searchconsole.example/sc",
    website: "https://example.com",
    ga4_property_id: null,
    google_place_id: null,
    basecamp_project_id: "12345",
    harvest_project_id: null,
    harvest_client_id: null,
    tier: "Enterprise",
    last_communication_at: new Date().toISOString(),
    last_event_is_internal: false,
    needs_reply: false,
    reply_acknowledged_at: null,
    reply_acknowledged_for_occurred_at: null,
    days_stale: 0,
    onboarding_status: "active",
    onboarding_started_at: new Date().toISOString(),
    onboarding_completed_at: null,
    onboarding_target_date: null,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

function templateItem(
  overrides: Partial<ClientOnboardingItem> & Pick<ClientOnboardingItem, "item_key" | "verification">,
): ClientOnboardingItem {
  return {
    id: 1,
    client_id: 1,
    label: overrides.label ?? overrides.item_key,
    category: overrides.category ?? "intake",
    severity: overrides.severity ?? "required",
    sort_order: overrides.sort_order ?? 1,
    required_for_graduation: overrides.required_for_graduation ?? true,
    requires_service: overrides.requires_service ?? null,
    guidance: overrides.guidance ?? null,
    completed_at: overrides.completed_at ?? null,
    completed_by: overrides.completed_by ?? null,
    notes: overrides.notes ?? null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

describe("evaluateClientOnboarding", () => {
  it("marks setup website item done when website is present", () => {
    const items = [
      templateItem({
        item_key: "conn_website",
        verification: "setup:website",
        category: "connections",
      }),
    ];
    const evaluation = evaluateClientOnboarding(baseClient(), items, {
      socialConnectionCount: 0,
      hasSeoBaseline: false,
      hasKeywordTargets: false,
      hasReportingPrefs: false,
      threadEvents: [],
    });
    const websiteItem = evaluation.items.find((row) => row.itemKey === "conn_website");
    expect(websiteItem?.done).toBe(true);
  });

  it("flags comms cadence overdue when no client touchpoint", () => {
    const items = [
      templateItem({
        item_key: "comms_weekly_cadence",
        verification: "comms:weekly_cadence",
        category: "communication",
      }),
    ];
    const evaluation = evaluateClientOnboarding(
      baseClient({
        last_communication_at: null,
        last_event_is_internal: null,
        onboarding_started_at: new Date(Date.now() - 8 * 86400000).toISOString(),
      }),
      items,
      {
        socialConnectionCount: 0,
        hasSeoBaseline: false,
        hasKeywordTargets: false,
        hasReportingPrefs: false,
        threadEvents: [],
      },
    );
    expect(evaluation.commsCadence).toBe("overdue");
  });
});
