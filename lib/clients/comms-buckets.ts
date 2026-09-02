import type { ClientRow } from "@/lib/types/client";

/**
 * Splits clients into the two Comms Monitor panels.
 *
 * Pure, and separate from the component, because the interesting case is one
 * nobody looks at: a client with no recorded communication at all. That state
 * used to make a client vanish from both panels — `needs_reply` was false and
 * `(days_stale ?? 0) >= 15` read the null as zero — so the accounts that had
 * been ignored longest were the ones the monitor could not show.
 */

/** Days of silence to qualify for the Gone Silent panel. */
export const GONE_SILENT_DAYS = 15;

/**
 * How silent a client is. A null `days_stale` means no communication event has
 * ever been recorded, which is maximal silence rather than none.
 */
export function silenceRank(client: Pick<ClientRow, "days_stale">): number {
  return client.days_stale ?? Number.POSITIVE_INFINITY;
}

export type CommsBuckets = {
  awaitingReply: ClientRow[];
  goneSilent: ClientRow[];
};

export function bucketCommsClients(clients: ClientRow[]): CommsBuckets {
  const awaitingReply = clients
    .filter((c) => c.needs_reply)
    .sort(
      (a, b) =>
        new Date(a.last_communication_at ?? 0).getTime() -
        new Date(b.last_communication_at ?? 0).getTime(),
    );

  const goneSilent = clients
    .filter(
      (c) =>
        !c.needs_reply &&
        // Without a Basecamp project there is no channel being watched, so
        // silence says nothing — those would be noise, not findings.
        Boolean(c.basecamp_project_id) &&
        silenceRank(c) >= GONE_SILENT_DAYS,
    )
    .sort((a, b) => silenceRank(b) - silenceRank(a));

  return { awaitingReply, goneSilent };
}
