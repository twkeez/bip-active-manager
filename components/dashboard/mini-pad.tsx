"use client";

import { useState } from "react";
import Link from "next/link";

type MiniTask = { id: number; title: string; status: string; is_starred: boolean };

type Props = { initialTasks: MiniTask[] };

export default function MiniPad({ initialTasks }: Props) {
  const [tasks, setTasks] = useState<MiniTask[]>(initialTasks);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  const open = tasks.filter((t) => t.status !== "done").slice(0, 12);

  async function add() {
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    setSaving(true);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: text, status: "not_started", priority: "medium" }),
      });
      const data = (await res.json()) as { task?: MiniTask };
      if (data.task) setTasks((prev) => [data.task!, ...prev]);
    } finally {
      setSaving(false);
    }
  }

  async function toggleDone(task: MiniTask) {
    const next = task.status === "done" ? "not_started" : "done";
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: next } : t)));
    await fetch(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
  }

  return (
    <div className="bip-card overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between border-b px-4 py-3"
        style={{ borderColor: "var(--border)", background: "var(--primary-soft)" }}
      >
        <span className="text-sm font-semibold" style={{ color: "var(--primary)", fontFamily: "var(--font-heading)" }}>
          My Tasks
        </span>
        <Link href="/my-tasks" className="text-xs" style={{ color: "var(--primary)" }}>
          View all →
        </Link>
      </div>

      {/* Add row */}
      <div
        className="flex items-center gap-3 border-b px-4"
        style={{ borderColor: "var(--border)", height: 44 }}
      >
        <div className="h-4 w-4 shrink-0 rounded-full border-2" style={{ borderColor: "var(--border-strong)" }} />
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") void add(); }}
          placeholder="Add a task… press Enter"
          disabled={saving}
          className="flex-1 bg-transparent text-sm outline-none"
          style={{ color: "var(--text)" }}
        />
      </div>

      {/* Task lines */}
      {open.length === 0 ? (
        <p className="px-4 py-4 text-sm" style={{ color: "var(--text-subtle)" }}>
          All clear — add something above.
        </p>
      ) : (
        <ul className="divide-y" style={{ borderColor: "var(--border)" }}>
          {open.map((task) => (
            <li
              key={task.id}
              className="flex items-center gap-3 px-4 transition-colors hover:bg-[var(--surface-hover)]"
              style={{ height: 40 }}
            >
              <button
                onClick={() => void toggleDone(task)}
                className="h-4 w-4 shrink-0 rounded-full border-2 transition-colors hover:border-[var(--success)]"
                style={{ borderColor: "var(--border-strong)" }}
                aria-label="Mark done"
              />
              <span className="flex-1 truncate text-sm" style={{ color: "var(--text)" }}>
                {task.title}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
