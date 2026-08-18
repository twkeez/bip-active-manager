import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchBacklinkSummary, fetchBacklinks } from "@/lib/dataforseo/backlinks";

const CONFIG = { login: "user", password: "pass" };

// Field names and value formats copied from a live DataForSEO response for
// allcrittersvet.com, so the normalizers are exercised against real shapes.
function mockResponse(result: unknown) {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      status_code: 20000,
      tasks: [{ status_code: 20000, result: [result] }],
    }),
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchBacklinkSummary", () => {
  it("normalizes profile totals and the DataForSEO timestamp format", async () => {
    vi.stubGlobal(
      "fetch",
      mockResponse({
        target: "allcrittersvet.com",
        rank: 131,
        backlinks: 97,
        backlinks_spam_score: 27,
        broken_backlinks: 0,
        referring_domains: 75,
        referring_domains_nofollow: 32,
        referring_main_domains: 72,
        first_seen: "2020-10-31 16:38:31 +00:00",
        info: { cms: "wordpress" },
      }),
    );

    const result = await fetchBacklinkSummary(CONFIG, "https://www.allcrittersvet.com/");
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.summary.target).toBe("allcrittersvet.com");
    expect(result.summary.referringDomains).toBe(75);
    expect(result.summary.spamScore).toBe(27);
    expect(result.summary.cms).toBe("wordpress");
    expect(result.summary.firstSeen).toBe("2020-10-31T16:38:31.000Z");
  });

  it("rejects an empty domain without spending a request", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const result = await fetchBacklinkSummary(CONFIG, "   ");
    expect(result.ok).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("fetchBacklinks", () => {
  it("maps live rows and keeps unknown values null rather than zero", async () => {
    vi.stubGlobal(
      "fetch",
      mockResponse({
        total_count: 77,
        items: [
          {
            domain_from: "findanexoticvet.com",
            url_from: "https://findanexoticvet.com/clinics/all-critters",
            url_to: "https://www.allcrittersvet.com/",
            page_from_title: "All Critters Veterinary Hospital | Exotic Vet Finder",
            anchor: "All Critters Veterinary Hospital",
            dofollow: true,
            backlink_spam_score: 0,
            domain_from_rank: 113,
            links_count: 2,
            is_lost: false,
            is_new: false,
            is_broken: false,
            first_seen: "2020-10-31 16:38:31 +00:00",
            last_seen: "2026-08-01 09:12:44 +00:00",
          },
          {
            domain_from: "directory-spam.example",
            url_from: "https://directory-spam.example/vets",
            url_to: "https://www.allcrittersvet.com/",
            anchor: null,
            dofollow: false,
            backlink_spam_score: 74,
            is_lost: true,
          },
        ],
      }),
    );

    const result = await fetchBacklinks(CONFIG, "allcrittersvet.com");
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const [first, second] = result.rows;
    expect(first.domainFrom).toBe("findanexoticvet.com");
    expect(first.dofollow).toBe(true);
    expect(first.linksFromDomain).toBe(2);
    expect(first.lastSeen).toBe("2026-08-01T09:12:44.000Z");

    expect(second.dofollow).toBe(false);
    expect(second.anchor).toBeNull();
    expect(second.isLost).toBe(true);
    expect(second.spamScore).toBe(74);
    // Absent in the payload — must stay null so the table renders "—".
    expect(second.domainRank).toBeNull();
    expect(second.firstSeen).toBeNull();
    expect(second.linksFromDomain).toBe(1);
  });

  it("surfaces a DataForSEO task error instead of returning empty rows", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          status_code: 20000,
          tasks: [{ status_code: 40501, status_message: "Invalid Path." }],
        }),
      }),
    );

    const result = await fetchBacklinks(CONFIG, "allcrittersvet.com");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("Invalid Path.");
  });
});
