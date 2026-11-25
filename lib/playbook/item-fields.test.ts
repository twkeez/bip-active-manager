import { describe, expect, it } from "vitest";
import { pickEditableItemFields } from "@/lib/playbook/item-fields";

describe("playbook item fields", () => {
  it("keeps editable fields and drops the rest", () => {
    expect(
      pickEditableItemFields({ title: "Post weekly", sort_order: 2, id: 9, created_at: "x" }),
    ).toEqual({ title: "Post weekly", sort_order: 2 });
  });

  it("returns nothing for a body that isn't an object", () => {
    expect(pickEditableItemFields(null)).toEqual({});
    expect(pickEditableItemFields("title")).toEqual({});
  });
});
