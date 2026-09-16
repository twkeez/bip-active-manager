import type { ClientExpectationsModel } from "@/lib/onboarding/load-client-expectations";

/**
 * A client's own edits to their document, laid over the standard version.
 *
 * Applied to the model rather than inside either renderer, so the PDF and the
 * Word file cannot disagree about what was edited. Section keys are stable
 * names for places in the document — never positions, which move when research
 * is re-run or a service is added.
 *
 * The strategist note is not here: it has always lived on the client record,
 * and the editor writes it there.
 */

export type DocumentEdit = {
  sectionKey: string;
  /** Replacement text; null when the edit only hides the section. */
  body: string | null;
  hidden: boolean;
};

/** Sections whose text can be replaced. An empty replacement prints nothing. */
const TEXT_KEYS = new Set([
  "intro",
  "priorities",
  "plan.website",
  "plan.timing",
  "checklist",
  "timetable",
  "market.snapshot",
  "market.landscape",
  "closing",
]);

/** Sections that can be left out altogether. */
const HIDEABLE_KEYS = new Set(["checklist", "timetable", "market", "glossary"]);

const SERVICE_FIELD = /^service:(seo|ppc|smm|blog|orm):(expect|limits|recommend)$/;
const COMPETITOR = /^market\.competitor:(.{1,200})$/;

export const MAX_EDIT_LENGTH = 10_000;

export function competitorKey(name: string): string {
  return `market.competitor:${name}`;
}

export function serviceKey(service: string, field: "expect" | "limits" | "recommend"): string {
  return `service:${service}:${field}`;
}

export function canEditText(sectionKey: string): boolean {
  return TEXT_KEYS.has(sectionKey) || SERVICE_FIELD.test(sectionKey) || COMPETITOR.test(sectionKey);
}

export function canHide(sectionKey: string): boolean {
  return HIDEABLE_KEYS.has(sectionKey) || COMPETITOR.test(sectionKey);
}

export function isValidSectionKey(sectionKey: string): boolean {
  return canEditText(sectionKey) || canHide(sectionKey);
}

/**
 * "What we need from you" is a list, edited as one item per line. Bullets and
 * checkboxes people paste in are stripped rather than printed twice.
 */
export function parseChecklistLines(body: string) {
  return body
    .split("\n")
    .map((line) => line.replace(/^\s*(?:[-*•☐]|\[\s?\])\s*/, "").trim())
    .filter(Boolean)
    .map((text) => ({ text, serviceLabel: "" }));
}

/**
 * "Meeting Notes" — what the client told us they want, one item per line.
 * The same pasted-bullet stripping as the checklist.
 */
export function parsePriorityLines(body: string): string[] {
  return parseChecklistLines(body).map((item) => item.text);
}

export function checklistToLines(items: Array<{ text: string }>): string {
  return items.map((item) => item.text).join("\n");
}

export type AppliedEdits = {
  model: ClientExpectationsModel;
  /** Sections whose text differs from the standard version. */
  edited: string[];
  hidden: string[];
};

/**
 * Lays the edits over the model. With keepHidden, hidden sections stay in the
 * model so the editor can show them greyed out with a way back; for printing
 * they are removed.
 */
export function applyDocumentEdits(
  source: ClientExpectationsModel,
  edits: DocumentEdit[],
  { keepHidden = false }: { keepHidden?: boolean } = {},
): AppliedEdits {
  // Copy only what can change, so the loaded model is never mutated.
  const model: ClientExpectationsModel = {
    ...source,
    timeline: { ...source.timeline },
    priorities: [...source.priorities],
    market: source.market ? { ...source.market, competitors: source.market.competitors.map((c) => ({ ...c })) } : null,
    content: {
      ...source.content,
      services: source.content.services.map((service) => ({ ...service })),
      checklist: [...source.content.checklist],
      glossary: [...source.content.glossary],
    },
  };
  const edited: string[] = [];
  const hidden: string[] = [];

  for (const edit of edits) {
    const key = edit.sectionKey;
    if (!isValidSectionKey(key)) continue;

    if (edit.body !== null && canEditText(key)) {
      const body = edit.body;
      let applied = true;
      const competitor = COMPETITOR.exec(key);
      const service = SERVICE_FIELD.exec(key);
      if (key === "intro") model.content.intro = body;
      else if (key === "priorities") model.priorities = parsePriorityLines(body);
      else if (key === "timetable") model.content.timetable = body;
      else if (key === "closing") model.content.closing = body;
      else if (key === "checklist") model.content.checklist = parseChecklistLines(body);
      else if (key === "plan.website") model.timeline.website = body.trim() || null;
      else if (key === "plan.timing") model.timeline.starts = body.trim() || null;
      else if (key === "market.snapshot" && model.market) model.market.snapshot = body;
      else if (key === "market.landscape" && model.market) model.market.landscape = body;
      else if (competitor && model.market) {
        const match = model.market.competitors.find((c) => c.name === competitor[1]);
        if (match) match.description = body.trim() || null;
        else applied = false; // research re-run and the practice is gone
      } else if (service) {
        const section = model.content.services.find((s) => s.key === service[1]);
        if (section) section[service[2] as "expect" | "limits" | "recommend"] = body;
        else applied = false; // the client no longer buys that service
      } else applied = false;
      if (applied) edited.push(key);
    }

    if (edit.hidden && canHide(key)) {
      hidden.push(key);
      if (keepHidden) continue;
      const competitor = COMPETITOR.exec(key);
      if (key === "market") model.market = null;
      else if (key === "glossary") model.content.glossary = [];
      else if (key === "timetable") model.content.timetable = "";
      else if (key === "checklist") model.content.checklist = [];
      else if (competitor && model.market) {
        model.market.competitors = model.market.competitors.filter((c) => c.name !== competitor[1]);
      }
    }
  }

  return { model, edited, hidden };
}
