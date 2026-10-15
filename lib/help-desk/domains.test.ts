import { describe, expect, it } from "vitest";
import { emailDomain, extractDomains, isIgnorableDomain, normalizeDomain } from "@/lib/help-desk/domains";

describe("normalizeDomain", () => {
  it("reduces a URL to its bare domain", () => {
    expect(normalizeDomain("https://www.HappyPawsVet.com/contact?x=1")).toBe("happypawsvet.com");
    expect(normalizeDomain("happypawsvet.com/")).toBe("happypawsvet.com");
    expect(normalizeDomain("http://www2.happypawsvet.com:8080")).toBe("happypawsvet.com");
    expect(normalizeDomain("jane@happypawsvet.com")).toBe("happypawsvet.com");
  });

  it("rejects things that are not domains", () => {
    expect(normalizeDomain("")).toBeNull();
    expect(normalizeDomain("Not hosted by BI")).toBeNull();
    expect(normalizeDomain("localhost")).toBeNull();
  });
});

describe("emailDomain", () => {
  it("needs an @", () => {
    expect(emailDomain("Jane@HappyPawsVet.com")).toBe("happypawsvet.com");
    expect(emailDomain("happypawsvet.com")).toBeNull();
    expect(emailDomain(null)).toBeNull();
  });
});

describe("extractDomains", () => {
  it("finds websites and email domains in ticket text", () => {
    const text = "Please update www.happypawsvet.com/staff — thanks, Jane (jane@clinic-mail.net)";
    expect(extractDomains(text).sort()).toEqual(["clinic-mail.net", "happypawsvet.com"]);
  });

  it("skips pasted file names", () => {
    expect(extractDomains("attached hero.jpg and menu.pdf")).toEqual([]);
  });
});

describe("isIgnorableDomain", () => {
  it("ignores mailbox providers, our domains and common services", () => {
    expect(isIgnorableDomain("gmail.com")).toBe(true);
    expect(isIgnorableDomain("beyondindigo.com")).toBe(true);
    expect(isIgnorableDomain("drive.google.com")).toBe(true);
    expect(isIgnorableDomain("agency.example", ["agency.example"])).toBe(true);
    expect(isIgnorableDomain("happypawsvet.com")).toBe(false);
  });
});
