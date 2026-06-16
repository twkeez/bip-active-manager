export function extractGoogleSheetId(url: string) {
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match?.[1] ?? null;
}

export function extractGoogleSheetGid(url: string) {
  const hashMatch = url.match(/[#&]gid=(\d+)/);
  if (hashMatch?.[1]) return hashMatch[1];
  const queryMatch = url.match(/[?&]gid=(\d+)/);
  return queryMatch?.[1] ?? "0";
}

export function buildGoogleSheetCsvExportUrl(sheetUrl: string) {
  const sheetId = extractGoogleSheetId(sheetUrl);
  if (!sheetId) {
    throw new Error("Invalid Google Sheet URL.");
  }
  const gid = extractGoogleSheetGid(sheetUrl);
  return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
}

export async function fetchGoogleSheetAsCsv(sheetUrl: string) {
  const exportUrl = buildGoogleSheetCsvExportUrl(sheetUrl);
  const response = await fetch(exportUrl, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(
      "Could not fetch Google Sheet. Ensure the sheet is shared for link access.",
    );
  }
  const text = await response.text();
  if (!text.trim()) {
    throw new Error("Google Sheet appears empty.");
  }
  return text;
}
