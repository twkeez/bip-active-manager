import Link from "next/link";
import { EMAIL_LIMIT, EMAIL_WINDOW_DAYS, type DayContext } from "@/lib/assistant/day-context";

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

const easternTime = (iso: string) =>
  new Date(iso).toLocaleString("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

/** The inbox is only as current as its last sync, and the panel says so. */
function emailFreshness(daysAgo: number | null): string | null {
  if (daysAgo === null) return "Email has never synced, so nothing is shown.";
  if (daysAgo >= 2) return `Email last synced ${daysAgo} days ago, so recent mail is missing.`;
  return null;
}

export default function TodayPanel({ context }: { context: DayContext }) {
  const { calendar, tasks, canaries, emails, emailLastSyncedDaysAgo, today } = context;
  const freshness = emailFreshness(emailLastSyncedDaysAgo);
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

      <Card title={`High-priority email, last ${EMAIL_WINDOW_DAYS} days (${emails.length})`}>
        {freshness && <p className="mb-2 text-amber-300">{freshness}</p>}
        {emails.length === 0 ? (
          muted(`No high-priority email in the last ${EMAIL_WINDOW_DAYS} days.`)
        ) : (
          <ul className="divide-y divide-bip-border">
            {emails.map((email, index) => (
              <li key={`${email.received}-${index}`} className="py-2 first:pt-0 last:pb-0">
                <p>
                  <span className="font-medium">{email.subject}</span>
                  <span className="text-bip-muted">
                    {" "}
                    · {email.from}
                    {email.receivedAt ? ` · ${easternTime(email.receivedAt)} ET` : ""}
                  </span>
                </p>
                {email.why && <p className="text-xs text-bip-muted">Flagged because: {email.why}</p>}
              </li>
            ))}
          </ul>
        )}
        {emails.length >= EMAIL_LIMIT && (
          <p className="mt-2 text-xs text-bip-muted">Showing the {EMAIL_LIMIT} most recent; there may be more.</p>
        )}
        <p className="mt-2 text-xs text-bip-muted">
          Only your inbox is checked, and only mail the inbox triage has flagged as high priority. Mail to other team members is not
          included.
        </p>
      </Card>
    </section>
  );
}
