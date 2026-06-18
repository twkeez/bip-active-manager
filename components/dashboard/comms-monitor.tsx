"use client";

import { useState } from "react";
import { ExternalLink, MessageSquare, Clock, CheckCircle } from "lucide-react";
import type { ClientRow } from "@/lib/types/client";
import { acknowledgeNoReply } from "@/lib/clients/acknowledge-no-reply";

type Props = {
  clients: ClientRow[];
};

function daysAgoLabel(dateStr: string | null): string {
  if (!dateStr) return "—";
  const days = Math.floor(
    (Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24),
  );
  if (days === 0) return "today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

function basecampProjectUrl(projectId: string | null): string {
  if (!projectId) return "";
  return `https://basecamp.com/2175055/projects/${projectId}`;
}

function CommsRow({
  client,
  onAcknowledge,
}: {
  client: ClientRow;
  onAcknowledge?: (id: number) => void;
}) {
  const [loading, setLoading] = useState(false);
  const bcUrl = basecampProjectUrl(client.basecamp_project_id);

  async function handleAck() {
    setLoading(true);
    try {
      await acknowledgeNoReply(client.id);
      onAcknowledge?.(client.id);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-4 border-b border-[var(--bip-border)] px-4 py-3 last:border-0 hover:bg-[var(--bip-hover)] transition-colors">
      {/* Client name + strategist */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-[var(--text)]">{client.account_name}</p>
        {client.marketing_strategist && (
          <p className="text-xs text-[var(--text-muted)]">{client.marketing_strategist}</p>
        )}
      </div>

      {/* Last comms */}
      <div className="w-28 text-right">
        <p className="text-xs text-[var(--text-muted)]">
          {daysAgoLabel(client.last_communication_at)}
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {bcUrl && (
          <a
            href={bcUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 rounded-md border border-[var(--bip-border)] px-2 py-1 text-xs text-[var(--text-muted)] hover:border-[var(--bip-border-strong)] hover:text-[var(--text)] transition-colors"
          >
            <ExternalLink size={11} />
            Basecamp
          </a>
        )}
        {onAcknowledge && (
          <button
            onClick={handleAck}
            disabled={loading}
            className="flex items-center gap-1 rounded-md border border-[var(--bip-border)] px-2 py-1 text-xs text-[var(--text-muted)] hover:border-[var(--bip-accent)] hover:text-[var(--bip-accent)] transition-colors disabled:opacity-40"
          >
            <CheckCircle size={11} />
            {loading ? "…" : "Dismiss"}
          </button>
        )}
      </div>
    </div>
  );
}

function Panel({
  title,
  icon: Icon,
  color,
  clients,
  onAcknowledge,
  emptyText,
}: {
  title: string;
  icon: React.ElementType;
  color: string;
  clients: ClientRow[];
  onAcknowledge?: (id: number) => void;
  emptyText: string;
}) {
  return (
    <div className="bip-card flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2.5 border-b border-[var(--bip-border)] px-4 py-3">
        <Icon size={14} style={{ color }} />
        <span className="text-sm font-medium text-[var(--text)]">{title}</span>
        <span
          className="ml-auto rounded-full px-2 py-0.5 text-xs font-semibold"
          style={{
            background: `color-mix(in srgb, ${color} 15%, transparent)`,
            color,
          }}
        >
          {clients.length}
        </span>
      </div>

      {/* Rows */}
      <div className="divide-y divide-[var(--bip-border)]">
        {clients.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-[var(--text-subtle)]">
            {emptyText}
          </p>
        ) : (
          clients.map((c) => (
            <CommsRow key={c.id} client={c} onAcknowledge={onAcknowledge} />
          ))
        )}
      </div>
    </div>
  );
}

export default function CommsMonitor({ clients }: Props) {
  const [localClients, setLocalClients] = useState(clients);

  function handleAcknowledge(id: number) {
    setLocalClients((prev) =>
      prev.map((c) => (c.id === id ? { ...c, needs_reply: false } : c)),
    );
  }

  const awaitingReply = localClients
    .filter((c) => c.needs_reply)
    .sort(
      (a, b) =>
        new Date(a.last_communication_at ?? 0).getTime() -
        new Date(b.last_communication_at ?? 0).getTime(),
    );

  const goneSilent = localClients
    .filter((c) => !c.needs_reply && (c.days_stale ?? 0) >= 15)
    .sort((a, b) => (b.days_stale ?? 0) - (a.days_stale ?? 0));

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Panel
        title="Awaiting Reply"
        icon={MessageSquare}
        color="#f59e0b"
        clients={awaitingReply}
        onAcknowledge={handleAcknowledge}
        emptyText="No threads waiting on a reply."
      />
      <Panel
        title="Gone Silent (15+ days)"
        icon={Clock}
        color="#ef4444"
        clients={goneSilent}
        emptyText="No clients have gone quiet."
      />
    </div>
  );
}
