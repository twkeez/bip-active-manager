import { describe, expect, it } from "vitest";
import { decideRoleGate, nonAdminMayReach } from "@/lib/auth/role-gate";

describe("role gate", () => {
  it("lets admins reach everything", () => {
    for (const path of ["/home", "/response-report", "/coal-mines", "/api/coal-mines/canaries", "/team", "/api/team/role"]) {
      expect(decideRoleGate(path, "admin"), path).toBe("allow");
    }
  });

  it("lets strategists reach the client section, its tools and their APIs", () => {
    for (const path of [
      "/dashboard/clients",
      "/dashboard/clients/248",
      "/reports/doc-to-pdf",
      "/guide",
      "/api/clients/248",
      "/api/reporting/anything",
      "/api/playbook/items",
    ]) {
      expect(decideRoleGate(path, "strategist"), path).toBe("allow");
    }
  });

  it("blocks strategists from admin pages and admin APIs", () => {
    for (const path of [
      "/home",
      "/response-report",
      "/coal-mines",
      "/team",
      "/ai-spend",
      "/api/team/role",
      "/api/team/invite",
      "/api/coal-mines/canaries",
      "/api/poobah-client-watch",
      "/api/client-watch/12/read",
      "/api/website-audits",
    ]) {
      expect(decideRoleGate(path, "strategist"), path).toBe("block");
    }
  });

  it("treats an unreadable role as a non-admin", () => {
    expect(decideRoleGate("/team", null)).toBe("block");
    expect(decideRoleGate("/dashboard/clients", null)).toBe("allow");
  });

  it("always serves sign-in", () => {
    expect(nonAdminMayReach("/login")).toBe(true);
    expect(nonAdminMayReach("/auth/callback")).toBe(true);
  });
});
