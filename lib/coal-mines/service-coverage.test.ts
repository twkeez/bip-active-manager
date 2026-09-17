import { describe, expect, it } from "vitest";
import {
  findCoverageProblems,
  isPlaceholderKey,
  summariseCoverage,
  type CoverageClient,
} from "./service-coverage";

const now = new Date("2026-09-17T12:00:00Z");
const daysAgo = (days: number) => new Date(now.getTime() - days * 86_400_000).toISOString();

function client(overrides: Partial<CoverageClient> = {}): CoverageClient {
  return {
    id: 1,
    accountName: "Harmony Animal Hospital",
    services: ["ppc"],
    keys: { ads: "123-456-7890" },
    lastData: { ads: daysAgo(1) },
    ...overrides,
  };
}

describe("isPlaceholderKey", () => {
  // The ten clients this canary was written for: the field looked filled in.
  it("recognises a note left in an ID field", () => {
    for (const value of ["Needs added", "Check on services", "verify account", "Different account", "TBD"]) {
      expect(isPlaceholderKey(value)).toBe(true);
    }
  });

  it("accepts real identifiers", () => {
    for (const value of ["123-456-7890", "1234567890", "sc-domain:example.com", "https://www.example.com/", "example.com"]) {
      expect(isPlaceholderKey(value)).toBe(false);
    }
  });

  it("treats empty as not a placeholder — that is a different problem", () => {
    expect(isPlaceholderKey("")).toBe(false);
    expect(isPlaceholderKey(null)).toBe(false);
  });
});

describe("findCoverageProblems", () => {
  it("says nothing about a client whose data is current", () => {
    expect(findCoverageProblems([client()], now)).toEqual([]);
  });

  it("names the note someone left in the ID field", () => {
    const problems = findCoverageProblems(
      [client({ keys: { ads: "Needs added" }, lastData: {} })],
      now,
    );
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatchObject({ kind: "placeholder", sourceLabel: "Google Ads" });
    expect(problems[0].note).toContain("Needs added");
  });

  it("tells nothing-connected apart from connected-but-silent", () => {
    const [nothing] = findCoverageProblems([client({ keys: {}, lastData: {} })], now);
    expect(nothing.kind).toBe("not_connected");

    const [silent] = findCoverageProblems([client({ lastData: {} })], now);
    expect(silent.kind).toBe("no_data");
    expect(silent.note).toContain("never returned data");

    const [stopped] = findCoverageProblems([client({ lastData: { ads: daysAgo(40) } })], now);
    expect(stopped.note).toContain("no data since");
  });

  // A client is only asked about what they pay for.
  it("ignores a source for a service the client does not buy", () => {
    const problems = findCoverageProblems(
      [client({ services: ["ppc"], keys: { ads: "123-456-7890" }, lastData: { ads: daysAgo(1) } })],
      now,
    );
    expect(problems).toEqual([]);
  });

  it("checks every service a client does buy", () => {
    const problems = findCoverageProblems(
      [
        client({
          services: ["ppc", "seo", "orm"],
          keys: { ads: "123-456-7890", searchConsole: "https://example.com", reviews: "" },
          lastData: { ads: daysAgo(1) },
        }),
      ],
      now,
    );
    expect(problems.map((problem) => problem.sourceLabel).sort()).toEqual([
      "Google reviews",
      "Search Console",
    ]);
  });

  it("counts clients, not rows", () => {
    const problems = findCoverageProblems(
      [
        client({ services: ["ppc", "seo"], keys: {}, lastData: {} }),
        client({ id: 2, accountName: "Second", services: ["ppc"], keys: { ads: "Needs added" }, lastData: {} }),
      ],
      now,
    );
    expect(summariseCoverage(problems)).toMatchObject({
      clients: 2,
      problems: 3,
      placeholders: 1,
      notConnected: 2,
    });
  });
});
