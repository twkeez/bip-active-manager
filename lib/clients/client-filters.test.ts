import { describe, expect, it } from "vitest";
import {
  clientMatchesOnboardingFilter,
  clientMatchesServiceFilter,
  clientMatchesStatusFilter,
  filterClients,
} from "@/lib/clients/client-filters";
import type { ClientRow } from "@/lib/types/client";

function client(partial: Partial<ClientRow> & Pick<ClientRow, "id" | "account_name">): ClientRow {
  return {
    marketing_strategist: null,
    total_package_hours: null,
    hours_for_strategist: null,
    blog: null,
    smm: null,
    seo: null,
    ppc: null,
    orm: null,
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
    created_at: "2026-01-01T00:00:00Z",
    ...partial,
  };
}

describe("client list filters", () => {
  const rows = [
    client({
      id: 1,
      account_name: "Alpha Vet",
      seo: "Foundation",
      ppc: "N",
      basecamp_project_id: "123",
      needs_reply: false,
      reply_acknowledged_at: "2026-05-01T00:00:00Z",
    }),
    client({
      id: 4,
      account_name: "Delta Pet",
      seo: "N",
      ppc: "N",
      basecamp_project_id: "789",
      needs_reply: false,
      reply_acknowledged_at: null,
    }),
    client({
      id: 2,
      account_name: "Beta Clinic",
      seo: "N",
      ppc: "Premium",
      basecamp_project_id: null,
      needs_reply: true,
    }),
    client({
      id: 3,
      account_name: "Gamma Hospital",
      seo: "N",
      ppc: "N",
      basecamp_project_id: "456",
      tier: "Low Contact",
    }),
  ];

  it("filters by name, status, and services", () => {
    expect(
      filterClients(rows, {
        search: "beta",
        statusFilter: "",
        serviceFilters: [],
        onboardingFilter: "",
      }).map((row) => row.id),
    ).toEqual([2]);

    expect(
      filterClients(rows, {
        search: "",
        statusFilter: "Awaiting",
        serviceFilters: [],
        onboardingFilter: "",
      }).map((row) => row.id),
    ).toEqual([2]);

    expect(
      filterClients(rows, {
        search: "",
        statusFilter: "Paused",
        serviceFilters: [],
        onboardingFilter: "",
      }).map((row) => row.id),
    ).toEqual([3]);

    expect(
      filterClients(rows, {
        search: "",
        statusFilter: "",
        serviceFilters: ["seo"],
        onboardingFilter: "",
      }).map((row) => row.id),
    ).toEqual([1]);

    expect(
      filterClients(rows, {
        search: "",
        statusFilter: "",
        serviceFilters: ["ads"],
        onboardingFilter: "",
      }).map((row) => row.id),
    ).toEqual([2]);

    expect(
      filterClients(rows, {
        search: "",
        statusFilter: "",
        serviceFilters: ["comms"],
        onboardingFilter: "",
      }).map((row) => row.id),
    ).toEqual([1, 4, 3]);
  });

  it("matches individual service and status helpers", () => {
    expect(clientMatchesServiceFilter(rows[0]!, "seo")).toBe(true);
    expect(clientMatchesServiceFilter(rows[2]!, "comms")).toBe(false);
    expect(clientMatchesStatusFilter(rows[2]!, "Awaiting")).toBe(true);
    expect(clientMatchesStatusFilter(rows[0]!, "Active")).toBe(false);
    expect(clientMatchesStatusFilter(rows[0]!, "Pending")).toBe(true);
  });

  it("excludes acknowledged Pending clients from Awaiting filter", () => {
    expect(
      filterClients(rows, {
        search: "",
        statusFilter: "Awaiting",
        serviceFilters: [],
        onboardingFilter: "",
      }).map((row) => row.id),
    ).toEqual([2]);

    expect(
      filterClients(rows, {
        search: "",
        statusFilter: "Pending",
        serviceFilters: [],
        onboardingFilter: "",
      }).map((row) => row.id),
    ).toEqual([1]);
  });

  it("filters by onboarding status", () => {
    const onboardingRows = [
      client({ id: 10, account_name: "Onboarding Active", onboarding_status: "active" }),
      client({ id: 11, account_name: "Onboarding Complete", onboarding_status: "complete" }),
      client({ id: 12, account_name: "Not Started", onboarding_status: null }),
    ];

    expect(
      filterClients(onboardingRows, {
        search: "",
        statusFilter: "",
        serviceFilters: [],
        onboardingFilter: "active",
      }).map((row) => row.id),
    ).toEqual([10]);

    expect(clientMatchesOnboardingFilter(onboardingRows[2]!, "not_started")).toBe(true);
    expect(clientMatchesOnboardingFilter(onboardingRows[0]!, "not_started")).toBe(false);
  });
});
