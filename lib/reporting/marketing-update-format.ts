export type MarketingUpdateContextSummary = {
  channelsIncluded: string[];
  hasAds: boolean;
  hasGbp: boolean;
  hasGbpManualInteractions: boolean;
  hasSearchConsole: boolean;
  hasFacebook: boolean;
  hasKeywords: boolean;
  dateRangeLabel: string;
};

function norm(value: string | null | undefined) {
  return (value ?? "").trim();
}

function parseIsoDate(value: string) {
  const parsed = new Date(`${value}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatCompactNumber(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) {
    const scaled = value / 1_000_000;
    return `${scaled >= 10 ? scaled.toFixed(0) : scaled.toFixed(2).replace(/\.?0+$/, "")}M`;
  }
  if (abs >= 1_000) {
    const scaled = value / 1_000;
    return `${scaled >= 10 ? scaled.toFixed(0) : scaled.toFixed(2).replace(/\.?0+$/, "")}K`;
  }
  return value.toLocaleString("en-US");
}

export function formatCurrencyFromMicros(micros: number): string {
  const dollars = micros / 1_000_000;
  if (dollars >= 100) return `$${Math.round(dollars).toLocaleString("en-US")}`;
  return `$${dollars.toFixed(2)}`;
}

export function formatAverageCpcFromMicros(micros: number): string {
  return `$${(micros / 1_000_000).toFixed(2)}`;
}

export function formatDateRangeLabel(startDate: string, endDate: string): string {
  const start = parseIsoDate(startDate);
  const end = parseIsoDate(endDate);
  if (!start || !end) return `${startDate} – ${endDate}`;
  const sameYear = start.getFullYear() === end.getFullYear();
  const startLabel = start.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
  const endLabel = end.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return `${startLabel} – ${endLabel}`;
}

export function defaultMarketingUpdateTitle(referenceDate = new Date()): string {
  const quarter = Math.floor(referenceDate.getMonth() / 3) + 1;
  return `Marketing Updates Q${quarter} ${referenceDate.getFullYear()}`;
}

export function defaultMarketingUpdateGreeting(accountName: string): string {
  const trimmed = norm(accountName);
  return trimmed ? `Hi ${trimmed} team,` : "Hi there,";
}
