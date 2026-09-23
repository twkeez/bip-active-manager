import { describe, expect, it } from "vitest";
import type { ResponseReportRow } from "@/lib/basecamp/load-response-report";
import {
  internalAuthors,
  isAcknowledged,
  shapeAndSort,
  statusOf,
  summarizeReport,
} from "@/lib/basecamp/response-report";

function row(overrides: Partial<ResponseReportRow> = {}): ResponseReportRow {
  return {
    client_id: 1,
    account_name: "Acme Vet",
    marketing_strategist: null,
    basecamp_project_id: "123",
    is_low_contact: false,
    is_website_only: false,
    reply_acknowledged_for_occurred_at: null,
    last_internal_at: "2026-08-20T10:00:00Z",
    last_internal_author: "Alex",
    last_internal_author_email: "alex@beyondindigo.com",
    last_internal_thread_title: null,
    last_internal_thread_url: null,
    last_client_at: "2026-08-18T10:00:00Z",
    last_client_author: "Dr. Ruiz",
    last_client_author_email: "ruiz@acmevet.com",
    last_client_thread_title: null,
    last_client_thread_url: null,
    client_spoke_last: false,
    days_since_our_reply: 4,
    days_since_client_contact: 6,
    ...overrides,
  };
}

describe("statusOf", () => {
  it("flags projects where the client spoke last", () => {
    expect(statusOf(row({ client_spoke_last: true }))).toBe("awaiting_us");
  });

  it("flags projects where we spoke last", () => {
    expect(statusOf(row())).toBe("awaiting_client");
  });

  it("reports no contact when neither side has posted", () => {
    expect(
      statusOf(
        row({
          last_internal_at: null,
          last_client_at: null,
          client_spoke_last: false,
        }),
      ),
    ).toBe("no_contact");
  });
});

describe("isAcknowledged", () => {
  it("is true once the client's latest message has been dismissed", () => {
    expect(
      isAcknowledged(
        row({
          client_spoke_last: true,
          last_client_at: "2026-08-18T10:00:00Z",
          reply_acknowledged_for_occurred_at: "2026-08-18T10:00:00Z",
        }),
      ),
    ).toBe(true);
  });

  it("is false again when the client posts something newer", () => {
    expect(
      isAcknowledged(
        row({
          client_spoke_last: true,
          last_client_at: "2026-08-22T10:00:00Z",
          reply_acknowledged_for_occurred_at: "2026-08-18T10:00:00Z",
        }),
      ),
    ).toBe(false);
  });
});

describe("shapeAndSort", () => {
  it("puts the longest unanswered client message first", () => {
    const sorted = shapeAndSort([
      row({ client_id: 1, account_name: "Quiet", last_internal_at: null, last_client_at: null }),
      row({ client_id: 2, account_name: "Waited two days", client_spoke_last: true, days_since_client_contact: 2 }),
      row({ client_id: 3, account_name: "Answered" }),
      row({ client_id: 4, account_name: "Waited ten days", client_spoke_last: true, days_since_client_contact: 10 }),
    ]);
    expect(sorted.map((r) => r.client_id)).toEqual([4, 2, 3, 1]);
  });

  it("sinks acknowledged rows below the ones still open", () => {
    const sorted = shapeAndSort([
      row({
        client_id: 1,
        client_spoke_last: true,
        days_since_client_contact: 30,
        last_client_at: "2026-07-25T10:00:00Z",
        reply_acknowledged_for_occurred_at: "2026-07-25T10:00:00Z",
      }),
      row({ client_id: 2, client_spoke_last: true, days_since_client_contact: 1 }),
    ]);
    expect(sorted.map((r) => r.client_id)).toEqual([2, 1]);
  });

  it("uses our own last reply as the wait for answered projects", () => {
    const [shaped] = shapeAndSort([row({ days_since_our_reply: 4 })]);
    expect(shaped.waitingDays).toBe(4);
  });
});

describe("summarizeReport", () => {
  it("counts open replies and excludes acknowledged ones", () => {
    const summary = summarizeReport(
      shapeAndSort([
        row({ client_id: 1, client_spoke_last: true, days_since_client_contact: 9 }),
        row({ client_id: 2, client_spoke_last: true, days_since_client_contact: 2 }),
        row({
          client_id: 3,
          client_spoke_last: true,
          days_since_client_contact: 40,
          last_client_at: "2026-07-15T10:00:00Z",
          reply_acknowledged_for_occurred_at: "2026-07-15T10:00:00Z",
        }),
        row({ client_id: 4 }),
        row({ client_id: 5, last_internal_at: null, last_client_at: null }),
      ]),
    );
    expect(summary).toEqual({
      total: 5,
      awaitingUs: 2,
      awaitingClient: 1,
      noContact: 1,
      overdue: 1,
    });
  });
});

describe("internalAuthors", () => {
  it("lists teammates by how many projects they spoke last on", () => {
    const authors = internalAuthors(
      shapeAndSort([
        row({ client_id: 1, last_internal_author: "Stephanie" }),
        row({ client_id: 2, last_internal_author: "Alex" }),
        row({ client_id: 3, last_internal_author: "Stephanie" }),
        row({ client_id: 4, last_internal_author: null }),
      ]),
    );
    expect(authors).toEqual(["Stephanie", "Alex"]);
  });
});
