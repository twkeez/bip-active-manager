import { describe, expect, it } from "vitest";
import { readSettings, weRepliedSince } from "./basecamp-watch";
import type { ThreadRow } from "@/lib/coal-mines/basecamp-threads";

const thread = (overrides: Partial<ThreadRow> = {}): ThreadRow => ({
  basecamp_project_id: "1",
  client_id: 1,
  thread_title: "Q3 marketing",
  thread_url: null,
  occurred_at: "2026-09-23T15:00:00Z",
  is_internal: true,
  ...overrides,
});

describe("weRepliedSince", () => {
  const flaggedAt = "2026-09-23T12:00:00Z";

  // The point of the whole list: answering in Basecamp is all anyone has to do.
  it("clears an item once we post after the message that was flagged", () => {
    expect(weRepliedSince(thread(), flaggedAt)).toBe(true);
  });

  it("does not clear when the client is the one who posted again", () => {
    expect(weRepliedSince(thread({ is_internal: false }), flaggedAt)).toBe(false);
  });

  // Our own earlier message is the thing they are waiting on a reply to.
  it("does not clear on a reply from before it was flagged", () => {
    expect(weRepliedSince(thread({ occurred_at: "2026-09-23T09:00:00Z" }), flaggedAt)).toBe(false);
  });

  it("does not clear when nobody knows who spoke last", () => {
    expect(weRepliedSince(thread({ is_internal: null }), flaggedAt)).toBe(false);
    expect(weRepliedSince(undefined, flaggedAt)).toBe(false);
  });
});

describe("watch settings", () => {
  it("keeps a sensible quiet threshold whatever is stored", () => {
    expect(readSettings({ quietAfterDays: 21 })).toEqual({ quietAfterDays: 21 });
    expect(readSettings({})).toEqual({ quietAfterDays: 14 });
    expect(readSettings({ quietAfterDays: 0 })).toEqual({ quietAfterDays: 14 });
    expect(readSettings({ quietAfterDays: "a fortnight" })).toEqual({ quietAfterDays: 14 });
  });
});
