import { describe, expect, it } from "vitest";
import {
  describeProjectActivity,
  triageProjectName,
} from "@/lib/clients/basecamp-project-triage";

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

describe("describeProjectActivity", () => {
  const NOW = new Date("2026-09-09T12:00:00Z");
  const ago = (days: number) => new Date(NOW.getTime() - days * 86_400_000).toISOString();

  it("reads recent activity in days and older in months", () => {
    expect(describeProjectActivity(ago(0), NOW).label).toBe("today");
    expect(describeProjectActivity(ago(1), NOW).label).toBe("yesterday");
    expect(describeProjectActivity(ago(12), NOW).label).toBe("12 days ago");
    expect(describeProjectActivity(ago(90), NOW).label).toBe("3 months ago");
  });

  it("marks a year of silence as dormant", () => {
    expect(describeProjectActivity(ago(364), NOW).dormant).toBe(false);
    expect(describeProjectActivity(ago(365), NOW).dormant).toBe(true);
    expect(describeProjectActivity(ago(900), NOW).label).toBe("2 years ago");
  });

  // Unknown must never read as old — that would argue for ignoring a project
  // on the strength of missing data.
  it("does not treat a missing or unparseable date as dormant", () => {
    for (const value of [null, undefined, "", "not a date"]) {
      const activity = describeProjectActivity(value, NOW);
      expect(activity.dormant, String(value)).toBe(false);
      expect(activity.days).toBeNull();
    }
  });

  it("does not go negative on a clock skew", () => {
    expect(describeProjectActivity(ago(-2), NOW).days).toBe(0);
  });
});
