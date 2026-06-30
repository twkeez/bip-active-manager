import Link from "next/link";
import { ClipboardCheck, Bell } from "lucide-react";
import { dueStatus } from "@/lib/site-audit/seo-audit-schedule";
import { matchStrategistByName, type StrategistContact } from "@/lib/team/strategist-roster";
import type { ClientSeoAuditScheduleWithClient } from "@/lib/site-audit/seo-audit-types";

type Props = {
  schedules: ClientSeoAuditScheduleWithClient[];
  roster: StrategistContact[];
  appUrl: string;
};

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function mailto(to: string, clientName: string, appUrl: string, status: string) {
  const subject = `SEO audit ${status} — ${clientName}`;
  const body = [
    "Hi,",
    "",
    `The recurring SEO site audit for ${clientName} is ${status}.`,
    "",
    `Run it here: ${appUrl.replace(/\/$/, "")}/seo-audits`,
    "",
    "Sent from BIP Control Panel",
  ].join("\n");
  return `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/**
 * Dashboard panel listing clients whose recurring SEO audit is due or overdue.
 * Renders nothing when there's nothing to action, to keep the dashboard quiet.
 */
export default function SeoAuditsDuePanel({ schedules, roster, appUrl }: Props) {
  const actionable = schedules
    .map((schedule) => ({ schedule, status: dueStatus(schedule.next_due_at) }))
    .filter(({ status }) => status === "due" || status === "overdue")
    .sort((a, b) => (a.status === "overdue" && b.status !== "overdue" ? -1 : 1));

  if (actionable.length === 0) return null;

  return (
    <div className="bip-card overflow-hidden">
      <div className="flex items-center gap-2.5 border-b border-[var(--bip-border)] px-4 py-3">
        <ClipboardCheck size={14} className="text-[var(--bip-accent)]" />
        <span className="text-sm font-medium text-[var(--text)]">SEO Audits Due</span>
        <Link href="/seo-audits" className="ml-auto text-xs text-[var(--bip-accent)] hover:underline">
          Open tool →
        </Link>
      </div>
      <div className="divide-y divide-[var(--bip-border)]">
        {actionable.map(({ schedule, status }) => {
          const strategist = matchStrategistByName(schedule.marketing_strategist, roster);
          return (
            <div key={schedule.id} className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--bip-hover)] transition-colors">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-[var(--text)]">{schedule.account_name}</p>
                <p className="text-xs text-[var(--text-muted)]">
                  Due {formatDate(schedule.next_due_at)}
                  {schedule.marketing_strategist ? ` · ${schedule.marketing_strategist}` : ""}
                </p>
              </div>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                  status === "overdue"
                    ? "bg-red-500/15 text-red-400"
                    : "bg-amber-500/15 text-amber-400"
                }`}
              >
                {status}
              </span>
              {strategist?.email && (
                <a
                  href={mailto(strategist.email, schedule.account_name, appUrl, status)}
                  className="flex items-center gap-1 rounded-md border border-[var(--bip-border)] px-2 py-1 text-xs text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
                >
                  <Bell size={11} /> Notify
                </a>
              )}
              <Link
                href="/seo-audits"
                className="rounded-md border border-[var(--bip-border)] px-2 py-1 text-xs text-[var(--text-muted)] hover:border-[var(--bip-accent)] hover:text-[var(--bip-accent)] transition-colors"
              >
                Start
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}
