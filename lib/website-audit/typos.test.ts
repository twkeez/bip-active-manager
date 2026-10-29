import { describe, expect, it } from "vitest";
import { isRealTypo } from "@/lib/website-audit/typos";

const t = (text: string, suggestion: string) => isRealTypo({ text, suggestion });

describe("isRealTypo", () => {
  it("keeps real spelling and spacing fixes", () => {
    expect(t("Opthalmology", "Ophthalmology")).toBe(true);
    expect(t("If you pet is experiencing", "If your pet is experiencing")).toBe(true);
    expect(t("protec,mtion", "protection")).toBe(true);
    expect(t("atEdgewater Animal Hospital", "at Edgewater Animal Hospital")).toBe(true);
    expect(t("dallashwyanimal", "dallashighwayanimal")).toBe(true);
    expect(t("4th of July Safety Tips for Powder Spring Pets", "Powder Springs Pets")).toBe(true);
    expect(t("Polishing helps smooth imperfections created during scaling, The combination", "scaling. The combination")).toBe(true);
  });

  it("drops notes filed as typos (the Edgewater report)", () => {
    expect(t("Edgewater Animal Hospital Forms", "No spelling error found")).toBe(false);
    expect(t("Veterinary Diagnostics", "No misspelling found")).toBe(false);
    expect(t("Behind the Magic", "none needed")).toBe(false);
    expect(t("Charlotte's Proven Veterinary Leaders", "Remove or correct: Charlotte's reference is inconsistent with the Indian Land location")).toBe(false);
    expect(t("Flea and tick medications for dogs (cats)", "Flea and tick medications for dogs (and cats) or similar wording")).toBe(false);
  });

  it("drops rewrites and apostrophe style", () => {
    expect(t("Dog and Cat Dental Health Near Fort Mill and Indian Land", "Dog and Cat Dental Care in Indian Land")).toBe(false);
    expect(t("Pet's Oral Health", "Pet’s Oral Health")).toBe(false);
    expect(t("Pet Dominion Animal Hospital", "Not applicable: page title and headings do not include this name")).toBe(false);
  });
});
