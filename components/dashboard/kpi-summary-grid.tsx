"use client";
export type KpiChangeTrend = "up" | "down" | "neutral";
export type KpiSummaryItem = {
  id: string;
  label: string;
  value: string;
  changeText?: string;
  changeTrend?: KpiChangeTrend;
};
type KpiSummaryGridProps = {
  items: KpiSummaryItem[];
  theme?: "default" | "dark";
};
function changeTrendClass(
  trend: KpiChangeTrend | undefined,
  theme: "default" | "dark",
) {
  if (trend === "up") {
    return theme === "dark" ? "text-bip-accent" : "text-emerald-600";
  }
  if (trend === "down") {
    return theme === "dark" ? "text-red-400" : "text-bip-danger";
  }
  return theme === "dark" ? "text-white/50" : "text-white/50";
}
export function KpiSummaryCard({
  item,
  theme = "default",
}: {
  item: KpiSummaryItem;
  theme?: "default" | "dark";
}) {
  const cardClass =
    theme === "dark"
      ? "rounded-xl border border-white/[0.08] bg-bip-card/50 px-4 py-3"
      : "rounded-lg border border-white/[0.08] bg-bip-card px-3 py-2.5";
  const labelClass =
    theme === "dark"
      ? "text-[11px] font-medium uppercase tracking-wide text-white/50"
      : "text-[11px] font-medium uppercase tracking-wide text-white/40";
  const valueClass =
    theme === "dark"
      ? "mt-1 text-xl font-bold tabular-nums text-white"
      : "mt-1 text-xl font-bold tabular-nums text-white";
  return (
    <article className={cardClass}>
      
      <p className={labelClass}>{item.label}</p>
      <p className={valueClass}>{item.value}</p>
      {item.changeText && (
        <p
          className={`mt-0.5 text-[11px] font-medium ${changeTrendClass(item.changeTrend, theme)}`}
        >
          
          {item.changeText}
        </p>
      )}
    </article>
  );
}
export default function KpiSummaryGrid({
  items,
  theme = "default",
}: KpiSummaryGridProps) {
  if (items.length === 0) return null;
  return (
    <div className="grid grid-cols-3 gap-3">
      
      {items.map((item) => (
        <KpiSummaryCard key={item.id} item={item} theme={theme} />
      ))}
    </div>
  );
}
