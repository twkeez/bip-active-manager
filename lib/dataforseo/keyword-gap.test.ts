import { describe, expect, it } from "vitest";
import { cleanDomain, dataForSeoTaskError, extractTaskResultItems } from "@/lib/dataforseo/client";
import { formatKeywordGapItems } from "@/lib/dataforseo/keyword-gap";

describe("cleanDomain", () => {
  it("strips protocol, www, paths, and trailing slashes", () => {
    expect(cleanDomain("https://www.Example.com/about")).toBe("example.com");
    expect(cleanDomain("http://www.competitor.com/")).toBe("competitor.com");
    expect(cleanDomain("competitor.com/")).toBe("competitor.com");
    expect(cleanDomain("www.client.com/services/vet")).toBe("client.com");
    expect(cleanDomain("  HTTPS://Client.com/  ")).toBe("client.com");
  });
});

describe("formatKeywordGapItems", () => {
  const items = [
    {
      keyword_data: {
        keyword: "plumber near me",
        keyword_info: { search_volume: 1200 },
        serp_info: { keyword_difficulty: 42 },
      },
      first_domain_serp_element: null,
      second_domain_serp_element: { rank_absolute: 3 },
    },
    {
      keyword_data: {
        keyword: "emergency plumbing",
        keyword_info: { search_volume: 800 },
        serp_info: { keyword_difficulty: 55 },
      },
      first_domain_serp_element: { rank_absolute: 18 },
      second_domain_serp_element: { rank_absolute: 4 },
    },
    {
      keyword_data: {
        keyword: "drain cleaning",
        keyword_info: { search_volume: 500 },
        serp_info: { keyword_difficulty: 30 },
      },
      first_domain_serp_element: { rank_absolute: 5 },
      second_domain_serp_element: { rank_absolute: 9 },
    },
  ];

  it("maps missing, weak, and shared segments from domain intersection items", () => {
    const rows = formatKeywordGapItems(items, "client.com", "competitor.com");
    expect(rows).toHaveLength(3);
    expect(rows[0]?.type).toBe("missing");
    expect(rows[0]?.clientRank).toBe("-");
    expect(rows[1]?.type).toBe("weak");
    expect(rows[2]?.type).toBe("shared");
    expect(rows[1]?.difficulty).toBe("55%");
  });
});

describe("extractTaskResultItems", () => {
  it("reads nested task result items", () => {
    const items = extractTaskResultItems({
      tasks: [{ result: [{ items: [{ keyword: "test" }] }] }],
    });
    expect(items).toEqual([{ keyword: "test" }]);
  });
});

describe("dataForSeoTaskError", () => {
  it("returns null for successful responses", () => {
    expect(dataForSeoTaskError({ status_code: 20000, tasks: [{ status_code: 20000 }] })).toBeNull();
  });

  it("returns task error messages", () => {
    expect(
      dataForSeoTaskError({
        status_code: 20000,
        tasks: [{ status_code: 40000, status_message: "Invalid target." }],
      }),
    ).toBe("Invalid target.");
  });
});
