import { describe, expect, it } from "vitest";
import {
  businessMatchesTitle,
  domainFromUrlOrHost,
  formatLocationName,
} from "@/lib/dataforseo/domain-discovery";

describe("formatLocationName", () => {
  it("formats city and state for DataForSEO location_name", () => {
    expect(formatLocationName("Grove City, OH")).toBe("Grove City,OH,United States");
    expect(formatLocationName("Seattle")).toBe("Seattle,United States");
  });
});

describe("domainFromUrlOrHost", () => {
  it("extracts hostname from urls and bare domains", () => {
    expect(domainFromUrlOrHost("https://www.example.com/about")).toBe("example.com");
    expect(domainFromUrlOrHost("allcrittersvet.com")).toBe("allcrittersvet.com");
  });
});

describe("businessMatchesTitle", () => {
  it("matches partial business names", () => {
    expect(
      businessMatchesTitle(
        "All Critters Veterinary Hospital",
        "All Critters Vet - Grove City",
      ),
    ).toBe(true);
  });
});
