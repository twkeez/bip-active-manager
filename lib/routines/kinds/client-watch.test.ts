import { describe, expect, it } from "vitest";
import { readSettings } from "./client-watch";

describe("client watch settings", () => {
  it("keeps whole client ids, without repeats", () => {
    expect(readSettings({ clientIds: [3, 3, 9, "12", -1, null] })).toMatchObject({ clientIds: [3, 9, 12] });
  });

  it("watches nothing rather than guessing when the list is missing", () => {
    expect(readSettings({})).toMatchObject({ clientIds: [] });
  });

  it("includes watch items unless they are switched off", () => {
    expect(readSettings({}).includeWatchItems).toBe(true);
    expect(readSettings({ includeWatchItems: false }).includeWatchItems).toBe(false);
  });
});
