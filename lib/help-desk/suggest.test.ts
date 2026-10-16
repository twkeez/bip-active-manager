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
const brookNorth = practice("Brookhaven Animal Hospital North", "brookhavennorth.com");
const brookSouth = practice("Brookhaven Animal Hospital South", "brookhavensouth.com");
const amcFlorida = practice("Animal Medical Center (FL)", "amcflorida.com");
const petsChoice = practice("Pet's Choice Animal Hospital", "petschoicevet.com");
const allPet = practice("All Pet Animal Hospital (PA)", "allpet.net");
const oldOak = practice("Old Oak Veterinary Clinic", "oldoakvet.com", true);
const practices = [quitman, happyPaws, brookNorth, brookSouth, oldOak, amcFlorida, petsChoice, allPet];

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
    const s = suggestPracticeForRequester(practices, { email: "brookhavenanimalhospital@gmail.com" });
    expect(s?.confidence).toBe("Low");
    expect(s?.reason).toContain("just as well");
  });

  it("offers nothing for an address with no clue in it", () => {
    expect(suggestPracticeForRequester(practices, { email: "jennifer.k.smith@gmail.com" })).toBeNull();
  });

  // Regressions from the first live run.
  it("does not let a common word make a guess", () => {
    expect(suggestPracticeForRequester(practices, { email: "katie@gmail.com", mentionedDomains: ["vetsfirstchoice.com"] })).toBeNull();
  });

  it("never trusts a generic name past Low when it is only contained", () => {
    const s = suggestPracticeForRequester(practices, { email: "alisa@yahoo.com", organizationName: "Nebraska Animal Medical Center" });
    expect(s?.confidence).toBe("Low");
  });

  it("gives machine senders no guess", () => {
    expect(
      suggestPracticeForRequester(practices, { email: "18772449322@phone.com", requesterName: "Phone.com Voicemail", mentionedDomains: ["allpet.net"] }),
    ).toBeNull();
  });

  it("ignores mentioned sites when a person mentions several practices", () => {
    expect(
      suggestPracticeForRequester(practices, { email: "freelancer@gmail.com", mentionedDomains: ["allpet.net", "happypawsvet.com"] }),
    ).toBeNull();
  });

  it("still uses one mentioned practice site", () => {
    expect(
      suggestPracticeForRequester(practices, { email: "silver@msn.com", mentionedDomains: ["quitmanvetclinic.vetsfirstchoice.com"] }),
    ).toMatchObject({ practice: quitman, confidence: "High" });
  });
});
