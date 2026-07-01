"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { SERVICE_TIER_TABLES } from "@/lib/services/tier-content";

const MAGENTA = "#ce2084";

export default function ServiceTiersView() {
  const [activeKey, setActiveKey] = useState(SERVICE_TIER_TABLES[0]?.key ?? "");
  const table = SERVICE_TIER_TABLES.find((t) => t.key === activeKey) ?? SERVICE_TIER_TABLES[0];

  if (!table) {
    return <p className="text-sm text-bip-muted">No service tiers defined yet.</p>;
  }

  return (
    <div className="space-y-4">
      {/* Service switcher */}
      <div className="flex flex-wrap gap-2">
        {SERVICE_TIER_TABLES.map((t) => {
          const active = t.key === table.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setActiveKey(t.key)}
              className="rounded-full border px-3 py-1.5 text-sm font-medium transition-colors"
              style={
                active
                  ? { borderColor: MAGENTA, background: `${MAGENTA}1a`, color: MAGENTA }
                  : undefined
              }
            >
              <span className={active ? "" : "text-bip-muted"}>{t.label}</span>
            </button>
          );
        })}
      </div>

      <p className="text-sm leading-relaxed text-bip-muted">{table.summary}</p>

      {/* Comparison table */}
      <div className="overflow-x-auto rounded-xl border border-bip-border">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="w-40 border-b border-bip-border bg-bip-page p-3 text-left align-bottom text-xs font-semibold uppercase tracking-wide text-bip-muted">
                &nbsp;
              </th>
              {table.tiers.map((tier) => (
                <th key={tier.key} className="border-b border-l border-bip-border bg-bip-page p-3 text-left align-bottom">
                  <div className="text-base font-bold" style={{ color: MAGENTA }}>
                    {tier.label}
                  </div>
                  <div className="mt-0.5 text-sm font-semibold text-bip-text">{tier.price}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row) => (
              <tr key={row.label} className="align-top">
                <th className="border-b border-bip-border p-3 text-left">
                  <div className="text-sm font-semibold text-bip-text">{row.label}</div>
                  {row.note && (
                    <div className="mt-1 inline-block rounded px-1.5 py-0.5 text-[10px] font-medium" style={{ background: `${MAGENTA}1a`, color: MAGENTA }}>
                      {row.note}
                    </div>
                  )}
                </th>
                {row.cells.map((bullets, i) => (
                  <td key={i} className="border-b border-l border-bip-border p-3">
                    <ul className="space-y-1.5">
                      {bullets.map((b, j) => (
                        <li key={j} className="flex items-start gap-1.5 text-sm text-bip-text">
                          <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: MAGENTA }} />
                          <span>{b}</span>
                        </li>
                      ))}
                    </ul>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
