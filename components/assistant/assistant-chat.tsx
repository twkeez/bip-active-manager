"use client";

import { useEffect, useRef, useState } from "react";
import {
  CalendarX2,
  Check,
  CircleAlert,
  Loader2,
  RotateCcw,
  Send,
  Sparkles,
  SquarePen,
  X,
} from "lucide-react";
import type {
  AssistantEvent,
  Proposal,
  ProposedChange,
  TraceEntry,
} from "@/lib/assistant/run-assistant";
import type { UndoOperation } from "@/lib/assistant/task-changes";
import Markdown from "./markdown";

/**
 * Talking to the planning assistant.
 *
 * Three things on this screen exist to keep answers trustworthy rather than
 * merely fluent: every lookup is listed under "How I got this", task changes
 * are proposals you confirm change by change, and every confirmed change has
 * an Undo. Nothing is saved between visits yet — a new conversation starts
 * fresh, with a fresh snapshot of the day.
 */

type ProposalStatus = "pending" | "applying" | "applied" | "dismissed" | "undoing" | "undone";

type ProposalState = {
  proposal: Proposal;
  selected: boolean[];
  status: ProposalStatus;
  undo: UndoOperation[];
  appliedCount: number;
  message: string | null;
};

type UserTurn = { role: "user"; text: string };
type AssistantTurn = {
  role: "assistant";
  text: string;
  trace: TraceEntry[];
  proposals: ProposalState[];
  status: string | null;
  pending: boolean;
  error: string | null;
};
type Turn = UserTurn | AssistantTurn;

const STARTERS = [
  "What's waiting on me in Basecamp?",
  "Which of my tasks could AI or the app handle?",
  "What should I look at before my next client meeting?",
  "Which clients have gone quiet this month?",
];

const ACTION_LABEL: Record<ProposedChange["action"], string> = {
  create: "Add task",
  update: "Update",
  complete: "Mark done",
  reopen: "Reopen",
};

const STATUS_LABEL: Record<string, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  waiting_on_client: "Waiting on client",
};

/** How a proposal's outcome is told back to the model on the next turn. */
function proposalNote(state: ProposalState): string {
  const name = `Proposal "${state.proposal.summary}"`;
  switch (state.status) {
    case "applied":
      return `[${name}: Tom applied ${state.appliedCount} of ${state.proposal.changes.length} changes.]`;
    case "dismissed":
      return `[${name}: Tom dismissed it; nothing changed.]`;
    case "undone":
      return `[${name}: applied, then Tom undid it; nothing changed.]`;
    default:
      return `[${name}: not decided yet; nothing has changed.]`;
  }
}

function toHistory(turns: Turn[]) {
  return turns.map((turn) =>
    turn.role === "user"
      ? { role: "user" as const, text: turn.text }
      : {
          role: "assistant" as const,
          // A failed answer still has to occupy its turn, or the conversation
          // stops alternating and the next question is rejected.
          text: [turn.text || `(That answer failed: ${turn.error ?? "no reply"})`, ...turn.proposals.map(proposalNote)].join(
            "\n\n",
          ),
        },
  );
}

function ChangeDetail({ change }: { change: ProposedChange }) {
  const chips: string[] = [];
  if ("title" in change && change.title && change.action === "update") chips.push(`rename to "${change.title}"`);
  if ("due_date" in change && change.due_date !== undefined) {
    chips.push(change.due_date === null ? "clear due date" : `due ${change.due_date}`);
  }
  if ("priority" in change && change.priority) chips.push(`${change.priority} priority`);
  if ("status" in change && change.status) chips.push(STATUS_LABEL[change.status] ?? change.status);
  if ("client_id" in change && change.client_id !== undefined) {
    chips.push(change.client_id === null ? "unlink client" : `link to ${change.clientName ?? `client ${change.client_id}`}`);
  }
  if ("notes" in change && change.notes !== undefined) chips.push(change.notes === null ? "clear notes" : "update notes");

  const title = change.action === "create" ? change.title : change.currentTitle;

  return (
    <div className="min-w-0">
      <p className="text-xs text-bip-text">
        <span className="font-semibold">{ACTION_LABEL[change.action]}</span>
        {title ? <> · {title}</> : null}
      </p>
      {chips.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {chips.map((chip) => (
            <span key={chip} className="rounded-full border border-bip-border px-2 py-0.5 text-[10.5px] text-bip-muted">
              {chip}
            </span>
          ))}
        </div>
      )}
      <p className="mt-1 text-[11px] leading-relaxed text-bip-muted">{change.reason}</p>
    </div>
  );
}

function ProposalCard({
  state,
  onToggle,
  onConfirm,
  onDismiss,
  onUndo,
}: {
  state: ProposalState;
  onToggle: (index: number) => void;
  onConfirm: () => void;
  onDismiss: () => void;
  onUndo: () => void;
}) {
  const selectedCount = state.selected.filter(Boolean).length;
  const decided = state.status !== "pending" && state.status !== "applying";

  return (
    <div className="rounded-xl border border-bip-accent/40 bg-bip-card p-3.5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-bip-accent">Proposed changes to your tasks</p>
      <p className="mt-1 text-xs font-medium text-bip-text">{state.proposal.summary}</p>

      <ul className="mt-3 space-y-2.5">
        {state.proposal.changes.map((change, index) => (
          <li key={index} className="flex items-start gap-2.5 border-t border-bip-border pt-2.5 first:border-0 first:pt-0">
            {state.status === "pending" ? (
              <input
                type="checkbox"
                checked={state.selected[index]}
                onChange={() => onToggle(index)}
                aria-label={`Include: ${ACTION_LABEL[change.action]}`}
                className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-[var(--bip-accent,#C2185B)]"
              />
            ) : (
              <span className="mt-0.5 inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center">
                {state.status === "applied" && state.selected[index] ? (
                  <Check className="h-3.5 w-3.5 text-emerald-500" />
                ) : (
                  <span className="h-1.5 w-1.5 rounded-full bg-bip-border" />
                )}
              </span>
            )}
            <ChangeDetail change={change} />
          </li>
        ))}
      </ul>

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-bip-border pt-3">
        {state.status === "pending" && (
          <>
            <button
              type="button"
              onClick={onConfirm}
              disabled={selectedCount === 0}
              className="inline-flex items-center gap-1.5 rounded-md bg-bip-accent px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              <Check className="h-3.5 w-3.5" />
              Confirm {selectedCount === state.proposal.changes.length ? "all" : selectedCount}
            </button>
            <button type="button" onClick={onDismiss} className="text-[11px] text-bip-muted hover:text-bip-text">
              Dismiss
            </button>
          </>
        )}
        {state.status === "applying" && (
          <span className="inline-flex items-center gap-1.5 text-[11px] text-bip-muted">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Applying…
          </span>
        )}
        {state.status === "applied" && (
          <>
            <span className="text-[11px] text-emerald-500">
              Applied {state.appliedCount} change{state.appliedCount === 1 ? "" : "s"} to your task list.
            </span>
            {state.undo.length > 0 && (
              <button
                type="button"
                onClick={onUndo}
                className="inline-flex items-center gap-1 text-[11px] text-bip-muted hover:text-bip-text"
              >
                <RotateCcw className="h-3 w-3" /> Undo
              </button>
            )}
          </>
        )}
        {state.status === "undoing" && (
          <span className="inline-flex items-center gap-1.5 text-[11px] text-bip-muted">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Undoing…
          </span>
        )}
        {state.status === "undone" && <span className="text-[11px] text-bip-muted">Undone — your tasks are as they were.</span>}
        {state.status === "dismissed" && <span className="text-[11px] text-bip-muted">Dismissed — nothing changed.</span>}
        {state.message && (
          <span className={`text-[11px] ${decided ? "text-amber-500" : "text-red-400"}`}>{state.message}</span>
        )}
      </div>
    </div>
  );
}

function TraceList({ trace }: { trace: TraceEntry[] }) {
  if (trace.length === 0) return null;
  return (
    <details className="rounded-lg border border-bip-border bg-bip-card/60 px-3 py-2">
      <summary className="cursor-pointer text-[11px] text-bip-muted">
        How I got this · {trace.length} lookup{trace.length === 1 ? "" : "s"}
      </summary>
      <ol className="mt-2 space-y-2">
        {trace.map((entry, index) => (
          <li key={index} className="text-[11px]">
            <p className="flex items-start gap-1.5">
              {entry.ok ? (
                <Check className="mt-0.5 h-3 w-3 shrink-0 text-emerald-500" />
              ) : (
                <CircleAlert className="mt-0.5 h-3 w-3 shrink-0 text-amber-500" />
              )}
              <span className="text-bip-text">
                {entry.purpose ?? entry.tool}
                <span className="text-bip-muted"> — {entry.summary}</span>
              </span>
            </p>
            {(entry.sql || (entry.rows && entry.rows.length > 0)) && (
              <details className="ml-4 mt-1">
                <summary className="cursor-pointer text-[10.5px] text-bip-muted">Show the data</summary>
                {entry.sql && (
                  <pre className="mt-1 overflow-x-auto whitespace-pre-wrap rounded bg-bip-fill p-2 text-[10.5px] text-bip-muted">
                    {entry.sql}
                  </pre>
                )}
                {entry.rows && entry.rows.length > 0 && (
                  <div className="mt-1 max-h-56 overflow-auto rounded border border-bip-border">
                    <table className="w-full text-left text-[10.5px]">
                      <thead className="sticky top-0 bg-bip-card">
                        <tr>
                          {Object.keys(entry.rows[0]).map((column) => (
                            <th key={column} className="whitespace-nowrap px-2 py-1 font-medium text-bip-muted">
                              {column.replace(/_/g, " ")}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {entry.rows.map((row, rowIndex) => (
                          <tr key={rowIndex} className="border-t border-bip-border">
                            {Object.keys(entry.rows![0]).map((column) => {
                              const value = row[column];
                              return (
                                <td key={column} className="whitespace-nowrap px-2 py-1 text-bip-text">
                                  {value === null || value === undefined
                                    ? "—"
                                    : typeof value === "object"
                                      ? JSON.stringify(value).slice(0, 80)
                                      : String(value).slice(0, 80)}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </details>
            )}
          </li>
        ))}
      </ol>
    </details>
  );
}

export default function AssistantChat({ calendarConnected }: { calendarConnected: boolean }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [running, setRunning] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns]);

  function updateLastAssistant(update: (turn: AssistantTurn) => AssistantTurn) {
    setTurns((current) => {
      const next = [...current];
      const last = next[next.length - 1];
      if (last?.role === "assistant") next[next.length - 1] = update(last);
      return next;
    });
  }

  function updateProposal(proposalId: string, update: (state: ProposalState) => ProposalState) {
    setTurns((current) =>
      current.map((turn) =>
        turn.role === "assistant"
          ? { ...turn, proposals: turn.proposals.map((p) => (p.proposal.id === proposalId ? update(p) : p)) }
          : turn,
      ),
    );
  }

  async function send(text: string) {
    const question = text.trim();
    if (!question || running) return;

    const history = toHistory([...turns, { role: "user", text: question }]);
    setTurns((current) => [
      ...current,
      { role: "user", text: question },
      { role: "assistant", text: "", trace: [], proposals: [], status: "Starting…", pending: true, error: null },
    ]);
    setDraft("");
    setRunning(true);

    try {
      const response = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ history }),
      });
      if (!response.ok || !response.body) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? `The assistant could not start (HTTP ${response.status}).`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let finished = false;

      while (!finished) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line) as
            | AssistantEvent
            | { type: "done"; reply: string }
            | { type: "error"; message: string };

          if (event.type === "status") {
            updateLastAssistant((turn) => ({ ...turn, status: event.text }));
          } else if (event.type === "trace") {
            updateLastAssistant((turn) => ({
              ...turn,
              trace: [...turn.trace, event.entry],
              status: event.entry.purpose ?? turn.status,
            }));
          } else if (event.type === "proposal") {
            updateLastAssistant((turn) => ({
              ...turn,
              proposals: [
                ...turn.proposals,
                {
                  proposal: event.proposal,
                  selected: event.proposal.changes.map(() => true),
                  status: "pending",
                  undo: [],
                  appliedCount: 0,
                  message: null,
                },
              ],
            }));
          } else if (event.type === "done") {
            updateLastAssistant((turn) => ({ ...turn, text: event.reply, pending: false, status: null }));
            finished = true;
          } else if (event.type === "error") {
            updateLastAssistant((turn) => ({ ...turn, error: event.message, pending: false, status: null }));
            finished = true;
          }
        }
      }
      if (!finished) {
        updateLastAssistant((turn) => ({
          ...turn,
          pending: false,
          status: null,
          error: turn.text ? turn.error : "The connection closed before the answer arrived. Try again.",
        }));
      }
    } catch (error) {
      updateLastAssistant((turn) => ({
        ...turn,
        pending: false,
        status: null,
        error: error instanceof Error ? error.message : "The assistant failed.",
      }));
    } finally {
      setRunning(false);
    }
  }

  async function confirm(state: ProposalState) {
    const changes = state.proposal.changes.filter((_, index) => state.selected[index]);
    updateProposal(state.proposal.id, (p) => ({ ...p, status: "applying", message: null }));
    try {
      const response = await fetch("/api/assistant/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ changes }),
      });
      const payload = (await response.json()) as {
        applied?: unknown[];
        undo?: UndoOperation[];
        error?: string | null;
      };
      const appliedCount = payload.applied?.length ?? 0;
      if (appliedCount === 0) {
        updateProposal(state.proposal.id, (p) => ({
          ...p,
          status: "pending",
          message: payload.error ?? "Nothing was applied.",
        }));
        return;
      }
      updateProposal(state.proposal.id, (p) => ({
        ...p,
        status: "applied",
        appliedCount,
        undo: payload.undo ?? [],
        // Partial success: say plainly which part stopped.
        message: payload.error ? `Stopped after ${appliedCount}: ${payload.error}` : null,
      }));
    } catch (error) {
      updateProposal(state.proposal.id, (p) => ({
        ...p,
        status: "pending",
        message: error instanceof Error ? error.message : "Could not apply the changes.",
      }));
    }
  }

  async function undo(state: ProposalState) {
    updateProposal(state.proposal.id, (p) => ({ ...p, status: "undoing", message: null }));
    try {
      const response = await fetch("/api/assistant/undo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ undo: state.undo }),
      });
      const payload = (await response.json()) as { undone?: number; error?: string | null };
      if (payload.error) {
        updateProposal(state.proposal.id, (p) => ({
          ...p,
          status: "applied",
          message: `Undo stopped after ${payload.undone ?? 0}: ${payload.error}`,
        }));
        return;
      }
      updateProposal(state.proposal.id, (p) => ({ ...p, status: "undone", message: null }));
    } catch (error) {
      updateProposal(state.proposal.id, (p) => ({
        ...p,
        status: "applied",
        message: error instanceof Error ? error.message : "Undo failed.",
      }));
    }
  }

  const empty = turns.length === 0;

  return (
    <div className="space-y-4">
      {!calendarConnected && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-500/40 bg-bip-card px-4 py-3">
          <p className="flex items-center gap-2 text-xs text-bip-text">
            <CalendarX2 className="h-4 w-4 shrink-0 text-amber-500" />
            Your calendar isn&apos;t connected, so plans can&apos;t account for meetings.
          </p>
          <a href="/api/google/oauth/start" className="text-[11px] font-medium text-bip-accent hover:underline">
            Reconnect Google to add calendar →
          </a>
        </div>
      )}

      {empty ? (
        <div className="rounded-2xl border border-bip-border bg-bip-card px-6 py-10 text-center">
          <Sparkles className="mx-auto h-6 w-6 text-bip-accent" />
          <p className="mt-3 text-sm font-semibold text-bip-text">Start with your day</p>
          <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-bip-muted">
            It reads your open tasks, calendar, Coal Mines and flagged email, then suggests what to focus on and which tasks
            it can answer, watch or close for you. A full plan takes a minute or two — you&apos;ll see each lookup as it happens.
          </p>
          <button
            type="button"
            onClick={() => void send("Plan my day.")}
            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-bip-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            <Sparkles className="h-4 w-4" /> Plan my day
          </button>
          <div className="mt-5 flex flex-wrap justify-center gap-1.5">
            {STARTERS.map((starter) => (
              <button
                key={starter}
                type="button"
                onClick={() => void send(starter)}
                className="rounded-full border border-bip-border px-3 py-1 text-[11px] text-bip-muted hover:text-bip-text"
              >
                {starter}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {turns.map((turn, index) =>
            turn.role === "user" ? (
              <div key={index} className="flex justify-end">
                <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-bip-accent/10 px-3.5 py-2 text-[13px] text-bip-text">
                  {turn.text}
                </p>
              </div>
            ) : (
              <div key={index} className="space-y-2.5">
                {turn.pending && (
                  <div className="rounded-xl border border-bip-border bg-bip-card px-4 py-3">
                    <p className="flex items-center gap-2 text-xs text-bip-muted">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-bip-accent" />
                      {turn.status ?? "Working…"}
                    </p>
                    {turn.trace.length > 0 && (
                      <ol className="mt-2 space-y-1 border-l border-bip-border pl-3">
                        {turn.trace.map((entry, traceIndex) => (
                          <li key={traceIndex} className="text-[11px] text-bip-muted">
                            {entry.ok ? "✓" : "!"} {entry.purpose ?? entry.tool}{" "}
                            <span className="opacity-70">— {entry.summary}</span>
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>
                )}

                {!turn.pending && turn.text && (
                  <div className="rounded-xl border border-bip-border bg-bip-card px-4 py-3.5">
                    <Markdown source={turn.text} />
                  </div>
                )}

                {turn.error && (
                  <p className="flex items-start gap-2 rounded-xl border border-red-500/40 bg-bip-card px-4 py-3 text-xs text-red-400">
                    <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    {turn.error}
                  </p>
                )}

                {turn.proposals.map((state) => (
                  <ProposalCard
                    key={state.proposal.id}
                    state={state}
                    onToggle={(changeIndex) =>
                      updateProposal(state.proposal.id, (p) => ({
                        ...p,
                        selected: p.selected.map((value, i) => (i === changeIndex ? !value : value)),
                      }))
                    }
                    onConfirm={() => void confirm(state)}
                    onDismiss={() => updateProposal(state.proposal.id, (p) => ({ ...p, status: "dismissed" }))}
                    onUndo={() => void undo(state)}
                  />
                ))}

                {!turn.pending && <TraceList trace={turn.trace} />}
              </div>
            ),
          )}
        </div>
      )}

      <div ref={bottomRef} />

      <div className="sticky bottom-0 -mx-1 rounded-2xl border border-bip-border bg-bip-card p-2 shadow-sm">
        <div className="flex items-end gap-2">
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void send(draft);
              }
            }}
            rows={2}
            disabled={running}
            placeholder={empty ? "Or ask anything about your work…" : "Ask a follow-up… (Shift+Enter for a new line)"}
            className="min-h-[2.75rem] flex-1 resize-none rounded-lg bg-transparent px-2 py-1.5 text-[13px] text-bip-text placeholder:text-bip-muted focus:outline-none disabled:opacity-60"
          />
          <div className="flex shrink-0 items-center gap-1 pb-1">
            {!empty && (
              <button
                type="button"
                onClick={() => setTurns([])}
                disabled={running}
                title="New conversation"
                className="rounded-md p-2 text-bip-muted hover:text-bip-text disabled:opacity-50"
              >
                <SquarePen className="h-4 w-4" />
              </button>
            )}
            <button
              type="button"
              onClick={() => void send(draft)}
              disabled={running || !draft.trim()}
              aria-label="Send"
              className="rounded-md bg-bip-accent p-2 text-white hover:opacity-90 disabled:opacity-50"
            >
              {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>

      {turns.some((turn) => turn.role === "assistant" && turn.proposals.some((p) => p.status === "pending")) && (
        <p className="text-center text-[10.5px] text-bip-muted">
          <X className="mr-1 inline h-3 w-3" />
          Proposals you haven&apos;t confirmed are discarded if you start a new conversation or leave the page.
        </p>
      )}
    </div>
  );
}
