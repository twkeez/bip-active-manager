import { describe, expect, it } from "vitest";
import { shapeRow } from "@/lib/basecamp/response-report";
import type { RosterEntry } from "@/lib/basecamp/sheet-roster";
import { clientLine, describeRosterEntry, findRosterEntry } from "./roster";

const entry = (practiceName: string, clientId: number, clientName = practiceName): RosterEntry => ({
  practiceName,
  packageValue: "5.00",
  strategist: "Alex",
  state: "ready",
  clientId,
  clientName,
  projectId: `p${clientId}`,
  matchedBy: "name",
  candidates: [],
  sharesProjectWith: [],
});

describe("findRosterEntry", () => {
  const entries = [entry("Oak Vet", 1), entry("Oak Veterinary West", 2), entry("Birchwood Pet Hospital and Cat Clinic", 3, "Birchwood Pet Hospital")];

  it("prefers an exact name over names that contain it", () => {
    expect(findRosterEntry(entries, "oak vet").map((e) => e.clientId)).toEqual([1]);
  });
  it("finds a client by its BIP Control name as well as its sheet name", () => {
    expect(findRosterEntry(entries, "Birchwood Pet Hospital").map((e) => e.clientId)).toEqual([3]);
  });
  it("returns every candidate when the words fit several, so the caller can ask", () => {
    expect(findRosterEntry(entries, "oak").map((e) => e.clientId)).toEqual([1, 2]);
    expect(findRosterEntry(entries, "elm")).toEqual([]);
    expect(findRosterEntry(entries, "  ")).toEqual([]);
  });
});

describe("what Claude is told about a client", () => {
  const row = shapeRow({
    basecamp_project_id: "p1",
    basecamp_project_name: "P",
    client_id: 1,
    account_name: "Oak Vet",
    marketing_strategist: "Alex",
    is_low_contact: false,
    is_website_only: false,
    reply_acknowledged_for_occurred_at: null,
    last_internal_at: "2026-10-20T00:00:00Z",
    last_internal_author: "Us",
    last_internal_author_email: null,
    last_internal_thread_title: "Report",
    last_internal_thread_url: "https://example.com/t",
    last_client_at: null,
    last_client_author: null,
    last_client_author_email: null,
    last_client_thread_title: null,
    last_client_thread_url: null,
    client_spoke_last: false,
    days_since_our_reply: 35,
    days_since_client_contact: null,
  });

  it("carries the flag, the limit and why", () => {
    expect(clientLine(row)).toMatchObject({
      practice: "Oak Vet",
      bip_client_id: 1,
      flags: ["haven't heard from us"],
      who_spoke_last: "Beyond Indigo",
      days_since_our_last_post: 35,
      not_heard_limit_days: 30,
      not_heard_limit_reason: "Strategist is Alex",
      last_client_post: null,
      could_not_be_read: null,
    });
  });

  it("says plainly when a watched client is not on the roster", () => {
    expect(describeRosterEntry(null).on_master_sheet_roster).toBe(false);
    expect(describeRosterEntry(entry("Oak Vet", 1))).toMatchObject({ on_master_sheet_roster: true, strategist: "Alex" });
  });
});
