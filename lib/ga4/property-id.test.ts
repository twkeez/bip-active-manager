import { describe, expect, it } from "vitest";
import { clientGa4Property, ga4PropertyNumber, ga4PropertyProblem, isGa4MeasurementId } from "@/lib/ga4/property-id";

describe("ga4PropertyNumber", () => {
  it("takes digits, with or without properties/", () => {
    expect(ga4PropertyNumber("123456789")).toBe("123456789");
    expect(ga4PropertyNumber(" properties/123456789 ")).toBe("123456789");
  });
  it("refuses measurement IDs, blanks and notes", () => {
    expect(ga4PropertyNumber("G-1TVHPD8VRN")).toBeNull();
    expect(ga4PropertyNumber("")).toBeNull();
    expect(ga4PropertyNumber(null)).toBeNull();
    expect(ga4PropertyNumber("Needs added")).toBeNull();
  });
});

describe("clientGa4Property", () => {
  it("reads ga4_property_id first, in either form", () => {
    expect(clientGa4Property({ ga4_property_id: "properties/42", ga4_id: "99" })).toBe("42");
  });
  it("falls through to ga4_id when ga4_property_id is blank or unusable", () => {
    expect(clientGa4Property({ ga4_property_id: "", ga4_id: "99" })).toBe("99");
    expect(clientGa4Property({ ga4_property_id: "G-ABC123", ga4_id: "99" })).toBe("99");
  });
  it("is null when neither is usable", () => {
    expect(clientGa4Property({ ga4_property_id: null, ga4_id: "G-ABC123" })).toBeNull();
  });
});

describe("ga4PropertyProblem", () => {
  it("names a measurement ID for what it is", () => {
    expect(isGa4MeasurementId("G-ABC123")).toBe(true);
    expect(ga4PropertyProblem({ ga4_property_id: null, ga4_id: "G-ABC123" })).toMatch(/G-ABC123 is the website's measurement ID/);
  });
  it("says when nothing is set, and nothing when it's usable", () => {
    expect(ga4PropertyProblem({ ga4_property_id: null, ga4_id: null })).toMatch(/No GA4 property is set/);
    expect(ga4PropertyProblem({ ga4_property_id: "123", ga4_id: null })).toBeNull();
  });
});
