import { describe, expect, it } from "vitest";
import { matchIlluminareProjects } from "@/lib/illuminare/basecamp-match";
import type { BasecampProjectSummary } from "@/lib/basecamp/client";
import { normalizeClientName } from "@/lib/clients/normalize-name";

function project(id: string, name: string): BasecampProjectSummary {
  return { id, name, status: "active", normalizedName: normalizeClientName(name) };
}

function client(
  id: number,
  account_name: string,
  basecamp_project_id: string | null = null,
) {
  return { id, account_name, basecamp_project_id };
}

describe("matchIlluminareProjects", () => {
  it("suggests a clean name match not yet linked", () => {
    const { matches } = matchIlluminareProjects(
      [client(1, "The Front Porch Shop")],
      [project("100", "The Front Porch Shop")],
    );
    expect(matches[0]).toMatchObject({
      status: "matched",
      suggestedProjectId: "100",
    });
  });

  it("matches despite punctuation/case differences", () => {
    const { matches } = matchIlluminareProjects(
      [client(1, "BAKE!")],
      [project("200", "bake")],
    );
    expect(matches[0]?.status).toBe("matched");
    expect(matches[0]?.suggestedProjectId).toBe("200");
  });

  it("reports already_set when the current link matches", () => {
    const { matches } = matchIlluminareProjects(
      [client(1, "Dr. Kohutis", "300")],
      [project("300", "Dr. Kohutis")],
    );
    expect(matches[0]?.status).toBe("already_set");
  });

  it("flags a conflict when linked elsewhere", () => {
    const { matches } = matchIlluminareProjects(
      [client(1, "Ana Coronado", "999")],
      [project("300", "Ana Coronado")],
    );
    expect(matches[0]).toMatchObject({
      status: "conflict",
      suggestedProjectId: "300",
      currentProjectId: "999",
    });
  });

  it("marks missing when no project matches the name", () => {
    const { matches } = matchIlluminareProjects(
      [client(1, "UFVD")],
      [project("300", "Some Other Project")],
    );
    expect(matches[0]?.status).toBe("missing");
  });

  it("marks ambiguous when two projects share the name", () => {
    const { matches } = matchIlluminareProjects(
      [client(1, "Diane Eigner")],
      [project("1", "Diane Eigner"), project("2", "Diane Eigner")],
    );
    expect(matches[0]?.status).toBe("ambiguous");
  });

  it("lists projects that don't map 1:1 to a client as unmatched", () => {
    const { unmatchedProjects } = matchIlluminareProjects(
      [client(1, "The Crow River Market")],
      [
        project("1", "The Crow River Market"),
        project("2", "Internal — Team Ops"),
      ],
    );
    expect(unmatchedProjects.map((p) => p.id)).toEqual(["2"]);
  });
});
