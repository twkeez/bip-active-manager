"use client";

// Internal-only cockpit. Rendered inside the (staff-gated) client workspace overview.
// Styling uses the bip tokens defined in app/globals.css — no hardcoded colors.

import { useState } from "react";
import type {
  CockpitData,
  FocusItem,
  ChannelStatus,
  Priority,
} from "@/types/cockpit";

const STATUS_BADGE: Record<ChannelStatus, string> = {
  ok: "bip-badge-success",
  warn: "bip-badge-warning",
  bad: "bip-badge-danger",
};

const PRIORITY_BADGE: Record<Priority, string> = {
  P1: "bip-badge-danger",
  P2: "bip-badge-warning",
  P3: "bip-badge-info",
};

const PRIORITY_BORDER: Record<Priority, string> = {
  P1: "border-l-bip-danger",
  P2: "border-l-bip-highlight",
  P3: "border-l-bip-accent",
};

function tagClass(tone?: "hi" | "lo" | "neutral") {
  if (tone === "hi") return "bip-badge-danger";
  if (tone === "lo") return "bip-badge-success";
  return "bip-badge";
}

function FocusCard({ item }: { item: FocusItem }) {
  const [done, setDone] = useState(false);
  return (
    <div
      className={`mb-3 rounded-[var(--radius-lg)] border border-l-4 border-bip-border p-3.5 transition ${PRIORITY_BORDER[item.priority]} ${
        done ? "opacity-50" : "hover:-translate-y-px hover:shadow-md"
      }`}
    >
      <div className="flex items-start gap-2.5">
        <span className={`${PRIORITY_BADGE[item.priority]} mt-0.5 flex-none`}>{item.priority}</span>
        <h3
          className={`font-heading flex-1 text-[14.5px] font-bold leading-snug ${
            done ? "text-bip-subtle line-through" : "text-bip-text"
          }`}
        >
          {item.title}
        </h3>
        <button
          onClick={() => setDone((v) => !v)}
          aria-label={done ? "Mark as open" : "Mark as handled"}
          className={`grid h-[22px] w-[22px] flex-none place-items-center rounded-[var(--radius-sm)] border-[1.6px] text-[13px] font-extrabold transition ${
            done
              ? "border-bip-accent bg-bip-accent text-white"
              : "border-bip-border bg-bip-card text-transparent hover:border-bip-accent"
          }`}
        >
          ✓
        </button>
      </div>
      {item.why && <p className="mt-1.5 text-[13px] text-bip-muted">{item.why}</p>}
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {item.tags.map((t, i) => (
          <span key={i} className={tagClass(t.tone)}>
            {t.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export function StrategistCockpit({ data }: { data: CockpitData }) {
  const { client } = data;
  const openCount = data.focus.length;

  return (
    <div className="text-bip-text">
      {/* Top bar */}
      <div className="bip-card flex flex-wrap items-start justify-between gap-5 border-t-[3px] border-t-bip-accent p-5">
        <div>
          <span className="text-[10.5px] font-extrabold uppercase tracking-[0.18em] text-bip-accent">
            Strategist Cockpit · Internal
          </span>
          <div className="font-heading mt-1.5 text-[21px] font-extrabold tracking-tight">{client.name}</div>
          <div className="text-[12.5px] text-bip-muted">
            {[
              client.location,
              client.strategists && `Strategists: ${client.strategists}`,
              `Window: ${client.window.toLowerCase()}`,
            ]
              .filter(Boolean)
              .join(" · ")}
          </div>
        </div>
        <div className="text-right text-xs text-bip-subtle">
          <span className="inline-block rounded-[var(--radius-sm)] bg-bip-text px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-bip-card">
            Not client-facing
          </span>
          {client.syncedAt && <div className="mt-1.5">Synced {client.syncedAt}</div>}
        </div>
      </div>

      {/* Health strip */}
      <div className="mt-3.5 grid grid-cols-2 gap-2.5 md:grid-cols-5">
        {data.health.map((h, i) => (
          <div key={i} className="bip-card p-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-bip-muted">{h.channel}</div>
            <div className="mt-1.5">
              <span className={STATUS_BADGE[h.status]}>{h.label}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Work area */}
      <div className="mt-5 grid items-start gap-[18px] lg:grid-cols-[1.55fr_1fr]">
        {/* Focus queue */}
        <div className="bip-card p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-base font-extrabold tracking-tight">Focus queue</h2>
            <span className="bip-badge-info">{openCount} open</span>
          </div>
          <p className="mb-3.5 mt-1 text-[12.5px] text-bip-muted">
            Built from this client&apos;s channel signals, ranked by priority. Internal — none of this appears in the client report.
          </p>
          {data.focus.length === 0 ? (
            <p className="rounded-[var(--radius-lg)] border border-dashed border-bip-border p-6 text-center text-sm text-bip-muted">
              No open signals. Nice — nothing flagged this period.
            </p>
          ) : (
            data.focus.map((item) => <FocusCard key={item.id} item={item} />)
          )}
        </div>

        {/* Feature to client */}
        <div className="bip-card p-5">
          <h2 className="font-heading text-base font-extrabold tracking-tight">Feature to the client</h2>
          <p className="mb-3.5 mt-1 text-[12.5px] text-bip-muted">
            Spotlight these wins in the report — keeps it positive and on-message.
          </p>
          {data.features.length === 0 ? (
            <p className="text-sm text-bip-subtle">Sync data to populate wins.</p>
          ) : (
            data.features.map((w, i) => (
              <div key={i} className="flex gap-2.5 border-b border-bip-border py-2.5 last:border-b-0">
                <span className="bip-badge-success grid h-[22px] w-[22px] flex-none place-items-center">✓</span>
                <div className="text-[13.5px]">
                  <b className="font-bold">{w.title}</b>
                  <span className="mt-0.5 block text-xs text-bip-muted">{w.detail}</span>
                </div>
              </div>
            ))
          )}

          <div className="mt-4 flex flex-wrap items-center gap-3.5 text-[11.5px] text-bip-subtle">
            <span className="font-semibold text-bip-muted">Priority:</span>
            <span className="text-bip-danger">● P1 do now</span>
            <span className="text-bip-highlight">● P2 this month</span>
            <span className="text-bip-accent">● P3 backlog</span>
          </div>
        </div>
      </div>
    </div>
  );
}
