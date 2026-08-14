import type { SocialContentPost } from "./types";

// Export helpers for a month's plan. Pure string builders so they can be
// unit-tested and reused by any surface (clipboard, file download, email).

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "", "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function longDate(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return dateStr;
  return `${WEEKDAYS[d.getUTCDay()]}, ${MONTHS[d.getUTCMonth() + 1]} ${d.getUTCDate()}`;
}

function byDate(a: SocialContentPost, b: SocialContentPost) {
  return a.post_date.localeCompare(b.post_date) || a.sort_order - b.sort_order;
}

/** The whole month — everything a strategist needs to review or hand off. */
export function buildPlanText(params: {
  clientName: string;
  month: number;
  year: number;
  posts: SocialContentPost[];
}): string {
  const { clientName, month, year, posts } = params;
  const lines: string[] = [
    `${clientName} — ${MONTHS[month]} ${year} social plan`,
    `${posts.length} post${posts.length === 1 ? "" : "s"}`,
    "",
  ];

  for (const p of [...posts].sort(byDate)) {
    lines.push(`── ${longDate(p.post_date)} — ${p.campaign_label}`);
    lines.push(`Status: ${p.status}${p.locked ? " (locked)" : ""}`);
    lines.push("");
    lines.push(p.caption_draft?.trim() ? p.caption_draft.trim() : "[no caption yet]");
    if (p.hashtags?.trim()) {
      lines.push("");
      lines.push(p.hashtags.trim());
    }
    if (p.shot_list?.trim()) {
      lines.push("");
      lines.push(`Photo/video to request: ${p.shot_list.trim()}`);
    }
    lines.push("");
  }

  return lines.join("\n").trimEnd() + "\n";
}

/** Client-facing: just what the practice has to photograph or film. */
export function buildPhotoBriefText(params: {
  clientName: string;
  month: number;
  year: number;
  posts: SocialContentPost[];
}): string {
  const { clientName, month, year, posts } = params;
  const withShots = [...posts].sort(byDate).filter((p) => p.shot_list?.trim());

  const lines: string[] = [
    `${clientName} — ${MONTHS[month]} ${year} photo & video list`,
    "",
    "Here's everything we need from you this month. Phone photos are perfect — candid beats polished!",
    "",
  ];

  if (withShots.length === 0) {
    lines.push("Nothing to capture yet — we'll send this over once the month is written.");
  } else {
    for (const p of withShots) {
      lines.push(`• ${longDate(p.post_date)} — ${p.campaign_label}`);
      lines.push(`  ${p.shot_list!.trim()}`);
      lines.push("");
    }
    lines.push("Send everything to your Beyond Indigo strategist whenever it's ready. Thank you!");
  }

  return lines.join("\n").trimEnd() + "\n";
}

function csvCell(value: string | null | undefined): string {
  const v = (value ?? "").replace(/\r?\n/g, " ").trim();
  // Quote whenever the value could otherwise break the row.
  return /[",]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

/** Spreadsheet-friendly, one row per post. */
export function buildPlanCsv(posts: SocialContentPost[]): string {
  const header = ["Date", "Title", "Campaign type", "Status", "Locked", "Caption", "Shot list", "Hashtags"];
  const rows = [...posts].sort(byDate).map((p) =>
    [
      p.post_date,
      csvCell(p.campaign_label),
      p.campaign_type,
      p.status,
      p.locked ? "yes" : "no",
      csvCell(p.caption_draft),
      csvCell(p.shot_list),
      csvCell(p.hashtags),
    ].join(","),
  );
  return [header.join(","), ...rows].join("\n") + "\n";
}

export function exportFileName(clientName: string, month: number, year: number, ext: string): string {
  const slug = clientName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `${slug}-${MONTHS[month].toLowerCase()}-${year}.${ext}`;
}
