import Link from "next/link";
import { StatTile, StatTiles } from "@/components/ui/stat-tile";
import ReadNowButton from "@/components/home/read-now-button";
import { WAIT_THRESHOLDS } from "@/lib/basecamp/response-report";
import {
  BASECAMP_STATUS_LABEL,
  OWE_LABEL,
  isReportBehind,
  reportMonthLabel,
  type BasecampStatus,
  type WatchGroup,
  type WatchRead,
  type WatchRow,
} from "@/lib/client-watch/shape";

const TZ = "America/New_York";

const shortDay = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: TZ });

const STATUS_BADGE: Record<BasecampStatus, string> = {
  waiting_on_us: "bip-badge-danger",
  not_heard: "bip-badge-warning",
  waiting_on_client: "bip-badge-info",
  no_activity: "bip-badge-info",
};

function Field({ label, value, note }: { label: string; value: string | null; note?: string }) {
  if (!value) return null;
  return (
    <div className="space-y-0.5">
      <dt className="text-xs font-medium uppercase tracking-wide text-bip-muted">
        {label}
        {note && <span className="ml-1 normal-case tracking-normal">({note})</span>}
      </dt>
      <dd className="whitespace-pre-line text-sm text-bip-text">{value}</dd>
    </div>
  );
}

function ReadDetails({ read }: { read: WatchRead }) {
  return (
    <dl className="grid gap-3 sm:grid-cols-2">
      <Field label="What we owe" value={read.what_we_owe} />
      <Field label="Where things stand" value={read.where_things_stand} />
      <Field label="Open client asks" value={read.open_asks} />
      <Field label="Our commitments not shown done" value={read.our_commitments} />
      <Field label="Latest report seen" value={reportMonthLabel(read.latest_report_month) ?? "None seen in Basecamp"} />
      <Field label="Other threads" value={read.other_threads} />
      <Field label="Suggested next step" note="Claude's suggestion for the strategist to check" value={read.next_action} />
      <Field label="Limits of this read" value={read.read_notes} />
    </dl>
  );
}

function WatchItem({ row, now }: { row: WatchRow; now: Date }) {
  const read = row.read;
  const owe = read?.owe_response;
  const behind = read ? isReportBehind(read.latest_report_month, now) : false;
  return (
    <details className="group">
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2 px-4 py-2.5 hover:bg-bip-hover">
        <span className="text-bip-muted transition group-open:rotate-90" aria-hidden>
          ›
        </span>
        <span className="font-medium text-bip-text">{row.name}</span>
        <span className={`bip-badge ${STATUS_BADGE[row.basecampStatus]}`}>
          {BASECAMP_STATUS_LABEL[row.basecampStatus]}
          {row.waitingDays != null ? ` · ${row.waitingDays}d` : ""}
        </span>
        {owe === "yes" && <span className="bip-badge bip-badge-danger">We owe a reply</span>}
        {read?.unhappy && <span className="bip-badge bip-badge-danger">Unhappy or leaving</span>}
        {behind && <span className="bip-badge bip-badge-warning">Report behind</span>}
        {read?.flags
          .filter((flag) => !/unhappy|cancel|report behind/i.test(flag))
          .map((flag) => (
            <span key={flag} className="bip-badge bip-badge-warning">
              {flag}
            </span>
          ))}
        {row.failedRead && <span className="bip-badge bip-badge-danger">Last read failed</span>}
        <span className="ml-auto text-xs text-bip-muted">
          {read ? `Read ${shortDay(read.read_at)}${row.readIsBehind ? ", newer posts since" : ""}` : row.failedRead ? "No good read yet" : "Not read yet"}
        </span>
      </summary>
      <div className="space-y-3 border-t border-bip-border bg-bip-fill px-4 py-3 sm:pl-9">
        {row.failedRead && (
          <p role="alert" className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-bip-text">
            The read on {shortDay(row.failedRead.read_at)} failed: {row.failedRead.error}
            {read ? " What follows is the last good read." : ""}
          </p>
        )}
        {read ? (
          <>
            {owe && owe !== "yes" && <p className="text-sm text-bip-muted">Owe a response: {OWE_LABEL[owe]}.</p>}
            <ReadDetails read={read} />
            <p className="text-xs text-bip-muted">
              Claude read {read.posts_read} Basecamp {read.posts_read === 1 ? "post" : "posts"} in {read.threads_read}{" "}
              {read.threads_read === 1 ? "thread" : "threads"} from the last {read.window_days} days on {shortDay(read.read_at)}
              {read.most_recent_thread ? `; newest thread: ${read.most_recent_thread}` : ""}. Check the thread before acting on it.
            </p>
          </>
        ) : (
          !row.failedRead && <p className="text-sm text-bip-muted">This client hasn&apos;t been read yet.</p>
        )}
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <Link href={`/dashboard/clients/${row.clientId}`} className="text-bip-text underline underline-offset-2">
            Open client
          </Link>
          {row.lastClientPost?.url && (
            <a href={row.lastClientPost.url} target="_blank" rel="noopener noreferrer" className="text-bip-text underline underline-offset-2">
              Their last post ({shortDay(row.lastClientPost.at)})
            </a>
          )}
          <ReadNowButton clientId={row.clientId} label={read || row.failedRead ? "Read again now" : "Read now"} />
        </div>
      </div>
    </details>
  );
}

export type WatchTotals = { clients: number; oweResponse: number; unhappy: number; reportBehind: number; notRead: number };

/**
 * Client Watch on Home: for each client, what Claude found in its Basecamp
 * threads (what we owe, open asks, our commitments, latest report, a suggested
 * next step, flags), next to the live Basecamp status. Internal only.
 */
export default function ClientWatchSection({
  groups,
  totals,
  lastReadAt,
  setupError,
  loadError,
  now,
}: {
  groups: WatchGroup[];
  totals: WatchTotals;
  lastReadAt: string | null;
  setupError: string | null;
  loadError: string | null;
  now: Date;
}) {
  return (
    <section className="space-y-3">
      <h2 className="bip-section-label">Client Watch</h2>
      <p className="text-sm text-bip-muted">
        What Claude found reading each client&apos;s Basecamp threads, for the team only. Clients are read again on weekday mornings
        when they have new Basecamp posts. Check the thread before acting; suggested next steps are suggestions for the strategist.
      </p>
      {loadError ? (
        <p role="alert" className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-bip-text">
          {loadError}
        </p>
      ) : (
        <>
          {setupError && (
            <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-bip-text">
              {setupError} Until then every client shows as not read, and nothing can be read.
            </p>
          )}
          <StatTiles>
            <StatTile label="We owe a reply" value={totals.oweResponse} tone={totals.oweResponse > 0 ? "danger" : undefined} />
            <StatTile label="Unhappy or leaving" value={totals.unhappy} tone={totals.unhappy > 0 ? "warn" : undefined} />
            <StatTile label="Report behind" value={totals.reportBehind} tone={totals.reportBehind > 0 ? "warn" : undefined} />
            <StatTile
              label="Not read yet"
              value={totals.notRead}
              sub={lastReadAt ? `last read ${shortDay(lastReadAt)}` : "no reads yet"}
            />
          </StatTiles>
          {groups.length === 0 ? (
            <p className="rounded-xl border border-bip-border bg-bip-card p-4 text-sm text-bip-muted">No clients to show.</p>
          ) : (
            groups.map((group) => (
              <div key={group.strategist} className="overflow-hidden rounded-xl border border-bip-border bg-bip-card">
                <h3 className="border-b border-bip-border px-4 py-2 text-xs font-medium uppercase tracking-wide text-bip-muted">
                  {group.strategist} · {group.rows.length} {group.rows.length === 1 ? "client" : "clients"}
                </h3>
                <div className="divide-y divide-bip-border">
                  {group.rows.map((row) => (
                    <WatchItem key={row.clientId} row={row} now={now} />
                  ))}
                </div>
              </div>
            ))
          )}
          <p className="text-xs text-bip-muted">
            &ldquo;We owe a reply&rdquo; is Claude&apos;s reading of the threads; the Basecamp status beside it comes from the Response
            Report. A report is behind when the newest one seen in Basecamp is more than two months old. Waiting badges count days
            ({WAIT_THRESHOLDS.overdueDays}+ is overdue).
          </p>
        </>
      )}
    </section>
  );
}
