import { describe, expect, it } from "vitest";
import { isPortalPath } from "./portal-mode";

describe("client portal paths", () => {
  it("serves only a snapshot link", () => {
    expect(isPortalPath("/s/abcDEF123_-xyz456789012")).toBe(true);
    expect(isPortalPath("/s/abc/")).toBe(true);
    for (const path of ["/", "/login", "/api/mcp", "/dashboard/clients", "/s", "/s/", "/s/abc/extra", "/client-snapshot/81", "/s/../api"]) {
      expect(isPortalPath(path)).toBe(false);
    }
  });
});
