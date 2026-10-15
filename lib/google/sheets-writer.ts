import { buildServiceAccountClient, getMasterSheetId, getServiceAccountEmail } from "@/lib/google/master-sheet-source";

/**
 * Writes tabs of a Google Sheet the service account has been shared on as an
 * Editor. Each tab named is replaced wholesale; tabs not named are left alone.
 *
 * Values go in RAW, never USER_ENTERED: ticket subjects are written by
 * clients, and a subject starting with "=" must stay text, not become a
 * formula.
 */

const WRITE_SCOPE = "https://www.googleapis.com/auth/spreadsheets";
const CHUNK_ROWS = 2000;

export type SheetTab = { title: string; rows: (string | number)[][] };

type Client = ReturnType<typeof buildServiceAccountClient>;

function explain(error: unknown, sheetId: string): Error {
  const err = error as { response?: { status?: number; data?: { error?: { message?: string } } } };
  const status = err.response?.status;
  const message = err.response?.data?.error?.message ?? (error as Error).message;
  if (status === 403 || status === 404) {
    return new Error(
      `Google says the report sheet is not writable. Share it (${sheetUrl(sheetId)}) with ${getServiceAccountEmail()} as an Editor, then try again. (${message})`,
    );
  }
  return new Error(`Could not write the report sheet: ${message}`);
}

export function sheetUrl(sheetId: string) {
  return `https://docs.google.com/spreadsheets/d/${sheetId}/edit`;
}

async function call<T>(client: Client, sheetId: string, options: Parameters<Client["request"]>[0]) {
  try {
    const response = await client.request<T>(options);
    return response.data;
  } catch (error) {
    throw explain(error, sheetId);
  }
}

/** A tab's values as text, or [] if the tab does not exist yet. */
export async function readSheetTab(sheetId: string, title: string): Promise<string[][]> {
  const client = buildServiceAccountClient([WRITE_SCOPE]);
  const meta = await call<{ sheets?: { properties: { title: string } }[] }>(client, sheetId, {
    url: `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=sheets.properties.title`,
  });
  if (!(meta.sheets ?? []).some((s) => s.properties.title === title)) return [];
  const data = await call<{ values?: string[][] }>(client, sheetId, {
    url: `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(`'${title}'`)}`,
  });
  return data.values ?? [];
}

const columnLetter = (index: number) => {
  let n = index + 1;
  let out = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
};

/**
 * The Master Sheet is the team's source of truth and is never written to by
 * this app (Tom's standing rule). Every write path goes through here, so this
 * is the one place to refuse.
 */
export function assertNotMasterSheet(sheetId: string) {
  if (sheetId.trim() === getMasterSheetId().trim()) {
    throw new Error("Refusing to write to the Master Sheet — it is read-only for this app. Point HELP_DESK_REPORT_SHEET_ID at the report sheet.");
  }
}

export async function writeSheetTabs(sheetId: string, tabs: SheetTab[]): Promise<void> {
  assertNotMasterSheet(sheetId);
  const client = buildServiceAccountClient([WRITE_SCOPE]);
  const base = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}`;

  type SheetProps = { sheetId: number; title: string; index: number };
  const meta = await call<{ sheets?: { properties: SheetProps }[] }>(client, sheetId, {
    url: `${base}?fields=sheets.properties(sheetId,title,index)`,
  });
  const existing = new Map((meta.sheets ?? []).map((s) => [s.properties.title, s.properties]));

  const missing = tabs.filter((tab) => !existing.has(tab.title));
  if (missing.length) {
    const added = await call<{ replies?: { addSheet?: { properties: SheetProps } }[] }>(client, sheetId, {
      url: `${base}:batchUpdate`,
      method: "POST",
      data: { requests: missing.map((tab) => ({ addSheet: { properties: { title: tab.title } } })) },
    });
    for (const reply of added.replies ?? []) {
      if (reply.addSheet) existing.set(reply.addSheet.properties.title, reply.addSheet.properties);
    }
  }

  // Size each tab to fit exactly (writing past the grid fails, and shrinking
  // drops leftovers from a longer earlier run), freeze and bold the header
  // row, and put the tabs in order.
  const requests: unknown[] = [];
  // A new spreadsheet comes with an empty "Sheet1"; once our tabs exist it is clutter.
  const blank = existing.get("Sheet1");
  if (blank && !tabs.some((tab) => tab.title === "Sheet1")) {
    requests.push({ deleteSheet: { sheetId: blank.sheetId } });
  }
  tabs.forEach((tab, index) => {
    const props = existing.get(tab.title)!;
    const width = Math.max(1, ...tab.rows.map((r) => r.length));
    requests.push({
      updateSheetProperties: {
        properties: {
          sheetId: props.sheetId,
          index,
          gridProperties: { rowCount: Math.max(2, tab.rows.length), columnCount: width, frozenRowCount: 1 },
        },
        fields: "index,gridProperties.rowCount,gridProperties.columnCount,gridProperties.frozenRowCount",
      },
    });
    requests.push({
      repeatCell: {
        range: { sheetId: props.sheetId, startRowIndex: 0, endRowIndex: 1 },
        cell: { userEnteredFormat: { textFormat: { bold: true } } },
        fields: "userEnteredFormat.textFormat.bold",
      },
    });
  });
  await call(client, sheetId, { url: `${base}:batchUpdate`, method: "POST", data: { requests } });

  for (const tab of tabs) {
    const quoted = `'${tab.title}'`;
    await call(client, sheetId, {
      url: `${base}/values/${encodeURIComponent(quoted)}:clear`,
      method: "POST",
      data: {},
    });
    const width = Math.max(1, ...tab.rows.map((r) => r.length));
    for (let start = 0; start < tab.rows.length; start += CHUNK_ROWS) {
      const chunk = tab.rows.slice(start, start + CHUNK_ROWS);
      const range = `${quoted}!A${start + 1}:${columnLetter(width - 1)}${start + chunk.length}`;
      await call(client, sheetId, {
        url: `${base}/values/${encodeURIComponent(range)}?valueInputOption=RAW`,
        method: "PUT",
        data: { range, majorDimension: "ROWS", values: chunk },
      });
    }
  }
}
