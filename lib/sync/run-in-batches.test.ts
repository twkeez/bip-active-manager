import { describe, expect, it } from "vitest";
import { runInBatches, summarise, type ClientSyncResult } from "./run-in-batches";
import { stalestFirst, type StalenessOrder } from "./staleness";

describe("runInBatches", () => {
  it("runs a batch at a time and keeps the order of results", async () => {
    const inFlight: number[] = [];
    let peak = 0;
    const { results, deferred } = await runInBatches([1, 2, 3, 4, 5], 2, async (n) => {
      inFlight.push(n);
      peak = Math.max(peak, inFlight.length);
      await Promise.resolve();
      inFlight.pop();
      return n * 10;
    });
    expect(results).toEqual([10, 20, 30, 40, 50]);
    expect(deferred).toEqual([]);
    expect(peak).toBeLessThanOrEqual(2);
  });

  // The run has to come back with a report. Being killed mid-flight by the
  // function timeout loses the report as well as the work.
  it("stops starting batches at the deadline and says what it did not reach", async () => {
    const started: number[] = [];
    let clock = 0;
    const { results, deferred } = await runInBatches(
      [1, 2, 3, 4, 5, 6],
      2,
      async (n) => {
        started.push(n);
        clock += 30; // each job costs 30ms of the budget
        return n;
      },
      { deadline: 100, now: () => clock },
    );
    // Two batches fit inside 100ms; the third is not started.
    expect(results).toEqual([1, 2, 3, 4]);
    expect(deferred).toEqual([5, 6]);
    expect(started).toEqual([1, 2, 3, 4]);
  });

  it("never abandons a job it already started", async () => {
    let finished = 0;
    const { results } = await runInBatches(
      [1, 2],
      2,
      async (n) => {
        await new Promise((resolve) => setTimeout(resolve, 1));
        finished += 1;
        return n;
      },
      { deadline: Date.now() - 1_000 },
    );
    // The deadline had already passed, so nothing ran — but nothing was left
    // half-run either.
    expect(results).toEqual([]);
    expect(finished).toBe(0);
  });
});

describe("summarise", () => {
  it("counts a partial run honestly", () => {
    const results: ClientSyncResult[] = [
      { clientId: 1, accountName: "A", status: "ok" },
      { clientId: 2, accountName: "B", status: "failed", error: "revoked" },
      { clientId: 3, accountName: "C", status: "ok" },
    ];
    expect(summarise(results, { skipped: 150, deferred: 4 })).toMatchObject({
      synced: 2,
      failed: 1,
      skipped: 150,
      deferred: 4,
    });
  });
});

describe("stalestFirst", () => {
  it("puts never-synced clients first, then the oldest", () => {
    const newestByClient = new Map([
      [1, "2026-09-16T00:00:00Z"],
      [2, "2026-07-01T00:00:00Z"],
    ]);
    const staleness: StalenessOrder = {
      newestByClient,
      order: (id) => {
        const at = newestByClient.get(id);
        return at ? new Date(at).getTime() : 0;
      },
    };
    const ordered = stalestFirst([{ id: 1 }, { id: 2 }, { id: 3 }], staleness);
    expect(ordered.map((client) => client.id)).toEqual([3, 2, 1]);
  });
});
