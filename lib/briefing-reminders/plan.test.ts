import { describe, expect, it } from "vitest";
import { cadenceFor, includedInRun, planRun, slotForDate, upcomingRuns, type PlanClient } from "./plan";

describe("slotForDate", () => {
  it("knows the first and third Mondays", () => {
    expect(slotForDate(2026, 10, 5)).toBe("first"); // Mon 5 Oct 2026
    expect(slotForDate(2026, 10, 19)).toBe("third"); // Mon 19 Oct 2026
    expect(slotForDate(2026, 10, 12)).toBeNull(); // second Monday
    expect(slotForDate(2026, 10, 26)).toBeNull(); // fourth Monday
    expect(slotForDate(2026, 10, 6)).toBeNull(); // a Tuesday
    expect(slotForDate(2026, 6, 1)).toBe("first"); // Monday the 1st counts
  });
});

describe("upcomingRuns", () => {
  it("lists the next first and third Mondays from a Saturday", () => {
    expect(upcomingRuns(new Date("2026-09-26T16:00:00Z"))).toEqual([
      { date: "2026-10-05", slot: "first" },
      { date: "2026-10-19", slot: "third" },
    ]);
  });

  it("counts today before 8am Eastern, not after", () => {
    // 7am EDT on Monday 5 Oct = 11:00 UTC; 9am EDT = 13:00 UTC.
    expect(upcomingRuns(new Date("2026-10-05T11:00:00Z"), 1)).toEqual([{ date: "2026-10-05", slot: "first" }]);
    expect(upcomingRuns(new Date("2026-10-05T13:00:00Z"), 1)).toEqual([{ date: "2026-10-19", slot: "third" }]);
  });
});

describe("cadence", () => {
  it("reminds Low Contact clients on the first Monday only", () => {
    expect(includedInRun(cadenceFor(true), "first")).toBe(true);
    expect(includedInRun(cadenceFor(true), "third")).toBe(false);
    expect(includedInRun(cadenceFor(false), "third")).toBe(true);
  });
});

describe("planRun", () => {
  const staff = [
    { full_name: "Stephanie Smith", email: "stephanie@beyondindigo.com" },
    { full_name: "Melissa Jones", email: "melissa@beyondindigo.com" },
    { full_name: "Tom Keez", email: "tom@beyondindigo.com" },
    { full_name: "Tom Other", email: "tom2@beyondindigo.com" },
  ];
  const client = (overrides: Partial<PlanClient>): PlanClient => ({
    id: 1,
    accountName: "Paws",
    marketingStrategist: "Stephanie",
    isLowContact: false,
    basecampProjectId: "123",
    ignoredReason: null,
    ...overrides,
  });

  it("sends to the strategist, and to both when two are named", () => {
    const { reminders } = planRun(
      [client({}), client({ id: 2, accountName: "Bayside", marketingStrategist: "Melissa/Stephanie" })],
      staff,
      "first",
    );
    expect(reminders.map((r) => r.to.map((t) => t.email))).toEqual([
      ["melissa@beyondindigo.com", "stephanie@beyondindigo.com"],
      ["stephanie@beyondindigo.com"],
    ]);
    expect(reminders.every((r) => !r.toFallback && r.warnings.length === 0)).toBe(true);
  });

  it("falls back to Tom, saying why, when nobody on file can be emailed", () => {
    const { reminders } = planRun(
      [
        client({ id: 1, accountName: "A", marketingStrategist: "Low Contact", isLowContact: true }),
        client({ id: 2, accountName: "B", marketingStrategist: null }),
        client({ id: 3, accountName: "C", marketingStrategist: "Tom" }),
      ],
      staff,
      "first",
    );
    expect(reminders.every((r) => r.toFallback && r.to[0].email === "tom@beyondindigo.com")).toBe(true);
    expect(reminders.map((r) => r.warnings[0])).toEqual([
      'Strategist field says "Low Contact", not a teammate.',
      "No strategist on file.",
      '"Tom" matches more than one teammate.',
    ]);
  });

  it("leaves Low Contact clients out of the third-Monday run", () => {
    const { reminders } = planRun([client({ isLowContact: true })], staff, "third");
    expect(reminders).toEqual([]);
  });

  it("leaves out clients whose Basecamp project is not tracked", () => {
    const { reminders, leftOut } = planRun([client({ ignoredReason: "No longer a client" })], staff, "first");
    expect(reminders).toEqual([]);
    expect(leftOut[0].reason).toContain("No longer a client");
  });

  it("flags a Low Contact label without the Low Contact flag, and a missing project", () => {
    const { reminders } = planRun(
      [client({ marketingStrategist: "Low Contact", isLowContact: false, basecampProjectId: null })],
      staff,
      "third",
    );
    expect(reminders[0].warnings).toHaveLength(3);
  });
});
