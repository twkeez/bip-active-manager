import { describe, expect, it } from "vitest";
import {
  clientStatusBadgeClass,
  resolveClientStatus,
} from "@/components/clients/client-status-badge";

describe("client status badges", () => {
  it("maps comms state to display status", () => {
    expect(
      resolveClientStatus({
        needs_reply: true,
        reply_acknowledged_at: null,
        tier: "Premium",
      }),
    ).toBe("Awaiting");

    expect(
      resolveClientStatus({
        needs_reply: false,
        reply_acknowledged_at: "2026-05-01T00:00:00Z",
        tier: "Premium",
      }),
    ).toBe("Pending");

    expect(
      resolveClientStatus({
        needs_reply: false,
        reply_acknowledged_at: null,
        tier: "Premium",
      }),
    ).toBe("Active");

    expect(
      resolveClientStatus({
        needs_reply: true,
        reply_acknowledged_at: null,
        tier: "Low Contact",
      }),
    ).toBe("Paused");
  });

  it("returns badge classes for known statuses", () => {
    expect(clientStatusBadgeClass("Active")).toContain("emerald");
    expect(clientStatusBadgeClass("Awaiting")).toContain("amber");
    expect(clientStatusBadgeClass("Pending")).toContain("amber");
    expect(clientStatusBadgeClass("Paused")).toContain("white");
  });
});
