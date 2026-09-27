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
      { recordingId: 112973256, occurredAt: "2026-07-07T14:02:00.000Z", personId: 11, email: "daniel@beyondindigo.com" },
      { recordingId: 501, occurredAt: "2026-09-02T15:31:00.000Z", personId: 11, email: null },
      { recordingId: 502, occurredAt: "2026-09-02T15:40:00.000Z", personId: 22, email: null },
    ]);
  });

  it("skips comments without an id or a date, and survives junk", () => {
    expect(classicThreadPosts(1, { comments: [{ id: 5 }, { created_at: "2026-01-01T00:00:00Z" }] })).toEqual([]);
    expect(classicThreadPosts(1, null)).toEqual([]);
  });
});
