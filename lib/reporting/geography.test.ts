import { describe, expect, it } from "vitest";
import { geographyNote, reportGeography, stateName } from "./geography";

const row = (city: string, region: string, sessions = 10) => ({ city, region, sessions, users: sessions });

describe("stateName", () => {
  it("turns a two-letter code into GA4's region name", () => {
    expect(stateName("pa")).toBe("Pennsylvania");
    expect(stateName("Pennsylvania")).toBe("Pennsylvania");
    expect(stateName("")).toBeNull();
    expect(stateName("ZZ")).toBeNull();
  });
});

describe("reportGeography", () => {
  const rows = [
    row("Philadelphia", "Pennsylvania", 120),
    row("Ashburn", "Virginia", 40),
    row("Singapore", "(not set)", 30),
    row("(not set)", "Pennsylvania", 12),
  ];

  it("keeps only the client's state and names unknown cities", () => {
    const geo = reportGeography(rows, "PA");
    expect(geo.rows.map((r) => r.location)).toEqual(["Philadelphia", "Unknown city, Pennsylvania"]);
    expect(geo.leftOut).toBe(2);
    expect(geographyNote(geo)).toContain("Pennsylvania");
  });

  it("uses the region most visits came from when the client has no state on file", () => {
    const geo = reportGeography(rows, null);
    expect(geo.state).toBe("Pennsylvania");
    expect(geo.stateSource).toBe("traffic");
    expect(geo.rows.map((r) => r.location)).toEqual(["Philadelphia", "Unknown city, Pennsylvania"]);
    expect(geographyNote(geo)).toContain("where most of the site's visits come from");
  });

  it("shows every location when no region is known at all", () => {
    const geo = reportGeography([row("Singapore", "(not set)"), row("(not set)", "(not set)")], null);
    expect(geo.state).toBeNull();
    expect(geo.rows.map((r) => r.location)).toEqual(["Singapore", "Location not available"]);
    expect(geographyNote(geo)).toBeNull();
  });
});
