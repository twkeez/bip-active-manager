import { describe, expect, it } from "vitest";
import { runWithConcurrency } from "@/lib/basecamp/concurrency";

const tick = () => new Promise((resolve) => setTimeout(resolve, 1));

describe("runWithConcurrency", () => {
  it("processes every item", async () => {
    const seen: number[] = [];
    await runWithConcurrency([1, 2, 3, 4, 5], 2, async (n) => {
      await tick();
      seen.push(n);
    });
    expect(seen.sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it("never exceeds the limit", async () => {
    let running = 0;
    let peak = 0;
    await runWithConcurrency(Array.from({ length: 20 }, (_, i) => i), 4, async () => {
      running += 1;
      peak = Math.max(peak, running);
      await tick();
      running -= 1;
    });
    expect(peak).toBeLessThanOrEqual(4);
    expect(peak).toBe(4);
  });

  // The failure that matters: a rate-limited project must not stop the 100
  // projects queued behind it from being checked.
  it("keeps going after one item throws, then reports", async () => {
    const done: number[] = [];
    await expect(
      runWithConcurrency([1, 2, 3, 4], 2, async (n) => {
        await tick();
        if (n === 2) throw new Error("boom");
        done.push(n);
      }),
    ).rejects.toThrow(/1 of 4 jobs failed/);
    expect(done.sort()).toEqual([1, 3, 4]);
  });

  it("handles an empty list and a limit larger than the list", async () => {
    await expect(runWithConcurrency([], 5, async () => {})).resolves.toBeUndefined();
    const seen: number[] = [];
    await runWithConcurrency([1], 99, async (n) => {
      seen.push(n);
    });
    expect(seen).toEqual([1]);
  });
});
