"use client";

import { useRef, useState } from "react";
import type { UserTaskWithSource } from "@/lib/tasks/shared";

type Props = {
  tasks: UserTaskWithSource[];
  saving: boolean;
  onAdd: (title: string) => Promise<void>;
  onToggleDone: (task: UserTaskWithSource) => Promise<void>;
  onToggleStar: (task: UserTaskWithSource) => Promise<void>;
};

const LINE_HEIGHT = 40; // px — matches ruled line spacing

export default function QuickNotesPad({ tasks, saving, onAdd, onToggleDone, onToggleStar }: Props) {
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const open = tasks.filter((t) => t.status !== "done");
  const done = tasks.filter((t) => t.status === "done");
  const allLines = [...open, ...done];

  async function submit() {
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    await onAdd(text);
  }

  return (
    <div
      className="relative min-h-[600px] overflow-hidden rounded-xl border"
      style={{
        background: "var(--surface)",
        borderColor: "var(--border)",
        fontFamily: "var(--font-caveat), cursive",
      }}
    >
      {/* Ruled lines background */}
      <RuledLines />

      {/* Red margin line */}
      <div
        className="absolute inset-y-0 left-[72px] w-px opacity-30"
        style={{ background: "var(--accent)" }}
      />

      {/* Header */}
      <div className="relative z-10 border-b px-6 py-4" style={{ borderColor: "var(--border)", marginLeft: 72 }}>
        <p className="text-2xl font-semibold" style={{ color: "var(--text-subtle)", fontFamily: "var(--font-caveat), cursive" }}>
          Today&rsquo;s List
        </p>
        <p className="text-base" style={{ color: "var(--text-subtle)" }}>
          {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
        </p>
      </div>

      {/* Add input */}
      <div
        className="relative z-10 flex items-center gap-3 border-b px-4"
        style={{ borderColor: "var(--border)", height: LINE_HEIGHT, marginLeft: 72 }}
      >
        {/* Empty checkbox */}
        <div
          className="h-5 w-5 shrink-0 rounded-full border-2"
          style={{ borderColor: "var(--border-strong)" }}
        />
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void submit(); } }}
          placeholder="Add a task… press Enter"
          disabled={saving}
          className="flex-1 bg-transparent text-xl outline-none"
          style={{
            fontFamily: "var(--font-caveat), cursive",
            color: "var(--text)",
          }}
        />
        {draft.trim() && (
          <button
            onClick={() => void submit()}
            disabled={saving}
            className="rounded-lg px-3 py-1 text-base font-semibold transition-colors"
            style={{ background: "var(--primary)", color: "var(--text-on-brand)" }}
          >
            {saving ? "…" : "Add"}
          </button>
        )}
      </div>

      {/* Task lines */}
      <ul className="relative z-10" style={{ marginLeft: 72 }}>
        {allLines.length === 0 && (
          <li
            className="flex items-center px-4 text-xl italic"
            style={{ height: LINE_HEIGHT, color: "var(--text-subtle)", fontFamily: "var(--font-caveat), cursive", borderBottom: "1px solid var(--border)" }}
          >
            Nothing yet — add your first task above.
          </li>
        )}
        {allLines.map((task) => {
          const isDone = task.status === "done";
          return (
            <li
              key={task.id}
              className="group flex items-center gap-3 px-4 transition-colors hover:bg-[var(--surface-hover)]"
              style={{ height: LINE_HEIGHT, borderBottom: "1px solid var(--border)" }}
            >
              {/* Checkbox */}
              <button
                onClick={() => void onToggleDone(task)}
                className="relative h-5 w-5 shrink-0 rounded-full border-2 transition-colors"
                style={{
                  borderColor: isDone ? "var(--success)" : "var(--border-strong)",
                  background: isDone ? "var(--success)" : "transparent",
                }}
                aria-label={isDone ? "Mark not done" : "Mark done"}
              >
                {isDone && (
                  <svg className="absolute inset-0 m-auto" width="10" height="8" viewBox="0 0 10 8" fill="none">
                    <path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>

              {/* Title */}
              <span
                className="flex-1 text-xl leading-none"
                style={{
                  fontFamily: "var(--font-caveat), cursive",
                  color: isDone ? "var(--text-subtle)" : "var(--text)",
                  textDecoration: isDone ? "line-through" : "none",
                  opacity: isDone ? 0.55 : 1,
                }}
              >
                {task.title}
                {task.client && (
                  <span className="ml-2 text-base" style={{ color: "var(--text-subtle)" }}>
                    — {task.client.account_name}
                  </span>
                )}
              </span>

              {/* Star */}
              <button
                onClick={() => void onToggleStar(task)}
                className="opacity-0 group-hover:opacity-100 transition-opacity text-base"
                style={{ color: task.is_starred ? "#f59e0b" : "var(--text-subtle)" }}
                aria-label="Toggle star"
              >
                {task.is_starred ? "★" : "☆"}
              </button>
            </li>
          );
        })}
      </ul>

      {/* Page curl hint */}
      <div
        className="absolute bottom-0 right-0 h-8 w-8 opacity-20"
        style={{
          background: "linear-gradient(225deg, var(--border-strong) 50%, transparent 50%)",
          borderTopLeftRadius: "4px",
        }}
      />
    </div>
  );
}

function RuledLines() {
  const count = 20;
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Top binding strip */}
      <div className="absolute inset-x-0 top-0 h-[72px]" style={{ background: "var(--primary-soft)" }} />
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="absolute inset-x-0"
          style={{
            top: 72 + (i + 1) * LINE_HEIGHT,
            height: 1,
            background: "var(--border)",
            opacity: 0.6,
          }}
        />
      ))}
    </div>
  );
}
