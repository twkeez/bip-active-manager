import { describe, expect, it } from "vitest";
import {
  addDaysIso,
  buildCompletionPatch,
  buildFollowUpPatch,
  diffDaysIso,
  evaluateDeliverable,
  summarizeDeliverables,
  todayIso,
  type IlluminareDeliverableRow,
} from "@/lib/illuminare/deliverables";

function makeRow(
  overrides: Partial<IlluminareDeliverableRow> = {},
): IlluminareDeliverableRow {
  return {
    id: 1,
    client_id: 1,
    title: "Deliverable",
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

describe("date helpers", () => {
  it("adds days across month boundaries without tz drift", () => {
    expect(addDaysIso("2026-01-30", 5)).toBe("2026-02-04");
  });

  it("computes signed day differences", () => {
    expect(diffDaysIso("2026-02-04", "2026-01-30")).toBe(5);
    expect(diffDaysIso("2026-01-30", "2026-02-04")).toBe(-5);
  });

  it("derives today from a fixed instant", () => {
    expect(todayIso(new Date("2026-07-13T18:30:00Z"))).toBe("2026-07-13");
  });
});

describe("evaluateDeliverable", () => {
  it("flags a recurring deliverable as recurring, never a follow-up", () => {
    const row = makeRow({ kind: "recurring", cadence: "monthly", status: "active" });
    const evaluation = evaluateDeliverable(row, "2026-07-13");
    expect(evaluation.isRecurring).toBe(true);
    expect(evaluation.isOpenOneTime).toBe(false);
    expect(evaluation.needsFollowUp).toBe(false);
  });

  it("computes days until an open one-off's due date", () => {
    const row = makeRow({ due_date: "2026-07-20" });
    const evaluation = evaluateDeliverable(row, "2026-07-13");
    expect(evaluation.isOpenOneTime).toBe(true);
    expect(evaluation.dueInDays).toBe(7);
  });

  it("does NOT nudge a completed one-off before its follow-up date", () => {
    const row = makeRow({
      status: "completed",
      completed_at: "2026-07-01T00:00:00.000Z",
      follow_up_interval_days: 30,
      follow_up_at: "2026-07-31",
    });
    const evaluation = evaluateDeliverable(row, "2026-07-13");
    expect(evaluation.isCompletedOneTime).toBe(true);
    expect(evaluation.needsFollowUp).toBe(false);
    expect(evaluation.followUpDueInDays).toBe(18);
  });

  it("nudges a completed one-off once the follow-up date arrives", () => {
    const row = makeRow({
      status: "completed",
      follow_up_interval_days: 30,
      follow_up_at: "2026-07-10",
    });
    const evaluation = evaluateDeliverable(row, "2026-07-13");
    expect(evaluation.needsFollowUp).toBe(true);
    expect(evaluation.followUpDueInDays).toBe(-3); // 3 days overdue
  });

  it("skips follow-up when a completed one-off has no interval set", () => {
    const row = makeRow({ status: "completed", follow_up_at: null });
    const evaluation = evaluateDeliverable(row, "2026-07-13");
    expect(evaluation.needsFollowUp).toBe(false);
    expect(evaluation.followUpDueInDays).toBeNull();
  });
});

describe("summarizeDeliverables", () => {
  it("counts recurring, open one-offs, and pending follow-ups", () => {
    const rows = [
      makeRow({ id: 1, kind: "recurring", status: "active" }),
      makeRow({ id: 2, kind: "one_time", status: "active" }),
      makeRow({
        id: 3,
        kind: "one_time",
        status: "completed",
        follow_up_at: "2026-07-01",
      }),
      makeRow({
        id: 4,
        kind: "one_time",
        status: "completed",
        follow_up_at: "2026-12-01",
      }),
    ];
    const summary = summarizeDeliverables(rows, "2026-07-13");
    expect(summary.recurringActiveCount).toBe(1);
    expect(summary.openOneTimeCount).toBe(1);
    expect(summary.needsFollowUpCount).toBe(1); // only id 3
  });
});

describe("buildCompletionPatch", () => {
  it("schedules the first nudge one interval out from completion day", () => {
    const now = new Date("2026-07-13T15:00:00Z");
    const patch = buildCompletionPatch({ follow_up_interval_days: 30 }, undefined, now);
    expect(patch.status).toBe("completed");
    expect(patch.completed_at).toBe(now.toISOString());
    expect(patch.follow_up_interval_days).toBe(30);
    expect(patch.follow_up_at).toBe("2026-08-12");
  });

  it("honors an interval override and leaves no nudge when cleared", () => {
    const now = new Date("2026-07-13T15:00:00Z");
    expect(
      buildCompletionPatch({ follow_up_interval_days: 30 }, 0, now).follow_up_at,
    ).toBeNull();
    expect(
      buildCompletionPatch({ follow_up_interval_days: null }, 45, now).follow_up_at,
    ).toBe("2026-08-27");
  });
});

describe("buildFollowUpPatch", () => {
  it("rolls the next nudge forward by the interval after reaching out", () => {
    const now = new Date("2026-07-13T15:00:00Z");
    const patch = buildFollowUpPatch({ follow_up_interval_days: 60 }, now);
    expect(patch.last_followed_up_at).toBe(now.toISOString());
    expect(patch.follow_up_at).toBe("2026-09-11");
  });

  it("stops nudging when the interval has been cleared", () => {
    const now = new Date("2026-07-13T15:00:00Z");
    const patch = buildFollowUpPatch({ follow_up_interval_days: null }, now);
    expect(patch.follow_up_at).toBeNull();
  });
});
