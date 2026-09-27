import { describe, expect, it } from "vitest";
import {
  defaultNote,
  followupEmailBody,
  followupsAnswered,
  followupsToRenudge,
  isOverdue,
  threadIdFromUrl,
  type FollowupRow,
} from "./followups";

const NOW = new Date("2026-09-26T15:00:00Z");
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000).toISOString();

let id = 1;
function followup(overrides: Partial<FollowupRow> = {}): FollowupRow {
  return {
    id: id++,
    kind: "note",
    reminder_run: null,
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
  // The follow-up is about message 9 in project 123, sent to Stephanie 5h ago.
  const thread = (overrides: Partial<{ basecamp_project_id: string; basecamp_recording_id: number; occurred_at: string; author_email: string | null }>) => ({
    basecamp_project_id: "123",
    basecamp_recording_id: 9,
    occurred_at: hoursAgo(2),
    author_email: "stephanie@beyondindigo.com",
    ...overrides,
  });

  it("closes when the person asked is the last to post in that thread, after the note", () => {
    const f = followup({ sent_at: hoursAgo(5) });
    const answered = followupsAnswered([f], [thread({ author_email: "Stephanie@BeyondIndigo.com" })]);
    expect(answered).toHaveLength(1);
  });

  it("stays open when someone else posts, even in that thread", () => {
    const f = followup({ sent_at: hoursAgo(5) });
    expect(followupsAnswered([f], [thread({ author_email: "tom@beyondindigo.com" })])).toEqual([]);
  });

  it("stays open when the person asked posts in a different thread", () => {
    const f = followup({ sent_at: hoursAgo(5) });
    expect(followupsAnswered([f], [thread({ basecamp_recording_id: 10 })])).toEqual([]);
  });

  it("stays open for posts before the note, in other projects, or once done", () => {
    const open = followup({ sent_at: hoursAgo(5) });
    const done = followup({ state: "done" });
    const threads = [thread({ occurred_at: hoursAgo(6) }), thread({ basecamp_project_id: "999" })];
    expect(followupsAnswered([open, done], threads)).toEqual([]);
  });

  it("with no thread on the note, closes when the person asked posts anywhere in the project", () => {
    const f = followup({ sent_at: hoursAgo(5), thread_url: null, thread_title: null });
    expect(followupsAnswered([f], [thread({ basecamp_recording_id: 42 })])).toHaveLength(1);
    expect(followupsAnswered([f], [thread({ basecamp_recording_id: 42, author_email: "alex@beyondindigo.com" })])).toEqual([]);
  });
});

describe("threadIdFromUrl", () => {
  it("reads the message id from a thread URL", () => {
    expect(threadIdFromUrl("https://basecamp.com/2175055/projects/123/messages/113355480")).toBe(113355480);
    expect(threadIdFromUrl(null)).toBeNull();
    expect(threadIdFromUrl("https://basecamp.com/2175055/projects/123")).toBeNull();
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

describe("client update reminders", () => {
  it("never close on a Basecamp post, only by hand", () => {
    const f = followup({ kind: "client_update", reminder_run: "2026-10-05", thread_url: null, sent_at: hoursAgo(5) });
    const post = { basecamp_project_id: "123", basecamp_recording_id: 42, occurred_at: hoursAgo(1), author_email: "stephanie@beyondindigo.com" };
    expect(followupsAnswered([f], [post])).toEqual([]);
  });

  it("are overdue after five days, not two", () => {
    expect(isOverdue(followup({ kind: "client_update", sent_at: hoursAgo(100) }), NOW)).toBe(false);
    expect(isOverdue(followup({ kind: "client_update", sent_at: hoursAgo(121) }), NOW)).toBe(true);
  });

  it("get a reminder that says what is still open", () => {
    const body = followupEmailBody(
      followup({ kind: "client_update", reminder_run: "2026-10-05", project_name: "Paws" }),
      { reminder: true },
    );
    expect(body).toContain("Paws's client update from 2026-10-05 is still open");
    expect(body).toContain("mark it complete");
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
