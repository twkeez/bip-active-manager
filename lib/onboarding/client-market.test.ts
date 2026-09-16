import { describe, expect, it } from "vitest";
import { buildClientMarket, clientSafeDescription, parseCompetitorName } from "./client-market";

describe("parseCompetitorName", () => {
  it("separates the town the research appends in brackets", () => {
    expect(parseCompetitorName("Alto Tiburon Veterinary Hospital (Mill Valley, CA)")).toEqual({
      name: "Alto Tiburon Veterinary Hospital",
      location: "Mill Valley, CA",
    });
  });

  it("keeps a name with no location as it is", () => {
    expect(parseCompetitorName("Harbor Veterinary Services")).toEqual({
      name: "Harbor Veterinary Services",
      location: null,
    });
  });
});

describe("clientSafeDescription", () => {
  // The case that prompted this: review sentiment about another practice, quoted
  // in a document the client may forward.
  it("skips a sentence repeating another practice's review complaints", () => {
    expect(
      clientSafeDescription(
        "Reviews note pricing concerns, with some clients calling emergency visit costs 'exorbitant'. They offer CT scanning and laser therapy.",
      ),
    ).toBe("They offer CT scanning and laser therapy.");
  });

  it("keeps neutral mentions of visibility", () => {
    const note =
      "Alto Tiburon has operated since 1974 and has highly visible Yelp and Google rankings. Some clients complain about wait times.";
    expect(clientSafeDescription(note)).toBe(
      "Alto Tiburon has operated since 1974 and has highly visible Yelp and Google rankings.",
    );
  });

  it("does not split a sentence at a doctor's title", () => {
    expect(clientSafeDescription("A one-doctor practice led by Dr. Shruti Vaikhary, with a fear-free approach.")).toBe(
      "A one-doctor practice led by Dr. Shruti Vaikhary, with a fear-free approach.",
    );
  });

  // What PAWS's research actually looked like.
  it("does not split a sentence at an address's street direction", () => {
    expect(
      clientSafeDescription("Situated at 15200 S. Jog Rd in Delray Beach, a practice open six days a week. It opened in 2019."),
    ).toBe("Situated at 15200 S. Jog Rd in Delray Beach, a practice open six days a week.");
    expect(clientSafeDescription("A chain location opened in 2023 at 5066 W. Atlantic Ave., with online booking.")).toBe(
      "A chain location opened in 2023 at 5066 W. Atlantic Ave., with online booking.",
    );
  });

  it("returns nothing when every sentence is unsuitable", () => {
    expect(clientSafeDescription("Clients complain about rude staff. Prices are overpriced.")).toBeNull();
    expect(clientSafeDescription("")).toBeNull();
  });

  // The first cut ended every Tiburon description mid-phrase with "…".
  it("keeps a long research sentence whole when it fits", () => {
    const sentence =
      "The closest competitor, Alto Tiburon has operated since 1974 and offers a comprehensive full-service hospital experience including cancer therapy, exotic animal care, advanced diagnostics, and emergency services — with a strong, well-established online presence and highly visible Yelp and Google rankings.";
    expect(sentence.length).toBeGreaterThan(300);
    expect(clientSafeDescription(sentence)).toBe(sentence);
  });

  it("shortens a genuinely long sentence at a clause break, ending in a full stop", () => {
    const long = `A long-established practice on Miller Avenue, well regarded for personal care, ${"known across the county for many things ".repeat(12)}and more.`;
    const description = clientSafeDescription(long)!;
    expect(description.length).toBeLessThanOrEqual(421);
    expect(description.endsWith(".")).toBe(true);
    expect(description).not.toContain("…");
  });

  it("leaves the description out rather than cut it mid-phrase when there is no clean break", () => {
    expect(clientSafeDescription(`A${" word".repeat(120)}.`)).toBeNull();
  });
});

describe("buildClientMarket", () => {
  it("is null when there is no research, so the section does not print", () => {
    expect(buildClientMarket(null)).toBeNull();
    expect(buildClientMarket({ competitors: [], marketSnapshot: " ", searchLandscape: "" })).toBeNull();
  });

  it("carries the summary, the landscape and the named practices only", () => {
    const market = buildClientMarket({
      marketSnapshot: "Tiburon is a small, affluent peninsula community.",
      searchLandscape: "Searches pull results from across Marin County.",
      competitors: [
        { name: "Marin City Animal Hospital (Sausalito, CA)", note: "A newer practice open seven days a week." },
        { name: "  ", note: "no name" },
      ],
    });
    expect(market).toEqual({
      snapshot: "Tiburon is a small, affluent peninsula community.",
      landscape: "Searches pull results from across Marin County.",
      competitors: [
        {
          name: "Marin City Animal Hospital",
          location: "Sausalito, CA",
          description: "A newer practice open seven days a week.",
        },
      ],
    });
  });
});
