import { describe, expect, it } from "vitest";
import {
  findThreadIssues,
  isInternalThread,
  stillNeedsReply,
  verdictIsCurrent,
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

describe("stillNeedsReply — the noise filter", () => {
  const base = (over: Partial<ThreadRow>): ThreadRow =>
    thread({ daysAgo: 10, is_internal: false, thread_excerpt: "the last message", ...over });

  // Fail open. An unread thread must never be hidden — missing a real request
  // costs far more than one extra row.
  it("keeps a thread nothing has read yet", () => {
    expect(stillNeedsReply(base({ reply_need: null }))).toBe(true);
  });

  it("drops a thread judged closed or informational", () => {
    expect(
      stillNeedsReply(base({ reply_need: "closed", classified_excerpt: "the last message" })),
    ).toBe(false);
    expect(
      stillNeedsReply(base({ reply_need: "fyi", classified_excerpt: "the last message" })),
    ).toBe(false);
  });

  it("keeps needs_reply and unclear", () => {
    expect(
      stillNeedsReply(base({ reply_need: "needs_reply", classified_excerpt: "the last message" })),
    ).toBe(true);
    expect(
      stillNeedsReply(base({ reply_need: "unclear", classified_excerpt: "the last message" })),
    ).toBe(true);
  });

  // The case that would silently break it: a thread read as "closed", then the
  // client asks something new. The stale verdict must not hide the new message.
  it("stops trusting a verdict once the thread has moved on", () => {
    const moved = base({
      reply_need: "closed",
      classified_excerpt: "thanks much",
      thread_excerpt: "actually, one more thing — can we change the date?",
    });
    expect(verdictIsCurrent(moved)).toBe(false);
    expect(stillNeedsReply(moved)).toBe(true);
  });
});

describe("findThreadIssues with verdicts", () => {
  it("filters out the announcements and thank-yous", () => {
    const { awaitingUs } = findThreadIssues(
      [
        thread({
          daysAgo: 4,
          is_internal: false,
          thread_title: "Closed for Labor Day",
          thread_excerpt: "We will be closed Monday",
          classified_excerpt: "We will be closed Monday",
          reply_need: "fyi",
        }),
        thread({
          daysAgo: 12,
          is_internal: false,
          thread_title: "Marketing Updates Q1",
          thread_excerpt: "can we move this to the 15th?",
          classified_excerpt: "can we move this to the 15th?",
          reply_need: "needs_reply",
        }),
      ],
      NAMES,
      NOW,
    );
    expect(awaitingUs.map((f) => f.title)).toEqual(["Marketing Updates Q1"]);
  });

  it("puts someone chasing us above someone who has merely waited longer", () => {
    const { awaitingUs } = findThreadIssues(
      [
        thread({
          daysAgo: 30,
          is_internal: false,
          thread_title: "Old but calm",
          thread_excerpt: "x",
          classified_excerpt: "x",
          reply_need: "needs_reply",
        }),
        thread({
          daysAgo: 5,
          is_internal: false,
          thread_title: "Chasing us",
          thread_excerpt: "y",
          classified_excerpt: "y",
          reply_need: "needs_reply",
          reply_need_escalated: true,
        }),
      ],
      NAMES,
      NOW,
    );
    expect(awaitingUs.map((f) => f.title)).toEqual(["Chasing us", "Old but calm"]);
  });
});
