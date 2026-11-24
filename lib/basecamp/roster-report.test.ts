import { describe, expect, it } from "vitest";
import type { ResponseReportRow } from "./load-response-report";
import { applyRoster, buildIntegrity, daysBetween, failedSyncProjects, readProblemOf } from "./roster-report";
import type { RosterEntry } from "./sheet-roster";

const projectRow = (projectId: string, over: Partial<ResponseReportRow> = {}): ResponseReportRow => ({
  basecamp_project_id: projectId,
  basecamp_project_name: `Project ${projectId}`,
  client_id: 900,
  account_name: `Project ${projectId}`,
  marketing_strategist: "From the client record",
  is_low_contact: false,
  is_website_only: false,
  reply_acknowledged_for_occurred_at: null,
  last_internal_at: "2026-11-01T12:00:00Z",
  last_internal_author: "Us",
  last_internal_author_email: null,
  last_internal_thread_title: null,
  last_internal_thread_url: null,
  last_client_at: "2026-11-10T12:00:00Z",
  last_client_author: "Them",
  last_client_author_email: null,
  last_client_thread_title: null,
  last_client_thread_url: null,
  client_spoke_last: true,
  days_since_our_reply: 23,
  days_since_client_contact: 14,
  ...over,
});

const entry = (practiceName: string, clientId: number, projectId: string | null, over: Partial<RosterEntry> = {}): RosterEntry => ({
  practiceName,
  packageValue: "5.00",
  strategist: "Alex",
  state: projectId ? "ready" : "no_project",
  clientId,
  clientName: practiceName,
  projectId,
  matchedBy: "name",
  candidates: [],
  sharesProjectWith: [],
  ...over,
});

describe("applyRoster", () => {
  it("gives one row per roster client and keeps other projects apart", () => {
    const { rosterRows, otherRows } = applyRoster([projectRow("p1"), projectRow("p2")], [entry("Oak Vet", 1, "p1")], []);
    expect(rosterRows.map((r) => r.account_name)).toEqual(["Oak Vet"]);
    expect(rosterRows[0]).toMatchObject({ on_roster: true, client_id: 1, row_key: "client-1", days_since_client_contact: 14 });
    expect(otherRows.map((r) => r.basecamp_project_id)).toEqual(["p2"]);
    expect(otherRows[0]!.on_roster).toBe(false);
  });

  it("takes the strategist from the sheet and the flags from the roster client", () => {
    const { rosterRows } = applyRoster(
      [projectRow("p1")],
      [entry("Oak Vet", 1, "p1", { strategist: "Daniel/Tom" })],
      [{ id: 1, is_low_contact: true, is_website_only: true, reply_acknowledged_for_occurred_at: "2026-11-11T00:00:00Z" }],
    );
    expect(rosterRows[0]).toMatchObject({
      marketing_strategist: "Daniel/Tom",
      is_low_contact: true,
      is_website_only: true,
      reply_acknowledged_for_occurred_at: "2026-11-11T00:00:00Z",
    });
  });

  it("gives each practice sharing a project its own row", () => {
    const { rosterRows, otherRows } = applyRoster(
      [projectRow("shared")],
      [
        entry("Maple Vet", 20, "shared", { sharesProjectWith: ["Maple ER"] }),
        entry("Maple ER", 18, "shared", { sharesProjectWith: ["Maple Vet"] }),
      ],
      [],
    );
    expect(rosterRows.map((r) => [r.account_name, r.client_id, r.row_key])).toEqual([
      ["Maple Vet", 20, "client-20"],
      ["Maple ER", 18, "client-18"],
    ]);
    expect(rosterRows[0]!.shares_project_with).toEqual(["Maple ER"]);
    expect(otherRows).toEqual([]);
  });

  it("reports a roster client whose project is on the ignore list", () => {
    const { rosterRows } = applyRoster([], [entry("Oak Vet", 1, "p1")], [], [projectRow("p1", { client_spoke_last: false })]);
    expect(rosterRows[0]).toMatchObject({ account_name: "Oak Vet", on_ignore_list: true, client_spoke_last: false });
  });

  it("keeps a roster client whose project has no stored posts, as no contact", () => {
    const { rosterRows } = applyRoster([], [entry("Oak Vet", 1, "p1")], []);
    expect(rosterRows).toHaveLength(1);
    expect(rosterRows[0]).toMatchObject({ last_internal_at: null, last_client_at: null, on_ignore_list: false });
  });

  it("leaves out roster rows that are not matched to a project (they are listed in the roster line)", () => {
    const { rosterRows } = applyRoster(
      [projectRow("p1")],
      [entry("No Project Vet", 2, null), entry("Unmatched Vet", 0, null, { state: "unmatched", clientId: null }), entry("Oak Vet", 1, "p1")],
      [],
    );
    expect(rosterRows.map((r) => r.account_name)).toEqual(["Oak Vet"]);
  });
});

describe("daysBetween", () => {
  it("counts calendar days, not 24-hour spans", () => {
    const now = Date.parse("2026-11-24T01:00:00Z");
    expect(daysBetween("2026-11-23T23:00:00Z", now)).toBe(1);
    expect(daysBetween("2026-11-24T00:30:00Z", now)).toBe(0);
    expect(daysBetween("2026-11-09T12:00:00Z", now)).toBe(15);
  });
});

describe("former and cancelling clients", () => {
  const flag = (id: number, account_status: string | null | undefined) => ({
    id,
    is_low_contact: false,
    is_website_only: false,
    reply_acknowledged_for_occurred_at: null,
    account_status,
    account_status_changed_at: "2026-11-24T00:00:00Z",
    account_status_changed_by: "someone@example.com",
  });

  it("moves them off the report into the excluded list, and loses nobody", () => {
    const entries = [entry("Oak Vet", 1, "p1"), entry("Elm Vet", 2, "p2"), entry("Ash Vet", 3, "p3")];
    const { rosterRows, excludedRows, otherRows } = applyRoster(
      [projectRow("p1"), projectRow("p2"), projectRow("p3")],
      entries,
      [flag(1, "active"), flag(2, "cancelling"), flag(3, "former")],
    );
    expect(rosterRows.map((r) => r.account_name)).toEqual(["Oak Vet"]);
    expect(excludedRows.map((r) => [r.account_name, r.account_status, r.account_status_changed_by])).toEqual([
      ["Elm Vet", "cancelling", "someone@example.com"],
      ["Ash Vet", "former", "someone@example.com"],
    ]);
    expect(rosterRows.length + excludedRows.length).toBe(entries.length);
    // An excluded client's project is still its own: it must not reappear as an unclaimed project.
    expect(otherRows).toEqual([]);
  });

  it("treats a missing or unknown status as active", () => {
    const { rosterRows, excludedRows } = applyRoster(
      [projectRow("p1"), projectRow("p2")],
      [entry("Oak Vet", 1, "p1"), entry("Elm Vet", 2, "p2")],
      [flag(1, undefined), flag(2, "paused")],
    );
    expect(rosterRows).toHaveLength(2);
    expect(excludedRows).toEqual([]);
  });
});

describe("integrity", () => {
  const NOW = Date.parse("2026-11-24T12:00:00Z");

  it("reads failed projects out of the sync's error text, all of them", () => {
    const text =
      "Could not list | 7 project(s) failed: project 11 (client 4): Basecamp answered 500; project 12 (client none): timed out; " +
      "project 13 (client 9): Duplicate basecamp_project_id — client 2 also points at this project.";
    const failed = failedSyncProjects(text);
    expect([...failed.keys()]).toEqual(["11", "12"]);
    expect(failed.get("11")).toBe("Basecamp answered 500");
    expect(failedSyncProjects(null).size).toBe(0);
  });

  it("explains why a row cannot be trusted", () => {
    const context = { failedProjects: new Map([["p1", "timed out"]]), now: NOW };
    expect(readProblemOf(projectRow("p1"), context)).toMatch(/last Basecamp sync failed.*timed out/);
    expect(readProblemOf(projectRow("p2", { project_last_seen_at: "2026-11-04T23:30:00Z" }), context)).toMatch(/not listed this project since 2026-11-04/);
    expect(readProblemOf(projectRow("p2", { project_last_seen_at: "2026-11-24T11:00:00Z" }), context)).toBeNull();
    expect(readProblemOf(projectRow("p3"), context)).toBeNull();
  });

  it("marks a roster client whose project the sync does not read", () => {
    const { rosterRows } = applyRoster([], [entry("Oak Vet", 1, "p1")], []);
    expect(rosterRows[0]!.read_problem).toMatch(/not in the list the sync reads/);
  });

  it("accounts for every roster client", () => {
    const entries = [
      entry("Oak Vet", 1, "p1"),
      entry("Elm Vet", 2, "p2"),
      entry("Ash Vet", 3, "p3"),
      entry("Fir Vet", 0, null, { state: "unmatched", clientId: null }),
    ];
    const rosterRows = [projectRow("p1"), projectRow("p2", { account_name: "Elm Vet", read_problem: "timed out" })];
    const integrity = buildIntegrity({ entries, rosterRows, excludedRows: [projectRow("p3")], problems: [], historyDays: 180 });
    expect(integrity).toMatchObject({ inScope: 4, reported: 1, excluded: 1, notMatched: ["Fir Vet"], complete: false });
    expect(integrity.failed).toEqual([{ name: "Elm Vet", reason: "timed out" }]);
    expect(integrity.reported + integrity.failed.length + integrity.excluded + integrity.notMatched.length).toBe(integrity.inScope);
  });

  it("is complete only when nothing is wrong", () => {
    const entries = [entry("Oak Vet", 1, "p1")];
    const ok = buildIntegrity({ entries, rosterRows: [projectRow("p1")], excludedRows: [], problems: [], historyDays: 180 });
    expect(ok.complete).toBe(true);
    const capped = buildIntegrity({ entries, rosterRows: [projectRow("p1")], excludedRows: [], problems: ["row limit hit"], historyDays: 180 });
    expect(capped.complete).toBe(false);
  });
});
