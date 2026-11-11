import { describe, expect, it } from "vitest";
import { appearsOn, isRealTypo, realTypos } from "@/lib/website-audit/typos";

const t = (text: string, suggestion: string, where?: string) => isRealTypo({ text, suggestion, where });

describe("isRealTypo", () => {
  it("keeps real spelling and spacing fixes", () => {
    expect(t("Opthalmology", "Ophthalmology")).toBe(true);
    expect(t("If you pet is experiencing", "If your pet is experiencing")).toBe(true);
    expect(t("protec,mtion", "protection")).toBe(true);
    expect(t("atEdgewater Animal Hospital", "at Edgewater Animal Hospital")).toBe(true);
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

  it("drops anything inside a web address, email or handle", () => {
    expect(t("opthalmology", "ophthalmology", "url")).toBe(false);
    expect(t("/services/opthalmology.html", "/services/ophthalmology.html", "text")).toBe(false);
    expect(t("dallashwyanimal", "dallashighwayanimal", "text")).toBe(false);
    expect(t("Opthalmology", "Ophthalmology", "menu")).toBe(true);
  });

  it("drops style choices: abbreviations, hyphens and accepted spellings", () => {
    expect(t("Dallas Hwy", "Dallas Highway")).toBe(false);
    expect(t("stress free parking lot", "stress-free parking lot")).toBe(false);
    expect(t("wellness and preventative exam", "wellness and preventive exam")).toBe(false);
    expect(t("mosquitos", "mosquitoes")).toBe(false);
    expect(t("lillies", "lilies")).toBe(true);
  });

  it("drops a different word swapped in, but keeps near-misses and extra words", () => {
    expect(t("oral or topical antifungal infections", "antifungal medications")).toBe(false);
    expect(t("You would them pay us", "You would then pay us")).toBe(true);
    expect(t("do doing things the right way", "to doing things the right way")).toBe(true);
    expect(t("learn about the our services", "learn about our services")).toBe(true);
    expect(t("wrong in with your pet's teeth", "wrong with your pet's teeth")).toBe(true);
    expect(t("calculus.Tartar", "calculus. Tartar")).toBe(true);
    expect(t("call 770) 419-8086", "call (770) 419-8086")).toBe(true);
    expect(t("Power Springs, GA", "Powder Springs, GA")).toBe(true);
    expect(t("its safe", "it's safe")).toBe(true);
    expect(t("commited", "committed")).toBe(true);
  });
});

describe("mistakes must be on the page", () => {
  const page = { title: "Meet Our Team", h1s: ["Our Vets"], navLinks: [{ text: "Opthalmology" }], text: "Dr. Toth is commited to   care. It’s safe here." };
  it("keeps what the page shows, whatever the spacing or quote style", () => {
    expect(appearsOn("commited to care", page)).toBe(true);
    expect(appearsOn("It's safe", page)).toBe(true);
    expect(appearsOn("Opthalmology", page)).toBe(true);
  });
  it("drops a mistake the page doesn't contain", () => {
    expect(realTypos([{ text: "enjoyes", suggestion: "enjoys" }, { text: "commited", suggestion: "committed" }], page).map((x) => x.text)).toEqual(["commited"]);
  });
  it("doesn't drop anything when there's no page text to check", () => {
    expect(realTypos([{ text: "enjoyes", suggestion: "enjoys" }], {})).toHaveLength(1);
  });
});
