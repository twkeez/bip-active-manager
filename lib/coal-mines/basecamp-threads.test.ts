import { describe, expect, it } from "vitest";
import {
  findThreadIssues,
  isInternalThread,
  type ThreadRow,
} from "@/lib/coal-mines/basecamp-threads";

const NOW = new Date("2026-09-04T12:00:00Z");
const NAMES = new Map([
  [1, "Harmony Animal Hospital"],
  [2, "Blue Ravine Animal Hospital"],
]);

function thread(overrides: Partial<ThreadRow> & { daysAgo: number }): ThreadRow {
  const { daysAgo, ...rest } = overrides;
  return {
    client_id: 1,
    thread_title: "Website Communication",
    thread_url: "https://basecamp.com/2175055/projects/1/messages/1",
    occurred_at: new Date(NOW.getTime() - daysAgo * 86_400_000).toISOString(),
    is_internal: true,
    ...rest,
  };
}

describe("isInternalThread", () => {
  it("recognises the team's INTERNAL: naming convention", () => {
    expect(isInternalThread("INTERNAL: Account Notes")).toBe(true);
    expect(isInternalThread("  internal: build & code")).toBe(true);
    expect(isInternalThread("Website Communication")).toBe(false);
    // "Internally" is a word, not the prefix — \b stops it matching.
    expect(isInternalThread("Internally reviewed content")).toBe(false);
    expect(isInternalThread(null)).toBe(false);
  });
});

describe("findThreadIssues", () => {
  it("flags a thread where the client spoke last and has been waiting", () => {
    const { awaitingUs } = findThreadIssues(
      [thread({ daysAgo: 11, is_internal: false })],
      NAMES,
      NOW,
    );
    expect(awaitingUs).toHaveLength(1);
    expect(awaitingUs[0]).toMatchObject({
      clientName: "Harmony Animal Hospital",
      title: "Website Communication",
      days: 11,
    });
  });

  it("leaves threads alone where we spoke last", () => {
    const { awaitingUs } = findThreadIssues(
      [thread({ daysAgo: 20, is_internal: true })],
      NAMES,
      NOW,
    );
    expect(awaitingUs).toEqual([]);
  });

  it("gives a same-day reply room to happen", () => {
    const { awaitingUs } = findThreadIssues(
      [thread({ daysAgo: 1, is_internal: false })],
      NAMES,
      NOW,
    );
    expect(awaitingUs).toEqual([]);
  });

  // Nobody is waiting on an internal note, so it must never read as a broken
  // promise to a client.
  it("never puts an INTERNAL thread in awaiting-us", () => {
    const { awaitingUs, stalled, considered } = findThreadIssues(
      [thread({ daysAgo: 40, is_internal: false, thread_title: "INTERNAL: Account Notes" })],
      NAMES,
      NOW,
    );
    expect(awaitingUs).toEqual([]);
    expect(stalled).toEqual([]);
    expect(considered).toBe(0);
  });

  it("flags long-silent threads whoever spoke last", () => {
    const { stalled } = findThreadIssues(
      [
        thread({ daysAgo: 45, is_internal: true }),
        thread({ daysAgo: 10, is_internal: true }),
      ],
      NAMES,
      NOW,
    );
    expect(stalled).toHaveLength(1);
    expect(stalled[0].days).toBe(45);
  });

  // Unknown authorship must not invent work — is_internal is nullable.
  it("does not assume a client is waiting when authorship is unknown", () => {
    const { awaitingUs } = findThreadIssues(
      [thread({ daysAgo: 20, is_internal: null })],
      NAMES,
      NOW,
    );
    expect(awaitingUs).toEqual([]);
  });

  it("puts the longest wait first", () => {
    const { awaitingUs } = findThreadIssues(
      [
        thread({ daysAgo: 5, is_internal: false, thread_title: "Newer" }),
        thread({ daysAgo: 25, is_internal: false, thread_title: "Older" }),
        thread({ daysAgo: 12, is_internal: false, thread_title: "Middle" }),
      ],
      NAMES,
      NOW,
    );
    expect(awaitingUs.map((f) => f.title)).toEqual(["Older", "Middle", "Newer"]);
  });

  it("falls back to the client id when a name is missing", () => {
    const { awaitingUs } = findThreadIssues(
      [thread({ daysAgo: 9, is_internal: false, client_id: 99 })],
      NAMES,
      NOW,
    );
    expect(awaitingUs[0].clientName).toBe("Client 99");
  });

  // One problem, named once — a long wait is both awaiting and stalled.
  it("does not list the same thread under both headings", () => {
    const { awaitingUs, stalled } = findThreadIssues(
      [thread({ daysAgo: 45, is_internal: false, thread_title: "Ad and Budget issues" })],
      NAMES,
      NOW,
    );
    expect(awaitingUs.map((f) => f.title)).toEqual(["Ad and Budget issues"]);
    expect(stalled).toEqual([]);
  });

  it("honours custom thresholds", () => {
    const rows = [thread({ daysAgo: 2, is_internal: false })];
    expect(findThreadIssues(rows, NAMES, NOW).awaitingUs).toEqual([]);
    expect(findThreadIssues(rows, NAMES, NOW, { awaitingDays: 1 }).awaitingUs).toHaveLength(1);
  });
});
