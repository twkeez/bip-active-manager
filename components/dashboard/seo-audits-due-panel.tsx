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
 * Always rendered (with an empty state) so it's a permanent, trusted section.
 */
export default function SeoAuditsDuePanel({ schedules, roster, appUrl }: Props) {
  const actionable = schedules
    .map((schedule) => ({ schedule, status: dueStatus(schedule.next_due_at) }))
    .filter(({ status }) => status === "due" || status === "overdue")
    .sort((a, b) => (a.status === "overdue" && b.status !== "overdue" ? -1 : 1));

  // The soonest not-yet-due audit, shown in the empty state for context.
  const nextUpcoming = schedules
    .filter((s) => dueStatus(s.next_due_at) === "upcoming" && s.next_due_at)
    .sort((a, b) => new Date(a.next_due_at!).getTime() - new Date(b.next_due_at!).getTime())[0];

  return (
    <div className="bip-card overflow-hidden">
      <div className="flex items-center gap-2.5 border-b border-[var(--bip-border)] px-4 py-3">
        <ClipboardCheck size={14} className="text-[var(--bip-accent)]" />
        <span className="text-sm font-medium text-[var(--text)]">SEO Audits Due</span>
        {actionable.length > 0 && (
          <span className="rounded-full bg-[var(--bip-accent)]/15 px-2 py-0.5 text-xs font-semibold text-[var(--bip-accent)]">
            {actionable.length}
          </span>
        )}
        <Link href="/seo-audits" className="ml-auto text-xs text-[var(--bip-accent)] hover:underline">
          Open tool →
        </Link>
      </div>

      {actionable.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-[var(--text-subtle)]">
          {schedules.length === 0
            ? "No clients enrolled yet. Open the tool to schedule recurring audits."
            : nextUpcoming
              ? `Nothing due right now. Next: ${nextUpcoming.account_name} on ${formatDate(nextUpcoming.next_due_at)}.`
              : "Nothing due right now."}
        </p>
      ) : (
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
      )}
    </div>
  );
}
