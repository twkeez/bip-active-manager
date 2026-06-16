import type { UserTaskPriority, UserTaskStatus } from "@/lib/types/client";

export type LegacyTaskRow = {
  title: string;
  description: string | null;
  status: UserTaskStatus;
  dueDate: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  priority: UserTaskPriority;
  categoryName: string | null;
  assigneeName: string | null;
  basecampUrl: string | null;
  basecampSubject: string | null;
  communicationPreview: string | null;
  isStarred: boolean;
  raw: Record<string, string>;
};

function normalize(value: string | null | undefined) {
  return (value ?? "").trim();
}

function parseDateToIsoDate(value: string) {
  const raw = normalize(value);
  if (!raw) return null;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

function parseDateToIsoTimestamp(value: string) {
  const raw = normalize(value);
  if (!raw) return null;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function mapStatus(value: string): UserTaskStatus {
  const raw = normalize(value).toLowerCase();
  if (raw === "done" || raw === "completed") return "done";
  if (raw === "in_progress" || raw === "in progress" || raw === "doing") {
    return "in_progress";
  }
  if (raw === "waiting_on_client" || raw === "waiting on client" || raw === "waiting") {
    return "waiting_on_client";
  }
  if (raw === "blocked" || raw === "on hold") return "not_started";
  if (raw === "not_started" || raw === "not started" || raw === "inbox") {
    return "not_started";
  }
  return "not_started";
}

function mapPriority(value: string): UserTaskPriority {
  const raw = normalize(value).toLowerCase();
  if (raw === "high") return "high";
  if (raw === "low") return "low";
  return "medium";
}

function mapBoolean(value: string) {
  const raw = normalize(value).toLowerCase();
  return raw === "true" || raw === "t" || raw === "1" || raw === "yes";
}

function parseJsonObject(value: string) {
  const raw = normalize(value);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (parsed && typeof parsed === "object") return parsed;
    return null;
  } catch {
    return null;
  }
}

function parseDelimited(text: string, delimiter = "\t") {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]!;
    if (char === '"') {
      if (inQuotes && text[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (!inQuotes && char === delimiter) {
      row.push(cell);
      cell = "";
      continue;
    }
    if (!inQuotes && (char === "\n" || char === "\r")) {
      if (char === "\r" && text[i + 1] === "\n") i += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }
    cell += char;
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

export function parseLegacyTasksFromRaw(rawText: string) {
  const rows = parseDelimited(rawText, "\t");
  if (rows.length <= 1) return [];

  const headers = rows[0]!.map((header) => normalize(header).toLowerCase());
  const records: LegacyTaskRow[] = [];

  for (const rawRow of rows.slice(1)) {
    const values = [...rawRow];
    while (values.length < headers.length) values.push("");
    const mapped: Record<string, string> = {};
    headers.forEach((header, index) => {
      mapped[header] = values[index] ?? "";
    });
    const title = normalize(mapped.title);
    if (!title) continue;

    const communicationWatch = parseJsonObject(mapped.communication_watch ?? "");
    const communicationPreview =
      typeof communicationWatch?.preview === "string"
        ? normalize(communicationWatch.preview)
        : null;
    const basecampUrl =
      typeof communicationWatch?.basecamp_web_url === "string"
        ? normalize(communicationWatch.basecamp_web_url)
        : null;
    const basecampSubject =
      typeof communicationWatch?.subject === "string"
        ? normalize(communicationWatch.subject)
        : null;

    records.push({
      title,
      description: normalize(mapped.description) || null,
      status: mapStatus(mapped.status),
      dueDate: parseDateToIsoDate(mapped.due_date),
      createdAt: parseDateToIsoTimestamp(mapped.created_at),
      updatedAt: parseDateToIsoTimestamp(mapped.updated_at),
      priority: mapPriority(mapped.priority),
      categoryName: normalize(mapped.planner_label) || null,
      assigneeName:
        normalize(mapped.planner_assignee) || normalize(mapped.assigned_to) || null,
      basecampUrl,
      basecampSubject,
      communicationPreview,
      isStarred: mapBoolean(mapped.is_starred ?? mapped.starred ?? ""),
      raw: mapped,
    });
  }

  return records;
}
