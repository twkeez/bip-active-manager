import { describe, expect, it } from "vitest";
import {
  resolveStrategistContacts,
  strategistDisplayName,
  type StaffProfile,
} from "@/lib/onboarding/expectation-people";

const STAFF: StaffProfile[] = [
  { full_name: "Stephanie", email: "stephanie@example.com" },
  { full_name: "Melissa", email: "melissa@example.com" },
  { full_name: "Daniel", email: "daniel@example.com" },
  // Two Tom profiles, as in live data — we cannot say which address is right.
  { full_name: "tom", email: "tom.one@example.com" },
  { full_name: "Tom", email: "tom.two@example.com" },
];

describe("resolveStrategistContacts", () => {
  // The live bug: the intro printed "Low Contact will go through it with you".
  it("treats statuses stored in the field as no strategist", () => {
    for (const value of ["Low Contact", "Website Only", "Onboarding", "Dont Know", "", null]) {
      expect(resolveStrategistContacts(value, STAFF), String(value)).toEqual([]);
    }
  });

  it("finds one strategist with their email", () => {
    expect(resolveStrategistContacts("Stephanie", STAFF)).toEqual([
      { name: "Stephanie", email: "stephanie@example.com" },
    ]);
  });

  it("splits a pair", () => {
    const contacts = resolveStrategistContacts("Melissa/Stephanie", STAFF);
    expect(contacts.map((c) => c.name)).toEqual(["Melissa", "Stephanie"]);
    expect(strategistDisplayName(contacts)).toBe("Melissa and Stephanie");
  });

  it("withholds an email when two profiles share a first name", () => {
    const tom = resolveStrategistContacts("Daniel/Tom", STAFF).find((c) => c.name === "Tom");
    expect(tom).toEqual({ name: "Tom", email: null });
  });

  it("drops someone who is not on the team, and repeats", () => {
    expect(resolveStrategistContacts("Jordan/Stephanie/stephanie", STAFF).map((c) => c.name)).toEqual([
      "Stephanie",
    ]);
  });
});

describe("strategistDisplayName", () => {
  it("reads naturally for none, one, and several", () => {
    expect(strategistDisplayName([])).toBe("");
    expect(strategistDisplayName([{ name: "Alex", email: null }])).toBe("Alex");
    expect(
      strategistDisplayName([
        { name: "A", email: null },
        { name: "B", email: null },
        { name: "C", email: null },
      ]),
    ).toBe("A, B and C");
  });
});
