import { describe, expect, it } from "vitest";
import type { UserTask } from "@/lib/types/client";
import { filterTasks, isOverdue, sortTasks } from "./mcp-filter";

let nextId = 1;
function task(overrides: Partial<UserTask> = {}): UserTask {
  const id = nextId++;
  return {
    id,
    owner_user_id: "u",
    title: `Task ${id}`,
    notes: null,
    description: null,
    status: "not_started",
    priority: "medium",
    due_date: null,
    category_id: null,
    client_id: null,
    project_id: null,
    phase_id: null,
    is_starred: false,
    source_type: "manual",
    created_at: "2026-11-01T00:00:00Z",
    updated_at: "2026-11-01T00:00:00Z",
    ...overrides,
  };
}

describe("filterTasks", () => {
  const open = task({ status: "in_progress", client_id: 7, project_id: 3, due_date: "2026-11-05", is_starred: true });
  const waiting = task({ status: "waiting_on_client", client_id: 8, due_date: "2026-11-20" });
  const done = task({ status: "done", client_id: 7 });
  const all = [open, waiting, done];

  it("defaults to open tasks", () => {
    expect(filterTasks(all, {})).toEqual([open, waiting]);
  });
  it("filters by done, all and a single stage", () => {
    expect(filterTasks(all, { status: "done" })).toEqual([done]);
    expect(filterTasks(all, { status: "all" })).toEqual(all);
    expect(filterTasks(all, { status: "waiting_on_client" })).toEqual([waiting]);
  });
  it("filters by client, project, due date and star", () => {
    expect(filterTasks(all, { status: "all", clientId: 7 })).toEqual([open, done]);
    expect(filterTasks(all, { projectId: 3 })).toEqual([open]);
    expect(filterTasks(all, { dueBy: "2026-11-06" })).toEqual([open]);
    expect(filterTasks(all, { starredOnly: true })).toEqual([open]);
  });
});

describe("sortTasks", () => {
  it("puts starred first, then earliest due date, undated last, then priority", () => {
    const undatedHigh = task({ priority: "high" });
    const later = task({ due_date: "2026-12-01" });
    const soonLow = task({ due_date: "2026-11-10", priority: "low" });
    const soonHigh = task({ due_date: "2026-11-10", priority: "high" });
    const starred = task({ is_starred: true });
    expect(sortTasks([undatedHigh, later, soonLow, starred, soonHigh]).map((t) => t.id)).toEqual([
      starred.id,
      soonHigh.id,
      soonLow.id,
      later.id,
      undatedHigh.id,
    ]);
  });
});

describe("isOverdue", () => {
  it("is overdue only when open and due before today", () => {
    expect(isOverdue({ due_date: "2026-11-05", status: "not_started" }, "2026-11-06")).toBe(true);
    expect(isOverdue({ due_date: "2026-11-06", status: "not_started" }, "2026-11-06")).toBe(false);
    expect(isOverdue({ due_date: "2026-11-05", status: "done" }, "2026-11-06")).toBe(false);
    expect(isOverdue({ due_date: null, status: "not_started" }, "2026-11-06")).toBe(false);
  });
});
