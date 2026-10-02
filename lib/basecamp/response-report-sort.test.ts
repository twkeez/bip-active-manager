import { describe, expect, it } from "vitest";
import { nextSort, shapeRow, sortReportRows } from "./response-report";
import type { ResponseReportRow } from "./load-response-report";

const row = (name: string, extra: Partial<ResponseReportRow>): ResponseReportRow => ({
  basecamp_project_id: name,
  basecamp_project_name: name,
  client_id: null,
  account_name: name,
  marketing_strategist: null,
  is_low_contact: null,
  is_website_only: null,
  reply_acknowledged_for_occurred_at: null,
  last_internal_at: null,
  last_internal_author: null,
  last_internal_author_email: null,
  last_internal_thread_title: null,
  last_internal_thread_url: null,
  last_client_at: null,
  last_client_author: null,
  last_client_author_email: null,
  last_client_thread_title: null,
  last_client_thread_url: null,
  client_spoke_last: false,
  days_since_our_reply: null,
  days_since_client_contact: null,
  ...extra,
});

const rows = [
  row("Bravo", { client_spoke_last: true, days_since_client_contact: 3, last_client_at: "2026-09-29T00:00:00Z", last_internal_at: "2026-09-01T00:00:00Z" }),
  row("alpha", { client_spoke_last: true, days_since_client_contact: 30, last_client_at: "2026-09-02T00:00:00Z" }),
  row("Charlie", {}),
].map(shapeRow);

describe("sorting the response report", () => {
  it("sorts by name, wait and date, with empty values always last", () => {
    expect(sortReportRows(rows, { key: "project", direction: "asc" }).map((r) => r.account_name)).toEqual(["alpha", "Bravo", "Charlie"]);
    expect(sortReportRows(rows, { key: "waiting", direction: "desc" }).map((r) => r.account_name)).toEqual(["alpha", "Bravo", "Charlie"]);
    expect(sortReportRows(rows, { key: "waiting", direction: "asc" }).map((r) => r.account_name)).toEqual(["Bravo", "alpha", "Charlie"]);
    expect(sortReportRows(rows, { key: "our_reply", direction: "desc" }).map((r) => r.account_name)).toEqual(["Bravo", "alpha", "Charlie"]);
  });

  it("cycles a header: default direction, reversed, then the report's own order", () => {
    let sort = nextSort(null, "waiting");
    expect(sort).toEqual({ key: "waiting", direction: "desc" });
    sort = nextSort(sort, "waiting");
    expect(sort).toEqual({ key: "waiting", direction: "asc" });
    expect(nextSort(sort, "waiting")).toBeNull();
    expect(nextSort(sort, "project")).toEqual({ key: "project", direction: "asc" });
    expect(sortReportRows(rows, null)).toBe(rows);
  });
});
