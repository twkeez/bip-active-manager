import Link from "next/link";
import { House } from "lucide-react";
import { ToolPage } from "@/components/ui/tool-page";
import { StatTile, StatTiles } from "@/components/ui/stat-tile";
import { ReportStateBadge } from "@/components/reporting/report-state-badge";
import { waitTone, WAIT_THRESHOLDS } from "@/lib/basecamp/response-report";
import { predatesReportTracking, REPORT_TRACKING_BEGAN, type HomeSummary, type HomeView as View } from "@/lib/home/home-summary";
import { monthLabel, STATE_LABELS, type MonthKey } from "@/lib/reporting/monthly";

const TZ = "America/New_York";

function fmtSync(value: string | null): string {
  if (!value) return "never";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "unknown";
  return `${d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: TZ })} ET`;
}

const plural = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;

const trackingBeganLabel = new Date(`${REPORT_TRACKING_BEGAN}T12:00:00Z`).toLocaleDateString("en-US", {
  month: "long",
  day: "numeric",
  year: "numeric",
  timeZone: TZ,
});

const TONE_BADGE = { overdue: "bip-badge-danger", aging: "bip-badge-warning", fresh: "bip-badge-info" } as const;

function Problem({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-bip-text">
      {children}
    </p>
  );
}

/**
 * The Home page. A server component with no state of its own: the My clients /
 * Everyone switch is a link, and every line links to where the work is done.
 */
export default function HomeView({
  summary,
  view,
  mineCount,
  mineError,
  sheetName,
  month,
  reportLoad,
  monthlyLoad,
}: {
  summary: HomeSummary;
  view: View;
  mineCount: number;
  mineError: string | null;
  /** The name looked for in the sheet's Strategist column, as typed there (lower case). */
  sheetName: string | null;
  month: MonthKey;
  reportLoad: { rosterApplied: boolean; lastSyncedAt: string | null; loadError: string | null };
  monthlyLoad: { error: string | null; warnings: string[]; statesTracked: boolean };
}) {
  const label = monthLabel(month);
  const mine = view === "mine";

  return (
    <ToolPage
      title="Home"
      icon={House}
      maxWidth="6xl"
      description={
        mine
          ? `Your ${plural(mineCount, "client")} on the Master Sheet: who's waiting on us in Basecamp, and where ${label} reports stand.`
          : `Every client with a Package on the Master Sheet: who's waiting on us in Basecamp, and where ${label} reports stand.`
      }
      actions={
        <nav aria-label="Whose clients" className="flex gap-1">
          {(
            [
              ["mine", "My clients"],
              ["all", "Everyone"],
            ] as const
          ).map(([key, text]) => (
            <Link
              key={key}
              href={`/home?view=${key}`}
              aria-current={view === key ? "page" : undefined}
              className={`rounded-md border px-2.5 py-1 text-xs ${
                view === key ? "border-bip-accent bg-bip-accent text-white" : "border-bip-border text-bip-muted hover:bg-bip-hover"
              }`}
            >
              {text}
            </Link>
          ))}
        </nav>
      }
    >
      {mineError && <Problem>{mineError}</Problem>}
      {mine && !mineError && mineCount === 0 && (
        <p className="rounded-xl border border-bip-border bg-bip-card p-4 text-sm text-bip-muted">
          No client on the Master Sheet has {sheetName ? `“${sheetName.charAt(0).toUpperCase()}${sheetName.slice(1)}”` : "your name"} in its Strategist column, so My
          clients is empty. Everyone shows every client.
        </p>
      )}

      {/* Waiting on us */}
      <section className="space-y-3">
        <h2 className="bip-section-label">Waiting on us</h2>
        {reportLoad.loadError ? (
          <Problem>The Basecamp numbers couldn&apos;t be loaded, so none are shown. {reportLoad.loadError}</Problem>
        ) : (
          <>
            {!reportLoad.rosterApplied && (
              <Problem>
                The Master Sheet roster couldn&apos;t be read, so these numbers cover every Basecamp project, not just
                clients with a Package. The Response Report says why.
              </Problem>
            )}
            <StatTiles>
              <StatTile label="Waiting on us" value={summary.waiting.length} />
              <StatTile
                label={`Waiting ${WAIT_THRESHOLDS.overdueDays}+ days`}
                value={summary.overdue}
                tone={summary.overdue > 0 ? "danger" : undefined}
              />
              <StatTile label="Haven't heard from us" value={summary.notHeard} tone={summary.notHeard > 0 ? "warn" : undefined} />
              <StatTile label="Clients checked" value={summary.rosterClients} sub={`Basecamp sync ${fmtSync(reportLoad.lastSyncedAt)}`} />
            </StatTiles>

            {summary.waiting.length === 0 ? (
              <p className="rounded-xl border border-bip-border bg-bip-card p-4 text-sm text-bip-muted">
                Nobody is waiting on a reply from us.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-bip-border bg-bip-card">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs uppercase tracking-wide text-bip-muted">
                    <tr className="border-b border-bip-border">
                      <th className="px-4 py-2 font-medium">Client</th>
                      <th className="px-4 py-2 font-medium">Waiting</th>
                      <th className="px-4 py-2 font-medium">Their last message</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-bip-border">
                    {summary.waiting.map((row) => (
                      <tr key={row.row_key ?? row.basecamp_project_id} className="hover:bg-bip-hover">
                        <td className="px-4 py-2">
                          {row.client_id != null ? (
                            <Link
                              href={`/dashboard/clients/${row.client_id}`}
                              className="font-medium text-bip-text underline-offset-2 hover:underline"
                            >
                              {row.account_name}
                            </Link>
                          ) : (
                            <span className="font-medium text-bip-text">{row.account_name}</span>
                          )}
                        </td>
                        <td className="px-4 py-2">
                          <span className={`bip-badge ${TONE_BADGE[waitTone(row.waitingDays)]}`}>
                            {row.waitingDays == null ? "Unknown" : plural(row.waitingDays, "day")}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-bip-text">
                          {row.last_client_thread_url ? (
                            <a
                              href={row.last_client_thread_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="underline-offset-2 hover:underline"
                            >
                              {row.last_client_thread_title || "Open in Basecamp"}
                            </a>
                          ) : (
                            <span className="text-bip-muted">{row.last_client_thread_title || "No link"}</span>
                          )}
                          {row.last_client_author && <span className="text-bip-muted"> · {row.last_client_author}</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="text-xs text-bip-muted">
              From Basecamp only. Dismissed messages are left out. <Link href="/response-report" className="underline">Response Report</Link>{" "}
              has every client, and{" "}
              <Link href="/response-report?status=not_heard" className="underline">
                Haven&apos;t heard from us
              </Link>{" "}
              lists those {summary.notHeard}.
            </p>
          </>
        )}
      </section>

      {/* Reports */}
      <section className="space-y-3">
        <h2 className="bip-section-label">{label} reports</h2>
        {monthlyLoad.error ? (
          <Problem>The report list couldn&apos;t be built, so nothing is shown. {monthlyLoad.error}</Problem>
        ) : (
          <>
            {monthlyLoad.warnings.length > 0 && (
              <ul className="space-y-1 rounded-xl border border-bip-border bg-bip-card p-4 text-sm text-bip-text">
                {monthlyLoad.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            )}
            {predatesReportTracking(month) && (
              <p className="rounded-xl border border-bip-border bg-bip-card p-4 text-sm text-bip-text">
                Report tracking began {trackingBeganLabel}. A {label} report finished before then shows Not started until
                it&apos;s marked on Monthly reports, so Not started here can mean no record rather than not done.
              </p>
            )}
            <StatTiles>
              {(["not_started", "draft", "reviewed", "sent"] as const).map((key) => (
                <StatTile
                  key={key}
                  label={STATE_LABELS[key]}
                  value={monthlyLoad.statesTracked ? summary.reportCounts[key] : "?"}
                  tone={key === "sent" && summary.reportClients > 0 && summary.reportCounts.sent === summary.reportClients ? "good" : undefined}
                />
              ))}
            </StatTiles>
            {summary.reportsNotSent.length === 0 ? (
              <p className="rounded-xl border border-bip-border bg-bip-card p-4 text-sm text-bip-muted">
                {summary.reportClients === 0 ? "No reports to show." : `Every ${label} report is marked sent.`}
              </p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-bip-border bg-bip-card">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs uppercase tracking-wide text-bip-muted">
                    <tr className="border-b border-bip-border">
                      <th className="px-4 py-2 font-medium">Not sent yet</th>
                      <th className="px-4 py-2 font-medium">Strategist</th>
                      <th className="px-4 py-2 font-medium">{label}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-bip-border">
                    {summary.reportsNotSent.map((row) => (
                      <tr key={row.clientId} className="hover:bg-bip-hover">
                        <td className="px-4 py-2">
                          <Link
                            href={`/reports/${row.clientId}?month=${month}&back=reporting`}
                            className="font-medium text-bip-text underline-offset-2 hover:underline"
                          >
                            {row.name}
                          </Link>
                        </td>
                        <td className="px-4 py-2 text-bip-text">
                          {row.strategist ?? <span className="text-bip-muted">None on the sheet</span>}
                        </td>
                        <td className="px-4 py-2">
                          {monthlyLoad.statesTracked ? <ReportStateBadge state={row.state} /> : <span className="text-bip-muted">Unknown</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="text-xs text-bip-muted">
              <Link href={`/reporting?month=${month}`} className="underline">
                Monthly reports
              </Link>{" "}
              has every client and other months.
            </p>
          </>
        )}
      </section>

      {/* Everyone: one line per strategist */}
      {!mine && summary.byStrategist.length > 0 && (
        <section className="space-y-3">
          <h2 className="bip-section-label">By strategist</h2>
          <div className="overflow-x-auto rounded-xl border border-bip-border bg-bip-card">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-bip-muted">
                <tr className="border-b border-bip-border">
                  <th className="px-4 py-2 font-medium">Strategist</th>
                  <th className="px-4 py-2 text-right font-medium">Clients</th>
                  <th className="px-4 py-2 text-right font-medium">Waiting on us</th>
                  <th className="px-4 py-2 text-right font-medium">{WAIT_THRESHOLDS.overdueDays}+ days</th>
                  <th className="px-4 py-2 text-right font-medium">Haven&apos;t heard</th>
                  <th className="px-4 py-2 text-right font-medium">{label} not sent</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-bip-border tabular-nums">
                {summary.byStrategist.map((line) => (
                  <tr key={line.strategist}>
                    <td className="px-4 py-2 text-bip-text">{line.strategist}</td>
                    <td className="px-4 py-2 text-right text-bip-text">{line.clients}</td>
                    <td className="px-4 py-2 text-right text-bip-text">{line.waitingOnUs}</td>
                    <td className={`px-4 py-2 text-right ${line.overdue > 0 ? "font-semibold text-red-400" : "text-bip-text"}`}>
                      {line.overdue}
                    </td>
                    <td className="px-4 py-2 text-right text-bip-text">{line.notHeard}</td>
                    <td className="px-4 py-2 text-right text-bip-text">{monthlyLoad.statesTracked ? line.reportsNotSent : "?"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-bip-muted">
            Strategists as named in column I of the Master Sheet. A shared client (&ldquo;Daniel/Tom&rdquo;) is counted once, under that name; in My clients it counts for each person named.
          </p>
        </section>
      )}
    </ToolPage>
  );
}
