import { describe, expect, it } from "vitest";
import {
  DEFAULT_SECTION_ORDER,
  isSameSectionOrder,
  moveSection,
  parseSectionOrder,
  serialiseSectionOrder,
} from "./document-order";

describe("parseSectionOrder", () => {
  it("keeps a saved order", () => {
    const saved = serialiseSectionOrder(["checklist", ...DEFAULT_SECTION_ORDER.filter((k) => k !== "checklist")]);
    expect(parseSectionOrder(saved)[0]).toBe("checklist");
  });

  it("falls back to the standard order when nothing is saved", () => {
    expect(parseSectionOrder(null)).toEqual(DEFAULT_SECTION_ORDER);
    expect(parseSectionOrder("")).toEqual(DEFAULT_SECTION_ORDER);
    expect(isSameSectionOrder(parseSectionOrder(""))).toBe(true);
  });

  // A client who reordered their document before a section existed should not
  // have the new section printed last, where an intro would read as a footnote.
  it("puts a section saved orders predate back where it normally sits", () => {
    const before = ["note", "intro", "checklist", "timetable", "market", "services", "glossary", "closing"];
    const order = parseSectionOrder(before.join("\n"));
    expect(order).toContain("reassure");
    expect(order.indexOf("reassure")).toBe(order.indexOf("services") + 1);
    // A new section follows whichever section it normally follows — here the
    // note, which this client moved to the top — not the end of the document.
    expect(order.indexOf("priorities")).toBe(order.indexOf("note") + 1);
    expect(order.slice(0, 1)).toEqual(["note"]);
  });

  it("ignores sections that no longer exist, and repeats", () => {
    const order = parseSectionOrder("closing\nchecklist\nchecklist\nwhatever");
    expect(order.indexOf("closing")).toBeLessThan(order.indexOf("checklist"));
    expect(order.filter((key) => key === "checklist")).toHaveLength(1);
    expect(order).not.toContain("whatever");
    expect([...order].sort()).toEqual([...DEFAULT_SECTION_ORDER].sort());
  });
});

describe("the house order", () => {
  // /client-expectations sets the order for everyone; a client's own order is
  // completed from it, so a section nobody has moved lands where the house
  // puts it, not where the app shipped it.
  it("completes a client's order from the house order", () => {
    const house = ["reassure", ...DEFAULT_SECTION_ORDER.filter((key) => key !== "reassure")];
    const client = parseSectionOrder("checklist\nintro", house);
    // The client asked for the checklist first, so a section they never moved
    // does not push past it — but it still sits where the house puts it.
    expect(client[0]).toBe("checklist");
    expect(client.indexOf("reassure")).toBeLessThan(client.indexOf("intro"));
    expect(isSameSectionOrder(client, house)).toBe(false);
    expect(isSameSectionOrder(parseSectionOrder(null, house), house)).toBe(true);
  });
});

describe("moveSection", () => {
  it("moves one place, and stops at the ends", () => {
    expect(moveSection(["a", "b", "c"], "c", "up")).toEqual(["a", "c", "b"]);
    expect(moveSection(["a", "b", "c"], "a", "down")).toEqual(["b", "a", "c"]);
    expect(moveSection(["a", "b", "c"], "a", "up")).toEqual(["a", "b", "c"]);
    expect(moveSection(["a", "b", "c"], "c", "down")).toEqual(["a", "b", "c"]);
    expect(moveSection(["a", "b"], "gone", "up")).toEqual(["a", "b"]);
  });
});
