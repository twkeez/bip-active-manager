import { describe, expect, it } from "vitest";
import type { MasterSheetRow } from "@/lib/clients/master-sheet";
import { normalizeClientName } from "@/lib/clients/normalize-name";
import { compact, suggestPracticeForRequester } from "@/lib/help-desk/suggest";

function practice(practiceName: string, url: string | null, former = false): MasterSheetRow {
  return {
    practiceName,
    normalizedName: normalizeClientName(practiceName),
    url,
    city: null,
    state: null,
    packageValue: null,
    strategist: null,
    former,
  };
}

const quitman = practice("Quitman Animal Clinic", "quitmanvetclinic.com");
const happyPaws = practice("Happy Paws Veterinary Hospital", "happypawsvet.com");
const lakeNorth = practice("Lakeside Animal Hospital North", "lakesidenorth.com");
const lakeSouth = practice("Lakeside Animal Hospital South", "lakesidesouth.com");
const oldOak = practice("Old Oak Veterinary Clinic", "oldoakvet.com", true);
const practices = [quitman, happyPaws, lakeNorth, lakeSouth, oldOak];

describe("compact", () => {
  it("drops case, spaces, punctuation and parentheticals", () => {
    expect(compact("Quitman Animal Clinic (MS)")).toBe("quitmananimalclinic");
    expect(compact("Paws & Claws")).toBe("pawsandclaws");
  });
});

describe("suggestPracticeForRequester", () => {
  it("is High when a Gmail address is the practice's name", () => {
    const s = suggestPracticeForRequester(practices, { email: "quitmananimalclinic@gmail.com" });
    expect(s).toMatchObject({ practice: quitman, confidence: "High" });
    expect(s?.reason).toContain("quitmananimalclinic@gmail.com");
  });

  it("is High when the address is the practice's web address", () => {
    expect(suggestPracticeForRequester(practices, { email: "happypawsvet@yahoo.com" })).toMatchObject({
      practice: happyPaws,
      confidence: "High",
    });
  });

  it("is Medium when only the distinctive part of the name appears", () => {
    expect(suggestPracticeForRequester(practices, { email: "quitmanvet1@aol.com" })).toMatchObject({
      practice: quitman,
      confidence: "Medium",
    });
  });

  it("is Medium when a ticket subject names the practice", () => {
    expect(
      suggestPracticeForRequester(practices, {
        email: "jsmith1978@gmail.com",
        subjects: ["Photo update for Quitman Animal Clinic homepage"],
      }),
    ).toMatchObject({ practice: quitman, confidence: "Medium" });
  });

  it("suggests former clients too", () => {
    expect(suggestPracticeForRequester(practices, { email: "oldoakvet@gmail.com" })).toMatchObject({
      practice: oldOak,
      confidence: "High",
    });
  });

  it("drops to Low when two practices fit equally well", () => {
    const s = suggestPracticeForRequester(practices, { email: "lakesideanimalhospital@gmail.com" });
    expect(s?.confidence).toBe("Low");
    expect(s?.reason).toContain("just as well");
  });

  it("offers nothing for an address with no clue in it", () => {
    expect(suggestPracticeForRequester(practices, { email: "jennifer.k.smith@gmail.com" })).toBeNull();
  });
});
