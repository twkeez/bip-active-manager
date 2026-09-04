import { describe, expect, it } from "vitest";
import { buildSyncRoster } from "@/lib/basecamp/sync-roster";

const client = (id: number, projectId: string | null, ack: string | null = null) => ({
  id,
  basecamp_project_id: projectId,
  reply_acknowledged_for_occurred_at: ack,
});

describe("buildSyncRoster", () => {
  // The reason this exists: 55 active projects had no client record and were
  // therefore never fetched at all.
  it("includes Basecamp projects that no client record claims", () => {
    const roster = buildSyncRoster(
      [
        { id: "1", name: "Harmony Animal Hospital" },
        { id: "2", name: "Volunteer Vet" },
      ],
      [client(10, "1")],
    );
    expect(roster).toHaveLength(2);
    const orphan = roster.find((r) => r.projectId === "2")!;
    expect(orphan.clientId).toBeNull();
    expect(orphan.projectName).toBe("Volunteer Vet");
  });

  it("labels a project with the client that claims it", () => {
    const [only] = buildSyncRoster([{ id: "1", name: "Harmony" }], [client(10, "1", "2026-01-01")]);
    expect(only.clientId).toBe(10);
    expect(only.replyAckForOccurredAt).toBe("2026-01-01");
  });

  // Previously the second client's project was skipped outright for the run.
  // Now the project is synced once and the extra records are just reported.
  it("syncs a contested project once, lowest client id owning it", () => {
    const roster = buildSyncRoster(
      [{ id: "6660074", name: "Travelers Rest" }],
      [client(75, "6660074"), client(43, "6660074")],
    );
    expect(roster).toHaveLength(1);
    expect(roster[0].clientId).toBe(43);
    expect(roster[0].duplicateClientIds).toEqual([75]);
  });

  // A truncated or failing projects call must never shrink what we already
  // watch — that would turn an API hiccup into silent blindness.
  it("keeps projects a client points at even when Basecamp did not list them", () => {
    const roster = buildSyncRoster([], [client(10, "9999")]);
    expect(roster).toHaveLength(1);
    expect(roster[0]).toMatchObject({
      projectId: "9999",
      clientId: 10,
      listedByBasecamp: false,
      projectName: null,
    });
  });

  it("ignores clients with no project and blank project ids", () => {
    expect(buildSyncRoster([], [client(1, null), client(2, "   ")])).toEqual([]);
  });

  it("does not duplicate a project listed by Basecamp and claimed by a client", () => {
    const roster = buildSyncRoster([{ id: "1", name: "Harmony" }], [client(10, "1")]);
    expect(roster).toHaveLength(1);
    expect(roster[0].listedByBasecamp).toBe(true);
  });
});
