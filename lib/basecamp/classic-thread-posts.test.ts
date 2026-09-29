import { describe, expect, it } from "vitest";
import { classicThreadPosts } from "./classic-thread-posts";

describe("classicThreadPosts", () => {
  it("returns the opening post and every comment, oldest first as Basecamp lists them", () => {
    const detail = {
      id: 112973256,
      created_at: "2026-07-07T10:02:00.000-04:00",
      creator: { id: 11, name: "Daniel Gonzalez", email_address: "daniel@beyondindigo.com" },
      comments: [
        { id: 501, created_at: "2026-09-02T11:31:00.000-04:00", creator: { id: 11, name: "Daniel Gonzalez" } },
        { id: "502", created_at: "2026-09-02T11:40:00.000-04:00", creator: { id: 22, name: "Beth Frank" } },
      ],
    };
    expect(classicThreadPosts(112973256, detail)).toEqual([
      { recordingId: 112973256, occurredAt: "2026-07-07T14:02:00.000Z", personId: 11, email: "daniel@beyondindigo.com", name: "Daniel Gonzalez", text: null, redactedLines: 0, withheld: null },
      { recordingId: 501, occurredAt: "2026-09-02T15:31:00.000Z", personId: 11, email: null, name: "Daniel Gonzalez", text: null, redactedLines: 0, withheld: null },
      { recordingId: 502, occurredAt: "2026-09-02T15:40:00.000Z", personId: 22, email: null, name: "Beth Frank", text: null, redactedLines: 0, withheld: null },
    ]);
  });

  it("keeps each post's words, with credential lines removed", () => {
    const detail = {
      created_at: "2026-09-25T10:00:00Z",
      creator: { id: 1, name: "Stephanie Anderson" },
      content: "<p>Here is the campaign plan.</p><p>Budget: $1,000/mo</p>",
      comments: [
        {
          id: 9,
          created_at: "2026-09-25T12:00:00Z",
          creator: { id: 2, name: "Dr. Riff" },
          content: "<div>Please add Boca searches.<br>Our WordPress password: hunter2<br>Hours Mon–Sat 8–5.</div>",
        },
      ],
    };
    const [opening, reply] = classicThreadPosts(100, detail, "Marketing Services – Q3 2026");
    expect(opening.text).toBe("Here is the campaign plan.\nBudget: $1,000/mo");
    expect(reply).toMatchObject({ name: "Dr. Riff", text: "Please add Boca searches.\nHours Mon–Sat 8–5.", redactedLines: 1, withheld: null });
  });

  it("never keeps the words of a thread named for access or logins", () => {
    const detail = { created_at: "2026-09-01T00:00:00Z", creator: { id: 1 }, content: "<p>FTP host: x</p>", comments: [] };
    expect(classicThreadPosts(7, detail, "INTERNAL: Access, Tools, & Forms")[0]).toMatchObject({ text: null, withheld: "access_thread" });
  });

  it("skips comments without an id or a date, and survives junk", () => {
    expect(classicThreadPosts(1, { comments: [{ id: 5 }, { created_at: "2026-01-01T00:00:00Z" }] })).toEqual([]);
    expect(classicThreadPosts(1, null)).toEqual([]);
  });
});
