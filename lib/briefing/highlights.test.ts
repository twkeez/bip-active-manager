import { describe, expect, it } from "vitest";
import {
  rateText,
  risingHighlight,
  selectHighlights,
  totalHighlight,
  worthSending,
  type Highlight,
} from "./highlights";
import { composeClientMessage, composeStrategistNote } from "./compose";
import type { ClientBriefing } from "./types";

describe("risingHighlight", () => {
  it("names a real rise, with the numbers behind it", () => {
    expect(
      risingHighlight({
        id: "x",
        scope: "account",
        noun: "Website traffic",
        period: { current: 1967, previous: 1150 },
        floor: 100,
      })?.text,
    ).toBe("Website traffic increased 71% (1,967 this month, up from 1,150)");
  });

  it("stays quiet about ordinary movement", () => {
    expect(
      risingHighlight({ id: "x", scope: "seo", noun: "Visits", period: { current: 105, previous: 100 }, floor: 40 }),
    ).toBeNull();
  });

  // The client half may never carry a fall; that is the strategist's to raise.
  it("never turns a drop into a highlight", () => {
    expect(
      risingHighlight({ id: "x", scope: "seo", noun: "Visits", period: { current: 40, previous: 400 }, floor: 40 }),
    ).toBeNull();
  });

  it("will not celebrate a rise from nothing", () => {
    expect(
      risingHighlight({ id: "x", scope: "smm", noun: "Reach", period: { current: 900, previous: 0 }, floor: 200 }),
    ).toBeNull();
  });
});

describe("totalHighlight", () => {
  it("reports a total worth reporting", () => {
    expect(
      totalHighlight({
        id: "x",
        scope: "ppc",
        value: 1204,
        floor: 40,
        text: (formatted) => `Google Ads brought ${formatted} visits`,
      })?.text,
    ).toBe("Google Ads brought 1,204 visits");
  });

  it("stays quiet about a total too small to be news", () => {
    expect(totalHighlight({ id: "x", scope: "ppc", value: 9, floor: 40, text: (f) => f })).toBeNull();
  });

  it("writes rates as whole percentages", () => {
    expect(rateText(581, 1204)).toBe("48%");
    expect(rateText(5, 0)).toBeNull();
  });
});

describe("selectHighlights", () => {
  const highlight = (id: string, scope: Highlight["scope"]): Highlight => ({ id, scope, text: id });

  it("leads with the website overall, then ads, then the rest", () => {
    const chosen = selectHighlights([
      highlight("reviews", "orm"),
      highlight("search", "seo"),
      highlight("traffic", "account"),
      highlight("ads", "ppc"),
    ]);
    expect(chosen.map((item) => item.id)).toEqual(["traffic", "ads", "search", "reviews"]);
  });

  it("needs more than one thing before a note is worth sending", () => {
    expect(worthSending([highlight("a", "ppc")])).toBe(false);
    expect(worthSending([highlight("a", "ppc"), highlight("b", "orm")])).toBe(true);
  });
});

function briefing(overrides: Partial<ClientBriefing> = {}): ClientBriefing {
  return {
    clientId: 1,
    clientName: "Oroville Animal Hospital",
    services: [
      { key: "seo", label: "SEO", planLabel: "Premium" },
      { key: "ppc", label: "Google Ads", planLabel: "Premium" },
    ],
    strategists: [{ name: "Stephanie", email: "stephanie@beyondindigo.com" }],
    findings: [
      { id: "f1", scope: "ppc", level: "needs_you", headline: "Losing impression share to budget" },
    ],
    blindSpots: [{ scope: "seo", source: "Search Console", reason: "No access", lastSeen: null }],
    highlights: [
      { id: "h1", scope: "account", text: "Website traffic increased 51%" },
      { id: "h2", scope: "ppc", text: "Google Ads brought 1,204 visits" },
    ],
    clientNoteReady: true,
    quiet: false,
    generatedAt: "2026-09-17T00:00:00Z",
    ...overrides,
  };
}

describe("the two messages", () => {
  // The whole point of the split: a practice must never receive our problems
  // by accident, and must never be told something is wrong before their
  // strategist has decided how to say it.
  it("keeps every problem out of the client's message", () => {
    const message = composeClientMessage(briefing()) ?? "";
    expect(message).toContain("Website traffic increased 51%");
    expect(message).not.toContain("impression share");
    expect(message).not.toContain("Search Console");
    expect(message).not.toMatch(/could not see/i);
    expect(message).toMatch(/^Hi Oroville Animal Hospital team,/);
    expect(message.trimEnd().endsWith("Stephanie")).toBe(true);
  });

  it("writes service names as names, not lowercase", () => {
    expect(composeClientMessage(briefing())).toContain("SEO and Google Ads");
  });

  it("sends nothing to a client when there is not enough good news", () => {
    expect(composeClientMessage(briefing({ highlights: [], clientNoteReady: false }))).toBeNull();
  });

  it("tells the strategist whether a client message is waiting", () => {
    expect(composeStrategistNote(briefing())).toContain("A client update is ready to send");
    expect(composeStrategistNote(briefing({ clientNoteReady: false, highlights: [] }))).toContain(
      "No client update this time",
    );
  });

  it("still gives the strategist the blind spots", () => {
    expect(composeStrategistNote(briefing())).toContain("Search Console");
  });
});
