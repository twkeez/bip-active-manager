import { describe, expect, it } from "vitest";
import {
  backedByLine,
  checkedStrengths,
  clientDetail,
  clientPositioningLine,
  countWord,
  examplePrompt,
  farEnoughApart,
  highlightsNotReady,
} from "@/lib/website-audit/highlights";
import type { AiPrompt, AuditResults, PromptRun } from "@/lib/website-audit/types";

const about = "Locally owned and serving Powder Springs since 2001. We are a family, non-corporate practice.";
const pages: Record<string, string> = { "https://dhah.org/about/": about };
const pageText = (url: string) => pages[url] ?? null;
const reviews = [
  { text: "Dr. Toth sent a written report after the visit with the plan." },
  { text: "They let me wait in the car with my cat." },
];

describe("checkedStrengths (Dallas Highway #8 wording)", () => {
  it("keeps a strength whose quotes are on the page, without the advice", () => {
    const out = checkedStrengths(
      [
        {
          title: "Locally owned, serving the community since 2001",
          detail: "An independent, non-corporate practice. Lead with the 'since 2001' history and the locally owned status.",
          evidence: [{ source: "https://dhah.org/about/", quote: "serving Powder Springs since 2001" }],
        },
      ],
      pageText,
      reviews,
    );
    expect(out).toEqual([{ title: "Locally owned, serving the community since 2001", detail: "An independent, non-corporate practice.", backedBy: "website" }]);
  });

  it("drops a strength when a quote isn't really there", () => {
    const out = checkedStrengths(
      [{ title: "Open late", detail: "x", evidence: [{ source: "https://dhah.org/about/", quote: "open until midnight" }] }],
      pageText,
      reviews,
    );
    expect(out).toEqual([]);
  });

  it("drops an 'every visit' claim that only reviews back", () => {
    const out = checkedStrengths(
      [
        {
          title: "A written report and plan after every visit",
          detail: "Clients get a detailed follow-up. Few practices offer this, so put it on the homepage.",
          evidence: [{ source: "review 1", quote: "sent a written report after the visit" }],
        },
      ],
      pageText,
      reviews,
    );
    expect(out).toEqual([]);
  });

  it("drops 'never' sentences and commentary from a reviews-only strength", () => {
    const out = checkedStrengths(
      [
        {
          title: "Low-stress visits for cats",
          detail: "Owners can wait in the car with their cat. So they never sit next to dogs. This is a strong reason for cat owners to choose you.",
          evidence: [{ source: "review 2", quote: "wait in the car with my cat" }],
        },
      ],
      pageText,
      reviews,
    );
    expect(out).toEqual([{ title: "Low-stress visits for cats", detail: "Owners can wait in the car with their cat.", backedBy: "reviews" }]);
  });

  it("leaves out strengths about opening hours", () => {
    const out = checkedStrengths(
      [{ title: "Open evenings", detail: "Open until 10 pm.", evidence: [{ source: "https://dhah.org/about/", quote: "since 2001" }] }],
      pageText,
      reviews,
    );
    expect(out).toEqual([]);
  });

  it("says both when the website and reviews back it", () => {
    const out = checkedStrengths(
      [
        {
          title: "Local",
          detail: "Family practice.",
          evidence: [
            { source: "https://dhah.org/about/", quote: "since 2001" },
            { source: "review 1", quote: "written report" },
          ],
        },
      ],
      pageText,
      reviews,
    );
    expect(out[0].backedBy).toBe("both");
    expect(backedByLine("both")).toBe("Your reviews and website back this up.");
    expect(backedByLine("reviews")).toBe("Your Google reviews back this up.");
  });
});

describe("clientDetail", () => {
  it("removes comparisons with other practices", () => {
    expect(clientDetail("Vets explain options. Most practices nearby rush this.")).toBe("Vets explain options.");
  });
});

describe("clientPositioningLine", () => {
  it("hides a line in the practice's voice or with 'every'", () => {
    expect(clientPositioningLine("A Powder Springs practice where our vets take time.")).toBeNull();
    expect(clientPositioningLine("A practice that sends a plan after every visit.")).toBeNull();
    expect(clientPositioningLine("Dallas Highway Animal Hospital is a locally owned Powder Springs practice.")).toBe(
      "Dallas Highway Animal Hospital is a locally owned Powder Springs practice.",
    );
  });
});

describe("examplePrompt", () => {
  const prompts: AiPrompt[] = [
    { id: "s1", kind: "service", text: "dog vaccinations near Powder Springs GA" },
    { id: "s2", kind: "service", text: "pet dental care near Powder Springs GA" },
  ];
  it("prefers a question that included the practice", () => {
    const runs = [{ promptId: "s2", cited: true, mentioned: true }] as PromptRun[];
    expect(examplePrompt(prompts, runs, "service")).toBe("pet dental care near Powder Springs GA");
  });
  it("is null when no question of that kind ran", () => {
    expect(examplePrompt(prompts, [], "local")).toBeNull();
  });
});

describe("farEnoughApart", () => {
  it("compares only with a run four weeks older or more", () => {
    expect(farEnoughApart("2026-11-11T12:00:00Z", "2026-11-09T12:00:00Z")).toBe(false);
    expect(farEnoughApart("2026-11-11T12:00:00Z", "2026-10-10T12:00:00Z")).toBe(true);
    expect(farEnoughApart("2026-11-11T12:00:00Z", null)).toBe(false);
  });
});

describe("highlightsNotReady", () => {
  const ai = { complete: true, missing: 0, errors: [] } as unknown as AuditResults["aiVisibility"];
  const content = {} as AuditResults["content"];
  it("is empty for a finished US audit", () => {
    expect(highlightsNotReady({ city: "Powder Springs", state: "GA", results: { aiVisibility: ai, content } as AuditResults })).toEqual([]);
  });
  it("blocks Q1's audit (#10): Canadian and unfinished", () => {
    const q1 = { complete: false, missing: 36, errors: ["Invalid Field: 'location_name'"] } as unknown as AuditResults["aiVisibility"];
    const reasons = highlightsNotReady({ city: "Oshawa, Ontario, Canada", state: null, results: { aiVisibility: q1, content } as AuditResults });
    expect(reasons.some((r) => r.includes("Canada"))).toBe(true);
    expect(reasons.some((r) => r.includes("36 answers are missing"))).toBe(true);
  });
});

describe("countWord", () => {
  it("spells small counts", () => {
    expect(countWord(6)).toBe("six");
    expect(countWord(4)).toBe("four");
  });
});
