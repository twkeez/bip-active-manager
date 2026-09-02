import { describe, expect, it } from "vitest";
import { bucketCommsClients, silenceRank } from "@/lib/clients/comms-buckets";
import type { ClientRow } from "@/lib/types/client";

function client(overrides: Partial<ClientRow>): ClientRow {
  return {
    id: 1,
    account_name: "Test Vet",
    basecamp_project_id: "123",
    needs_reply: false,
    days_stale: null,
    last_communication_at: null,
    last_event_is_internal: null,
    marketing_strategist: null,
    ...overrides,
  } as ClientRow;
}

describe("silenceRank", () => {
  it("treats no recorded communication as maximal silence, not zero", () => {
    // The bug this replaced: `days_stale ?? 0` made the quietest clients look
    // like the busiest ones.
    expect(silenceRank({ days_stale: null })).toBe(Number.POSITIVE_INFINITY);
    expect(silenceRank({ days_stale: 40 })).toBe(40);
    expect(silenceRank({ days_stale: null })).toBeGreaterThan(silenceRank({ days_stale: 999 }));
  });
});

describe("bucketCommsClients", () => {
  it("puts clients with an unanswered message in Awaiting Reply", () => {
    const { awaitingReply, goneSilent } = bucketCommsClients([
      client({ id: 1, needs_reply: true, days_stale: 3, last_communication_at: "2026-08-25T00:00:00Z" }),
    ]);
    expect(awaitingReply.map((c) => c.id)).toEqual([1]);
    expect(goneSilent).toEqual([]);
  });

  // The regression that motivated this file: a client whose last message aged
  // out of the old 30-day window appeared in neither panel.
  it("surfaces a client with no recorded communication at all", () => {
    const { awaitingReply, goneSilent } = bucketCommsClients([
      client({ id: 7, needs_reply: false, days_stale: null, last_communication_at: null }),
    ]);
    expect(awaitingReply).toEqual([]);
    expect(goneSilent.map((c) => c.id)).toEqual([7]);
  });

  it("sorts the longest silences first, with no-record clients at the top", () => {
    const { goneSilent } = bucketCommsClients([
      client({ id: 1, days_stale: 20 }),
      client({ id: 2, days_stale: null }),
      client({ id: 3, days_stale: 90 }),
    ]);
    expect(goneSilent.map((c) => c.id)).toEqual([2, 3, 1]);
  });

  it("leaves recently contacted clients out of Gone Silent", () => {
    const { goneSilent } = bucketCommsClients([
      client({ id: 1, days_stale: 14 }),
      client({ id: 2, days_stale: 15 }),
    ]);
    expect(goneSilent.map((c) => c.id)).toEqual([2]);
  });

  it("ignores clients with no Basecamp project, whose silence means nothing", () => {
    const { goneSilent } = bucketCommsClients([
      client({ id: 1, basecamp_project_id: null, days_stale: null }),
      client({ id: 2, basecamp_project_id: "456", days_stale: null }),
    ]);
    expect(goneSilent.map((c) => c.id)).toEqual([2]);
  });

  it("never shows the same client in both panels", () => {
    const { awaitingReply, goneSilent } = bucketCommsClients([
      client({ id: 1, needs_reply: true, days_stale: null }),
    ]);
    expect(awaitingReply.map((c) => c.id)).toEqual([1]);
    expect(goneSilent).toEqual([]);
  });
});
