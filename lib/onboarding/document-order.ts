/**
 * The order the client document's sections print in, per client.
 *
 * The standard order suits most practices, but not all: a client who cares
 * most about what we need from them wants that first, and one being reassured
 * after a rough launch wants "When not to panic" high up. So the order is
 * saved per client like any other edit, and the editor moves whole sections —
 * never a paragraph out of its section, and never one service away from the
 * rest, which would leave "What to expect" stranded from the plan it belongs
 * to.
 *
 * What cannot move: the logo, the title and the plan box. They are how a
 * practice manager knows what they are holding.
 */

export type DocumentSection = { key: string; label: string };

/** Movable sections, in the order they print unless a client says otherwise. */
export const DOCUMENT_SECTIONS: DocumentSection[] = [
  { key: "intro", label: "Intro" },
  { key: "note", label: "A note from your strategist" },
  { key: "priorities", label: "Meeting Notes" },
  { key: "checklist", label: "What we need from you" },
  { key: "timetable", label: "Your timetable" },
  { key: "market", label: "Your local market" },
  // All the service sections together: SEO, Google Ads and the rest keep their
  // own fixed order inside this one block.
  { key: "services", label: "Your services" },
  { key: "reassure", label: "When not to panic" },
  { key: "glossary", label: "Terms you'll see us use" },
  { key: "closing", label: "Closing" },
];

/** The order shipped with the app, used until someone changes it. */
export const DEFAULT_SECTION_ORDER: string[] = DOCUMENT_SECTIONS.map((section) => section.key);

/**
 * Where the house order lives: a master block, beside the wording it orders,
 * so /client-expectations saves both with one button. A client's own order is
 * saved separately and wins for that client.
 */
export const DOCUMENT_ORDER_BLOCK_KEY = "document_order";

export const SECTION_LABEL: Record<string, string> = Object.fromEntries(
  DOCUMENT_SECTIONS.map((section) => [section.key, section.label]),
);

export function isMovableSection(key: string): boolean {
  return DEFAULT_SECTION_ORDER.includes(key);
}

/**
 * A saved order, made safe to print from.
 *
 * Saved orders outlive the document: a section added later is missing from
 * every order saved before it, and one removed later is still named in them.
 * So unknown keys are dropped, and a missing section is put back where it
 * normally sits — after whichever section normally precedes it — rather than
 * at the end, where a new intro would print last.
 */
export function parseSectionOrder(
  body: string | null | undefined,
  /** What a saved order is completed from — the house order, for one client. */
  fallback: string[] = DEFAULT_SECTION_ORDER,
): string[] {
  const saved = (body ?? "")
    .split(/[\n,]/)
    .map((key) => key.trim())
    .filter((key) => isMovableSection(key));
  const order = saved.filter((key, index) => saved.indexOf(key) === index);

  const complete = fallback.filter((key) => isMovableSection(key));
  for (const key of DEFAULT_SECTION_ORDER) {
    if (order.includes(key)) continue;
    const from = complete.includes(key) ? complete : DEFAULT_SECTION_ORDER;
    const at = from.indexOf(key);
    // Anchored to the section it normally follows. With nothing above it, it
    // goes above the section it normally precedes instead, so a new section
    // never displaces a choice the saved order made explicitly.
    const above = from.slice(0, at).reverse().find((candidate) => order.includes(candidate));
    if (above) {
      order.splice(order.indexOf(above) + 1, 0, key);
      continue;
    }
    const below = from.slice(at + 1).find((candidate) => order.includes(candidate));
    order.splice(below ? order.indexOf(below) : 0, 0, key);
  }
  return order;
}

export function serialiseSectionOrder(order: string[]): string {
  return order.join("\n");
}

export function isSameSectionOrder(order: string[], other: string[] = DEFAULT_SECTION_ORDER): boolean {
  return serialiseSectionOrder(order) === serialiseSectionOrder(other);
}

/** One step up or down. At either end the order comes back unchanged. */
export function moveSection(order: string[], key: string, direction: "up" | "down"): string[] {
  const from = order.indexOf(key);
  const to = direction === "up" ? from - 1 : from + 1;
  if (from === -1 || to < 0 || to >= order.length) return order;
  const next = [...order];
  next.splice(to, 0, next.splice(from, 1)[0]);
  return next;
}

/**
 * The order with sections this client has nothing to print for left out, so
 * the editor's arrows move past them instead of appearing to do nothing.
 */
export function visibleSectionOrder(order: string[], has: (key: string) => boolean): string[] {
  return order.filter(has);
}
