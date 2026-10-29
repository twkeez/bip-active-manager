import { describe, expect, it } from "vitest";
import { searchConsoleNote, searchConsoleNotConnected } from "@/lib/seo/search-console-access";

describe("searchConsoleNote", () => {
  it("says the site isn't connected when Google refused access", () => {
    const run = { run_status: "failed", error_message: "Search Console API failed (403): User does not have sufficient permission", property_url: "https://x.com/" };
    expect(searchConsoleNotConnected(run)).toBe(true);
    expect(searchConsoleNote(run)).toMatch(/isn't connected for this client \(https:\/\/x.com\/\).*tom@beyondindigo.com/);
  });

  it("passes other failures through, and stays quiet when the sync worked", () => {
    expect(searchConsoleNote({ run_status: "failed", error_message: "timeout" })).toBe("The last Search Console sync failed: timeout");
    expect(searchConsoleNote({ run_status: "completed", error_message: null })).toBeNull();
    expect(searchConsoleNote(null)).toBeNull();
  });
});
