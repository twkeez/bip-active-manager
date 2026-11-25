"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { BarChart3 } from "lucide-react";
import { ToolPage } from "@/components/ui/tool-page";
import { StatTile, StatTiles } from "@/components/ui/stat-tile";
import { ReportStateBadge } from "@/components/reporting/report-state-badge";
import { ACCOUNT_STATUS_LABEL } from "@/lib/clients/account-status";
import type { MonthlyList } from "@/lib/reporting/monthly-list";
import {
  monthLabel,
  REPORT_STATES,
  SENT_VIA_LABELS,
  STATE_LABELS,
  type MonthKey,
  type ReportState,
} from "@/lib/reporting/monthly";

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/New_York" });

/**
 * The Reporting page: one line per client with a Package, and where its report
 * stands for the chosen month. Filters run in the browser over the loaded list.
 */
export default function MonthlyReportList({
  list,
  months,
  isAdmin,
}: {
  list: MonthlyList;
  months: MonthKey[];
  isAdmin: boolean;
}) {
  const [state, setState] = useState<ReportState | "all">("all");
  const [strategist, setStrategist] = useState<string>("all");

  const strategists = useMemo(
    () => [...new Set(list.rows.map((row) => row.strategist ?? "No strategist"))].sort((a, b) => a.localeCompare(b)),
    [list.rows],
  );
  const shown = list.rows.filter(
    (row) =>
      (state === "all" || row.state === state) &&
      (strategist === "all" || (row.strategist ?? "No strategist") === strategist),
  );
  const label = monthLabel(list.month);

  return (
    <ToolPage
      title="Reporting"
      icon={BarChart3}
      maxWidth="6xl"
      description={
        isAdmin
          ? "Every client with a Package on the Master Sheet, and where its monthly report stands. Open a client to write, review and send its report."
          : "Your clients with a Package on the Master Sheet, and where each monthly report stands. Open a client to write, review and send its report."
      }
      actions={
        <nav aria-label="Report month" className="flex flex-wrap gap-1">
          {months.map((month) => (
            <Link
              key={month}
              href={`/reporting?month=${month}`}
              aria-current={month === list.month ? "page" : undefined}
              className={`rounded-md border px-2.5 py-1 text-xs ${
                month === list.month
                  ? "border-bip-accent bg-bip-accent text-white"
                  : "border-bip-border text-bip-muted hover:bg-bip-hover"
              }`}
            >
              {monthLabel(month)}
            </Link>
          ))}
        </nav>
      }
    >
      {list.error ? (
        <p role="alert" className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-bip-text">
          The list couldn&apos;t be built, so nothing is shown rather than a partial list. {list.error}
        </p>
      ) : (
        <>
          {list.warnings.length > 0 && (
            <ul className="space-y-1 rounded-xl border border-bip-border bg-bip-card p-4 text-sm text-bip-text">
              {list.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          )}

          <StatTiles>
            {(["not_started", "draft", "reviewed", "sent"] as const).map((key) => (
              <StatTile
                key={key}
                label={`${STATE_LABELS[key]} · ${label}`}
                value={list.statesTracked ? list.counts[key] : "?"}
              />
            ))}
          </StatTiles>

          <div className="flex flex-wrap items-center gap-2 text-sm">
            <label className="flex items-center gap-2 text-bip-muted">
              State
              <select
                value={state}
                onChange={(event) => setState(event.target.value as ReportState | "all")}
                className="rounded-md border border-bip-border bg-bip-card px-2 py-1 text-bip-text"
              >
                <option value="all">All</option>
                {REPORT_STATES.map((key) => (
                  <option key={key} value={key}>
                    {STATE_LABELS[key]}
                  </option>
                ))}
              </select>
            </label>
            {strategists.length > 1 && (
              <label className="flex items-center gap-2 text-bip-muted">
                Strategist
                <select
                  value={strategist}
                  onChange={(event) => setStrategist(event.target.value)}
                  className="rounded-md border border-bip-border bg-bip-card px-2 py-1 text-bip-text"
                >
                  <option value="all">All</option>
                  {strategists.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <span className="text-bip-muted">
              Showing {shown.length} of {list.rows.length} {list.rows.length === 1 ? "client" : "clients"}
            </span>
          </div>

          {list.rows.length === 0 ? (
            <p className="rounded-xl border border-bip-border bg-bip-card p-4 text-sm text-bip-muted">
              {isAdmin
                ? "No client with a Package is matched to the Master Sheet."
                : "No clients with a Package are assigned to you. An admin assigns clients to strategists."}
            </p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-bip-border bg-bip-card">
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-bip-muted">
                  <tr className="border-b border-bip-border">
                    <th className="px-4 py-2 font-medium">Client</th>
                    <th className="px-4 py-2 font-medium">Strategist</th>
                    <th className="px-4 py-2 font-medium">Package</th>
                    <th className="px-4 py-2 font-medium">{label}</th>
                    <th className="px-4 py-2 font-medium">Last export</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-bip-border">
                  {shown.map((row) => (
                    <tr key={row.clientId} className="hover:bg-bip-hover">
                      <td className="px-4 py-2">
                        <Link
                          href={`/reports/${row.clientId}?month=${list.month}&back=reporting`}
                          className="font-medium text-bip-text underline-offset-2 hover:underline"
                        >
                          {row.name}
                        </Link>
                        {row.accountStatus !== "active" && (
                          <span className="ml-2 bip-badge bip-badge-warning">{ACCOUNT_STATUS_LABEL[row.accountStatus]}</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-bip-text">{row.strategist ?? <span className="text-bip-muted">None on the sheet</span>}</td>
                      <td className="px-4 py-2 text-bip-text">{row.packageValue}</td>
                      <td className="px-4 py-2">
                        {list.statesTracked ? (
                          <span className="flex flex-wrap items-center gap-2">
                            <ReportStateBadge state={row.state} />
                            {row.stateChangedAt && (
                              <span className="text-xs text-bip-muted">
                                {shortDate(row.stateChangedAt)}
                                {row.sentVia.length > 0 && ` · ${row.sentVia.map((via) => SENT_VIA_LABELS[via]).join(", ")}`}
                              </span>
                            )}
                          </span>
                        ) : (
                          <span className="text-xs text-bip-muted">Not tracked yet</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-bip-muted">{row.lastExportAt ? shortDate(row.lastExportAt) : "Never"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {(list.formerLeftOff.length > 0 || list.unmatched.length > 0) && (
            <div className="space-y-1 text-sm text-bip-muted">
              {list.formerLeftOff.length > 0 && (
                <p>
                  Left off as former clients ({list.formerLeftOff.length}): {list.formerLeftOff.join(", ")}.
                </p>
              )}
              {list.unmatched.length > 0 && (
                <p>
                  On the Master Sheet with a Package but not matched to one client, so they can&apos;t have a report until
                  they&apos;re matched in Project Wiring ({list.unmatched.length}): {list.unmatched.join(", ")}.
                </p>
              )}
            </div>
          )}

          {list.sheetReadAt && (
            <p className="text-xs text-bip-muted">Master Sheet last read {shortDate(list.sheetReadAt)}.</p>
          )}
        </>
      )}
    </ToolPage>
  );
}
