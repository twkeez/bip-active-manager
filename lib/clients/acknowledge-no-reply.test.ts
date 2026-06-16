import { afterEach, describe, expect, it, vi } from "vitest";
import { acknowledgeNoReply, shouldShowReplyAlert } from "@/lib/clients/acknowledge-no-reply";

describe("acknowledgeNoReply", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns updated client on success", async () => {
    const updatedClient = {
      id: 42,
      account_name: "Test Client",
      needs_reply: false,
      reply_acknowledged_at: "2026-06-10T12:00:00Z",
    };

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ ok: true, client: updatedClient }),
      }),
    );

    const result = await acknowledgeNoReply(42);
    expect(result).toEqual(updatedClient);
    expect(fetch).toHaveBeenCalledWith("/api/basecamp/acknowledge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId: 42 }),
    });
  });

  it("throws when API returns an error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: "Unauthorized" }),
      }),
    );

    await expect(acknowledgeNoReply(1)).rejects.toThrow("Unauthorized");
  });

  it("throws when response omits client payload", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ ok: true }),
      }),
    );

    await expect(acknowledgeNoReply(1)).rejects.toThrow("Failed to mark as no reply needed");
  });
});

describe("shouldShowReplyAlert", () => {
  it("is true when needs_reply is set", () => {
    expect(shouldShowReplyAlert({ needs_reply: true })).toBe(true);
  });

  it("is false when needs_reply is clear", () => {
    expect(shouldShowReplyAlert({ needs_reply: false })).toBe(false);
  });
});
