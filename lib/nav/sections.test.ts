import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { activeHref, allNavLinks, NAV_SECTIONS, visibleItems } from "./sections";
import { isNavItemVisibleForRole } from "@/lib/auth/app-mode";

const root = join(__dirname, "../..");

describe("sidebar sections", () => {
  it("has the six sections of the redesign, in order", () => {
    expect(NAV_SECTIONS.map((section) => section.label)).toEqual([
      "Home",
      "Clients",
      "Reporting",
      "Onboarding",
      "Playbook",
      "Admin",
    ]);
  });

  it("links each page once", () => {
    const hrefs = allNavLinks().map((link) => link.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it("links only pages that exist", () => {
    for (const { href } of allNavLinks()) {
      expect(existsSync(join(root, "app/(app)", href, "page.tsx")), `${href} has no page`).toBe(true);
    }
  });

  it("has no link to a tool Tom cut", () => {
    const hrefs = new Set(allNavLinks().map((link) => link.href));
    for (const cut of ["/client-briefings", "/illuminare", "/ads-planner", "/social-planner", "/wins", "/sales-lab"]) {
      expect(hrefs.has(cut), cut).toBe(false);
    }
  });

  it("keeps the Admin section to admins", () => {
    const admin = NAV_SECTIONS.find((section) => section.key === "admin")!;
    expect(admin.items.every((item) => item.adminOnly)).toBe(true);
  });
});

describe("activeHref", () => {
  it("lights the most specific link", () => {
    expect(activeHref("/services/partnership")).toBe("/services/partnership");
    expect(activeHref("/services")).toBe("/services");
    expect(activeHref("/dashboard/clients/abc?tab=ads")).toBe("/dashboard/clients");
    expect(activeHref("/reports/doc-to-pdf")).toBe("/reports/doc-to-pdf");
  });

  it("lights nothing for a page with no link", () => {
    expect(activeHref("/reports")).toBeNull();
    expect(activeHref("/services-old")).toBeNull();
  });
});

describe("what a strategist sees", () => {
  it("is still only Clients, on either deployment", () => {
    for (const mode of ["full", "team"] as const) {
      const seen = NAV_SECTIONS.flatMap((section) =>
        visibleItems(
          [...section.items, ...(section.more?.items ?? [])],
          false,
          (href) => isNavItemVisibleForRole(href, mode, false),
        ),
      ).map((item) => item.href);
      expect(seen).toEqual(["/dashboard/clients"]);
    }
  });

  it("is everything for an admin on the full build", () => {
    const seen = NAV_SECTIONS.flatMap((section) =>
      visibleItems([...section.items, ...(section.more?.items ?? [])], true, (href) =>
        isNavItemVisibleForRole(href, "full", true),
      ),
    );
    expect(seen.length).toBe(allNavLinks().length);
  });
});
