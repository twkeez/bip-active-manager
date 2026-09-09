import { JWT } from "google-auth-library";

/**
 * Reads the master sheet straight out of Google Drive.
 *
 * It lives in a Drive folder alongside seven "Copy of ..." sheets, so the
 * folder is not a safe thing to point at — the file is pinned by id instead.
 *
 * Access is via the service account rather than a public link. The sheet is a
 * list of every practice we serve, and "anyone with the link" is the wrong
 * setting for that; the cost is one sharing step.
 */

/** "Master Sheet 2026" in the shared Drive folder. Override to move sheets. */
const DEFAULT_SHEET_ID = "1P_Jweul9GUzDBqCNUqQi9a6zgoNPttyxxOOj2DWjb24";

/** The tab, not the file — the workbook has several and only this one is the roster. */
const DEFAULT_TAB = "Master";

export function getMasterSheetId() {
  return (process.env.MASTER_SHEET_ID ?? "").trim() || DEFAULT_SHEET_ID;
}

export function getMasterSheetTab() {
  return (process.env.MASTER_SHEET_TAB ?? "").trim() || DEFAULT_TAB;
}

export function getServiceAccountEmail() {
  return (process.env.GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL ?? "").trim();
}

function buildClient() {
  const email = getServiceAccountEmail();
  const key = (process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY ?? "").replace(/\\n/g, "\n");
  if (!email || !key) {
    throw new Error(
      "No Google service account configured — set GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL and GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.",
    );
  }
  return new JWT({
    email,
    key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
}

export async function fetchMasterSheetRows(): Promise<string[][]> {
  const sheetId = getMasterSheetId();
  const tab = getMasterSheetTab();
  const client = buildClient();

  let data: { values?: string[][] };
  try {
    const range = encodeURIComponent(`${tab}!A:BZ`);
    const response = await client.request<{ values?: string[][] }>({
      url: `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}`,
    });
    data = response.data;
  } catch (error) {
    const err = error as { response?: { status?: number; data?: { error?: { message?: string } } } };
    const status = err.response?.status;
    const message = err.response?.data?.error?.message ?? (error as Error).message;

    // Overwhelmingly the cause, and unfixable from in here — so the error says
    // exactly who to share with rather than "permission denied".
    if (status === 403 || status === 404) {
      throw new Error(
        `Google says the sheet is not readable. Share "Master Sheet 2026" with ${getServiceAccountEmail()} as a Viewer, then try again. (${message})`,
      );
    }
    if (status === 400) {
      throw new Error(
        `Could not read the "${tab}" tab — check the tab name. (${message})`,
      );
    }
    throw new Error(`Could not read the master sheet: ${message}`);
  }

  const values = data.values ?? [];
  if (values.length === 0) {
    throw new Error(`The "${tab}" tab came back empty.`);
  }
  // The API trims trailing empty cells per row, so rows arrive ragged. Padding
  // here keeps column-index lookups honest downstream.
  const width = Math.max(...values.map((row) => row.length));
  return values.map((row) => {
    const padded = [...row];
    while (padded.length < width) padded.push("");
    return padded;
  });
}
