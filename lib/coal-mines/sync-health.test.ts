import { describe, expect, it } from "vitest";
import { assessSyncHealth } from "@/lib/coal-mines/sync-health";
import { findProjectWiringProblems } from "@/lib/coal-mines/project-wiring";

const NOW = new Date("2026-09-04T20:00:00Z");
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000).toISOString();

describe("assessSyncHealth", () => {
  it("is quiet when the schedule is keeping up", () => {
    const h = assessSyncHealth({ last_synced_at: hoursAgo(0.4), last_error: null }, NOW);
    expect(h.status).toBe("ok");
    expect(h.headline).toContain("within the last hour");
  });

  it("notices a gap long before it becomes a day", () => {
    expect(assessSyncHealth({ last_synced_at: hoursAgo(7), last_error: null }, NOW).status).toBe(
      "stale",
    );
  });

  it("tolerates a weekend gap but not a lost schedule", () => {
    // The weekend schedule runs once a day, so 25 hours is not yet alarming.
    expect(assessSyncHealth({ last_synced_at: hoursAgo(25), last_error: null }, NOW).status).toBe(
      "stale",
    );
    expect(assessSyncHealth({ last_synced_at: hoursAgo(30), last_error: null }, NOW).status).toBe(
      "overdue",
    );
  });

  // The failure this canary exists for: a run killed by the function timeout
  // never writes last_synced_at, so the gap grows and says so rather than the
  // page looking calm.
  it("treats a never-completed sync as the loudest state", () => {
    const h = assessSyncHealth({ last_synced_at: null, last_error: null }, NOW);
    expect(h.status).toBe("never");
    expect(h.headline).toContain("reporting on nothing");
  });

  it("splits the sync's joined error string back into readable lines", () => {
    const h = assessSyncHealth(
      {
        last_synced_at: hoursAgo(0.2),
        last_error:
          "3 project(s) failed: project 19895756 (client 20): Duplicate id; project 6660074 (client 75): Duplicate id",
      },
      NOW,
    );
    expect(h.errors.length).toBeGreaterThan(1);
  });

  it("reports no errors when the last run was clean", () => {
    expect(assessSyncHealth({ last_synced_at: hoursAgo(1), last_error: null }, NOW).errors).toEqual(
      [],
    );
    expect(assessSyncHealth({ last_synced_at: hoursAgo(1), last_error: "  " }, NOW).errors).toEqual(
      [],
    );
  });
});

describe("findProjectWiringProblems", () => {
  const client = (id: number, name: string, pid: string | null) => ({
    id,
    account_name: name,
    basecamp_project_id: pid,
  });

  it("finds clients fighting over one project", () => {
    const { duplicates, skippedClients } = findProjectWiringProblems([
      client(20, "Long Meadow", "19895756"),
      client(84, "Long Meadow / Animal ER", "19895756"),
      client(18, "Animal ER", "19895756"),
      client(43, "Travelers Rest", "6660074"),
      client(75, "Volunteer Veterinary", "6660074"),
      client(1, "Fine Vet", "111"),
    ]);
    expect(duplicates).toHaveLength(2);
    // Three clients on one project means two are skipped, not three.
    expect(skippedClients).toBe(3);
  });

  it("puts the client that keeps the project first", () => {
    const { duplicates } = findProjectWiringProblems([
      client(84, "Later record", "19895756"),
      client(18, "Earlier record", "19895756"),
    ]);
    expect(duplicates[0].clients.map((c) => c.id)).toEqual([18, 84]);
  });

  it("says nothing when every client has its own project", () => {
    const { duplicates, skippedClients, linked } = findProjectWiringProblems([
      client(1, "A", "111"),
      client(2, "B", "222"),
    ]);
    expect(duplicates).toEqual([]);
    expect(skippedClients).toBe(0);
    expect(linked).toBe(2);
  });

  it("ignores clients with no project at all — that is a different problem", () => {
    const { duplicates, linked } = findProjectWiringProblems([
      client(1, "A", null),
      client(2, "B", "   "),
      client(3, "C", "333"),
    ]);
    expect(duplicates).toEqual([]);
    expect(linked).toBe(1);
  });
});
