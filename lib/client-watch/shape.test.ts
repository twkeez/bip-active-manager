import { describe, expect, it } from "vitest";
import type { ResponseReportRow } from "@/lib/basecamp/load-response-report";
import {
  CLIENT_WATCH_PROMPT_VERSION,
  countByStrategist,
  groupByStrategist,
  isMissingTableError,
  isReportBehind,
  NO_STRATEGIST_ON_SHEET,
  planReads,
  reportMonthLabel,
  toWatchRow,
  type WatchRead,
} from "./shape";

const report = (name: string, clientId: number, overrides: Partial<ResponseReportRow> = {}): ResponseReportRow => ({
  basecamp_project_id: name,
  basecamp_project_name: name,
  client_id: clientId,
  account_name: name,
  marketing_strategist: null,
  is_low_contact: false,
  is_website_only: false,
  reply_acknowledged_for_occurred_at: null,
  last_internal_at: "2026-11-20T00:00:00Z",
  last_internal_author: "Alex",
  last_internal_author_email: null,
  last_internal_thread_title: "October report",
  last_internal_thread_url: null,
  last_client_at: "2026-11-10T00:00:00Z",
  last_client_author: "Dr. Lee",
  last_client_author_email: null,
  last_client_thread_title: "Question",
  last_client_thread_url: null,
  client_spoke_last: false,
  days_since_our_reply: 5,
  days_since_client_contact: 15,
  ...overrides,
});

const waitingOnUs = (days: number): Partial<ResponseReportRow> => ({
  client_spoke_last: true,
  days_since_client_contact: days,
  last_client_at: "2026-11-24T00:00:00Z",
});

let nextId = 1;
const read = (clientId: number, overrides: Partial<WatchRead> = {}): WatchRead => ({
  id: nextId++,
  client_id: clientId,
  read_at: "2026-11-25T13:20:00Z",
  prompt_version: CLIENT_WATCH_PROMPT_VERSION,
  model: "m",
  window_days: 90,
  threads_read: 3,
  posts_read: 12,
  posts_without_words: 0,
  newest_post_at: "2026-11-24T00:00:00Z",
  cost_usd: 0.05,
  owe_response: "no",
  what_we_owe: null,
  where_things_stand: "Fine.",
  open_asks: null,
  our_commitments: null,
  other_threads: null,
  latest_report_month: "2026-10",
  next_action: "Send the November report.",
  flags: [],
  unhappy: false,
  most_recent_thread: null,
  read_notes: null,
  error: null,
  ...overrides,
});

const now = new Date("2026-11-25T15:00:00Z");

describe("isReportBehind", () => {
  it("calls August or earlier behind in November, and September or October not", () => {
    expect(isReportBehind("2026-08", now)).toBe(true);
    expect(isReportBehind("2026-09", now)).toBe(false);
    expect(isReportBehind("2026-10", now)).toBe(false);
  });
  it("doesn't call a client behind when no report was seen", () => {
    expect(isReportBehind(null, now)).toBe(false);
    expect(isReportBehind("", now)).toBe(false);
  });
  it("works across a year end", () => {
    expect(isReportBehind("2026-11", new Date("2027-01-10T00:00:00Z"))).toBe(false);
    expect(isReportBehind("2026-10", new Date("2027-01-10T00:00:00Z"))).toBe(true);
  });
});

describe("reportMonthLabel", () => {
  it("names the month", () => {
    expect(reportMonthLabel("2026-08")).toBe("August 2026");
    expect(reportMonthLabel(null)).toBeNull();
  });
});

describe("isMissingTableError", () => {
  it("spots the table not being there yet", () => {
    expect(isMissingTableError('relation "public.client_watch_latest" does not exist')).toBe(true);
    expect(isMissingTableError("Could not find the table 'public.client_watch_reads' in the schema cache")).toBe(true);
    expect(isMissingTableError("permission denied for table client_watch_reads")).toBe(false);
  });
});

describe("planReads", () => {
  const base = { model: "m", promptVersion: CLIENT_WATCH_PROMPT_VERSION };
  it("reads only clients where something changed", () => {
    const lastAttempts = new Map([
      [1, read(1)],
      [2, read(2, { newest_post_at: "2026-11-01T00:00:00Z" })],
      [3, read(3, { error: "timed out" })],
      [4, read(4, { prompt_version: "old" })],
    ]);
    const { due, unchanged } = planReads({
      ...base,
      lastAttempts,
      clients: [
        { clientId: 1, name: "Same", newestPostAt: "2026-11-24T00:00:00Z" },
        { clientId: 2, name: "New posts", newestPostAt: "2026-11-24T00:00:00Z" },
        { clientId: 3, name: "Failed", newestPostAt: "2026-11-24T00:00:00Z" },
        { clientId: 4, name: "Old prompt", newestPostAt: "2026-11-24T00:00:00Z" },
        { clientId: 5, name: "Never", newestPostAt: null },
      ],
    });
    expect(unchanged).toBe(1);
    expect(due.map((d) => [d.clientId, d.reason])).toEqual([
      [5, "never read"],
      [2, "new Basecamp posts"],
      [3, "last read failed"],
      [4, "instructions or model changed"],
    ]);
  });
  it("reads a client on request whatever its state", () => {
    const { due } = planReads({
      ...base,
      lastAttempts: new Map([[1, read(1)]]),
      clients: [{ clientId: 1, name: "Same", newestPostAt: "2026-11-24T00:00:00Z" }],
      force: new Set([1]),
    });
    expect(due[0]?.reason).toBe("asked for");
  });
});

describe("toWatchRow", () => {
  it("uses the sheet strategist, and groups a blank one under no strategist", () => {
    expect(toWatchRow(report("A", 1), "Alex", null, null).strategist).toBe("Alex");
    expect(toWatchRow(report("A", 1), "  ", null, null).strategist).toBe(NO_STRATEGIST_ON_SHEET);
  });
  it("counts waiting days only when the client waits on us", () => {
    expect(toWatchRow(report("A", 1, waitingOnUs(6)), "Alex", null, null)).toMatchObject({
      basecampStatus: "waiting_on_us",
      waitingDays: 6,
    });
    expect(toWatchRow(report("A", 1), "Alex", null, null).waitingDays).toBeNull();
  });
  it("shows a failed read only when it came after the good one", () => {
    const good = read(1);
    const failedAfter = read(1, { error: "timed out" });
    expect(toWatchRow(report("A", 1), "Alex", good, failedAfter).failedRead).toBe(failedAfter);
    expect(toWatchRow(report("A", 1), "Alex", good, good).failedRead).toBeNull();
    expect(toWatchRow(report("A", 1), "Alex", null, failedAfter).failedRead).toBe(failedAfter);
  });
  it("marks a read behind when Basecamp has newer posts than it saw", () => {
    const seen = read(1, { newest_post_at: "2026-11-20T00:00:00Z" });
    expect(toWatchRow(report("A", 1, waitingOnUs(1)), "Alex", seen, seen).readIsBehind).toBe(true);
    const current = read(1, { newest_post_at: "2026-11-24T00:00:00Z" });
    expect(toWatchRow(report("A", 1, waitingOnUs(1)), "Alex", current, current).readIsBehind).toBe(false);
  });
});

describe("groupByStrategist", () => {
  it("sorts strategists A to Z with no strategist last, and the most pressing client first", () => {
    const rows = [
      toWatchRow(report("Zed", 1), "Stephanie", read(1), null),
      toWatchRow(report("Calm", 2), "Alex", read(2), null),
      toWatchRow(report("Owed", 3), "Alex", read(3, { owe_response: "yes" }), null),
      toWatchRow(report("Upset", 4), "Alex", read(4, { unhappy: true }), null),
      toWatchRow(report("Long wait", 5, waitingOnUs(9)), "Alex", read(5), null),
      toWatchRow(report("Short wait", 6, waitingOnUs(2)), "Alex", read(6), null),
      toWatchRow(report("Unread", 7), "Alex", null, null),
      toWatchRow(report("Nobody", 8), null, null, null),
    ];
    const groups = groupByStrategist(rows);
    expect(groups.map((g) => g.strategist)).toEqual(["Alex", "Stephanie", NO_STRATEGIST_ON_SHEET]);
    expect(groups[0]?.rows.map((r) => r.name)).toEqual(["Owed", "Upset", "Long wait", "Short wait", "Unread", "Calm"]);
  });
});

describe("countByStrategist", () => {
  it("counts per strategist with a total last, and leaves unread clients out of read counts", () => {
    const rows = [
      toWatchRow(report("A", 1, waitingOnUs(3)), "Alex", read(1, { owe_response: "yes", latest_report_month: "2026-07" }), null),
      toWatchRow(report("B", 2), "Alex", read(2, { unhappy: true }), null),
      toWatchRow(report("C", 3), "Stephanie", null, null),
    ];
    const counts = countByStrategist(rows, now);
    expect(counts.map((c) => c.strategist)).toEqual(["Alex", "Stephanie", "Total"]);
    expect(counts[0]).toMatchObject({ clients: 2, oweResponse: 1, unhappy: 1, reportBehind: 1, waitingOnUs: 1, notRead: 0 });
    expect(counts[1]).toMatchObject({ clients: 1, oweResponse: 0, notRead: 1 });
    expect(counts[2]).toMatchObject({ clients: 3, oweResponse: 1, unhappy: 1, reportBehind: 1, notRead: 1 });
  });
});
