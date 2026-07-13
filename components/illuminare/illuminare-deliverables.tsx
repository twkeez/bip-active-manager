"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BellRing,
  CalendarClock,
  Check,
  Plus,
  RefreshCw,
  Repeat,
  Trash2,
} from "lucide-react";
import {
  CADENCE_LABELS,
  DELIVERABLE_CADENCES,
  evaluateDeliverable,
  summarizeDeliverables,
  todayIso,
  type DeliverableCadence,
  type DeliverableKind,
  type IlluminareDeliverableRow,
} from "@/lib/illuminare/deliverables";

type Props = {
  clientId: number;
  deliverables: IlluminareDeliverableRow[];
};

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function relDays(days: number): string {
  if (days === 0) return "today";
  if (days < 0) return `${Math.abs(days)}d overdue`;
  return `in ${days}d`;
}

export default function IlluminareDeliverables({ clientId, deliverables }: Props) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<number | "new" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const today = todayIso();
  const summary = useMemo(
    () => summarizeDeliverables(deliverables, today),
    [deliverables, today],
  );

  const recurring = deliverables.filter((d) => d.kind === "recurring");
  const openOneTime = deliverables.filter(
    (d) => d.kind === "one_time" && d.status === "active",
  );
  const completedOneTime = deliverables.filter(
    (d) => d.kind === "one_time" && d.status !== "active",
  );
  const followUps = completedOneTime.filter(
    (d) => evaluateDeliverable(d, today).needsFollowUp,
  );

  async function call(url: string, init: RequestInit, id: number | "new") {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(url, {
        headers: { "Content-Type": "application/json" },
        ...init,
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Request failed");
      }
      router.refresh();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
      return false;
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="rounded-lg border border-[var(--bip-border)] bg-[var(--bip-card)] p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-[var(--text)]">
            Deliverables & tasks
          </h2>
          <p className="mt-0.5 text-xs text-[var(--text-muted)]">
            {summary.recurringActiveCount} recurring · {summary.openOneTimeCount} open
            project{summary.openOneTimeCount === 1 ? "" : "s"}
            {summary.needsFollowUpCount > 0 && (
              <span className="text-[var(--bip-accent)]">
                {" "}
                · {summary.needsFollowUpCount} to check back in
              </span>
            )}
          </p>
        </div>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--bip-border)] px-3 py-1.5 text-xs font-medium text-[var(--text)] hover:bg-[var(--bip-hover)]"
        >
          <Plus size={14} /> Add
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-400">
          {error}
        </div>
      )}

      {showForm && (
        <AddDeliverableForm
          clientId={clientId}
          busy={busyId === "new"}
          onSubmit={async (payload) => {
            const ok = await call(
              "/api/illuminare/deliverables",
              { method: "POST", body: JSON.stringify(payload) },
              "new",
            );
            if (ok) setShowForm(false);
          }}
        />
      )}

      {/* Re-engagement nudges */}
      {followUps.length > 0 && (
        <div className="mb-5 rounded-lg border border-[var(--bip-accent)]/40 bg-[var(--bip-accent)]/10 p-3">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-[var(--bip-accent)]">
            <BellRing size={14} /> Time to reach back out
          </p>
          <div className="flex flex-col gap-2">
            {followUps.map((d) => {
              const evalr = evaluateDeliverable(d, today);
              return (
                <div
                  key={d.id}
                  className="flex items-center justify-between gap-3 text-sm"
                >
                  <span className="text-[var(--text)]">
                    {d.title}
                    <span className="ml-2 text-xs text-[var(--text-muted)]">
                      {evalr.followUpDueInDays != null &&
                        relDays(evalr.followUpDueInDays)}
                    </span>
                  </span>
                  <button
                    disabled={busyId === d.id}
                    onClick={() =>
                      call(
                        `/api/illuminare/deliverables/${d.id}`,
                        {
                          method: "PATCH",
                          body: JSON.stringify({ action: "followed_up" }),
                        },
                        d.id,
                      )
                    }
                    className="inline-flex shrink-0 items-center gap-1 rounded-md bg-[var(--bip-accent)] px-2.5 py-1 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
                  >
                    <Check size={12} /> Logged a check-in
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {deliverables.length === 0 && !showForm ? (
        <p className="py-4 text-center text-sm text-[var(--text-muted)]">
          No deliverables yet. Add recurring retainer work or a one-time project.
        </p>
      ) : (
        <div className="flex flex-col gap-5">
          <Group icon={<Repeat size={13} />} label="Recurring">
            {recurring.length === 0 ? (
              <Empty text="No recurring work." />
            ) : (
              recurring.map((d) => (
                <Row
                  key={d.id}
                  title={d.title}
                  detail={d.detail}
                  meta={d.cadence ? CADENCE_LABELS[d.cadence] : "Recurring"}
                  busy={busyId === d.id}
                  onDelete={() =>
                    call(
                      `/api/illuminare/deliverables/${d.id}`,
                      { method: "DELETE" },
                      d.id,
                    )
                  }
                />
              ))
            )}
          </Group>

          <Group icon={<CalendarClock size={13} />} label="Open projects">
            {openOneTime.length === 0 ? (
              <Empty text="No open one-time projects." />
            ) : (
              openOneTime.map((d) => {
                const evalr = evaluateDeliverable(d, today);
                return (
                  <Row
                    key={d.id}
                    title={d.title}
                    detail={d.detail}
                    meta={
                      d.due_date
                        ? `Due ${fmtDate(d.due_date)}${
                            evalr.dueInDays != null
                              ? ` · ${relDays(evalr.dueInDays)}`
                              : ""
                          }`
                        : "One-time project"
                    }
                    busy={busyId === d.id}
                    action={{
                      label: "Complete",
                      icon: <Check size={12} />,
                      onClick: () =>
                        call(
                          `/api/illuminare/deliverables/${d.id}`,
                          {
                            method: "PATCH",
                            body: JSON.stringify({ action: "complete" }),
                          },
                          d.id,
                        ),
                    }}
                    onDelete={() =>
                      call(
                        `/api/illuminare/deliverables/${d.id}`,
                        { method: "DELETE" },
                        d.id,
                      )
                    }
                  />
                );
              })
            )}
          </Group>

          {completedOneTime.length > 0 && (
            <Group icon={<Check size={13} />} label="Completed projects">
              {completedOneTime.map((d) => {
                const evalr = evaluateDeliverable(d, today);
                const nextNudge =
                  d.follow_up_at && !evalr.needsFollowUp
                    ? `Next check-in ${fmtDate(d.follow_up_at)}`
                    : d.follow_up_interval_days
                      ? "Check-in scheduled"
                      : "No check-in set";
                return (
                  <Row
                    key={d.id}
                    title={d.title}
                    detail={d.detail}
                    dim
                    meta={`Completed ${fmtDate(d.completed_at)} · ${nextNudge}`}
                    busy={busyId === d.id}
                    action={{
                      label: "Log check-in",
                      icon: <RefreshCw size={12} />,
                      onClick: () =>
                        call(
                          `/api/illuminare/deliverables/${d.id}`,
                          {
                            method: "PATCH",
                            body: JSON.stringify({ action: "followed_up" }),
                          },
                          d.id,
                        ),
                    }}
                    onDelete={() =>
                      call(
                        `/api/illuminare/deliverables/${d.id}`,
                        { method: "DELETE" },
                        d.id,
                      )
                    }
                  />
                );
              })}
            </Group>
          )}
        </div>
      )}
    </section>
  );
}

function Group({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-2 flex items-center gap-1.5 text-[0.7rem] font-semibold uppercase tracking-wide text-[var(--text-subtle)]">
        {icon} {label}
      </p>
      <div className="flex flex-col gap-1.5">{children}</div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="text-xs text-[var(--text-subtle)]">{text}</p>;
}

function Row({
  title,
  detail,
  meta,
  busy,
  dim,
  action,
  onDelete,
}: {
  title: string;
  detail: string | null;
  meta: string;
  busy: boolean;
  dim?: boolean;
  action?: { label: string; icon: React.ReactNode; onClick: () => void };
  onDelete: () => void;
}) {
  return (
    <div
      className={`flex items-start justify-between gap-3 rounded-md border border-[var(--bip-border)] px-3 py-2 ${
        dim ? "opacity-70" : ""
      }`}
    >
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-[var(--text)]">{title}</p>
        {detail && (
          <p className="mt-0.5 truncate text-xs text-[var(--text-muted)]">{detail}</p>
        )}
        <p className="mt-0.5 text-xs text-[var(--text-subtle)]">{meta}</p>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {action && (
          <button
            disabled={busy}
            onClick={action.onClick}
            className="inline-flex items-center gap-1 rounded-md border border-[var(--bip-border)] px-2 py-1 text-xs font-medium text-[var(--text)] hover:bg-[var(--bip-hover)] disabled:opacity-50"
          >
            {action.icon} {action.label}
          </button>
        )}
        <button
          disabled={busy}
          onClick={onDelete}
          aria-label="Delete deliverable"
          className="rounded-md p-1 text-[var(--text-subtle)] hover:bg-[var(--bip-hover)] hover:text-rose-400 disabled:opacity-50"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

type NewDeliverable = {
  clientId: number;
  title: string;
  detail: string | null;
  kind: DeliverableKind;
  cadence: DeliverableCadence | null;
  dueDate: string | null;
  followUpIntervalDays: number | null;
};

function AddDeliverableForm({
  clientId,
  busy,
  onSubmit,
}: {
  clientId: number;
  busy: boolean;
  onSubmit: (payload: NewDeliverable) => void;
}) {
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [kind, setKind] = useState<DeliverableKind>("one_time");
  const [cadence, setCadence] = useState<DeliverableCadence>("monthly");
  const [dueDate, setDueDate] = useState("");
  const [followUpDays, setFollowUpDays] = useState("30");

  const inputCls =
    "w-full rounded-md border border-[var(--bip-border)] bg-[var(--bip-bg)] px-2.5 py-1.5 text-sm text-[var(--text)] placeholder:text-[var(--text-subtle)] focus:border-[var(--bip-accent)] focus:outline-none";

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!title.trim()) return;
        onSubmit({
          clientId,
          title: title.trim(),
          detail: detail.trim() || null,
          kind,
          cadence: kind === "recurring" ? cadence : null,
          dueDate: kind === "one_time" && dueDate ? dueDate : null,
          followUpIntervalDays:
            kind === "one_time" && followUpDays ? Number(followUpDays) : null,
        });
      }}
      className="mb-5 flex flex-col gap-3 rounded-lg border border-[var(--bip-border)] bg-[var(--bip-bg)] p-3"
    >
      <div className="flex gap-2">
        {(["one_time", "recurring"] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(k)}
            className={`flex-1 rounded-md border px-3 py-1.5 text-xs font-medium ${
              kind === k
                ? "border-[var(--bip-accent)] bg-[var(--bip-accent)]/10 text-[var(--bip-accent)]"
                : "border-[var(--bip-border)] text-[var(--text-muted)] hover:bg-[var(--bip-hover)]"
            }`}
          >
            {k === "one_time" ? "One-time project" : "Recurring"}
          </button>
        ))}
      </div>

      <input
        className={inputCls}
        placeholder="Title (e.g. Website redesign, 4 blog posts)"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        autoFocus
      />
      <input
        className={inputCls}
        placeholder="Detail (optional)"
        value={detail}
        onChange={(e) => setDetail(e.target.value)}
      />

      {kind === "recurring" ? (
        <label className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
          Cadence
          <select
            className={inputCls}
            value={cadence}
            onChange={(e) => setCadence(e.target.value as DeliverableCadence)}
          >
            {DELIVERABLE_CADENCES.map((c) => (
              <option key={c} value={c}>
                {CADENCE_LABELS[c]}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <div className="flex flex-col gap-2 sm:flex-row">
          <label className="flex flex-1 flex-col gap-1 text-xs text-[var(--text-muted)]">
            Due date (optional)
            <input
              type="date"
              className={inputCls}
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </label>
          <label className="flex flex-1 flex-col gap-1 text-xs text-[var(--text-muted)]">
            Check back in after (days)
            <input
              type="number"
              min={0}
              className={inputCls}
              placeholder="30"
              value={followUpDays}
              onChange={(e) => setFollowUpDays(e.target.value)}
            />
          </label>
        </div>
      )}

      <div className="flex justify-end gap-2">
        <button
          type="submit"
          disabled={busy || !title.trim()}
          className="inline-flex items-center gap-1.5 rounded-md bg-[var(--bip-accent)] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          <Plus size={14} /> {busy ? "Adding…" : "Add deliverable"}
        </button>
      </div>
    </form>
  );
}
