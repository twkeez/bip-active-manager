function norm(s: string | null | undefined) {
  return (s ?? "").trim();
}

export function websiteLabel(url: string | null | undefined) {
  const t = norm(url);
  if (!t) return "—";
  try {
    const u = t.includes("://") ? new URL(t) : new URL(`https://${t}`);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return t.length > 32 ? `${t.slice(0, 29)}…` : t;
  }
}

/** "Oct 27 – Nov 23, 2026" for two YYYY-MM-DD dates (read as calendar days, not times). */
export function formatDateRange(startDate: string, endDate: string): string {
  const day = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00Z`);
  const start = day(startDate);
  const end = day(endDate);
  const sameYear = start.getUTCFullYear() === end.getUTCFullYear();
  const fmt = (d: Date, withYear: boolean) =>
    d.toLocaleDateString("en-US", { month: "short", day: "numeric", ...(withYear ? { year: "numeric" } : {}), timeZone: "UTC" });
  return `${fmt(start, !sameYear)} – ${fmt(end, true)}`;
}
