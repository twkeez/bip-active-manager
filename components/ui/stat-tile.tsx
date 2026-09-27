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
  tone?: "warn" | "good" | "danger";
}) {
  const toneClass =
    tone === "warn"
      ? "text-amber-300"
      : tone === "good"
        ? "text-emerald-400"
        : tone === "danger"
          ? "text-red-200"
          : "text-bip-text";
  return (
    <div
      className={`min-w-0 rounded-xl border px-4 py-3 ${
        tone === "danger" ? "border-red-500/40 bg-red-500/10" : "border-bip-border bg-bip-card"
      }`}
    >
      <p className={`text-2xl font-semibold tabular-nums ${toneClass}`}>{value}</p>
      <p className="truncate text-xs text-bip-muted" title={sub ? `${label} · ${sub}` : undefined}>
        {label}
        {sub ? ` · ${sub}` : ""}
      </p>
    </div>
  );
}
