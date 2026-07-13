import { describe, expect, it } from "vitest";
import {
  buildCommsExcerpt,
  computeCommsAggregate,
  isInternalAuthor,
  storedIsInternal,
} from "@/lib/illuminare/comms";

const INTERNAL = ["beyondindigo.com"];

describe("isInternalAuthor", () => {
  it("treats our domain as internal", () => {
    expect(isInternalAuthor("tom@beyondindigo.com", INTERNAL)).toBe(true);
  });
  it("treats other domains as external", () => {
    expect(isInternalAuthor("client@somepractice.com", INTERNAL)).toBe(false);
  });
  it("returns null without a usable email", () => {
    expect(isInternalAuthor(null, INTERNAL)).toBeNull();
    expect(isInternalAuthor("not-an-email", INTERNAL)).toBeNull();
  });
});

describe("storedIsInternal", () => {
  it("passes through a known classification", () => {
    expect(storedIsInternal(true, "a@b.com")).toBe(true);
    expect(storedIsInternal(false, "a@b.com")).toBe(false);
  });
  it("treats unknown-with-email as external, unknown-without-email as internal", () => {
    expect(storedIsInternal(null, "someone@x.com")).toBe(false);
    expect(storedIsInternal(null, null)).toBe(true);
  });
});

describe("computeCommsAggregate", () => {
  const now = new Date("2026-07-13T00:00:00Z").getTime();

  it("returns nulls with no events", () => {
    expect(computeCommsAggregate(null, now)).toEqual({
      last_communication_at: null,
      last_comm_is_internal: null,
      needs_reply: false,
      days_stale: null,
    });
  });

  it("flags needs_reply when the client spoke last", () => {
    const agg = computeCommsAggregate(
      { occurred_at: "2026-07-10T00:00:00Z", is_internal: false },
      now,
    );
    expect(agg.needs_reply).toBe(true);
    expect(agg.days_stale).toBe(3);
    expect(agg.last_comm_is_internal).toBe(false);
  });

  it("does not flag needs_reply when we spoke last", () => {
    const agg = computeCommsAggregate(
      { occurred_at: "2026-07-12T00:00:00Z", is_internal: true },
      now,
    );
    expect(agg.needs_reply).toBe(false);
    expect(agg.days_stale).toBe(1);
  });
});

describe("buildCommsExcerpt", () => {
  it("strips html and collapses whitespace", () => {
    expect(buildCommsExcerpt("<p>Hello   <strong>there</strong></p>")).toBe(
      "Hello there",
    );
  });
  it("truncates long text", () => {
    const long = "a".repeat(300);
    const out = buildCommsExcerpt(long, 50)!;
    expect(out.length).toBe(50);
    expect(out.endsWith("…")).toBe(true);
  });
  it("returns null for empty input", () => {
    expect(buildCommsExcerpt(null)).toBeNull();
    expect(buildCommsExcerpt("<p></p>")).toBeNull();
  });
});
