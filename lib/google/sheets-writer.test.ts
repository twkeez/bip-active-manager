import { describe, expect, it } from "vitest";
import { getMasterSheetId } from "@/lib/google/master-sheet-source";
import { assertNotMasterSheet, writeSheetTabs } from "@/lib/google/sheets-writer";

describe("never writing to the Master Sheet", () => {
  it("refuses the Master Sheet's id before touching Google", async () => {
    expect(() => assertNotMasterSheet(getMasterSheetId())).toThrow(/Master Sheet/);
    await expect(writeSheetTabs(getMasterSheetId(), [{ title: "Clients", rows: [["x"]] }])).rejects.toThrow(/Master Sheet/);
  });

  it("allows another sheet", () => {
    expect(() => assertNotMasterSheet("1gaFBgQBIvvhOWPg7oeP4KUa7vjKuHJhBUxg6CWCKSOk")).not.toThrow();
  });
});
