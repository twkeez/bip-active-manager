import { describe, expect, it } from "vitest";
import {
  matchToMasterSheet,
  parseMasterSheet,
  type MasterSheetRow,
} from "@/lib/clients/master-sheet";
import { normalizeClientName } from "@/lib/clients/normalize-name";

const row = (practiceName: string, extra: Partial<MasterSheetRow> = {}): MasterSheetRow => ({
  practiceName,
  normalizedName: normalizeClientName(practiceName),
  url: null,
  city: null,
  state: null,
  packageValue: null,
  strategist: null,
  ...extra,
});

describe("parseMasterSheet", () => {
  // The real sheet has a grouping row above the headers and columns that move,
  // so headings are found by name rather than position.
  const csv = [
    ",Business Information,,,,,,,Marketing Services",
    "Practice Name,URL,Group/Sister Practice,Affiliations,City,County,State,Package,Strategist",
    "Adobe Animal Hospital,adobeanimalhosp.com,Oroville,,Yuba City,,CA,7.00,Melissa",
    ",,,,,,,,",
    '"Quoted, Name Vet",example.com,,,Austin,,TX,2.00,Alex',
  ].join("\n");

  it("reads rows by heading, skipping the grouping row", () => {
    const rows = parseMasterSheet(csv);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      practiceName: "Adobe Animal Hospital",
      city: "Yuba City",
      state: "CA",
      packageValue: "7.00",
      strategist: "Melissa",
    });
  });

  it("handles quoted commas and drops rows with no practice name", () => {
    expect(parseMasterSheet(csv)[1].practiceName).toBe("Quoted, Name Vet");
  });

  it("returns nothing when the sheet has no Practice Name column", () => {
    expect(parseMasterSheet("a,b,c\n1,2,3")).toEqual([]);
  });

  it("keeps the first of a duplicated practice", () => {
    const dupe = "Practice Name,City\nAlpha Vet,Austin\nAlpha Vet,Dallas";
    expect(parseMasterSheet(dupe)).toHaveLength(1);
  });
});

describe("matchToMasterSheet", () => {
  it("matches on an exact name", () => {
    const result = matchToMasterSheet("Blackbob Pet Hospital and Cat Clinic", [
      row("Blackbob Pet Hospital and Cat Clinic"),
    ]);
    expect(result.confidence).toBe("exact");
  });

  // The cases the naive matcher missed, all real: Basecamp and the sheet write
  // the same practice differently.
  it("matches across the naming differences that actually occur", () => {
    const sheet = [
      row("Volunteer Veterinary Hospital"),
      row("Pet Dominion Animal Hospital"),
      row("Animal Medical Hospital & Urgent Care (NC)"),
      row("Ten West Bird & Animal Hospital"),
    ];
    expect(matchToMasterSheet("Volunteer Vet", sheet).row?.practiceName).toBe(
      "Volunteer Veterinary Hospital",
    );
    expect(matchToMasterSheet("Pet Dominion", sheet).row?.practiceName).toBe(
      "Pet Dominion Animal Hospital",
    );
    expect(matchToMasterSheet("Animal Medical Hospital & Urgent Care", sheet).row?.practiceName)
      .toBe("Animal Medical Hospital & Urgent Care (NC)");
    expect(matchToMasterSheet("Ten West Bird and Animal Hospital", sheet).row?.practiceName)
      .toBe("Ten West Bird & Animal Hospital");
  });

  // The false pairs a min-size similarity produced. These are separate
  // practices and pairing them would argue for the wrong action.
  it("does not pair practices that merely share common words", () => {
    const sheet = [row("Paws and Claws Veterinary Hospital")];
    expect(matchToMasterSheet("Happy Paws & Claws Veterinary Clinic", sheet).confidence).toBe(
      "none",
    );
  });

  it("does not treat a location suffix as the same practice", () => {
    const sheet = [row("PetSmart Veterinary Services - Smyrna")];
    expect(matchToMasterSheet("PetSmart Veterinary Services - Alpharetta", sheet).confidence)
      .toBe("none");
  });

  it("reports nothing when the practice is genuinely absent", () => {
    const sheet = [row("Paws and Claws Veterinary Hospital")];
    expect(matchToMasterSheet("Gerbil Town Veterinary", sheet)).toEqual({
      confidence: "none",
      row: null,
    });
  });

  it("never claims better than 'likely' for a fuzzy hit", () => {
    expect(matchToMasterSheet("Volunteer Vet", [row("Volunteer Veterinary Hospital")]).confidence)
      .toBe("likely");
  });
});
