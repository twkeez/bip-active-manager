"use client";

import { useEffect, useState } from "react";
import { CalendarClock, ClipboardCheck, GraduationCap } from "lucide-react";
import OnboardingWizard from "@/components/dashboard/onboarding-wizard";
import ClientPlaybookView from "@/components/playbook/client-playbook-view";
import { getClientActiveServices, activeServiceLabels } from "@/lib/clients/service-active";
import { clientStage, stageLabel } from "@/lib/clients/client-lifecycle";
import { dueStatus } from "@/lib/site-audit/seo-audit-schedule";
import type { ClientRow } from "@/lib/types/client";
import type { ClientDetailTab } from "@/lib/dashboard/client-workspace-types";

type NavTab = ClientDetailTab | "edit";

type Props = {
  client: ClientRow;
  onOpenTab?: (tab: NavTab) => void;
  onEditClient?: () => void;
  onGraduated?: () => void;
};

type AuditScheduleRow = { client_id: number; next_due_at: string | null };

/** Small chip surfacing this client's recurring SEO audit when it's due/overdue. */
function SeoAuditDueChip({ clientId }: { clientId: number }) {
  const [status, setStatus] = useState<"due" | "overdue" | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/client-seo-audits/schedules", { cache: "no-store" });
        const payload = (await res.json()) as { schedules?: AuditScheduleRow[] };
        if (cancelled || !res.ok) return;
        const mine = payload.schedules?.find((s) => s.client_id === clientId);
        const s = mine ? dueStatus(mine.next_due_at) : "none";
        if (s === "due" || s === "overdue") setStatus(s);
      } catch {
        // non-critical
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  if (!status) return null;
  return (
    <a
      href="/seo-audits"
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${status === "overdue" ? "bg-red-500/15 text-red-300" : "bg-amber-500/15 text-amber-300"}`}
    >
      <CalendarClock className="h-3.5 w-3.5" /> SEO audit {status}
    </a>
  );
}

export default function ClientRunOfShowView({ client, onOpenTab, onEditClient, onGraduated }: Props) {
  const stage = clientStage(client.onboarding_status);
  const services = activeServiceLabels(getClientActiveServices(client));

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="rounded-xl border border-bip-border bg-bip-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${stage === "active" ? "bg-emerald-500/15 text-emerald-300" : "bg-bip-accent/15 text-bip-accent"}`}
            >
              {stage === "active" ? <GraduationCap className="h-3.5 w-3.5" /> : <ClipboardCheck className="h-3.5 w-3.5" />}
              {stageLabel(stage)}
            </span>
            {client.marketing_strategist && (
              <span className="text-xs text-bip-muted">{client.marketing_strategist}</span>
            )}
          </div>
          <SeoAuditDueChip clientId={client.id} />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {services.length === 0 ? (
            <span className="text-xs text-bip-muted">No active services set — update the client profile.</span>
          ) : (
            services.map((label) => (
              <span key={label} className="rounded-full border border-bip-border px-2 py-0.5 text-xs text-bip-text">
                {label}
              </span>
            ))
          )}
        </div>
        <p className="mt-2 text-xs text-bip-muted">
          {stage === "onboarding"
            ? "Walk through onboarding step by step. Each step explains what to do and checks itself off when it can."
            : "This client is active. Below is their ongoing playbook for each service they receive."}
        </p>
      </div>

      {/* Stage body */}
      {stage === "onboarding" ? (
        <OnboardingWizard
          clientId={client.id}
          onOpenTab={onOpenTab}
          onEditClient={onEditClient}
          onGraduated={onGraduated}
        />
      ) : (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-bip-muted">Ongoing service playbook</p>
          <ClientPlaybookView client={client} />
        </div>
      )}
    </div>
  );
}
