import { describe, expect, it } from "vitest";
import {
  CURRENT_GOOGLE_ADS_API_VERSION,
  resolveGoogleAdsApiVersion,
} from "@/lib/ads/api-version";

describe("resolveGoogleAdsApiVersion", () => {
  // The live failure: the env said v20 and the code fell back to v21. Both were
  // retired, so every ads call returned an HTML 404 for two months.
  it("ignores a retired version rather than trusting the setting", () => {
    for (const retired of ["v19", "v20", "v21", "v14"]) {
      expect(resolveGoogleAdsApiVersion(retired), retired).toBe(CURRENT_GOOGLE_ADS_API_VERSION);
    }
  });

  it("keeps a version newer than the one we target, so a bump needs no deploy", () => {
    expect(resolveGoogleAdsApiVersion("v23")).toBe("v23");
    expect(resolveGoogleAdsApiVersion("V24")).toBe("v24");
  });

  it("uses the current version when unset or unparseable", () => {
    for (const value of ["", "   ", null, undefined, "latest", "20"]) {
      expect(resolveGoogleAdsApiVersion(value), String(value)).toBe(CURRENT_GOOGLE_ADS_API_VERSION);
    }
  });
});
