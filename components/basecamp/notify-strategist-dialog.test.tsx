import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import NotifyStrategistDialog from "@/components/basecamp/notify-strategist-dialog";
import type { ShapedReportRow } from "@/lib/basecamp/response-report";

const staff = [{ name: "Stephanie Lee", email: "stephanie@beyondindigo.com" }];

function row(overrides: Partial<ShapedReportRow> = {}): ShapedReportRow {
  return {
    basecamp_project_id: "123",
    basecamp_project_name: "Paws",
    client_id: 7,
    account_name: "Paws Veterinary Clinic",
    marketing_strategist: "Stephanie",
    is_low_contact: false,
    is_website_only: false,
    reply_acknowledged_for_occurred_at: null,
    last_internal_at: "2026-09-02T12:00:00Z",
    last_internal_author: "Alex",
    last_internal_author_email: "alex@beyondindigo.com",
    last_internal_thread_title: "Q3 updates",
    last_internal_thread_url: "https://basecamp.com/2175055/projects/123/messages/1",
    last_client_at: "2026-09-10T12:00:00Z",
    last_client_author: "Dr. Smith",
    last_client_author_email: "smith@paws.com",
    last_client_thread_title: "Where is our report?",
    last_client_thread_url: "https://basecamp.com/2175055/projects/123/messages/2",
    client_spoke_last: true,
    days_since_our_reply: 33,
    days_since_client_contact: 25,
    status: "awaiting_us",
    acknowledged: false,
    waitingDays: 25,
    ...overrides,
  };
}

const render = (r: ShapedReportRow) =>
  renderToStaticMarkup(
    <NotifyStrategistDialog row={r} staff={staff} suggestedEmail="stephanie@beyondindigo.com" onClose={() => {}} onSent={() => {}} />,
  );

describe("NotifyStrategistDialog message choice", () => {
  it("offers both messages and starts on 'Waiting on us' when the client spoke last", () => {
    const html = render(row());
    expect(html).toContain("Waiting on us");
    expect(html).toContain("It&#x27;s been a while");
    expect(html).toMatch(/aria-checked="true"[^>]*>Waiting on us/);
    expect(html).toContain("waiting on a reply from us for 25 days");
    expect(html).toContain("Follow-up needed: Paws Veterinary Clinic");
  });

  it("starts on 'It's been a while' when we spoke last, and says how long since our last message", () => {
    const html = render(row({ status: "awaiting_client", client_spoke_last: false, waitingDays: 33 }));
    expect(html).toMatch(/aria-checked="true"[^>]*>It&#x27;s been a while/);
    expect(html).toContain("33 days since our last message");
    expect(html).toContain("Check-in needed: Paws Veterinary Clinic");
  });

  it("will not offer 'Waiting on us' when nobody is waiting on us", () => {
    const html = render(row({ status: "awaiting_client", client_spoke_last: false }));
    expect(html).toMatch(/disabled=""[^>]*>Waiting on us/);
  });

  it("does not invent a number for a project with no messages from us on record", () => {
    const html = render(row({ status: "no_contact", client_spoke_last: false, days_since_our_reply: null, waitingDays: null }));
    expect(html).toContain("no Basecamp conversation with Paws Veterinary Clinic lately");
  });
});
