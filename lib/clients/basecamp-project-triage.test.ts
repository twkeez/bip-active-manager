import { describe, expect, it } from "vitest";
import { triageProjectName } from "@/lib/clients/basecamp-project-triage";

describe("triageProjectName", () => {
  it("recognises our own projects", () => {
    for (const name of [
      "Beyond Indigo Blog Communication",
      "Beyond Indigo Newsstand",
      "Beyond Indigo Pets — Technical Development",
      "Courageous Conversations",
      "Designer Resources",
      "Elyse's New Project Template",
    ]) {
      expect(triageProjectName(name).disposition, name).toBe("internal");
    }
  });

  // "Beyond Indigo Pets" contains "Pets", which would otherwise read as a
  // practice. Internal wins, or we would offer to import ourselves as a client.
  it("keeps our own projects internal even when they mention pets", () => {
    expect(triageProjectName("Beyond Indigo Pets Website Refresh").disposition).toBe("internal");
  });

  it("recognises practices", () => {
    for (const name of [
      "All Cats Care Center",
      "Blackbob Pet Hospital",
      "Bridger Veterinary Specialists",
      "Brook Farm Veterinary Center",
    ]) {
      expect(triageProjectName(name).disposition, name).toBe("practice");
    }
  });

  // Importing one of these creates a duplicate client for a practice we may
  // already have, so it must never land in the bulk-importable pile.
  it("holds back projects marked old or previous", () => {
    expect(triageProjectName("Harmony Animal Hospital (OLD)").disposition).toBe("unclear");
    expect(triageProjectName("Travelers Rest Animal Hospital (Previously CPAH)").disposition).toBe(
      "unclear",
    );
  });

  it("admits when a name says nothing", () => {
    expect(triageProjectName("Q3 Push").disposition).toBe("unclear");
    expect(triageProjectName("   ").disposition).toBe("unclear");
  });
});
