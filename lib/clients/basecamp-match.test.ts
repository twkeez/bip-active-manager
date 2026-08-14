import { describe, expect, it } from "vitest";
import type { BasecampProjectSummary } from "@/lib/basecamp/client";
import {
  findDuplicateBasecampProjectAssignments,
  matchClientsToBasecampProjects,
} from "@/lib/clients/basecamp-match";
import { normalizeClientName } from "@/lib/clients/normalize-name";
import type { ClientRow } from "@/lib/types/client";

function client(
  id: number,
  name: string,
  basecampProjectId: string | null = null,
  overrides: Partial<ClientRow> = {},
): ClientRow {
  return {
    id,
    account_name: name,
    public_name: null,
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
    basecamp_project_id: basecampProjectId,
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

function project(id: string, name: string): BasecampProjectSummary {
  return {
    id,
    name,
    status: "active",
    normalizedName: normalizeClientName(name),
  };
}

describe("matchClientsToBasecampProjects", () => {
  it("matches clients by normalized account name", () => {
    const result = matchClientsToBasecampProjects(
      [client(1, "Valley Pet Surgery +")],
      [project("9001", "Valley Pet Surgery")],
    );
    expect(result.matched).toHaveLength(1);
    expect(result.matched[0]).toMatchObject({
      clientId: 1,
      suggestedProjectId: "9001",
      status: "matched",
    });
  });

  it("flags conflict when client has a different project ID", () => {
    const result = matchClientsToBasecampProjects(
      [client(1, "Acme Corp", "1111")],
      [project("2222", "Acme Corp")],
    );
    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0]).toMatchObject({
      currentProjectId: "1111",
      suggestedProjectId: "2222",
      status: "conflict",
    });
  });

  it("marks already_set when IDs agree", () => {
    const result = matchClientsToBasecampProjects(
      [client(1, "Acme Corp", "2222")],
      [project("2222", "Acme Corp")],
    );
    expect(result.alreadySet).toHaveLength(1);
    expect(result.matched).toHaveLength(0);
  });

  it("marks ambiguous when duplicate client names exist", () => {
    const result = matchClientsToBasecampProjects(
      [client(1, "Twin Client"), client(2, "Twin Client")],
      [project("3001", "Twin Client")],
    );
    expect(result.ambiguous).toHaveLength(2);
  });

  it("lists unmatched projects with no single client match", () => {
    const result = matchClientsToBasecampProjects(
      [client(1, "Mapped Client")],
      [project("100", "Mapped Client"), project("200", "Orphan Project")],
    );
    expect(result.matched).toHaveLength(1);
    expect(result.unmatchedProjects).toEqual([
      { projectId: "200", projectName: "Orphan Project", status: "active" },
    ]);
  });

  it("marks missing clients with no project name match", () => {
    const result = matchClientsToBasecampProjects(
      [client(1, "No Project Client", null, { seo: "Premium" })],
      [project("100", "Other Project")],
    );
    expect(result.missingClients).toHaveLength(1);
    expect(result.missingClients[0]?.status).toBe("missing");
  });

  it("excludes ignored projects from unmatched list", () => {
    const result = matchClientsToBasecampProjects(
      [client(1, "Mapped Client")],
      [project("100", "Mapped Client"), project("200", "Orphan Project")],
      { ignoredProjectIds: new Set(["200"]) },
    );
    expect(result.unmatchedProjects).toEqual([]);
    expect(result.ignoredProjects).toEqual([
      { projectId: "200", projectName: "Orphan Project", status: "active" },
    ]);
    expect(result.stats.actionableUnmatchedCount).toBe(0);
    expect(result.stats.ignoredUnmatchedCount).toBe(1);
  });

  it("skips non-marketing clients from missingClients when marketingTrackedClientsOnly is true", () => {
    const result = matchClientsToBasecampProjects(
      [
        client(1, "Marketing Client", null, { seo: "Premium" }),
        client(2, "Comms Only", null, { tier: "Low Contact" }),
      ],
      [project("100", "Other Project")],
      { marketingTrackedClientsOnly: true },
    );
    expect(result.missingClients).toHaveLength(1);
    expect(result.missingClients[0]?.clientId).toBe(1);
    expect(result.stats.nonMarketingClientsSkipped).toBe(1);
  });
});

describe("findDuplicateBasecampProjectAssignments", () => {
  it("groups clients by project ID", () => {
    const map = findDuplicateBasecampProjectAssignments([
      client(1, "A", "100"),
      client(2, "B", "100"),
      client(3, "C", "200"),
    ]);
    expect(map.get("100")).toEqual([1, 2]);
    expect(map.get("200")).toEqual([3]);
  });
});
