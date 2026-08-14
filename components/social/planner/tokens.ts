// Design tokens shared by the social planner screens. Literal hex from the
// handoff bundles, matching the Clients list and Client overview redesigns.
export const T = {
  bg: "#F5F4EF",
  card: "#FFFFFF",
  ink: "#191813",
  secondary: "#6E6A5E",
  muted: "#8A8678",
  faint: "#A5A091",
  border: "#E6E3DA",
  borderSoft: "#E9E6DD",
  hairline: "#F5F3EC",
  chipBorder: "#EFEDE6",
  fill: "#FAF9F4",
  hover: "#F6F5F0",
  primary: "#2B3FE4",
  primaryHover: "#1F31C8",
  primaryTint: "#F5F6FE",
  green: "#1F7A4D",
  greenTint: "#E4F2E9",
  amber: "#B7791F",
  amberTint: "#FFF3DC",
  amberNoticeBg: "#FFFBF0",
  amberNoticeBorder: "#F0E2C4",
  amberNoticeText: "#8A5B14",
  /** Destructive actions and the Convert pillar. */
  rust: "#A03A2E",
  rustHover: "#8A3227",
  rustTint: "#FBF1EF",
  track: "#EFEDE6",
} as const;

export const FONT = "var(--font-instrument-sans), system-ui, sans-serif";

export const MONTH_NAMES = [
  "", "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export const WEEKDAY_HEADERS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** YYYY-MM-DD for a day in the given month, without timezone drift. */
export function isoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Weekday index (0=Sun) of the first of the month, UTC-safe. */
export function firstWeekdayOfMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
}

export function dayOf(dateStr: string): number {
  return Number(dateStr.slice(8, 10));
}

/** "Tue, Sep 1" — the date-select label in the editor and export sheet. */
export function selectDateLabel(year: number, month: number, day: number): string {
  const d = new Date(Date.UTC(year, month - 1, day));
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}
