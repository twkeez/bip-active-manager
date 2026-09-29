import { LIMITS } from "./types";

/** A problem with what was asked, in words the person (or Claude) can act on. */
export class PoobahError extends Error {
  constructor(
    message: string,
    /** HTTP status for the app's API: 400 bad input, 404 not found, 409 conflict. */
    readonly status: 400 | 404 | 409 | 500 = 400,
  ) {
    super(message);
    this.name = "PoobahError";
  }
}

export function requiredText(value: unknown, field: string, max: number): string {
  if (typeof value !== "string" || !value.trim()) throw new PoobahError(`${field} is required.`);
  const text = value.trim();
  if (text.length > max) throw new PoobahError(`${field} is too long (${text.length} characters; the limit is ${max}).`);
  return text;
}

export function optionalText(value: unknown, field: string, max: number): string | null {
  if (value == null || (typeof value === "string" && !value.trim())) return null;
  return requiredText(value, field, max);
}

/** Free-form text that may be empty (account basics). */
export function freeText(value: unknown, field: string, max: number): string {
  if (value == null) return "";
  if (typeof value !== "string") throw new PoobahError(`${field} must be text.`);
  if (value.length > max) throw new PoobahError(`${field} is too long (${value.length} characters; the limit is ${max}).`);
  return value;
}

/** A calendar date as YYYY-MM-DD, checked to be a real date. */
export function isoDate(value: unknown, field: string): string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    throw new PoobahError(`${field} must be a date written YYYY-MM-DD.`);
  }
  const text = value.trim();
  const parsed = new Date(`${text}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== text) {
    throw new PoobahError(`${field} "${text}" is not a real date.`);
  }
  return text;
}

export function optionalIsoDate(value: unknown, field: string): string | null {
  if (value == null || value === "") return null;
  return isoDate(value, field);
}

export type ItemFields = { text?: string; owner?: string | null; due_date?: string | null; done?: boolean };

/**
 * The fields an item update may change. Unknown fields are refused rather than
 * ignored, so a typo cannot look like a successful save.
 */
export function itemFields(raw: unknown): ItemFields {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new PoobahError("fields must be an object.");
  const input = raw as Record<string, unknown>;
  const allowed = ["text", "owner", "due_date", "done"];
  const unknown = Object.keys(input).filter((key) => !allowed.includes(key));
  if (unknown.length) {
    throw new PoobahError(`Unknown field${unknown.length === 1 ? "" : "s"}: ${unknown.join(", ")}. Allowed: ${allowed.join(", ")}.`);
  }
  const fields: ItemFields = {};
  if ("text" in input) fields.text = requiredText(input.text, "text", LIMITS.text);
  if ("owner" in input) fields.owner = optionalText(input.owner, "owner", LIMITS.owner);
  if ("due_date" in input) fields.due_date = optionalIsoDate(input.due_date, "due_date");
  if ("done" in input) {
    if (typeof input.done !== "boolean") throw new PoobahError("done must be true or false.");
    fields.done = input.done;
  }
  if (!Object.keys(fields).length) throw new PoobahError("Nothing to change: give at least one of text, owner, due_date, done.");
  return fields;
}

/** Today's date in Eastern time, YYYY-MM-DD: the default date for a log entry. */
export function todayEastern(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(now);
}
