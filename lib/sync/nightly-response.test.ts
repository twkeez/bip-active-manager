import { describe, expect, it } from "vitest";
import { nightlyOutcome } from "./nightly-response";

const base = { synced: 10, failed: 0, blocked: 0, skipped: 3, deferred: 0, results: [] };

describe("nightlyOutcome", () => {
  it("is complete only when nothing failed, was refused or was left over", () => {
    expect(nightlyOutcome(base)).toEqual({ complete: true, summaryText: null });
  });

  it("names refusals and leftovers, which used to pass as fine", () => {
    const outcome = nightlyOutcome({
      ...base,
      blocked: 2,
      deferred: 4,
      results: [
        { clientId: 1, accountName: "Broadway Oaks", status: "blocked" },
        { clientId: 2, accountName: "VSEC", status: "blocked" },
      ],
    });
    expect(outcome.complete).toBe(false);
    expect(outcome.summaryText).toBe(
      "2 blocked (no access or login), e.g. Broadway Oaks, VSEC · 4 not reached in time (they go first next run)",
    );
  });
});
