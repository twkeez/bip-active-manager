import { describe, expect, it } from "vitest";
import {
  checkResearchLocation,
  describeLocation,
  locationInstruction,
  researchLocationFor,
  statesNamedIn,
} from "./research-location";

const remedy = { city: "Parkville", state: "MD", street_address: "9512 Harford Rd", zip: "21234" };

describe("research location", () => {
  it("builds the full location with the state spelled out", () => {
    const result = researchLocationFor(remedy, "Baltimore County");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(describeLocation(result.location)).toBe("9512 Harford Rd, Parkville, MD 21234 (Baltimore County, Maryland, USA)");
    expect(locationInstruction(result.location)).toContain("Parkville, Maryland (MD), USA");
    expect(locationInstruction(result.location)).toContain("ignore them entirely");
  });

  it("refuses to research a town with no state", () => {
    const result = researchLocationFor({ city: "Parkville" });
    expect(result).toMatchObject({ ok: false });
    if (!result.ok) expect(result.error).toContain("state");
  });

  it("reads an older 'Town, ST' city and rejects a bad state code", () => {
    const result = researchLocationFor({ city: "Marietta, GA" });
    expect(result.ok && result.location.state).toBe("GA");
    expect(researchLocationFor({ city: "Marietta", state: "XX" })).toMatchObject({ ok: false });
  });

  it("finds states by name and by code", () => {
    expect([...statesNamedIn("Parkville, MO sits in the Kansas City Northland")].sort()).toEqual(["KS", "MO"]);
    expect([...statesNamedIn("Taylor Animal Hospital (Parkville, MO 64152)")]).toEqual(["MO"]);
    expect([...statesNamedIn("Serving Baltimore County, Maryland")]).toEqual(["MD"]);
    expect([...statesNamedIn("A practice on Washington Blvd")]).toEqual([]);
  });

  it("flags Missouri research for a Maryland client, and passes Maryland research", () => {
    const result = researchLocationFor(remedy);
    if (!result.ok) throw new Error("expected a location");
    const missouri = checkResearchLocation(
      [
        { where: "the market snapshot", text: "Parkville, Missouri is an affluent Kansas City Northland suburb with high pet ownership." },
        { where: "competitor 1", text: "Taylor Animal Hospital of Parkville (Parkville, MO)" },
      ],
      result.location,
    );
    expect(missouri.map((p) => p.where)).toEqual(["the market snapshot", "competitor 1"]);
    expect(missouri[0].found).toContain("Missouri");

    const maryland = checkResearchLocation(
      [
        { where: "the market snapshot", text: "Parkville, Maryland in Baltimore County has dense suburban pet ownership." },
        { where: "competitor 1", text: "Carney Animal Hospital (Parkville, MD)" },
        { where: "competitor 2", text: "Near the Pennsylvania line but based in Bel Air, MD" },
      ],
      result.location,
    );
    expect(maryland).toEqual([]);
  });
});
