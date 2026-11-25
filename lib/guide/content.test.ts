import { describe, expect, it } from "vitest";
import { GUIDE } from "./content";
import { NAV_SECTIONS, sectionLinks } from "@/lib/nav/sections";

// Keeps the team guide in step with the sidebar (lib/nav/sections.ts): add,
// rename, move or remove a sidebar link and this fails until
// lib/guide/content.ts says what it does, in the same section and order.

describe("team guide", () => {
  it("has one section per sidebar section, in sidebar order", () => {
    expect(GUIDE.sections.map((section) => section.title)).toEqual(NAV_SECTIONS.map((section) => section.label));
  });

  it("explains every sidebar link in its section and order, with its sidebar name and access", () => {
    NAV_SECTIONS.forEach((section, index) => {
      const guideSection = GUIDE.sections[index];
      const links = sectionLinks(section);
      expect(
        guideSection.items.map((item) => item.href),
        `The guide's ${section.label} section should list the sidebar's ${section.label} links in sidebar order`,
      ).toEqual(links.map((link) => link.href));
      links.forEach((link, position) => {
        const item = guideSection.items[position];
        expect(item.label, `Rename ${link.href} in the guide to match the sidebar`).toBe(link.label);
        expect(Boolean(item.adminOnly), `Fix "admins only" on ${link.href} in the guide`).toBe(Boolean(link.adminOnly));
      });
    });
  });

  it("has something to say about each one", () => {
    for (const item of GUIDE.sections.flatMap((section) => section.items)) {
      expect(item.purpose.length, item.href).toBeGreaterThan(20);
    }
  });
});
