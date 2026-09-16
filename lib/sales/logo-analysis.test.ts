import { describe, expect, it, vi } from "vitest";

// The logo analysis moved from Gemini to Claude (71b80ca). Mocking the old
// module left the real Claude client in place, so this test tried to call the
// API — failing without a key, and spending money with one.
vi.mock("@/lib/ai/claude", () => ({
  generateClaudeText: vi.fn(),
  generateClaudeContent: vi.fn(async () => `\`\`\`json
{"primaryHex":"#112233","secondaryHex":"#445566","accentHex":"#778899","brandPersonality":"Modern and trustworthy.","designCues":["Clean lines","High contrast CTA","Minimal icon style"]}
\`\`\``),
}));

import { analyzeLogoBrandProfile } from "./ai";

describe("analyzeLogoBrandProfile", () => {
  it("rejects a response that is not the promised colour profile", async () => {
    const { generateClaudeContent } = await import("@/lib/ai/claude");
    vi.mocked(generateClaudeContent).mockResolvedValueOnce('{"primaryHex":"blue"}');
    await expect(
      analyzeLogoBrandProfile({ logoBytes: Buffer.from("x"), mimeType: "image/png", prospectName: "Northside Vet" }),
    ).rejects.toThrow(/not valid JSON/);
  });

  it("parses fenced JSON and returns structured logo profile", async () => {
    const profile = await analyzeLogoBrandProfile({
      logoBytes: Buffer.from("fake-image-bytes"),
      mimeType: "image/png",
      prospectName: "Northside Vet",
    });
    expect(profile.primaryHex).toBe("#112233");
    expect(profile.secondaryHex).toBe("#445566");
    expect(profile.accentHex).toBe("#778899");
    expect(profile.brandPersonality).toContain("trustworthy");
    expect(profile.designCues.length).toBeGreaterThan(0);
  });
});
