import { normalizeClientName } from "@/lib/clients/normalize-name";

/**
 * The master sheet: the list of practices we actually serve.
 *
 * It answers the question the Basecamp project list cannot — whether an
 * unclaimed project belongs to a live client or to something we finished with
 * years ago. Of 53 unclaimed projects, 39 turned out to be current practices
 * whose names simply differ from Basecamp's, and only the ones absent from the
 * sheet *and* silent for a year were safe to ignore.
 *
 * Names never line up exactly. The sheet says "Volunteer Veterinary Hospital"
 * where Basecamp says "Volunteer Vet", and "Animal Medical Hospital & Urgent
 * Care (NC)" where Basecamp omits the state. So matching is fuzzy — and because
 * fuzzy matching is wrong sometimes, a match is only ever presented as a
 * suggestion. The one signal trusted to drive a decision is the absence of any
 * match at all, combined with a long silence.
 */

export type MasterSheetRow = {
  practiceName: string;
  normalizedName: string;
  url: string | null;
  city: string | null;
  state: string | null;
  packageValue: string | null;
  strategist: string | null;
};

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(cell);
      cell = "";
    } else if (c === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (c !== "\r") cell += c;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

const clean = (value: string | undefined) => {
  const trimmed = (value ?? "").trim();
  return trimmed ? trimmed : null;
};

/**
 * Reads the sheet by its column headings rather than by position — the sheet is
 * a living Google Doc with grouped headers, and columns move.
 */
export function parseMasterSheet(csv: string): MasterSheetRow[] {
  const rows = parseCsv(csv);
  const headerIndex = rows.findIndex((row) =>
    row.some((cell) => cell.trim().toLowerCase() === "practice name"),
  );
  if (headerIndex === -1) return [];

  const header = rows[headerIndex]!.map((cell) => cell.trim().toLowerCase().replace(/\s+/g, " "));
  const col = (...names: string[]) => {
    for (const name of names) {
      const index = header.indexOf(name);
      if (index !== -1) return index;
    }
    return -1;
  };
  const nameCol = col("practice name");
  const urlCol = col("url", "website");
  const cityCol = col("city");
  const stateCol = col("state");
  const packageCol = col("package");
  const strategistCol = col("strategist");

  const out: MasterSheetRow[] = [];
  const seen = new Set<string>();
  for (const row of rows.slice(headerIndex + 1)) {
    const practiceName = clean(row[nameCol]);
    if (!practiceName) continue;
    const normalizedName = normalizeClientName(practiceName);
    if (!normalizedName || seen.has(normalizedName)) continue;
    seen.add(normalizedName);
    out.push({
      practiceName,
      normalizedName,
      url: urlCol === -1 ? null : clean(row[urlCol]),
      city: cityCol === -1 ? null : clean(row[cityCol]),
      state: stateCol === -1 ? null : clean(row[stateCol]),
      packageValue: packageCol === -1 ? null : clean(row[packageCol]),
      strategist: strategistCol === -1 ? null : clean(row[strategistCol]),
    });
  }
  return out;
}

/** Words that carry no identity, plus the ones every practice shares. */
const NOISE = new Set(["the", "and", "of", "at", "in", "a", "llc", "inc", "pc", "pa", "dba", "fka"]);

/** "veterinary" and "vet" are the same word here; so are "&" and "and". */
const SYNONYMS: Record<string, string> = {
  veterinary: "vet",
  veterinarian: "vet",
  vets: "vet",
  hosp: "hospital",
  ctr: "center",
  centre: "center",
  svcs: "services",
};

export function nameTokens(value: string): Set<string> {
  return new Set(
    value
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter(Boolean)
      .map((token) => SYNONYMS[token] ?? token)
      .filter((token) => !NOISE.has(token)),
  );
}

export type MasterSheetMatch = {
  /** "exact" and "likely" both found something; "none" did not. */
  confidence: "exact" | "likely" | "none";
  row: MasterSheetRow | null;
};

/**
 * A location suffix is the difference between two real, separate practices —
 * "PetSmart Veterinary Services" and "PetSmart Veterinary Services - Smyrna"
 * are not the same clinic. A name that is a clean prefix of a longer one is
 * therefore not enough on its own.
 */
function overlap(a: Set<string>, b: Set<string>) {
  let shared = 0;
  for (const token of a) if (b.has(token)) shared++;
  const containment = shared / Math.min(a.size, b.size);
  const jaccard = shared / (a.size + b.size - shared);
  return { containment, jaccard };
}

export function matchToMasterSheet(
  projectName: string,
  sheet: MasterSheetRow[],
): MasterSheetMatch {
  const normalized = normalizeClientName(projectName);
  const exact = sheet.find((row) => row.normalizedName === normalized);
  if (exact) return { confidence: "exact", row: exact };

  const projectTokens = nameTokens(projectName);
  if (projectTokens.size === 0) return { confidence: "none", row: null };

  let best: { row: MasterSheetRow; jaccard: number } | null = null;
  for (const row of sheet) {
    const { containment, jaccard } = overlap(projectTokens, nameTokens(row.practiceName));
    // Both measures must agree. Containment alone promotes prefixes, and
    // Jaccard alone punishes the "Volunteer Vet" / "Volunteer Veterinary
    // Hospital" case that we do want to catch.
    if (containment >= 0.9 && jaccard >= 0.5 && (!best || jaccard > best.jaccard)) {
      best = { row, jaccard };
    }
  }
  return best ? { confidence: "likely", row: best.row } : { confidence: "none", row: null };
}
