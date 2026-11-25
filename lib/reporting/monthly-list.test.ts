import { describe, expect, it } from "vitest";
import type { RosterEntry } from "@/lib/basecamp/sheet-roster";
import { buildMonthlyList } from "@/lib/reporting/monthly-list";

function entry(practiceName: string, clientId: number | null, strategist = "Stephanie"): RosterEntry {
  return {
    practiceName,
    packageValue: "SEO Premium",
    strategist,
    state: clientId == null ? "unmatched" : "ready",
    clientId,
    clientName: clientId == null ? null : practiceName,
    projectId: null,
    matchedBy: clientId == null ? null : "name",
    candidates: [],
    sharesProjectWith: [],
  };
}

const entries = [
  entry("Paws Vet", 1),
  entry("Harmony", 2, "Tom"),
  entry("Old Clinic", 3),
  entry("Nobody Matches", null),
  entry("Beacon", 4),
];

describe("buildMonthlyList", () => {
  it("lists only the clients the viewer can see, with each month's state", () => {
    const list = buildMonthlyList({
      month: "2026-10",
      entries,
      // A strategist's session reads only their own clients.
      visibleClients: [
        { id: 1, account_name: "Paws Vet" },
        { id: 4, account_name: "Beacon", last_report_run_at: "2026-10-03T10:00:00Z" },
      ],
      stored: [{ client_id: 4, status: "sent", sent_via: ["pdf"], updated_at: "2026-11-04T09:00:00Z" }],
      isAdmin: false,
    });
    expect(list.rows.map((row) => [row.name, row.state])).toEqual([
      ["Beacon", "sent"],
      ["Paws Vet", "not_started"],
    ]);
    expect(list.rows[0]).toMatchObject({ sentVia: ["pdf"], stateChangedAt: "2026-11-04T09:00:00Z", lastExportAt: "2026-10-03T10:00:00Z" });
    expect(list.counts).toEqual({ not_started: 1, draft: 0, reviewed: 0, sent: 1 });
    // Unmatched sheet rows are an admin's to fix, not a strategist's.
    expect(list.unmatched).toEqual([]);
  });

  it("leaves former clients off and names them, keeps cancelling ones, and names unmatched rows for admins", () => {
    const list = buildMonthlyList({
      month: "2026-10",
      entries,
      visibleClients: [
        { id: 1, account_name: "Paws Vet", account_status: "cancelling" },
        { id: 2, account_name: "Harmony" },
        { id: 3, account_name: "Old Clinic", account_status: "former" },
        { id: 4, account_name: "Beacon" },
      ],
      stored: [],
      isAdmin: true,
    });
    expect(list.rows.map((row) => row.name)).toEqual(["Beacon", "Harmony", "Paws Vet"]);
    expect(list.rows.find((row) => row.name === "Paws Vet")?.accountStatus).toBe("cancelling");
    expect(list.formerLeftOff).toEqual(["Old Clinic"]);
    expect(list.unmatched).toEqual(["Nobody Matches"]);
    expect(list.counts.not_started).toBe(3);
  });

  it("lists a client once even if two sheet rows point at it", () => {
    const list = buildMonthlyList({
      month: "2026-10",
      entries: [entry("Paws Vet", 1), entry("Paws Veterinary Clinic", 1)],
      visibleClients: [{ id: 1, account_name: "Paws Vet" }],
      stored: [],
      isAdmin: true,
    });
    expect(list.rows).toHaveLength(1);
  });
});
