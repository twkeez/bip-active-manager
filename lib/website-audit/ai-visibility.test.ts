import { describe, expect, it } from "vitest";
import { buildPrompts, citedUrls, isMentioned, nameVariants, summarizePlatforms } from "./ai-visibility";
import type { PromptRun } from "./types";

const practice = { domain: "dhah.org", practiceName: "Dallas Highway Animal Hospital", city: "Powder Springs", state: "GA" };

describe("AI visibility", () => {
  it("builds the prompt set from the config, with the town and each service", () => {
    const prompts = buildPrompts(practice, ["pet dental care", "pet surgery"]);
    expect(prompts.some((p) => p.text === "best vet in Powder Springs GA")).toBe(true);
    expect(prompts.some((p) => p.text === "animal hospital near Powder Springs Georgia")).toBe(true);
    expect(prompts.filter((p) => p.kind === "service").map((p) => p.text)).toEqual([
      "pet dental care near Powder Springs GA",
      "pet surgery near Powder Springs GA",
    ]);
    expect(new Set(prompts.map((p) => p.id)).size).toBe(prompts.length);
  });

  it("recognises the practice by its full or distinctive name", () => {
    expect(nameVariants("Dallas Highway Animal Hospital")).toEqual(["dallas highway animal hospital", "dallas highway"]);
    expect(isMentioned("Try **Dallas Highway** for dental care.", "Dallas Highway Animal Hospital")).toBe(true);
    expect(isMentioned("Powder Springs Animal Clinic is popular.", "Dallas Highway Animal Hospital")).toBe(false);
  });

  it("collects cited URLs but not the raw search results", () => {
    const urls = citedUrls({
      references: [{ url: "https://www.dhah.org/services/" }],
      items: [{ sections: [{ annotations: [{ url: "https://petmd.com/a" }] }] }],
      search_results: [{ url: "https://notcited.com" }],
      check_url: "https://google.com",
    });
    expect(urls.sort()).toEqual(["https://petmd.com/a", "https://www.dhah.org/services/"]);
  });

  it("summarises each platform, ignoring failed calls", () => {
    const run = (platform: PromptRun["platform"], cited: boolean, error: string | null = null): PromptRun => ({
      promptId: "p1", platform, answered: true, cited, ownCitations: cited ? 2 : 0, ownUrls: [], mentioned: cited, citedDomains: [], answerExcerpt: "", error,
    });
    const s = summarizePlatforms([run("claude", true), run("claude", false)], 2, { claude: "claude-sonnet-5-5" });
    const claude = s.find((p) => p.platform === "claude")!;
    expect(claude).toMatchObject({ promptsRun: 2, promptsCited: 1, promptsMentioned: 1, citations: 2, model: "claude-sonnet-5-5" });
    expect(s.find((p) => p.platform === "gemini")!.promptsRun).toBe(0);
  });
});
