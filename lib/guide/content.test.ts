import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { GUIDE } from "./content";

// Keeps the team guide in step with the sidebar: add, rename or remove a
// sidebar link and this fails until lib/guide/content.ts says what it does.
const sidebar = readFileSync(join(__dirname, "../../components/layout/sidebar.tsx"), "utf8");
const sidebarLinks = new Map<string, { label: string; adminOnly: boolean }>();
for (const match of sidebar.matchAll(/\{\s*label:\s*"([^"]+)",\s*href:\s*"([^"]+)"[^}]*\}/g)) {
  const href = match[2];
  // The guide's own link, and the trimmed strategist list (same pages, other labels).
  if (href === "/guide" || sidebarLinks.has(href)) continue;
  sidebarLinks.set(href, { label: match[1], adminOnly: /adminOnly:\s*true/.test(match[0]) });
}
const guideItems = GUIDE.sections.flatMap((section) => section.items);

describe("team guide", () => {
  it("found the sidebar links", () => {
    expect(sidebarLinks.size).toBeGreaterThan(40);
  });

  it("explains every sidebar link, with its sidebar name and access", () => {
    for (const [href, link] of sidebarLinks) {
      const item = guideItems.find((entry) => entry.href === href);
      expect(item, `The sidebar links to ${href} ("${link.label}") but lib/guide/content.ts has no entry for it`).toBeDefined();
      expect(item!.label, `Rename ${href} in the guide to match the sidebar`).toBe(link.label);
      expect(Boolean(item!.adminOnly), `Fix "admins only" on ${href} in the guide`).toBe(link.adminOnly);
    }
  });

  it("has no entries for links the sidebar no longer has", () => {
    for (const item of guideItems) {
      expect(sidebarLinks.has(item.href), `${item.href} is in the guide but not the sidebar: remove or update it`).toBe(true);
    }
  });

  it("has something to say about each one", () => {
    for (const item of guideItems) {
      expect(item.purpose.length, item.href).toBeGreaterThan(20);
    }
  });
});
