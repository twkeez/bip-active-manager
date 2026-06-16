import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/ai/gemini", () => ({
  generateGeminiText: vi.fn(),
  generateGeminiContent: vi.fn(async () => `\`\`\`json
{"primaryHex":"#112233","secondaryHex":"#445566","accentHex":"#778899","brandPersonality":"Modern and trustworthy.","designCues":["Clean lines","High contrast CTA","Minimal icon style"]}
\`\`\``),
}));

import { analyzeLogoBrandProfile } from "./ai";

describe("analyzeLogoBrandProfile", () => {
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
