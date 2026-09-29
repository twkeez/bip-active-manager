import { describe, expect, it } from "vitest";
import { isoDate, itemFields, optionalText, requiredText, todayEastern } from "./validate";

describe("Poobah input checks", () => {
  it("refuses empty or oversized text instead of saving it", () => {
    expect(() => requiredText("  ", "status", 10)).toThrow("status is required.");
    expect(() => requiredText("x".repeat(11), "status", 10)).toThrow("too long");
    expect(requiredText("  On track ", "status", 10)).toBe("On track");
    expect(optionalText("", "owner", 10)).toBeNull();
  });

  it("accepts only real YYYY-MM-DD dates", () => {
    expect(isoDate("2026-09-29", "date")).toBe("2026-09-29");
    expect(() => isoDate("9/29/2026", "date")).toThrow("YYYY-MM-DD");
    expect(() => isoDate("2026-02-30", "date")).toThrow("not a real date");
  });

  it("refuses unknown item fields so a typo cannot pass as a save", () => {
    expect(() => itemFields({ titel: "x" })).toThrow("Unknown field: titel");
    expect(() => itemFields({})).toThrow("Nothing to change");
    expect(() => itemFields({ done: "yes" })).toThrow("done must be true or false.");
    expect(itemFields({ done: true, owner: "", due_date: null })).toEqual({ done: true, owner: null, due_date: null });
  });

  it("dates the log in Eastern time", () => {
    expect(todayEastern(new Date("2026-09-30T02:00:00Z"))).toBe("2026-09-29");
  });
});
