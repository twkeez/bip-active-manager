import { describe, expect, it } from "vitest";
import type { ThreadFinding } from "@/lib/coal-mines/basecamp-threads";
import { readSettings, reviewThreads } from "./basecamp-review";

const thread = (overrides: Partial<ThreadFinding> = {}): ThreadFinding => ({
  projectId: "1",
  clientId: 1,
  clientName: "Curem Veterinary Care",
  hasClient: true,
  title: "Q3 marketing",
  url: "https://basecamp.com/x",
  days: 4,
  ...overrides,
});

const settings = { replyAfterDays: 3, quietAfterDays: 14 };

describe("reviewThreads", () => {
  it("lists what needs a reply and what has gone quiet, under the routine's own headings", () => {
    const result = reviewThreads(
      {
        awaitingUs: [thread({ title: "Photos for October", days: 5 })],
        awaitingThem: [],
        stalled: [thread({ projectId: "2", title: "Website launch", days: 21 })],
        considered: 40,
      },
      settings,
    );
    expect(result.status).toBe("attention");
    expect(result.headline).toBe("1 thread needs a reply, 1 gone quiet for 14+ days.");
    expect(result.findings.map((finding) => finding.group)).toEqual([
      "Needs a reply from us",
      "No next step, quiet 14+ days",
    ]);
  });

  // A thread both waiting on us and quiet is listed once, as the urgent thing.
  it("never lists the same thread twice", () => {
    const both = thread({ title: "Budget question", days: 20 });
    const result = reviewThreads({ awaitingUs: [both], awaitingThem: [], stalled: [both], considered: 10 }, settings);
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].group).toBe("Needs a reply from us");
  });

  it("says plainly when there is nothing to do", () => {
    const result = reviewThreads({ awaitingUs: [], awaitingThem: [], stalled: [], considered: 52 }, settings);
    expect(result.status).toBe("ok");
    expect(result.headline).toContain("52 client threads checked");
  });

  it("flags a client kept waiting a week or more", () => {
    const result = reviewThreads(
      { awaitingUs: [thread({ days: 9 }), thread({ title: "Other", days: 4 })], awaitingThem: [], stalled: [], considered: 5 },
      settings,
    );
    expect(result.findings.map((finding) => finding.flagged)).toEqual([true, false]);
  });

  it("uses the quiet threshold it was given", () => {
    const result = reviewThreads(
      { awaitingUs: [], awaitingThem: [], stalled: [thread({ days: 30 })], considered: 5 },
      { replyAfterDays: 3, quietAfterDays: 21 },
    );
    expect(result.findings[0].group).toBe("No next step, quiet 21+ days");
  });
});

// The bug this caught: threads where we are waiting on the client were filed
// separately by the thread check and never reached the review at all.
describe("threads waiting on the client", () => {
  it("lists them once they have been quiet past the threshold", () => {
    const result = reviewThreads(
      {
        awaitingUs: [],
        awaitingThem: [thread({ title: "Send us your logo", days: 20 }), thread({ title: "Recent ask", days: 8 })],
        stalled: [],
        considered: 10,
      },
      settings,
    );
    expect(result.findings.map((finding) => finding.label)).toEqual(["Send us your logo"]);
    expect(result.findings[0].group).toBe("Waiting on the client, 14+ days");
    expect(result.headline).toContain("1 gone quiet for 14+ days");
  });
});

describe("readSettings", () => {
  it("falls back to the defaults for anything missing or nonsense", () => {
    expect(readSettings({})).toEqual({ replyAfterDays: 3, quietAfterDays: 14 });
    expect(readSettings({ quietAfterDays: "fourteen", replyAfterDays: -2 })).toEqual({
      replyAfterDays: 3,
      quietAfterDays: 14,
    });
    expect(readSettings({ quietAfterDays: 21 })).toMatchObject({ quietAfterDays: 21 });
  });
});
