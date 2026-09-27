import { describe, expect, it } from "vitest";
import { landingPathForRole, resolveEffectiveRole } from "./effective-role";

describe("landingPathForRole", () => {
  it("lands admins on the Response Report in the full app", () => {
    expect(landingPathForRole("admin", "full")).toBe("/response-report");
  });

  it("lands strategists on the client homescreen", () => {
    expect(landingPathForRole("strategist", "full")).toBe("/dashboard/clients");
  });

  it("lands everyone on the client homescreen in the team app, which has no Response Report", () => {
    expect(landingPathForRole("admin", "team")).toBe("/dashboard/clients");
  });

  it("follows the strategist preview an admin switched on", () => {
    expect(landingPathForRole(resolveEffectiveRole("admin", "strategist"), "full")).toBe("/dashboard/clients");
  });
});
