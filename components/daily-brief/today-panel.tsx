import Link from "next/link";
import type { DayContext } from "@/lib/assistant/day-context";

/**
 * Today, as of this page load: your calendar, the tasks due or overdue, and the
 * Coal Mines checks that are not quiet. Read live from the same sources the
 * Assistant's "Plan my day" uses, so the two cannot disagree. Not saved with
 * the brief: it is about right now, and about you.
 */

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-xl border border-bip-border bg-bip-card p-4">
      <h3 className="text-xs font-medium uppercase tracking-wide text-bip-muted">{title}</h3>
      <div className="mt-2 text-sm text-bip-text">{children}</div>
    </div>
  );
}

const muted = (text: string) => <p className="text-bip-muted">{text}</p>;

export default function TodayPanel({ context }: { context: DayContext }) {
  const { calendar, tasks, canaries, today } = context;
  const due = tasks.filter((task) => task.due_date != null && task.due_date <= today);

  return (
    <section className="space-y-2" aria-label="Today">
      <h2 className="text-xs font-medium uppercase tracking-wide text-bip-muted">Today · live as of this page load</h2>
      <div className="grid gap-3 md:grid-cols-3">
        <Card title="Calendar">
          {!calendar.connected ? (
            muted(`Not available: ${calendar.reason}`)
          ) : calendar.events.length === 0 ? (
            muted("Nothing scheduled today.")
          ) : (
            <ul className="space-y-1.5">
              {calendar.events.map((event, index) => (
                <li key={`${event.title}-${index}`} className="flex gap-2">
                  <span className="w-20 shrink-0 tabular-nums text-bip-muted">
                    {event.allDay ? "All day" : `${event.start}–${event.end}`}
                  </span>
                  <span className="min-w-0">{event.title}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title={`Tasks due or overdue (${due.length})`}>
          {due.length === 0 ? (
            muted("None.")
          ) : (
            <ul className="space-y-1.5">
              {due.slice(0, 8).map((task) => (
                <li key={task.id}>
                  <Link href="/my-tasks" className="hover:underline">
                    {task.title}
                  </Link>
                  <span className="block text-xs text-bip-muted">
                    {task.due_date! < today ? `Overdue, was due ${task.due_date}` : "Due today"}
                    {task.client ? ` · ${task.client}` : ""}
                  </span>
                </li>
              ))}
              {due.length > 8 && (
                <li className="text-xs text-bip-muted">
                  …and {due.length - 8} more in{" "}
                  <Link href="/my-tasks" className="underline">
                    My Tasks
                  </Link>
                </li>
              )}
            </ul>
          )}
        </Card>

        <Card title={`Coal Mines (${canaries.length} not quiet)`}>
          {canaries.length === 0 ? (
            muted("All checks are quiet.")
          ) : (
            <ul className="space-y-1.5">
              {canaries.map((canary) => (
                <li key={canary.key}>
                  <Link href="/coal-mines" className="font-medium hover:underline">
                    {canary.name}
                  </Link>
                  <span className="block text-xs text-bip-muted">{canary.headline}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </section>
  );
}
