import { describe, expect, it } from "vitest";
import {
  computeClientHealth,
  summarizeHealth,
  type ClientHealth,
} from "@/lib/illuminare/health";
import type { IlluminareDeliverableRow } from "@/lib/illuminare/deliverables";
import type { IlluminareClientRow } from "@/lib/illuminare/types";

function client(
  overrides: Partial<Pick<IlluminareClientRow, "id" | "status">> = {},
): Pick<IlluminareClientRow, "id" | "status"> {
  return { id: 1, status: "active", ...overrides };
}

function deliverable(
  overrides: Partial<IlluminareDeliverableRow> = {},
): IlluminareDeliverableRow {
  return {
    id: 1,
    client_id: 1,
    title: "D",
    detail: null,
    kind: "one_time",
    cadence: null,
    status: "active",
    start_date: null,
    due_date: null,
    completed_at: null,
    follow_up_interval_days: null,
    follow_up_at: null,
    last_followed_up_at: null,
    notes: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

const TODAY = "2026-07-13";

describe("computeClientHealth", () => {
  it("is on_track with no deliverables", () => {
    const health = computeClientHealth(client(), [], TODAY);
    expect(health.level).toBe("on_track");
    expect(health.reasons).toContain("On track");
  });

  it("flags attention for an overdue open project", () => {
    const health = computeClientHealth(
      client(),
      [deliverable({ due_date: "2026-07-01" })],
      TODAY,
    );
    expect(health.level).toBe("attention");
    expect(health.overdueProjects).toBe(1);
    expect(health.reasons).toContain("1 project overdue");
  });

  it("flags attention for a pending re-engagement follow-up", () => {
    const health = computeClientHealth(
      client(),
      [
        deliverable({
          status: "completed",
          follow_up_at: "2026-07-10",
        }),
      ],
      TODAY,
    );
    expect(health.level).toBe("attention");
    expect(health.followUpsDue).toBe(1);
    expect(health.reasons).toContain("1 to check back in");
  });

  it("is only watch when a project is due soon (within a week)", () => {
    const health = computeClientHealth(
      client(),
      [deliverable({ due_date: "2026-07-18" })],
      TODAY,
    );
    expect(health.level).toBe("watch");
    expect(health.dueSoonProjects).toBe(1);
  });

  it("does not count a project due beyond a week as due soon", () => {
    const health = computeClientHealth(
      client(),
      [deliverable({ due_date: "2026-08-30" })],
      TODAY,
    );
    expect(health.level).toBe("on_track");
    expect(health.dueSoonProjects).toBe(0);
  });

  it("marks paused/offboarded clients inactive regardless of deliverables", () => {
    const paused = computeClientHealth(
      client({ status: "paused" }),
      [deliverable({ due_date: "2026-07-01" })],
      TODAY,
    );
    expect(paused.level).toBe("inactive");
    expect(paused.reasons).toEqual(["Paused"]);
  });

  it("notes onboarding clients that are otherwise on track", () => {
    const health = computeClientHealth(client({ status: "onboarding" }), [], TODAY);
    expect(health.level).toBe("on_track");
    expect(health.reasons).toContain("Onboarding");
  });

  it("escalates attention over watch when both signals are present", () => {
    const health = computeClientHealth(
      client(),
      [
        deliverable({ id: 1, due_date: "2026-07-01" }), // overdue
        deliverable({ id: 2, due_date: "2026-07-18" }), // due soon
      ],
      TODAY,
    );
    expect(health.level).toBe("attention");
  });
});

describe("summarizeHealth", () => {
  it("tallies clients by level", () => {
    const healths: ClientHealth[] = [
      { clientId: 1, level: "attention", reasons: [], followUpsDue: 1, overdueProjects: 0, dueSoonProjects: 0 },
      { clientId: 2, level: "watch", reasons: [], followUpsDue: 0, overdueProjects: 0, dueSoonProjects: 1 },
      { clientId: 3, level: "on_track", reasons: [], followUpsDue: 0, overdueProjects: 0, dueSoonProjects: 0 },
      { clientId: 4, level: "inactive", reasons: [], followUpsDue: 0, overdueProjects: 0, dueSoonProjects: 0 },
      { clientId: 5, level: "attention", reasons: [], followUpsDue: 0, overdueProjects: 2, dueSoonProjects: 0 },
    ];
    expect(summarizeHealth(healths)).toEqual({
      attention: 2,
      watch: 1,
      onTrack: 1,
      inactive: 1,
    });
  });
});
