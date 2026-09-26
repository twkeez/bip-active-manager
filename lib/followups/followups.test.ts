import { describe, expect, it } from "vitest";
import {
  defaultNote,
  followupEmailBody,
  followupsAnswered,
  followupsToRenudge,
  isOverdue,
  type FollowupRow,
} from "./followups";

const NOW = new Date("2026-09-26T15:00:00Z");
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000).toISOString();

let id = 1;
function followup(overrides: Partial<FollowupRow> = {}): FollowupRow {
  return {
    id: id++,
    basecamp_project_id: "123",
    project_name: "Paws Veterinary Clinic",
    client_id: 7,
    recipient_name: "Stephanie",
    recipient_email: "stephanie@beyondindigo.com",
    subject: "Follow-up needed: Paws Veterinary Clinic",
    note: "Hi Stephanie,\n\nPlease reply.",
    thread_title: "October content",
    thread_url: "https://basecamp.com/2175055/projects/123/messages/9",
    sent_by_user_id: "u1",
    sent_by_email: "tom@beyondindigo.com",
    sent_at: hoursAgo(5),
    renudged_at: null,
    state: "open",
    resolution: null,
    resolved_at: null,
    resolved_by: null,
    ...overrides,
  };
}

describe("defaultNote", () => {
  it("asks for a reply when the client is waiting on us", () => {
    const { subject, note } = defaultNote({
      accountName: "Paws Veterinary Clinic",
      recipientName: "Stephanie",
      status: "awaiting_us",
      waitingDays: 6,
      threadTitle: "October content",
    });
    expect(subject).toBe("Follow-up needed: Paws Veterinary Clinic");
    expect(note).toContain("Hi Stephanie,");
    expect(note).toContain('waiting on a reply from us for 6 days on "October content"');
  });

  it("asks for a check-in when we are waiting on the client", () => {
    const { note } = defaultNote({
      accountName: "Paws",
      recipientName: null,
      status: "awaiting_client",
      waitingDays: 1,
      threadTitle: null,
    });
    expect(note.startsWith("Hi,")).toBe(true);
    expect(note).toContain("We haven't heard from Paws for 1 day.");
  });
});

describe("followupsAnswered", () => {
  it("closes on the first post from our side after the note", () => {
    const f = followup({ sent_at: hoursAgo(5) });
    const posts = [
      { basecamp_project_id: "123", occurred_at: hoursAgo(6), author_email: "early@beyondindigo.com" },
      { basecamp_project_id: "123", occurred_at: hoursAgo(2), author_email: "late@beyondindigo.com" },
      { basecamp_project_id: "123", occurred_at: hoursAgo(3), author_email: "first@beyondindigo.com" },
    ];
    const answered = followupsAnswered([f], posts);
    expect(answered).toHaveLength(1);
    expect(answered[0].post.author_email).toBe("first@beyondindigo.com");
  });

  it("ignores posts in other projects, posts before the note, and closed follow-ups", () => {
    const open = followup({ sent_at: hoursAgo(5) });
    const done = followup({ state: "done" });
    const posts = [
      { basecamp_project_id: "999", occurred_at: hoursAgo(1), author_email: null },
      { basecamp_project_id: "123", occurred_at: hoursAgo(10), author_email: null },
    ];
    expect(followupsAnswered([open, done], posts)).toEqual([]);
  });
});

describe("overdue and reminders", () => {
  it("is overdue after two days open", () => {
    expect(isOverdue(followup({ sent_at: hoursAgo(47) }), NOW)).toBe(false);
    expect(isOverdue(followup({ sent_at: hoursAgo(49) }), NOW)).toBe(true);
    expect(isOverdue(followup({ sent_at: hoursAgo(49), state: "done" }), NOW)).toBe(false);
  });

  it("re-sends each overdue follow-up once", () => {
    const due = followup({ sent_at: hoursAgo(50) });
    const alreadySent = followup({ sent_at: hoursAgo(80), renudged_at: hoursAgo(20) });
    const young = followup({ sent_at: hoursAgo(10) });
    expect(followupsToRenudge([due, alreadySent, young], NOW).map((f) => f.id)).toEqual([due.id]);
  });
});

describe("followupEmailBody", () => {
  it("includes the links, and a reminder line when re-sent", () => {
    const f = followup();
    expect(followupEmailBody(f)).toContain("Thread: https://basecamp.com/2175055/projects/123/messages/9");
    expect(followupEmailBody(f)).not.toContain("Reminder");
    expect(followupEmailBody(f, { reminder: true }).startsWith("Reminder:")).toBe(true);
  });
});
