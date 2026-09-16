import { describe, expect, it } from "vitest";
import { parseTaskChange, parseUndoOperation, TaskChangeError } from "./task-changes";

describe("parseTaskChange", () => {
  it("accepts a well-formed new task and drops fields it does not know", () => {
    const change = parseTaskChange({
      action: "create",
      title: "  Check Bowman ads  ",
      due_date: "2026-09-18",
      priority: "high",
      reason: "Spent $0 in the last 30 days",
      owner_user_id: "someone-else",
    });
    expect(change).toEqual({
      action: "create",
      title: "Check Bowman ads",
      notes: undefined,
      due_date: "2026-09-18",
      priority: "high",
      client_id: undefined,
      reason: "Spent $0 in the last 30 days",
    });
    // Whatever the model sends, it cannot choose whose task this is.
    expect(change).not.toHaveProperty("owner_user_id");
  });

  it("insists on a reason, so every suggestion explains itself", () => {
    expect(() => parseTaskChange({ action: "complete", task_id: 4 })).toThrow(/reason/);
  });

  it("rejects impossible dates the pattern alone would let through", () => {
    expect(() =>
      parseTaskChange({ action: "update", task_id: 4, due_date: "2026-02-30", reason: "r" }),
    ).toThrow(/real date/);
    expect(() =>
      parseTaskChange({ action: "update", task_id: 4, due_date: "next Friday", reason: "r" }),
    ).toThrow(/YYYY-MM-DD/);
  });

  it("allows clearing a due date with null", () => {
    const change = parseTaskChange({ action: "update", task_id: 4, due_date: null, reason: "r" });
    expect(change).toMatchObject({ action: "update", due_date: null });
  });

  // "done" goes through complete, which records the prior status for Undo.
  it("does not let an update set a task to done", () => {
    expect(() => parseTaskChange({ action: "update", task_id: 4, status: "done", reason: "r" })).toThrow(
      /complete/,
    );
  });

  it("refuses an update that changes nothing", () => {
    expect(() => parseTaskChange({ action: "update", task_id: 4, reason: "r" })).toThrow(/at least one/);
  });

  it("refuses a task id that is not a positive whole number", () => {
    for (const bad of ["4", 0, -1, 2.5, null]) {
      expect(() => parseTaskChange({ action: "complete", task_id: bad, reason: "r" })).toThrow(TaskChangeError);
    }
  });

  it("refuses an unknown action and a bad priority", () => {
    expect(() => parseTaskChange({ action: "delete", task_id: 4, reason: "r" })).toThrow(/action/);
    expect(() => parseTaskChange({ action: "create", title: "x", priority: "urgent", reason: "r" })).toThrow(
      /priority/,
    );
  });
});

describe("parseUndoOperation", () => {
  it("accepts a restore it could have produced", () => {
    const op = parseUndoOperation({
      kind: "restore",
      task_id: 12,
      fields: { title: "sunrise ads", notes: null, due_date: null, priority: "medium", status: "not_started", client_id: null },
    });
    expect(op.kind).toBe("restore");
  });

  // Undo payloads round-trip through the browser, so they are untrusted too.
  it("rejects a tampered restore", () => {
    expect(() =>
      parseUndoOperation({
        kind: "restore",
        task_id: 12,
        fields: { title: "x", notes: null, due_date: null, priority: "medium", status: "archived", client_id: null },
      }),
    ).toThrow();
    expect(() => parseUndoOperation({ kind: "drop_table", task_id: 12 })).toThrow();
  });
});
