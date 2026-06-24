// components/dashboard/strategist-cockpit.tsx
"use client";

// Internal-only cockpit. Rendered inside the (staff-gated) client workspace
// overview. Flat UI, sentence case, no gradients/shadows. Red/amber/blue encode
// P1/P2/P3 only; green is reserved for the win card.

import { useState } from "react";
import type { CockpitData, FocusItem, ChannelStatus, Priority } from "@/types/cockpit";

const STATUS_BADGE: Record<ChannelStatus, string> = {
  ok: "bip-badge-success",
  warn: "bip-badge-warning",
  bad: "bip-badge-danger",
};
const PRIORITY_BORDER: Record<Priority, string> = {
  P1: "border-l-bip-danger",
  P2: "border-l-bip-highlight",
  P3: "border-l-bip-accent",
};
const PRIORITY_TEXT: Record<Priority, string> = {
  P1: "text-bip-danger",
  P2: "text-bip-highlight",
  P3: "text-bip-accent",
};
const PRIORITY_WHEN: Record<Priority, string> = {
  P1: "Do now",
  P2: "This month",
  P3: "Backlog",
};

function FocusCard({ item }: { item: FocusItem }) {
  const [done, setDone] = useState(false);
  const [open, setOpen] = useState(false);
  return (
    <div
      className={`mb-2.5 rounded-[var(--radius-md)] border-l-2 bg-bip-card p-3.5 ${PRIORITY_BORDER[item.priority]} ${
        done ? "opacity-50" : ""
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h4 className={`text-sm font-semibold leading-snug ${done ? "text-bip-subtle line-through" : "text-bip-text"}`}>
            {item.title}
            {item.count > 1 && <span className="ml-1.5 font-normal text-bip-muted">×{item.count}</span>}
          </h4>
          {item.fix && (
            <p className="mt-1 text-[13px] text-bip-muted">
              <span className="font-medium text-bip-text">Fix:</span> {item.fix}
            </p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="bip-badge">{item.channel}</span>
            {item.entries.length > 0 && (
              <button onClick={() => setOpen((v) => !v)} className="text-[12px] font-medium text-bip-accent hover:underline">
                {open ? "Hide" : `Show ${item.entries.length} affected`}
              </button>
            )}
            {item.link && (
              <a href={item.link.href} className="text-[12px] font-medium text-bip-accent hover:underline">
                {item.link.label} →
              </a>
            )}
          </div>
          {open && item.entries.length > 0 && (
            <ul className="mt-2 space-y-1 rounded-[var(--radius-sm)] border border-bip-border p-2.5">
              {item.entries.map((e, i) => (
                <li key={i} className="text-[12px]">
                  {e.label && <span className="text-bip-text">{e.label}</span>}
                  {e.metrics && <span className="ml-2 font-mono text-bip-subtle">{e.metrics}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
        <button
          onClick={() => setDone((v) => !v)}
          className="flex flex-none items-center gap-1.5 text-[11px] font-medium text-bip-muted hover:text-bip-text"
        >
          <span
            className={`grid h-[16px] w-[16px] place-items-center rounded-[var(--radius-sm)] border text-[10px] ${
              done ? "border-bip-accent bg-bip-accent text-white" : "border-bip-border text-transparent"
            }`}
          >
            ✓
          </span>
          {done ? "Done" : "Mark done"}
        </button>
      </div>
    </div>
  );
}

export function StrategistCockpit({ data }: { data: CockpitData }) {
  const { client, counts, features } = data;
  const groups: Priority[] = ["P1", "P2", "P3"];
  const hasRealWin = features.length > 0 && !features[0].title.startsWith("No clean wins");
  const pinnedWin = hasRealWin ? features[0] : null;

  return (
    <div className="text-bip-text">
      {/* Channel health row */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
        {data.health.map((h, i) => (
          <div key={i} className="rounded-[var(--radius-md)] border border-bip-border bg-bip-card p-3">
            <div className="text-[12px] text-bip-muted">{h.channel}</div>
            <div className="mt-1.5">
              <span className={STATUS_BADGE[h.status]}>{h.label}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Two-column body */}
      <div className="mt-4 grid items-start gap-4 lg:grid-cols-[3fr_1fr]">
        {/* Focus queue */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold">Focus queue</h2>
            <span className="text-[12px] text-bip-subtle">
              Not client facing{client.syncedAt ? ` · synced ${client.syncedAt}` : ""}
            </span>
          </div>

          {pinnedWin && (
            <div className="mb-4 rounded-[var(--radius-md)] border-l-2 border-l-emerald-500 bg-emerald-500/10 p-3.5">
              <h4 className="text-sm font-semibold text-emerald-400">{pinnedWin.title}</h4>
              <p className="mt-0.5 text-[13px] text-bip-muted">{pinnedWin.detail} · Feature to client.</p>
            </div>
          )}

          {data.focus.length === 0 ? (
            <p className="rounded-[var(--radius-md)] border border-dashed border-bip-border p-6 text-center text-sm text-bip-muted">
              No open signals this period.
            </p>
          ) : (
            groups.map((p) => {
              const items = data.focus.filter((f) => f.priority === p);
              if (items.length === 0) return null;
              return (
                <div key={p} className="mb-5">
                  <div className={`mb-2 flex items-center gap-2 border-l-2 pl-2 ${PRIORITY_BORDER[p]}`}>
                    <span className={`text-[13px] font-semibold ${PRIORITY_TEXT[p]}`}>{p}</span>
                    <span className="text-[12px] text-bip-subtle">{PRIORITY_WHEN[p]} · {items.length}</span>
                  </div>
                  {items.map((item) => (
                    <FocusCard key={item.id} item={item} />
                  ))}
                </div>
              );
            })
          )}
        </div>

        {/* Sidebar */}
        <aside className="space-y-4">
          <div className="rounded-[var(--radius-md)] border border-bip-border bg-bip-card p-4">
            <div className="text-[12px] text-bip-muted">Priority</div>
            <div className="mt-2 space-y-1 text-sm">
              <div className={PRIORITY_TEXT.P1}>P1: {counts.P1}</div>
              <div className={PRIORITY_TEXT.P2}>P2: {counts.P2}</div>
              <div className={PRIORITY_TEXT.P3}>P3: {counts.P3}</div>
            </div>
          </div>

          <div className="rounded-[var(--radius-md)] border border-bip-border bg-bip-card p-4">
            <span className="inline-block rounded-[var(--radius-sm)] bg-bip-text px-2 py-0.5 text-[11px] font-medium text-bip-card">
              Not client facing
            </span>
            {client.syncedAt && <p className="mt-2 text-[12px] text-bip-muted">Last synced {client.syncedAt}</p>}
            <p className="mt-2 text-[12px] text-bip-subtle">
              Strategist cockpit · internal{client.strategists ? ` · ${client.strategists}` : ""}
            </p>
          </div>

          {features.length > 0 && (
            <div className="rounded-[var(--radius-md)] border border-bip-border bg-bip-card p-4">
              <div className="mb-2 text-[12px] text-bip-muted">Feature to the client</div>
              <ul className="space-y-2.5">
                {features.map((w, i) => (
                  <li key={i} className="text-[13px]">
                    <span className="font-medium text-bip-text">{w.title}</span>
                    <span className="mt-0.5 block text-[12px] text-bip-subtle">{w.detail}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
