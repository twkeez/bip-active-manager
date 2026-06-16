import { describe, expect, it } from "vitest";
import {
  computeClientCommsAggregate,
  storedAuthorIsInternal,
} from "@/lib/basecamp/comms-aggregate";

describe("storedAuthorIsInternal", () => {
  it("respects explicit internal and external classification", () => {
    expect(storedAuthorIsInternal(true)).toBe(true);
    expect(storedAuthorIsInternal(false)).toBe(false);
  });

  it("treats unknown authors with email as external", () => {
    expect(storedAuthorIsInternal(null, "client@vetclinic.com")).toBe(false);
  });

  it("defaults unknown authors without email to internal", () => {
    expect(storedAuthorIsInternal(null, null)).toBe(true);
    expect(storedAuthorIsInternal(null, "   ")).toBe(true);
  });
});

describe("computeClientCommsAggregate", () => {
  const nowMs = new Date("2026-05-20T12:00:00Z").getTime();

  it("marks awaiting when latest event is external and not acknowledged", () => {
    const result = computeClientCommsAggregate(
      { occurred_at: "2026-05-19T10:00:00Z", is_internal: false },
      null,
      nowMs,
    );
    expect(result.needs_reply).toBe(true);
    expect(result.last_event_is_internal).toBe(false);
    expect(result.days_stale).toBe(1);
  });

  it("clears awaiting when latest event is internal", () => {
    const result = computeClientCommsAggregate(
      { occurred_at: "2026-05-19T10:00:00Z", is_internal: true },
      null,
      nowMs,
    );
    expect(result.needs_reply).toBe(false);
    expect(result.last_event_is_internal).toBe(true);
  });

  it("clears awaiting when latest client message was acknowledged", () => {
    const result = computeClientCommsAggregate(
      { occurred_at: "2026-05-19T10:00:00Z", is_internal: false },
      "2026-05-19T10:00:00Z",
      nowMs,
    );
    expect(result.needs_reply).toBe(false);
  });

  it("returns awaiting when a newer client message arrives after acknowledgment", () => {
    const result = computeClientCommsAggregate(
      { occurred_at: "2026-05-20T09:00:00Z", is_internal: false },
      "2026-05-19T10:00:00Z",
      nowMs,
    );
    expect(result.needs_reply).toBe(true);
  });

  it("clears fields when no events remain in retention", () => {
    const result = computeClientCommsAggregate(null, null, nowMs);
    expect(result).toEqual({
      last_communication_at: null,
      last_event_is_internal: null,
      needs_reply: false,
      days_stale: null,
    });
  });
});
