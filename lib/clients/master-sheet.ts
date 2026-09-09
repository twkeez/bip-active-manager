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
  return parseMasterSheetRows(parseCsv(csv));
}

/**
 * The same reading, from rows rather than CSV text — the Sheets API hands back
 * a grid directly, and round-tripping it through CSV only adds a way to get
 * quoting wrong.
 */
export function parseMasterSheetRows(rows: string[][]): MasterSheetRow[] {
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
  /**
   * The closest thing on the sheet when nothing matched.
   *
   * A wrong match is visible and gets rejected; a *missed* one is silent, and
   * it puts a live client in the group that gets ignored in bulk. Live data
   * had two: "Robert Santos" against the sheet's "Rob Santos", and a bare
   * "PetSmart Veterinary Services" against its Smyrna entry.
   */
  nearest: { row: MasterSheetRow; score: number } | null;
};

/**
 * Words every practice shares. What is left after removing them is the part
 * that identifies a specific business — "volunteer", "petsmart", "dominion".
 */
const GENERIC = new Set([
  "vet", "animal", "pet", "hospital", "clinic", "center", "care", "services",
  "service", "medical", "urgent", "emergency", "surgery", "surgical", "practice",
  "group", "specialists", "specialist", "veterinarians", "health", "wellness",
  "referral", "companion", "family", "home", "mobile",
]);

/** "(CA)", "(NC)" — a state tag is a note, not a different practice. */
const STATE_CODE = /^[a-z]{2}$/;
const STATES = new Set([
  "al","ak","az","ar","ca","co","ct","de","fl","ga","hi","id","il","in","ia","ks",
  "ky","la","me","md","ma","mi","mn","ms","mo","mt","ne","nv","nh","nj","nm","ny",
  "nc","nd","oh","ok","or","pa","ri","sc","sd","tn","tx","ut","vt","va","wa","wv",
  "wi","wy","dc",
]);

/** Parentheticals are notes — "(OLD)", "(previously Bitterroot)", "(NC)". */
function stripParentheticals(value: string) {
  return value.replace(/\([^)]*\)/g, " ");
}

function distinctiveTokens(value: string) {
  const out = new Set<string>();
  for (const token of nameTokens(stripParentheticals(value))) {
    if (GENERIC.has(token)) continue;
    if (STATE_CODE.test(token) && STATES.has(token)) continue;
    out.add(token);
  }
  return out;
}

function setsEqual(a: Set<string>, b: Set<string>) {
  if (a.size !== b.size) return false;
  for (const value of a) if (!b.has(value)) return false;
  return true;
}

export function matchToMasterSheet(
  projectName: string,
  sheet: MasterSheetRow[],
): MasterSheetMatch {
  const normalized = normalizeClientName(projectName);
  const exact = sheet.find((row) => row.normalizedName === normalized);
  if (exact) return { confidence: "exact", row: exact, nearest: null };

  const projectCore = distinctiveTokens(projectName);
  const projectAll = nameTokens(stripParentheticals(projectName));
  if (projectAll.size === 0) return { confidence: "none", row: null, nearest: null };

  let nearest: { row: MasterSheetRow; score: number } | null = null;

  for (const row of sheet) {
    const sheetCore = distinctiveTokens(row.practiceName);

    // The identifying part has to be the same on both sides. A strict subset is
    // not enough, and that is the whole point: "PetSmart Veterinary Services"
    // sits inside "PetSmart Veterinary Services - Smyrna", and "Paws" sits
    // inside "Happy Paws & Claws", but each pair is two different businesses.
    if (projectCore.size > 0 && setsEqual(projectCore, sheetCore)) {
      return { confidence: "likely", row, nearest: null };
    }

    // Some names are entirely generic once trimmed — "Animal Medical Hospital &
    // Urgent Care" keeps nothing. There, fall back to whole-name similarity.
    if (projectCore.size === 0 && sheetCore.size === 0) {
      const sheetAll = nameTokens(stripParentheticals(row.practiceName));
      let shared = 0;
      for (const token of projectAll) if (sheetAll.has(token)) shared++;
      const jaccard = shared / (projectAll.size + sheetAll.size - shared);
      if (jaccard >= 0.8) return { confidence: "likely", row, nearest: null };
    }

    const sheetAll = nameTokens(stripParentheticals(row.practiceName));
    let shared = 0;
    for (const token of projectAll) if (sheetAll.has(token)) shared++;
    const score = shared / (projectAll.size + sheetAll.size - shared);
    if (score > 0.3 && (!nearest || score > nearest.score)) nearest = { row, score };
  }

  return { confidence: "none", row: null, nearest };
}
