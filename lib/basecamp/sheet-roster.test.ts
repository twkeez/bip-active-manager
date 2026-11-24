import { describe, expect, it } from "vitest";
import { duplicatePracticeNames } from "@/lib/clients/master-sheet";
import { normalizeClientName } from "@/lib/clients/normalize-name";
import { buildSheetRoster, type RosterClient, type RosterSheetRow } from "./sheet-roster";

const row = (practiceName: string, packageValue: string | null = "5.00", strategist: string | null = "Alex"): RosterSheetRow => ({
  practiceName,
  normalizedName: normalizeClientName(practiceName),
  packageValue,
  strategist,
});
const client = (id: number, account_name: string, basecamp_project_id: string | null = `p${id}`, master_sheet_name: string | null = null): RosterClient => ({
  id,
  account_name,
  basecamp_project_id,
  master_sheet_name,
});

describe("buildSheetRoster", () => {
  it("keeps only rows with a Package", () => {
    const roster = buildSheetRoster([row("Oak Vet"), row("Elm Vet", null), row("Ash Vet", "  ")], [client(1, "Oak Vet")]);
    expect(roster.counts.inScope).toBe(1);
    expect(roster.entries.map((e) => e.practiceName)).toEqual(["Oak Vet"]);
  });

  it("matches by exact name, ignoring case and punctuation", () => {
    const [entry] = buildSheetRoster([row("Dr. Poe's Veterinary Essentials")], [client(4, "dr poes veterinary essentials")]).entries;
    expect(entry).toMatchObject({ state: "ready", clientId: 4, projectId: "p4", matchedBy: "name" });
  });

  it("never matches on resemblance, but offers the look-alike", () => {
    const roster = buildSheetRoster([row("Birchwood Pet Hospital and Cat Clinic")], [client(49, "Birchwood Pet Hospital"), client(2, "Oak Vet")]);
    expect(roster.entries[0]).toMatchObject({ state: "unmatched", clientId: null });
    expect(roster.entries[0]!.candidates.map((c) => c.clientId)).toEqual([49]);
    expect(roster.counts.unmatched).toBe(1);
  });

  it("uses the sheet name saved on a client", () => {
    const [entry] = buildSheetRoster(
      [row("Birchwood Pet Hospital and Cat Clinic")],
      [client(49, "Birchwood Pet Hospital", "p49", "Birchwood Pet Hospital and Cat Clinic")],
    ).entries;
    expect(entry).toMatchObject({ state: "ready", clientId: 49, matchedBy: "saved_name" });
  });

  it("reports several clients with one name instead of picking one", () => {
    const roster = buildSheetRoster([row("Willow Animal Hospital")], [client(52, "Willow Animal Hospital"), client(57, "Willow Animal Hospital", null)]);
    expect(roster.entries[0]).toMatchObject({ state: "ambiguous", clientId: null });
    expect(roster.entries[0]!.candidates.map((c) => c.clientId)).toEqual([52, 57]);
  });

  it("lets a saved sheet name settle a shared name", () => {
    const [entry] = buildSheetRoster(
      [row("Willow Animal Hospital")],
      [client(52, "Willow Animal Hospital", "p52", "Willow Animal Hospital"), client(57, "Willow Animal Hospital", null)],
    ).entries;
    expect(entry).toMatchObject({ state: "ready", clientId: 52 });
  });

  it("flags a matched client with no Basecamp project", () => {
    const roster = buildSheetRoster([row("Oak Vet")], [client(1, "Oak Vet", "  ")]);
    expect(roster.entries[0]).toMatchObject({ state: "no_project", clientId: 1, projectId: null });
    expect(roster.counts).toMatchObject({ ready: 0, noProject: 1 });
  });

  it("notes practices that share one Basecamp project", () => {
    const roster = buildSheetRoster(
      [row("Maple Veterinary Clinic"), row("Animal ER of Mapleton"), row("Oak Vet")],
      [client(20, "Maple Veterinary Clinic", "p-shared"), client(18, "Animal ER of Mapleton", "p-shared"), client(1, "Oak Vet")],
    );
    expect(roster.entries[0]!.sharesProjectWith).toEqual(["Animal ER of Mapleton"]);
    expect(roster.entries[2]!.sharesProjectWith).toEqual([]);
    expect(roster.counts.ready).toBe(3);
  });

  it("lists rows with no real strategist", () => {
    const roster = buildSheetRoster([row("Oak Vet", "1.00", "NEED"), row("Elm Vet", "1.00", null), row("Ash Vet", "1.00", "Daniel/Tom")], []);
    expect(roster.needsStrategist).toEqual(["Oak Vet", "Elm Vet"]);
  });

  it("a client with a saved sheet name answers to that name only", () => {
    const roster = buildSheetRoster([row("Oak Vet"), row("Oak Veterinary West")], [client(1, "Oak Vet", "p1", "Oak Veterinary West")]);
    expect(roster.entries.map((e) => e.state)).toEqual(["unmatched", "ready"]);
  });

  it("every in-scope row is accounted for", () => {
    const roster = buildSheetRoster(
      [row("A Vet"), row("B Vet"), row("C Vet"), row("D Vet")],
      [client(1, "A Vet"), client(2, "B Vet", null), client(3, "C Vet"), client(4, "C Vet")],
    );
    const { inScope, ready, noProject, unmatched, ambiguous } = roster.counts;
    expect(ready + noProject + unmatched + ambiguous).toBe(inScope);
    expect(roster.counts).toEqual({ inScope: 4, ready: 1, noProject: 1, unmatched: 1, ambiguous: 1 });
  });
});

describe("duplicatePracticeNames", () => {
  it("names practices that appear on more than one row", () => {
    const grid = [["", ""], ["Practice Name", "Package"], ["Oak Vet", "5"], ["Elm Vet", ""], ["oak vet", "3"], ["", ""]];
    expect(duplicatePracticeNames(grid)).toEqual(["oak vet"]);
    expect(duplicatePracticeNames(grid.slice(0, 4))).toEqual([]);
  });
});

describe("projects more than one client points at", () => {
  it("is fine when each client is its own roster practice", () => {
    const roster = buildSheetRoster(
      [row("Maple Veterinary Clinic"), row("Animal ER of Mapleton")],
      [client(20, "Maple Veterinary Clinic", "p-shared"), client(18, "Animal ER of Mapleton", "p-shared")],
    );
    expect(roster.sharedProjects).toEqual([
      {
        projectId: "p-shared",
        kind: "shared",
        claimants: [
          { clientId: 18, clientName: "Animal ER of Mapleton", practiceName: "Animal ER of Mapleton" },
          { clientId: 20, clientName: "Maple Veterinary Clinic", practiceName: "Maple Veterinary Clinic" },
        ],
      },
    ]);
  });

  it("is a problem when one of them is not a roster client", () => {
    const roster = buildSheetRoster([row("Oak Vet")], [client(72, "Oak Vet", "p9"), client(355, "Oak", "p9"), client(5, "Elm Vet", "p5")]);
    expect(roster.sharedProjects).toHaveLength(1);
    expect(roster.sharedProjects[0]).toMatchObject({ projectId: "p9", kind: "problem" });
    expect(roster.sharedProjects[0]!.claimants.map((c) => c.practiceName)).toEqual(["Oak Vet", null]);
  });

  it("is reported even when neither client is on the roster", () => {
    const roster = buildSheetRoster([], [client(52, "Willow Animal Hospital", "p1"), client(57, "Willow Animal Hospital", "p1")]);
    expect(roster.sharedProjects.map((p) => p.kind)).toEqual(["problem"]);
  });
});
