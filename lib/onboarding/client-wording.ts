import { asPracticeType, isUrgentPractice } from "./practice-type";

// Wording that depends on what we know about the client, filled into the house
// copy through placeholders that carry today's wording as their fallback:
//
//   {{ad_spend|Most practices on this plan spend between $400 and $1,000 a month on the ads.}}
//
// A client with nothing filled in reads exactly what the house copy says; a
// client with an agreed budget, conversion types or an urgent-care practice
// type reads wording that fits them (Remedy has no online booking, so "a call,
// booking or form" was wrong for it).

export const CONVERSION_TYPES = ["phone_calls", "walk_ins", "directions", "online_booking", "forms"] as const;
export type ConversionType = (typeof CONVERSION_TYPES)[number];

export const CONVERSION_TYPE_LABEL: Record<ConversionType, string> = {
  phone_calls: "Phone calls",
  walk_ins: "Walk-ins",
  directions: "Directions requests",
  online_booking: "Online booking",
  forms: "Contact forms",
};

/** Each conversion type in the grammatical forms the copy needs. */
const PHRASES: Record<ConversionType, { one: string; plural: string; bare: string }> = {
  phone_calls: { one: "a phone call", plural: "calls", bare: "call" },
  walk_ins: { one: "a walk-in visit", plural: "walk-ins", bare: "walk-in" },
  directions: { one: "a request for directions", plural: "requests for directions", bare: "directions request" },
  online_booking: { one: "an online booking", plural: "bookings", bare: "booking" },
  forms: { one: "a form", plural: "form fills", bare: "form" },
};

function list(items: string[], conjunction: "or" | "and"): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} ${conjunction} ${items[items.length - 1]}`;
}

export function asConversionTypes(value: unknown): ConversionType[] {
  if (!Array.isArray(value)) return [];
  return CONVERSION_TYPES.filter((type) => value.includes(type));
}

export type ClientWordingInput = {
  adBudget?: string | null;
  conversionTypes?: unknown;
  practiceType?: unknown;
};

/** The client-specific value for each placeholder, or null to use the house wording. */
export function clientWordingValues(input: ClientWordingInput): Record<string, string | null> {
  const types = asConversionTypes(input.conversionTypes);
  const phrases = types.map((type) => PHRASES[type]);
  const budget = input.adBudget?.trim() || null;
  const perMonth = budget && !/month|\/\s*mo\b|monthly/i.test(budget) ? `${budget} a month` : budget;
  const urgent = isUrgentPractice(asPracticeType(input.practiceType));
  return {
    ad_spend: perMonth ? `The ad budget we agreed with you is ${perMonth}.` : null,
    conversion_one: phrases.length ? list(phrases.map((p) => p.one), "or") : null,
    conversions_or: phrases.length ? list(phrases.map((p) => p.plural), "or") : null,
    conversions_and: phrases.length ? list(phrases.map((p) => p.plural), "and") : null,
    conversion_each: phrases.length ? list(phrases.map((p) => p.bare), "or") : null,
    search_cost_note: urgent
      ? "urgent and emergency searches, the ones your ads will mostly show up for, tend to cost more per click than routine care, so expect the higher end of the usual range"
      : null,
  };
}

/** Placeholders the house copy may use, for the editor's reference. */
export const CLIENT_WORDING_FIELDS = Object.keys(clientWordingValues({}));

/**
 * Fills {{field|fallback}} placeholders: the client's wording when there is
 * one, otherwise the fallback exactly as written. Unknown fields keep their
 * fallback; a bare {{field}} with no value prints nothing.
 */
export function applyClientWording(text: string, values: Record<string, string | null>): string {
  return text.replace(/\{\{([a-z_]+)(?:\|([^{}]*))?\}\}/g, (whole, field: string, fallback: string | undefined) => {
    if (!(field in values)) return whole; // {{client_name}} and friends are filled elsewhere
    return values[field] ?? fallback ?? "";
  });
}
