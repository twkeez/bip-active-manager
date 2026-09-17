import { describe, expect, it } from "vitest";
import { suggestAccounts, type AdsAccount } from "./list-accounts";

const account = (name: string, customerId: string, status = "ENABLED"): AdsAccount => ({
  customerId,
  name,
  status,
  isManager: false,
});

describe("suggestAccounts", () => {
  const accounts = [
    account("Harmony Animal Hospital", "111-111-1111"),
    account("Harmony Animal Hospital - Urgent Care", "222-222-2222"),
    account("Switzer Veterinary Clinic", "333-333-3333"),
    account("Old Mill Vet", "444-444-4444", "CANCELED"),
  ];

  it("puts an exact name first", () => {
    expect(suggestAccounts("Harmony Animal Hospital", accounts)[0].customerId).toBe("111-111-1111");
  });

  it("offers both when a group shares a name", () => {
    const ids = suggestAccounts("Harmony Animal Hospital", accounts).map((a) => a.customerId);
    expect(ids).toContain("222-222-2222");
  });

  // "Veterinary Clinic" is half the roster; a match cannot rest on it.
  it("does not match on words every practice shares", () => {
    expect(suggestAccounts("Riverside Veterinary Clinic", accounts)).toEqual([]);
  });

  it("still offers a cancelled account, but not first", () => {
    const suggestions = suggestAccounts("Old Mill Vet", accounts);
    expect(suggestions.map((a) => a.customerId)).toContain("444-444-4444");
  });

  it("returns nothing rather than a guess", () => {
    expect(suggestAccounts("Somewhere Else Entirely", accounts)).toEqual([]);
  });
});
