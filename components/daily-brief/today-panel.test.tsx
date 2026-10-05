import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import TodayPanel from "@/components/daily-brief/today-panel";
import type { DayContext } from "@/lib/assistant/day-context";

const base: DayContext = {
  today: "2026-10-05",
  timeZone: "America/New_York",
  calendar: { connected: true, date: "2026-10-05", timeZone: "America/New_York", events: [] },
  tasks: [],
  canaries: [],
  emails: [],
  emailLastSyncedDaysAgo: 0,
};

const email = (overrides: Partial<DayContext["emails"][number]> = {}): DayContext["emails"][number] => ({
  from: "Dr. Smith",
  subject: "Website down?",
  snippet: "x",
  received: "2026-10-05 14:20",
  receivedAt: "2026-10-05T14:20:00+00:00",
  why: "Client reporting an outage",
  ...overrides,
});

describe("TodayPanel email", () => {
  it("shows subject, sender, Eastern time and why it was flagged", () => {
    const html = renderToStaticMarkup(<TodayPanel context={{ ...base, emails: [email()] }} />);
    expect(html).toContain("Website down?");
    expect(html).toContain("Dr. Smith");
    expect(html).toContain("Oct 5, 10:20 AM ET");
    expect(html).toContain("Flagged because: Client reporting an outage");
    expect(html).toContain("Mail to other team members is not");
  });

  it("says so when there is none, and when the inbox has not synced recently", () => {
    expect(renderToStaticMarkup(<TodayPanel context={base} />)).toContain("No high-priority email in the last 3 days.");
    expect(renderToStaticMarkup(<TodayPanel context={{ ...base, emailLastSyncedDaysAgo: 4 }} />)).toContain(
      "Email last synced 4 days ago",
    );
    expect(renderToStaticMarkup(<TodayPanel context={{ ...base, emailLastSyncedDaysAgo: null }} />)).toContain(
      "Email has never synced",
    );
  });

  it("does not render markup written in an email as markup", () => {
    const html = renderToStaticMarkup(
      <TodayPanel context={{ ...base, emails: [email({ subject: "<script>alert(1)</script>" })] }} />,
    );
    expect(html).not.toContain("<script>");
  });

  it("notes when the list was cut off", () => {
    const many = Array.from({ length: 15 }, (_, index) => email({ subject: `Msg ${index}` }));
    expect(renderToStaticMarkup(<TodayPanel context={{ ...base, emails: many }} />)).toContain("15 most recent");
  });
});
