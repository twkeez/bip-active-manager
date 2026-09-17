import { describe, expect, it } from "vitest";
import type { ClientExpectationsModel } from "@/lib/onboarding/load-client-expectations";
import { DEFAULT_SECTION_ORDER } from "@/lib/onboarding/document-order";
import { renderExpectationsWord } from "./expectations-word";

function model(sectionOrder: string[] = DEFAULT_SECTION_ORDER): ClientExpectationsModel {
  return {
    clientName: "The Vet's Pet Hospital of Tiburon",
    strategist: "",
    strategistContacts: [],
    town: "Tiburon",
    timeline: { kickoff: null, website: null, launchDate: null, starts: null },
    market: null,
    priorities: ["Wellness and dentistry first"],
    sectionOrder,
    note: "",
    noteHeading: "A note from your strategist",
    edits: { edited: [], hidden: [] },
    content: {
      intro: "Welcome.",
      timetable: "Weeks 1–2 — access.",
      reassure: { normal: "Rankings move.", alert: "Tell us if your phone is down." },
      checklist: [],
      glossary: [],
      closing: "That's the plan.",
      services: [],
    },
  } as unknown as ClientExpectationsModel;
}

/** The order is saved once and both renderers follow it; this is the Word half. */
describe("renderExpectationsWord", () => {
  it("prints the sections in the client's saved order", () => {
    const standard = renderExpectationsWord(model(), "");
    expect(standard.indexOf("Meeting Notes")).toBeLessThan(standard.indexOf("Your timetable"));
    expect(standard.indexOf("Your timetable")).toBeLessThan(standard.indexOf("When not to panic"));

    const moved = renderExpectationsWord(
      model(["reassure", ...DEFAULT_SECTION_ORDER.filter((key) => key !== "reassure")]),
      "",
    );
    expect(moved.indexOf("When not to panic")).toBeLessThan(moved.indexOf("Meeting Notes"));
  });

  it("prints both halves of the reassurance section", () => {
    const html = renderExpectationsWord(model(), "");
    expect(html).toContain("Normal, and not worth worrying about");
    expect(html).toContain("Tell your strategist");
    expect(html).toContain("Tell us if your phone is down.");
  });
});
