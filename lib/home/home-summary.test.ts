import { describe, expect, it } from "vitest";
import type { ResponseReportRow } from "@/lib/basecamp/load-response-report";
import type { MonthlyListRow } from "@/lib/reporting/monthly-list";
import type { WatchRead } from "@/lib/client-watch/shape";
import {
  buildHomeSummary,
  buildHomeWatch,
  chooseHomeView,
  NO_STRATEGIST,
  predatesReportTracking,
  strategistNames,
  viewerSheetNames,
} from "./home-summary";

const report = (name: string, clientId: number | null, overrides: Partial<ResponseReportRow> = {}): ResponseReportRow => ({
  basecamp_project_id: name,
  basecamp_project_name: name,
  client_id: clientId,
  account_name: name,
  marketing_strategist: null,
  is_low_contact: false,
  is_website_only: false,
  reply_acknowledged_for_occurred_at: null,
  last_internal_at: "2026-11-20T00:00:00Z",
  last_internal_author: null,
  last_internal_author_email: null,
  last_internal_thread_title: null,
  last_internal_thread_url: null,
  last_client_at: "2026-11-10T00:00:00Z",
  last_client_author: null,
  last_client_author_email: null,
  last_client_thread_title: null,
  last_client_thread_url: null,
  client_spoke_last: false,
  days_since_our_reply: 5,
  days_since_client_contact: 15,
  ...overrides,
});

const waitingOnUs = (days: number) => ({
  client_spoke_last: true,
  days_since_client_contact: days,
  last_client_at: "2026-11-24T00:00:00Z",
});

const monthly = (clientId: number, state: MonthlyListRow["state"], strategist: string | null = "Alex"): MonthlyListRow => ({
  clientId,
  name: `Client ${clientId}`,
  strategist,
  packageValue: "Core",
  accountStatus: "active",
  state,
  sentVia: [],
  stateChangedAt: null,
  lastExportAt: null,
});

describe("buildHomeSummary", () => {
  const reportRows = [
    report("Alpha", 1, waitingOnUs(2)),
    report("Bravo", 2, waitingOnUs(9)),
    report("Charlie", 3, { ...waitingOnUs(4), reply_acknowledged_for_occurred_at: "2026-11-24T00:00:00Z" }),
    report("Delta", 4, { days_since_our_reply: 20 }),
    report("No client", null, waitingOnUs(12)),
  ];
  const monthlyRows = [monthly(1, "sent"), monthly(2, "draft"), monthly(3, "not_started", "Stephanie"), monthly(4, "reviewed", null)];
  const sheetStrategist = new Map<number, string | null>([
    [1, "Alex"],
    [2, "Alex"],
    [3, "Stephanie"],
    [4, null],
  ]);

  it("lists who's waiting on us, longest first, leaving out dismissed messages", () => {
    const summary = buildHomeSummary({ reportRows, monthlyRows, view: "all", mine: new Set(), sheetStrategist });
    expect(summary.waiting.map((row) => row.account_name)).toEqual(["No client", "Bravo", "Alpha"]);
    expect(summary.overdue).toBe(2);
    expect(summary.notHeard).toBe(1);
    expect(summary.rosterClients).toBe(5);
  });

  it("narrows everything to the viewer's assigned clients for My clients", () => {
    const summary = buildHomeSummary({ reportRows, monthlyRows, view: "mine", mine: new Set([2, 4]), sheetStrategist });
    expect(summary.waiting.map((row) => row.account_name)).toEqual(["Bravo"]);
    expect(summary.notHeard).toBe(1);
    expect(summary.reportClients).toBe(2);
    expect(summary.reportsNotSent.map((row) => row.clientId)).toEqual([2, 4]);
    expect(summary.byStrategist).toEqual([]);
  });

  it("counts reports by state and lists every one not sent", () => {
    const summary = buildHomeSummary({ reportRows, monthlyRows, view: "all", mine: new Set(), sheetStrategist });
    expect(summary.reportCounts).toEqual({ not_started: 1, draft: 1, reviewed: 1, sent: 1 });
    expect(summary.reportsNotSent.map((row) => row.clientId)).toEqual([2, 3, 4]);
  });

  it("adds up each strategist by the Master Sheet name, with no strategist last", () => {
    const summary = buildHomeSummary({ reportRows, monthlyRows, view: "all", mine: new Set(), sheetStrategist });
    expect(summary.byStrategist).toEqual([
      { strategist: "Alex", clients: 2, waitingOnUs: 2, overdue: 1, notHeard: 0, reportsNotSent: 1 },
      { strategist: "Stephanie", clients: 1, waitingOnUs: 0, overdue: 0, notHeard: 0, reportsNotSent: 1 },
      { strategist: NO_STRATEGIST, clients: 2, waitingOnUs: 1, overdue: 1, notHeard: 1, reportsNotSent: 1 },
    ]);
  });
});

describe("chooseHomeView", () => {
  it("follows the link, else shows My clients to anyone with clients assigned", () => {
    expect(chooseHomeView("all", 13)).toBe("all");
    expect(chooseHomeView("mine", 0)).toBe("mine");
    expect(chooseHomeView(undefined, 13)).toBe("mine");
    expect(chooseHomeView("anything", 0)).toBe("all");
  });
});

describe("My clients by the Master Sheet", () => {
  it("finds the viewer in a shared or single Strategist value", () => {
    expect(strategistNames("Daniel/Tom", ["tom"])).toBe(true);
    expect(strategistNames("Daniel / Tom", ["daniel"])).toBe(true);
    expect(strategistNames("Tom", ["tom"])).toBe(true);
    expect(strategistNames("Stephanie", ["tom"])).toBe(false);
    expect(strategistNames("Tommy", ["tom"])).toBe(false);
    expect(strategistNames(null, ["tom"])).toBe(false);
    expect(strategistNames("Tom", [])).toBe(false);
  });

  it("looks for the first word of the profile name, or of the email without one", () => {
    expect(viewerSheetNames({ full_name: "Tom", email: "tom@beyondindigo.com" })).toEqual(["tom"]);
    expect(viewerSheetNames({ full_name: "Hollis Murphy", email: "hollis.murphy@beyondindigo.com" })).toEqual(["hollis"]);
    expect(viewerSheetNames({ full_name: "", email: "melissa@beyondindigo.com" })).toEqual(["melissa"]);
    expect(viewerSheetNames(null)).toEqual([]);
  });
});

describe("predatesReportTracking", () => {
  it("flags months before tracking began, Nov 25 2026", () => {
    expect(predatesReportTracking("2026-10")).toBe(true);
    expect(predatesReportTracking("2026-11")).toBe(false);
    expect(predatesReportTracking("2026-12")).toBe(false);
  });
});

describe("buildHomeWatch", () => {
  const read = (clientId: number, overrides: Partial<WatchRead> = {}): WatchRead => ({
    id: clientId,
    client_id: clientId,
    read_at: "2026-11-25T13:20:00Z",
    prompt_version: "v",
    model: "m",
    window_days: 90,
    threads_read: 1,
    posts_read: 1,
    posts_without_words: 0,
    newest_post_at: "2026-11-24T00:00:00Z",
    cost_usd: null,
    owe_response: "no",
    what_we_owe: null,
    where_things_stand: null,
    open_asks: null,
    our_commitments: null,
    other_threads: null,
    latest_report_month: null,
    next_action: null,
    flags: [],
    unhappy: false,
    most_recent_thread: null,
    read_notes: null,
    error: null,
    ...overrides,
  });
  const reportRows = [
    report("Alpha", 1, waitingOnUs(2)),
    report("Alpha second project", 1),
    report("Bravo", 2),
    report("Charlie", 3, { marketing_strategist: "Stored Name" }),
    report("No client", null, waitingOnUs(12)),
  ];
  const latest = new Map([
    [1, read(1, { owe_response: "yes" })],
    [2, read(2, { unhappy: true })],
  ]);
  const sheetStrategist = new Map<number, string | null>([
    [1, "Alex"],
    [2, "Daniel/Tom"],
  ]);
  const now = new Date("2026-11-25T15:00:00Z");

  it("shows every roster client once, named by the sheet's strategist", () => {
    const watch = buildHomeWatch({ reportRows, latest, attempts: latest, view: "all", mine: new Set(), sheetStrategist, now });
    expect(watch.groups.map((g) => [g.strategist, g.rows.map((r) => r.clientId)])).toEqual([
      ["Alex", [1]],
      ["Daniel/Tom", [2]],
      ["Stored Name", [3]],
    ]);
    expect(watch.totals).toEqual({ clients: 3, oweResponse: 1, unhappy: 1, reportBehind: 0, notRead: 1 });
    expect(watch.byStrategist.get("Daniel/Tom")?.unhappy).toBe(1);
  });

  it("keeps to the viewer's clients in My clients", () => {
    const watch = buildHomeWatch({ reportRows, latest, attempts: latest, view: "mine", mine: new Set([2]), sheetStrategist, now });
    expect(watch.groups.flatMap((g) => g.rows.map((r) => r.clientId))).toEqual([2]);
    expect(watch.totals.clients).toBe(1);
  });
});
