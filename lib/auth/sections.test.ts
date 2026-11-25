import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { isNavItemVisibleForAccess } from "@/lib/auth/app-mode";
import { decideRoleGate } from "@/lib/auth/role-gate";
import {
  effectiveGrants,
  GRANTABLE_SECTIONS,
  grantsReach,
  parseGrants,
  SECTION_ACCESS,
  SECTION_GRANT_KEYS,
  type SectionGrant,
} from "@/lib/auth/sections";
import { NAV_SECTIONS, visibleItems } from "@/lib/nav/sections";

const root = join(__dirname, "../..");
const allItems = NAV_SECTIONS.flatMap((section) => [...section.items, ...(section.more?.items ?? [])]);

function sidebarFor(grants: SectionGrant[], mode: "full" | "team") {
  return visibleItems(allItems, false, (href) => isNavItemVisibleForAccess(href, mode, false, grants)).map(
    (item) => item.href,
  );
}

describe("section grants", () => {
  it("are named after sidebar sections", () => {
    const keys = new Set(NAV_SECTIONS.map((section) => section.key));
    for (const key of SECTION_GRANT_KEYS) {
      expect(keys.has(key), key).toBe(true);
      expect(SECTION_ACCESS[key].label).toBe(NAV_SECTIONS.find((section) => section.key === key)!.label);
    }
  });

  it("can only be given for Playbook until Reporting and Onboarding are rebuilt", () => {
    expect(GRANTABLE_SECTIONS).toEqual(["playbook"]);
    expect(grantsReach("/client-snapshot", ["reporting"])).toBe(false);
    expect(grantsReach("/onboarding", ["onboarding"])).toBe(false);
  });

  it("open only pages that exist", () => {
    for (const key of GRANTABLE_SECTIONS) {
      for (const page of SECTION_ACCESS[key].pages) {
        expect(existsSync(join(root, "app/(app)", page, "page.tsx")), page).toBe(true);
      }
    }
  });

  it("ignore unknown or repeated values from the database", () => {
    expect(parseGrants(["playbook", "admin", "playbook", 3])).toEqual(["playbook"]);
    expect(parseGrants(null)).toEqual([]);
    expect(parseGrants("playbook")).toEqual([]);
  });

  it("mean nothing for admins or a missing role", () => {
    expect(effectiveGrants("admin", ["playbook"])).toEqual([]);
    expect(effectiveGrants(null, ["playbook"])).toEqual([]);
    expect(effectiveGrants("strategist", ["playbook"])).toEqual(["playbook"]);
  });
});

describe("a strategist with Playbook", () => {
  it("reaches the Playbook pages but not its admin editors", () => {
    for (const path of ["/playbook", "/services", "/services/partnership"]) {
      expect(decideRoleGate(path, "strategist", ["playbook"]), path).toBe("allow");
    }
    for (const path of ["/client-expectations", "/best-practices", "/onboarding-settings", "/team", "/api/team/role"]) {
      expect(decideRoleGate(path, "strategist", ["playbook"]), path).toBe("block");
    }
  });

  it("is blocked from those pages without the grant", () => {
    expect(decideRoleGate("/playbook", "strategist", [])).toBe("block");
    expect(decideRoleGate("/services/partnership", "strategist", [])).toBe("block");
  });

  it("can't use a grant without a strategist role", () => {
    expect(decideRoleGate("/playbook", null, ["playbook"])).toBe("block");
  });

  it("sees those pages in the sidebar on the full build, and only Clients on the team build", () => {
    expect(sidebarFor(["playbook"], "full")).toEqual([
      "/dashboard/clients",
      "/services",
      "/playbook",
      "/services/partnership",
    ]);
    expect(sidebarFor(["playbook"], "team")).toEqual(["/dashboard/clients"]);
  });
});

describe("the sidebar and the server agree", () => {
  it("never shows a strategist a link the server would block", () => {
    const grantSets: SectionGrant[][] = [[], ...SECTION_GRANT_KEYS.map((key) => [key]), [...SECTION_GRANT_KEYS]];
    for (const grants of grantSets) {
      for (const href of sidebarFor(grants, "full")) {
        expect(decideRoleGate(href, "strategist", grants), `${href} with ${grants.join(",")}`).toBe("allow");
      }
    }
  });
});
