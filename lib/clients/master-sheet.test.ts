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

  // Real pairs from the live sheet that earlier rules got wrong. Each is two
  // different businesses whose names overlap, and pairing them would have put a
  // dead project in front of Tom as a live client — or hidden a live one.
  it("does not pair practices that merely share common words", () => {
    const sheet = [row("Paws Veterinary Clinic"), row("Paws and Claws Veterinary Hospital")];
    expect(matchToMasterSheet("Happy Paws & Claws Veterinary Clinic", sheet).confidence).toBe("none");
    expect(matchToMasterSheet("Paws to Claws Veterinary Clinic", sheet).confidence).toBe("none");
  });

  it("does not treat a location suffix as the same practice", () => {
    const sheet = [row("PetSmart Veterinary Services - Smyrna")];
    expect(matchToMasterSheet("PetSmart Veterinary Services - Alpharetta", sheet).confidence)
      .toBe("none");
    // The bare name is a clean prefix of the Smyrna one, which is exactly the
    // shape a containment test waves through.
    expect(matchToMasterSheet("PetSmart Veterinary Services", sheet).confidence).toBe("none");
  });

  it("ignores a state tag, which is a note rather than a different practice", () => {
    const sheet = [row("RPVH - Bayside Animal Hospital"), row("Trilogy Veterinary Medical Center (UT)")];
    expect(matchToMasterSheet("RPVH - Bayside Animal Hospital (CA)", sheet).row?.practiceName)
      .toBe("RPVH - Bayside Animal Hospital");
    expect(matchToMasterSheet("Trilogy Veterinary Medical Center", sheet).row?.practiceName)
      .toBe("Trilogy Veterinary Medical Center (UT)");
  });

  it("matches when only generic words differ", () => {
    const sheet = [row("Capital Home Veterinary Care"), row("Northside Paws Veterinary Care")];
    expect(matchToMasterSheet("Capital Home Vet Care", sheet).confidence).toBe("likely");
    expect(
      matchToMasterSheet("Northside Paws Veterinary Care (Frank Veterinary Services)", sheet)
        .confidence,
    ).toBe("likely");
  });

  // Every word is generic once trimmed, so there is no distinctive core to
  // compare and whole-name similarity has to carry it.
  it("still matches names made entirely of generic words", () => {
    const sheet = [row("Animal Medical Hospital & Urgent Care (NC)")];
    expect(matchToMasterSheet("Animal Medical Hospital & Urgent Care", sheet).confidence)
      .toBe("likely");
  });

  it("reports nothing when the practice is genuinely absent", () => {
    const sheet = [row("Paws and Claws Veterinary Hospital")];
    expect(matchToMasterSheet("Gerbil Town Veterinary", sheet)).toMatchObject({
      confidence: "none",
      row: null,
    });
  });

  // A missed match is the dangerous one: it drops a live client into the group
  // that gets ignored in bulk. Live data had "Robert Santos" on a project and
  // "Rob Santos" on the sheet, which no token rule will pair.
  it("names the closest sheet entry when nothing matched", () => {
    const result = matchToMasterSheet("PetSmart Veterinary Services", [
      row("PetSmart Veterinary Services - Smyrna"),
    ]);
    expect(result.confidence).toBe("none");
    expect(result.nearest?.row.practiceName).toBe("PetSmart Veterinary Services - Smyrna");
  });

  it("offers no near miss when nothing is remotely close", () => {
    expect(matchToMasterSheet("Gerbil Town Veterinary", [row("Adobe Animal Hospital")]).nearest)
      .toBeNull();
  });

  it("never claims better than 'likely' for a fuzzy hit", () => {
    expect(matchToMasterSheet("Volunteer Vet", [row("Volunteer Veterinary Hospital")]).confidence)
      .toBe("likely");
  });
});
