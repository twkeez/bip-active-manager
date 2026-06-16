import { fetchGoogleSheetAsCsv } from "@/lib/google/fetch-sheet";
import { normalizeClientName } from "@/lib/clients/normalize-name";
import type { RosterSheetRow } from "@/lib/clients/types";
import type { ClientInsert } from "@/lib/types/client";

function cleanText(value: unknown) {
  if (value == null) return null;
  const text = String(value).trim();
  if (!text || text === "#N/A" || text === "N/A") return null;
  return text;
}

function cleanNum(value: unknown) {
  const text = cleanText(value);
  if (text == null) return null;
  const num = Number(text);
  return Number.isFinite(num) ? num : null;
}

function cleanHeader(value: string) {
  return value.replace(/^\uFEFF/, "").trim();
}

function parseCsvRows(csvText: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i += 1) {
    const char = csvText[i]!;
    const next = csvText[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || (char === "\r" && next === "\n")) {
      row.push(field);
      field = "";
      if (row.some((cell) => cell.trim().length > 0)) rows.push(row);
      row = [];
      if (char === "\r") i += 1;
    } else if (char !== "\r") {
      field += char;
    }
  }

  row.push(field);
  if (row.some((cell) => cell.trim().length > 0)) rows.push(row);
  return rows;
}

const ACCOUNT_HEADERS = ["account", "account name", "account_name", "client", "client name"];

function findAccountColumnIndex(headers: string[]) {
  const normalized = headers.map((h) => cleanHeader(h).toLowerCase());
  for (const candidate of ACCOUNT_HEADERS) {
    const index = normalized.indexOf(candidate);
    if (index >= 0) return index;
  }
  return normalized.findIndex((header) => header.includes("account"));
}

function headerToFieldMap(headers: string[]) {
  const map = new Map<string, string>();
  for (const header of headers) {
    map.set(cleanHeader(header).toLowerCase(), header);
  }
  return map;
}

function getCell(raw: Record<string, string>, ...keys: string[]) {
  for (const key of keys) {
    const value = raw[key];
    if (value != null && value.trim()) return value;
  }
  return "";
}

export function sheetRowToClientInsert(raw: Record<string, string>): ClientInsert | null {
  const accountName = cleanText(
    getCell(raw, "Account", "account", "Account Name", "account_name"),
  );
  if (!accountName) return null;

  return {
    account_name: accountName,
    marketing_strategist: cleanText(getCell(raw, "Marketing Strategist", "marketing_strategist")),
    total_package_hours: cleanNum(getCell(raw, "Total Package Hours", "total_package_hours")),
    hours_for_strategist: cleanNum(getCell(raw, "Hours for Strategist", "hours_for_strategist")),
    blog: cleanText(getCell(raw, "Blog", "blog")),
    smm: cleanText(getCell(raw, "SMM", "smm")),
    seo: cleanText(getCell(raw, "SEO", "seo")),
    ppc: cleanText(getCell(raw, "PPC", "ppc")),
    orm: cleanText(getCell(raw, "ORM", "orm")),
    ads_customer_id: cleanText(getCell(raw, "Ads_Customer_ID", "ads_customer_id")),
    ga4_id: cleanText(getCell(raw, "GA4_ID", "ga4_id")),
    sc_url: cleanText(getCell(raw, "SC URL: ", "SC URL", "sc_url")),
    website: cleanText(getCell(raw, "Website", "website")),
    ga4_property_id: cleanText(getCell(raw, "ga4_property_id", "GA4 property ID")),
    basecamp_project_id: cleanText(getCell(raw, "basecamp_project_id", "Basecamp Project ID")),
    harvest_project_id: cleanText(getCell(raw, "harvest_project_id", "Harvest Project ID")),
    harvest_client_id: cleanText(getCell(raw, "harvest_client_id", "Harvest Client ID")),
    tier: cleanText(getCell(raw, "tier", "Tier")),
    google_place_id: cleanText(getCell(raw, "google_place_id", "Google Place ID")),
    onboarding_status: null,
    onboarding_started_at: null,
    onboarding_completed_at: null,
    onboarding_target_date: null,
  };
}

export function parseRosterCsv(csvText: string): RosterSheetRow[] {
  const parsed = parseCsvRows(csvText);
  if (parsed.length < 2) {
    throw new Error("CSV must include a header row and at least one data row.");
  }

  const headers = parsed[0]!.map(cleanHeader);
  const accountIndex = findAccountColumnIndex(headers);
  if (accountIndex < 0) {
    throw new Error("Could not find an Account column in the spreadsheet.");
  }

  const rows: RosterSheetRow[] = [];
  for (let i = 1; i < parsed.length; i += 1) {
    const cells = parsed[i]!;
    const raw: Record<string, string> = {};
    for (let col = 0; col < headers.length; col += 1) {
      const header = headers[col];
      if (!header) continue;
      raw[header] = cells[col] ?? "";
    }

    const record = sheetRowToClientInsert(raw);
    if (!record) continue;

    rows.push({
      rowIndex: i + 1,
      accountName: record.account_name,
      normalizedName: normalizeClientName(record.account_name),
      record,
      raw,
    });
  }

  if (rows.length === 0) {
    throw new Error("No client rows found in spreadsheet.");
  }

  return rows;
}

export async function resolveRosterCsvInput(params: {
  sheetUrl?: string | null;
  csvText?: string | null;
}) {
  const csvFromText = (params.csvText ?? "").trim();
  if (csvFromText) {
    return { csvText: csvFromText, source: "csv" as const };
  }

  const sheetUrl = (params.sheetUrl ?? "").trim();
  if (sheetUrl) {
    const csvText = await fetchGoogleSheetAsCsv(sheetUrl);
    return { csvText, source: "google_sheet" as const };
  }

  throw new Error("Provide a Google Sheet URL or CSV content.");
}
