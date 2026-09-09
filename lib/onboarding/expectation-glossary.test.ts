import { describe, expect, it } from "vitest";
import { selectGlossaryTerms, type GlossaryTerm } from "@/lib/onboarding/expectation-glossary";
import type { ClientActiveServices } from "@/lib/clients/types";

const services = (active: Partial<ClientActiveServices>): ClientActiveServices => ({
  seo: false,
  ppc: false,
  smm: false,
  blog: false,
  orm: false,
  ...active,
});

const term = (over: Partial<GlossaryTerm> & { term: string }): GlossaryTerm => ({
  definition: "A definition.",
  services: [],
  sortOrder: 0,
  ...over,
});

describe("selectGlossaryTerms", () => {
  it("keeps terms for services the client actually bought", () => {
    const kept = selectGlossaryTerms(
      [
        term({ term: "Map Pack", services: ["seo"] }),
        term({ term: "Quality Score", services: ["ppc"] }),
      ],
      services({ seo: true }),
    );
    expect(kept.map((t) => t.term)).toEqual(["Map Pack"]);
  });

  it("always keeps an untagged term", () => {
    const kept = selectGlossaryTerms([term({ term: "Impressions" })], services({ ppc: true }));
    expect(kept).toHaveLength(1);
  });

  it("keeps a term shared by two services once", () => {
    const kept = selectGlossaryTerms(
      [term({ term: "Impressions", services: ["seo", "ppc"] })],
      services({ seo: true, ppc: true }),
    );
    expect(kept).toHaveLength(1);
  });

  // Printing one term twice under two definitions reads as carelessness in a
  // document whose whole job is to make us look like we know what we are doing.
  it("drops a duplicated term, however it was cased", () => {
    const kept = selectGlossaryTerms(
      [
        term({ term: "Backlink", definition: "First." }),
        term({ term: "  backlink ", definition: "Second." }),
      ],
      services({ seo: true }),
    );
    expect(kept).toHaveLength(1);
    expect(kept[0].definition).toBe("First.");
  });

  it("skips a term with no definition yet", () => {
    expect(
      selectGlossaryTerms([term({ term: "Half-written", definition: "  " })], services({ seo: true })),
    ).toEqual([]);
  });

  it("orders as authored, then alphabetically", () => {
    const kept = selectGlossaryTerms(
      [
        term({ term: "Zebra", sortOrder: 1 }),
        term({ term: "Beta", sortOrder: 2 }),
        term({ term: "Alpha", sortOrder: 2 }),
      ],
      services({ seo: true }),
    );
    expect(kept.map((t) => t.term)).toEqual(["Zebra", "Alpha", "Beta"]);
  });

  it("returns nothing when the client bought nothing tagged", () => {
    expect(
      selectGlossaryTerms([term({ term: "Map Pack", services: ["seo"] })], services({ ppc: true })),
    ).toEqual([]);
  });
});
