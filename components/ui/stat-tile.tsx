import type { ReactNode } from "react";

// The label/value summary tile repeated across the tool pages, plus a responsive
// grid wrapper. `tone` colors the number for at-a-glance state.

export function StatTiles({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{children}</div>;
}

export function StatTile({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string | number;
  sub?: string | null;
  tone?: "warn" | "good";
}) {
  const toneClass = tone === "warn" ? "text-amber-300" : tone === "good" ? "text-emerald-400" : "text-bip-text";
  return (
    <div className="rounded-xl border border-bip-border bg-bip-card px-4 py-3">
      <p className={`text-2xl font-semibold tabular-nums ${toneClass}`}>{value}</p>
      <p className="text-xs text-bip-muted">
        {label}
        {sub ? ` · ${sub}` : ""}
      </p>
    </div>
  );
}
