import { describe, expect, it } from "vitest";
import type { ClientExpectationsModel } from "@/lib/onboarding/load-client-expectations";
import { DEFAULT_SECTION_ORDER } from "@/lib/onboarding/document-order";
import {
  applyDocumentEdits,
  canHide,
  competitorKey,
  isValidSectionKey,
  parseChecklistLines,
  SECTION_ORDER_KEY,
  serviceKey,
} from "./document-edits";

function model(): ClientExpectationsModel {
  return {
    clientName: "The Vet's Pet Hospital of Tiburon",
    strategist: "",
    strategistContacts: [],
    town: "Tiburon",
    timeline: {
      kickoff: { label: "Started", date: "Sep 16, 2026" },
      website: "A simple splash page goes up early.",
      launchDate: null,
      starts: "Google Ads begins when your splash page goes live.",
    },
    market: {
      snapshot: "Tiburon is a small peninsula community.",
      landscape: "Searches pull from across Marin County.",
      competitors: [
        { name: "Alto Tiburon Veterinary Hospital", location: "Mill Valley, CA", description: "Since 1974." },
        { name: "Harbor Veterinary Services", location: "Sausalito, CA", description: "On Harbor Drive." },
      ],
    },
    priorities: [],
    sectionOrder: DEFAULT_SECTION_ORDER,
    note: "",
    noteHeading: "A note from your strategist",
    edits: { edited: [], hidden: [] },
    content: {
      intro: "Welcome.",
      timetable: "Weeks 1–2 — access.",
      reassure: { normal: "Rankings move.", alert: "Tell us if your phone is down." },
      closing: "That's the plan.",
      checklist: [{ text: "Access to your Google Business Profile", serviceLabel: "SEO" }],
      glossary: [{ id: 1, term: "Map Pack", definition: "The three results.", services: [], sortOrder: 1 }],
      services: [
        { key: "seo", label: "SEO", planLabel: "Premium", expect: "Standard SEO.", limits: "No guarantees.", need: "", recommend: "Rec." },
      ],
    },
  } as ClientExpectationsModel;
}

describe("section keys", () => {
  it("accepts the places a document can be edited and nothing else", () => {
    for (const key of ["intro", "plan.timing", "checklist", "market", "glossary", serviceKey("seo", "expect"), competitorKey("Alto Tiburon Veterinary Hospital")]) {
      expect(isValidSectionKey(key)).toBe(true);
    }
    for (const key of ["", "clientName", "service:seo:need", "service:gym:expect", "plan.kickoff"]) {
      expect(isValidSectionKey(key)).toBe(false);
    }
  });

  // Kickoff, tiers and the strategist come from the client's records; changing
  // them in the document would let the two drift apart.
  it("does not offer to hide the facts at the top", () => {
    expect(canHide("plan.timing")).toBe(false);
    expect(canHide("intro")).toBe(false);
  });
});

describe("applyDocumentEdits", () => {
  it("saves a section order without counting it as reworded text", () => {
    const reordered = ["checklist", ...DEFAULT_SECTION_ORDER.filter((key) => key !== "checklist")];
    const { model: edited, edited: keys } = applyDocumentEdits(model(), [
      { sectionKey: SECTION_ORDER_KEY, body: reordered.join("\n"), hidden: false },
    ]);
    expect(edited.sectionOrder).toEqual(reordered);
    expect(keys).toEqual([]);
  });

  it("leaves the reassurance section out when it is hidden", () => {
    const { model: edited, hidden } = applyDocumentEdits(model(), [
      { sectionKey: "reassure", body: null, hidden: true },
    ]);
    expect(edited.content.reassure).toEqual({ normal: "", alert: "" });
    expect(hidden).toEqual(["reassure"]);
  });


  it("fills in the client's priorities, one per line, pasted bullets removed", () => {
    const { model: edited, edited: keys } = applyDocumentEdits(model(), [
      { sectionKey: "priorities", body: "- Wellness\n\n• Dentistry\n  Online booking through Vello  ", hidden: false },
    ]);
    expect(edited.priorities).toEqual(["Wellness", "Dentistry", "Online booking through Vello"]);
    expect(keys).toEqual(["priorities"]);
    expect(canHide("priorities")).toBe(false);
  });

  it("replaces text for that client and reports what was edited", () => {
    const { model: edited, edited: keys } = applyDocumentEdits(model(), [
      { sectionKey: "plan.timing", body: "Ads start with the splash page; SEO with the full site.", hidden: false },
      { sectionKey: serviceKey("seo", "expect"), body: "Tailored SEO for Tiburon.", hidden: false },
    ]);
    expect(edited.timeline.starts).toBe("Ads start with the splash page; SEO with the full site.");
    expect(edited.content.services[0].expect).toBe("Tailored SEO for Tiburon.");
    expect(keys).toEqual(["plan.timing", "service:seo:expect"]);
  });

  it("never changes the model it was given", () => {
    const source = model();
    applyDocumentEdits(source, [
      { sectionKey: "intro", body: "Changed.", hidden: false },
      { sectionKey: competitorKey("Harbor Veterinary Services"), body: null, hidden: true },
    ]);
    expect(source.content.intro).toBe("Welcome.");
    expect(source.market!.competitors).toHaveLength(2);
  });

  it("removes hidden sections for printing", () => {
    const { model: printed, hidden } = applyDocumentEdits(model(), [
      { sectionKey: competitorKey("Harbor Veterinary Services"), body: null, hidden: true },
      { sectionKey: "glossary", body: null, hidden: true },
    ]);
    expect(printed.market!.competitors.map((c) => c.name)).toEqual(["Alto Tiburon Veterinary Hospital"]);
    expect(printed.content.glossary).toEqual([]);
    expect(hidden).toEqual([competitorKey("Harbor Veterinary Services"), "glossary"]);
  });

  // The editor shows hidden sections greyed out, with a way to bring them back.
  it("keeps hidden sections in place for the editor", () => {
    const { model: forEditor, hidden } = applyDocumentEdits(
      model(),
      [{ sectionKey: "market", body: null, hidden: true }],
      { keepHidden: true },
    );
    expect(forEditor.market).not.toBeNull();
    expect(hidden).toEqual(["market"]);
  });

  it("clears the timing line when it is edited to nothing", () => {
    const { model: edited } = applyDocumentEdits(model(), [{ sectionKey: "plan.timing", body: "  ", hidden: false }]);
    expect(edited.timeline.starts).toBeNull();
  });

  it("ignores an edit for a practice or service that is no longer there", () => {
    const { edited } = applyDocumentEdits(model(), [
      { sectionKey: competitorKey("A Practice From Old Research"), body: "x", hidden: false },
      { sectionKey: serviceKey("ppc", "expect"), body: "x", hidden: false },
    ]);
    expect(edited).toEqual([]);
  });
});

describe("parseChecklistLines", () => {
  it("makes one item per line and drops pasted bullets and checkboxes", () => {
    expect(parseChecklistLines("- Access to GBP\n☐ Billing details\n\n  [ ] Service areas  ").map((i) => i.text)).toEqual([
      "Access to GBP",
      "Billing details",
      "Service areas",
    ]);
  });
});
