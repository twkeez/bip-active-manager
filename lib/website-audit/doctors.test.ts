import { describe, expect, it } from "vitest";
import { doctorKeys } from "@/lib/website-audit/doctors";

describe("doctorKeys", () => {
  it("joins a bare surname to the one full name ending in it", () => {
    const of = doctorKeys(["Dr. Amy Kirkpatrick", "Dr. Kirkpatrick", "Dr. Amy Kirkpatrick, DVM"]);
    expect(new Set(["Dr. Amy Kirkpatrick", "Dr. Kirkpatrick", "Dr. Amy Kirkpatrick, DVM"].map(of)).size).toBe(1);
  });

  it("keeps a surname apart when two doctors share it", () => {
    const of = doctorKeys(["Dr. Amy Smith", "Dr. John Smith", "Dr. Smith"]);
    expect(of("Dr. Smith")).toBe("smith");
    expect(of("Dr. Amy Smith")).not.toBe(of("Dr. John Smith"));
  });
});
