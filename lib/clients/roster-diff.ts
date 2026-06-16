import { normalizeClientName } from "@/lib/clients/normalize-name";
import type {
  RosterDiffAmbiguous,
  RosterDiffMatched,
  RosterDiffResult,
  RosterSheetRow,
} from "@/lib/clients/types";
import type { ClientRow } from "@/lib/types/client";

function buildClientNameIndex(clients: ClientRow[]) {
  const byName = new Map<string, ClientRow[]>();
  for (const client of clients) {
    const key = normalizeClientName(client.account_name);
    const bucket = byName.get(key) ?? [];
    bucket.push(client);
    byName.set(key, bucket);
  }
  return byName;
}

export function diffRoster(clients: ClientRow[], sheetRows: RosterSheetRow[]): RosterDiffResult {
  const clientByName = buildClientNameIndex(clients);
  const matchedClientIds = new Set<number>();
  const matchedSheetKeys = new Set<number>();

  const matched: RosterDiffMatched[] = [];
  const ambiguous: RosterDiffAmbiguous[] = [];
  const toAdd: RosterSheetRow[] = [];

  for (const sheetRow of sheetRows) {
    const candidates = clientByName.get(sheetRow.normalizedName) ?? [];
    if (candidates.length === 1) {
      const client = candidates[0]!;
      matched.push({ client, sheetRow });
      matchedClientIds.add(client.id);
      matchedSheetKeys.add(sheetRow.rowIndex);
    } else if (candidates.length > 1) {
      ambiguous.push({
        sheetRow,
        candidates: candidates.map((client) => ({
          client,
          normalizedName: normalizeClientName(client.account_name),
        })),
      });
      matchedSheetKeys.add(sheetRow.rowIndex);
    } else {
      toAdd.push(sheetRow);
    }
  }

  const toRemove = clients.filter((client) => !matchedClientIds.has(client.id));

  return { toAdd, toRemove, matched, ambiguous };
}

export function buildRosterDiffExportCsv(result: RosterDiffResult) {
  const lines = ["action,account_name,details"];
  const escape = (value: string) => {
    if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
    return value;
  };

  for (const row of result.toAdd) {
    lines.push(["add", escape(row.accountName), "in sheet only"].join(","));
  }
  for (const client of result.toRemove) {
    lines.push(["remove", escape(client.account_name), "in tool only"].join(","));
  }
  for (const row of result.matched) {
    lines.push(["matched", escape(row.client.account_name), "in both"].join(","));
  }
  for (const row of result.ambiguous) {
    lines.push([
      "ambiguous",
      escape(row.sheetRow.accountName),
      escape(`${row.candidates.length} possible matches`),
    ].join(","));
  }

  return lines.join("\n");
}
