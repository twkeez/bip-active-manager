import { ArrowRightLeft, ExternalLink, MessageSquare } from "lucide-react";
import type { IlluminareClientRow } from "@/lib/illuminare/types";
import type { IlluminareCommsEventRow } from "@/lib/illuminare/comms";

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function relDays(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}

export default function IlluminareComms({
  client,
  events,
  linked,
}: {
  client: Pick<
    IlluminareClientRow,
    "last_communication_at" | "last_comm_is_internal" | "needs_reply" | "comms_synced_at"
  >;
  events: IlluminareCommsEventRow[];
  linked: boolean;
}) {
  return (
    <section className="rounded-lg border border-[var(--bip-border)] bg-[var(--bip-card)] p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-[var(--text)]">Communication</h2>
        {client.needs_reply && (
          <span className="inline-flex items-center gap-1 rounded-full border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-[0.7rem] font-medium text-rose-400">
            <ArrowRightLeft size={11} /> Awaiting our reply
          </span>
        )}
      </div>

      {client.last_communication_at && (
        <p className="mb-4 text-xs text-[var(--text-muted)]">
          Last activity {relDays(client.last_communication_at)} ·{" "}
          {client.last_comm_is_internal ? "from us" : "from the client"}
        </p>
      )}

      {!linked ? (
        <p className="text-sm text-[var(--text-muted)]">
          Link this client to a Basecamp project (Illuminare → Match projects) to
          pull in communication.
        </p>
      ) : events.length === 0 ? (
        <p className="text-sm text-[var(--text-muted)]">
          No recent messages or comments.
          {!client.comms_synced_at && " Run a sync from the Basecamp page."}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {events.map((event) => (
            <div
              key={`${event.kind}-${event.recording_id}`}
              className="rounded-md border border-[var(--bip-border)] px-3 py-2"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <MessageSquare
                    size={13}
                    className="shrink-0 text-[var(--text-subtle)]"
                  />
                  <span
                    className={`shrink-0 rounded px-1.5 py-0.5 text-[0.65rem] font-medium ${
                      event.is_internal
                        ? "bg-sky-500/15 text-sky-400"
                        : "bg-amber-500/15 text-amber-400"
                    }`}
                  >
                    {event.is_internal ? "Us" : "Client"}
                  </span>
                  <span className="truncate text-sm text-[var(--text)]">
                    {event.author_name ?? event.author_email ?? "Unknown"}
                    {event.kind === "comment" && (
                      <span className="text-[var(--text-subtle)]"> · comment</span>
                    )}
                  </span>
                </div>
                <span className="shrink-0 text-xs text-[var(--text-subtle)]">
                  {fmtDateTime(event.occurred_at)}
                </span>
              </div>
              {event.title && (
                <p className="mt-1 text-sm font-medium text-[var(--text)]">
                  {event.title}
                </p>
              )}
              {event.excerpt && (
                <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                  {event.excerpt}
                </p>
              )}
              {event.url && (
                <a
                  href={event.url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-[var(--bip-accent)]"
                >
                  Open in Basecamp <ExternalLink size={11} />
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
