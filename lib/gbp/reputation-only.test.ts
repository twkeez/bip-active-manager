import { describe, expect, it } from "vitest";
import { isReputationClient } from "./reputation-only";

describe("isReputationClient", () => {
  it("refreshes only clients that have ORM", () => {
    expect(isReputationClient("Premium")).toBe(true);
    expect(isReputationClient("Foundation")).toBe(true);
    expect(isReputationClient("N")).toBe(false);
    expect(isReputationClient("")).toBe(false);
    expect(isReputationClient(null)).toBe(false);
  });
});
