import { describe, expect, it } from "vitest";
import { normalizeClientName } from "@/lib/clients/normalize-name";
import { diffRoster } from "@/lib/clients/roster-diff";
import { parseRosterCsv } from "@/lib/clients/roster-import";
import type { ClientRow } from "@/lib/types/client";

function client(id: number, name: string): ClientRow {
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
    created_at: new Date().toISOString(),
  };
}

describe("normalizeClientName", () => {
  it("normalizes trailing plus and punctuation", () => {
    expect(normalizeClientName("Valley Pet Surgery +")).toBe(
      normalizeClientName("Valley Pet Surgery"),
    );
  });
});

describe("diffRoster", () => {
  it("detects add, remove, and matched clients", () => {
    const csv = [
      "Account,Website",
      "Valley Pet Surgery +,valley.com",
      "Brand New Client,new.com",
    ].join("\n");
    const sheetRows = parseRosterCsv(csv);
    const dbClients = [
      client(1, "Valley Pet Surgery"),
      client(2, "Old Departed Client"),
    ];

    const result = diffRoster(dbClients, sheetRows);
    expect(result.matched).toHaveLength(1);
    expect(result.toAdd).toHaveLength(1);
    expect(result.toAdd[0]?.accountName).toBe("Brand New Client");
    expect(result.toRemove).toHaveLength(1);
    expect(result.toRemove[0]?.account_name).toBe("Old Departed Client");
  });
});
