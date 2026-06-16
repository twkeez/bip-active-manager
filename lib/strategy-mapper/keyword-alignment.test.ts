import { describe, expect, it } from "vitest";
import {
  buildDeterministicKeywordCoverage,
  collectTargetKeywords,
  keywordPresentInText,
} from "@/lib/strategy-mapper/keyword-alignment";
import type { KeywordMatrixRow } from "@/types/strategy-mapper";

const matrix: KeywordMatrixRow[] = [
  {
    intentCategory: "Emergency",
    targetGeography: "Howell NJ",
    keywordVariations: ["emergency vet Howell", "24 hour vet near me"],
  },
  {
    intentCategory: "Wellness",
    targetGeography: "Monmouth County",
    keywordVariations: ["veterinarian Howell NJ"],
  },
];

describe("collectTargetKeywords", () => {
  it("flattens keyword variations from matrix rows", () => {
    expect(collectTargetKeywords(matrix)).toEqual([
      "emergency vet Howell",
      "24 hour vet near me",
      "veterinarian Howell NJ",
    ]);
  });
});

describe("keywordPresentInText", () => {
  it("matches full keyword phrases case-insensitively", () => {
    expect(
      keywordPresentInText(
        "emergency vet Howell",
        "Best Emergency Vet Howell NJ — Open 24 Hours",
      ),
    ).toBe(true);
  });

  it("matches when most significant tokens appear", () => {
    expect(
      keywordPresentInText("veterinarian Howell NJ", "Howell veterinarian and cat care"),
    ).toBe(true);
  });

  it("returns false when keyword is absent", () => {
    expect(keywordPresentInText("exotic avian vet", "Dog and cat wellness clinic")).toBe(false);
  });
});

describe("buildDeterministicKeywordCoverage", () => {
  it("records where keywords were found and lists gaps", () => {
    const result = buildDeterministicKeywordCoverage(matrix, [
      {
        label: "Homepage title",
        text: "Emergency Vet Howell — 24 Hour Animal Hospital",
      },
      { label: "Homepage meta", text: "Wellness exams for dogs and cats" },
    ]);

    expect(result.coverage.find((row) => row.keyword === "emergency vet Howell")?.foundIn).toEqual([
      "Homepage title",
    ]);
    expect(result.gaps).toContain("veterinarian Howell NJ");
    expect(result.gaps).toContain("24 hour vet near me");
  });
});
