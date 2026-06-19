"use client";
import {
  Clock3,
  ExternalLink,
  MessageSquare,
  MessageSquareText,
  Sparkles,
} from "lucide-react";
import {
  ClientRowStatusBadge,
  resolveClientStatus,
} from "@/components/clients/client-status-badge";
import { previewText, openableBasecampUrl } from "@/lib/basecamp/display";
import { isServiceActive, norm } from "@/lib/clients/service-active";
import type { BasecampThreadEvent, ClientRow } from "@/lib/types/client";
type ClientProfileViewProps = {
  form: Partial<ClientRow>;
  recentThreads?: BasecampThreadEvent[];
};
function strategistInitial(name: string) {
  const trimmed = norm(name);
  if (!trimmed) return "?";
  return trimmed.charAt(0).toUpperCase();
}
function serviceTone(value: string) {
  const normalized = value.trim().toLowerCase();
  if (normalized.includes("premium") || normalized.includes("pro")) {
    return {
      label: value,
      className: "border-violet-200 bg-violet-50 text-violet-800",
    };
  }
  if (/^\d+$/.test(normalized)) {
    return { label: value, className: "border-sky-200 bg-sky-50 text-sky-800" };
  }
  return {
    label: value,
    className: "border-emerald-200 bg-emerald-50 text-emerald-800",
  };
}
function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    month: "numeric",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
function StrategistTile({ name }: { name: string }) {
  const displayName = norm(name) || "Unassigned";
  const initial = strategistInitial(name);
  return (
    <div className="rounded-xl border border-violet-100 bg-gradient-to-br from-violet-50 to-white p-3">
      
      <p className="text-[11px] font-semibold uppercase tracking-wide text-bip-muted">
        
        Marketing strategist
      </p>
      <div className="mt-2 flex items-center gap-2.5">
        
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-600 text-sm font-semibold text-white shadow-none"
          aria-hidden
        >
          
          {initial}
        </span>
        <p className="text-sm font-semibold text-bip-text">{displayName}</p>
      </div>
    </div>
  );
}
function InfoTile({
  label,
  value,
  accent = "zinc",
}: {
  label: string;
  value: string;
  accent?: "zinc" | "sky";
}) {
  const accentClass =
    accent === "sky"
      ? "border-sky-100 bg-gradient-to-br from-sky-50 to-white"
      : "border-bip-border bg-gradient-to-br from-zinc-50 to-white";
  return (
    <div className={`rounded-xl border p-3 ${accentClass}`}>
      
      <p className="text-[11px] font-semibold uppercase tracking-wide text-bip-muted">
        
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-bip-text">
        {value || "—"}
      </p>
    </div>
  );
}
function ActiveServicePill({ label, value }: { label: string; value: string }) {
  const tone = serviceTone(value);
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-bip-border bg-bip-card py-0.5 pl-2 pr-1">
      
      <span className="text-[11px] font-semibold text-bip-text">
        {label}
      </span>
      <span
        className={`inline-flex rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${tone.className}`}
      >
        
        {tone.label}
      </span>
    </span>
  );
}
function BasecampThreadCard({ event }: { event: BasecampThreadEvent }) {
  const basecampUrl = openableBasecampUrl(event.thread_url);
  return (
    <article className="rounded-xl border border-bip-border bg-bip-card p-3">
      
      <div className="mb-1.5 flex items-center justify-between gap-2">
        
        <span className="inline-flex items-center gap-1 text-xs font-medium text-bip-text">
          
          <MessageSquareText className="h-3.5 w-3.5" />
          {event.kind === "message" ? "Thread" : "Comment"}
        </span>
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${event.is_internal ? "bg-zinc-200 text-white" : "bg-amber-100 text-amber-800"}`}
        >
          
          {event.is_internal ? "Internal" : "Client"}
        </span>
      </div>
      <p className="text-xs text-bip-muted">
        
        {formatDateTime(event.occurred_at)}
        {event.author_email ? ` · ${event.author_email}` : ""}
      </p>
      {norm(event.thread_title) && (
        <p className="mt-2 text-sm font-semibold text-bip-text">
          
          {event.thread_title}
        </p>
      )}
      <p className="mt-1 text-sm leading-relaxed text-bip-text">
        
        {previewText(event)}
      </p>
      {basecampUrl && (
        <a
          href={basecampUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-violet-700 underline decoration-violet-200 underline-offset-2 hover:text-violet-900"
        >
          
          Open in Basecamp <ExternalLink className="h-3.5 w-3.5" />
        </a>
      )}
    </article>
  );
}
function DataRow({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: "amber" | "emerald" | "default";
}) {
  const valueClass =
    highlight === "amber"
      ? "font-semibold text-amber-800"
      : highlight === "emerald"
        ? "font-medium text-emerald-700"
        : "font-medium text-bip-text";
  return (
    <tr className="border-b border-zinc-100 last:border-0"><th className="w-[44%] py-2.5 pr-3 text-left text-xs font-normal text-bip-muted">
                  {label}
      </th><td className={`py-2.5 text-right text-sm ${valueClass}`}>
        {value}
      </td></tr>
  );
}
export default function ClientProfileView({
  form,
  recentThreads = [],
}: ClientProfileViewProps) {
  const statusClient = {
    needs_reply: form.needs_reply ?? false,
    reply_acknowledged_at: form.reply_acknowledged_at ?? null,
    tier: form.tier ?? null,
  };
  const status = resolveClientStatus(statusClient);
  const awaitingReply = Boolean(form.needs_reply);
  const packageHours =
    form.total_package_hours != null || form.hours_for_strategist != null
      ? `${form.total_package_hours ?? "—"} total · ${form.hours_for_strategist ?? "—"} strategist`
      : "—";
  const staleLabel =
    form.days_stale == null
      ? "—"
      : `${form.days_stale} day${form.days_stale === 1 ? "" : "s"}`;
  const lastSource =
    form.last_event_is_internal == null
      ? "—"
      : form.last_event_is_internal
        ? "Internal"
        : "Client";
  const activeServices = [
    { key: "Blog", value: norm(form.blog) },
    { key: "SMM", value: norm(form.smm) },
    { key: "SEO", value: norm(form.seo) },
    { key: "PPC", value: norm(form.ppc) },
    { key: "ORM", value: norm(form.orm) },
  ].filter((service) => isServiceActive(service.value));
  return (
    <div className="space-y-4">
      
      <div className="overflow-hidden rounded-2xl border border-bip-border bg-gradient-to-br from-indigo-500 via-violet-600 to-fuchsia-600 p-[1px] shadow-none">
        
        <div className="rounded-[15px] bg-bip-card p-4">
          
          <div className="flex flex-wrap items-start justify-between gap-3">
            
            <div>
              
              <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-violet-700">
                
                <Sparkles className="h-3 w-3" /> New client layout ·
                preview
              </div>
              <h2 className="text-lg font-semibold tracking-tight text-bip-text">
                
                {norm(form.account_name) || "Client profile"}
              </h2>
            </div>
            <ClientRowStatusBadge client={statusClient} />
          </div>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        
        <StrategistTile name={norm(form.marketing_strategist)} />
        <InfoTile label="Tier" value={norm(form.tier) || "—"} accent="sky" />
        <InfoTile label="Package hours" value={packageHours} />
      </div>
      <section className="rounded-2xl border border-bip-border bg-bip-card p-3">
        
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-bip-muted">
          
          Active services
        </h3>
        {activeServices.length === 0 ? (
          <p className="text-sm text-bip-muted">No active services on file.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            
            {activeServices.map((service) => (
              <ActiveServicePill
                key={service.key}
                label={service.key}
                value={service.value}
              />
            ))}
          </div>
        )}
      </section>
      <section
        className={`rounded-2xl border p-4 ${awaitingReply ? "border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50/40" : "border-bip-border bg-bip-card"}`}
      >
        
        <div className="mb-3 flex items-center justify-between gap-2">
          
          <div className="flex items-center gap-2">
            
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-lg ${awaitingReply ? "bg-amber-200 text-amber-900" : "bg-emerald-100 text-emerald-700"}`}
            >
              
              <MessageSquare className="h-4 w-4" />
            </div>
            <div>
              
              <h3 className="text-sm font-semibold text-bip-text">
                
                Communications
              </h3>
              <p className="text-xs text-bip-muted">
                
                Reply state and recent thread activity
              </p>
            </div>
          </div>
          {awaitingReply && (
            <span className="rounded-full bg-amber-500 px-2.5 py-1 text-[11px] font-semibold text-white shadow-none">
              
              Reply needed
            </span>
          )}
        </div>
        <div className="overflow-hidden rounded-xl border border-bip-border bg-bip-card/80">
          
          <table className="w-full px-1"><tbody>
              <DataRow
                label="Awaiting response"
                value={awaitingReply ? "Yes — client last message" : "No"}
                highlight={awaitingReply ? "amber" : "default"}
              />
              <DataRow
                label="Acknowledged as no-reply"
                value={formatDateTime(form.reply_acknowledged_at)}
              />
              <DataRow
                label="Last communication"
                value={formatDateTime(form.last_communication_at)}
              />
              <DataRow label="Days since communication" value={staleLabel} />
              <DataRow
                label="Last message source"
                value={lastSource}
                highlight={
                  lastSource === "Client" && awaitingReply ? "amber" : "default"
                }
              />
            </tbody></table>
        </div>
        {status === "Awaiting" && (
          <p className="mt-3 flex items-center gap-1.5 text-xs text-amber-800">
            
            <Clock3 className="h-3.5 w-3.5 shrink-0" /> Client was last to
            respond — prioritize a reply when you triage this account.
          </p>
        )}
        {recentThreads.length > 0 && (
          <div className="mt-4 space-y-2">
            
            <p className="text-[11px] font-semibold uppercase tracking-wide text-bip-muted">
              
              Latest Basecamp activity
            </p>
            <div className="space-y-2">
              
              {recentThreads.slice(0, 3).map((event) => (
                <BasecampThreadCard key={event.id} event={event} />
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
