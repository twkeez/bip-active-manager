/**
 * Pure helpers for the Connections picker: which listed site, property or
 * account fits a client, and how a stored value compares with what our access
 * can read. Kept apart from the Google calls so they can be tested.
 */

export type SourceKey = "search_console" | "ga4" | "ads";

export const SOURCE_LABELS: Record<SourceKey, string> = {
  search_console: "Search Console",
  ga4: "Google Analytics (GA4)",
  ads: "Google Ads",
};

/** One thing our access can read, as the picker lists it. */
export type SourceOption = {
  /** What is saved on the client: a Search Console site, a GA4 property number, a 10-digit Ads ID. */
  value: string;
  label: string;
  /** Extra detail: the GA4 account, an Ads account's status. */
  detail: string | null;
  /** Which of our identities can read it, by name. */
  readableBy: string[];
  /** False when an identity is listed on it but can't read its data (e.g. a Restricted or unverified Search Console user). */
  usable: boolean;
};

const lettersAndDigits = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Words shared by half the roster, so a match can't rest on them. */
const GENERIC = /(veterinary|animal|hospital|clinic|pet|vet|care|center|centre|the|and)/g;

const distinctive = (value: string) => lettersAndDigits(value.toLowerCase().replace(GENERIC, " "));

/** "https://www.example.com/" or "sc-domain:example.com" -> "example.com"; null if unreadable. */
export function siteHost(value: string | null | undefined): string | null {
  const raw = (value ?? "").trim();
  if (!raw) return null;
  if (raw.startsWith("sc-domain:")) return raw.slice("sc-domain:".length).toLowerCase().replace(/^www\./, "") || null;
  try {
    const url = new URL(raw.includes("://") ? raw : `https://${raw}`);
    return url.host.toLowerCase().replace(/^www\./, "") || null;
  } catch {
    return null;
  }
}

/** How well a name fits the client: 0 = not at all. */
function nameScore(clientName: string, candidate: string): number {
  const target = lettersAndDigits(clientName);
  const name = lettersAndDigits(candidate);
  if (!target || !name) return 0;
  if (name === target) return 100;
  if (name.includes(target) || target.includes(name)) return 80;
  const core = distinctive(clientName);
  const candidateCore = distinctive(candidate);
  if (core.length >= 5 && candidateCore.length >= 5 && (candidateCore.includes(core) || core.includes(candidateCore))) return 60;
  return 0;
}

/**
 * The options that might belong to this client, best first, at most five.
 *
 * A Search Console site matches on the website's host; a GA4 property or an
 * Ads account on its name (or a host in its name). Generous on purpose: two
 * practices in a group share most of their name, and the safe outcome is to
 * show both to someone who knows which is which. Nothing is picked for them.
 */
export function suggestOptions(
  source: SourceKey,
  client: { account_name: string; website: string | null },
  options: SourceOption[],
): SourceOption[] {
  const host = siteHost(client.website);
  const scored = options
    .map((option) => {
      let score = 0;
      if (source === "search_console") {
        const optionHost = siteHost(option.value);
        if (host && optionHost) {
          if (optionHost === host) score = 100;
          else if (host.endsWith(`.${optionHost}`)) score = 70;
        }
      } else {
        score = nameScore(client.account_name, option.label);
        const hostCore = host ? lettersAndDigits(host.split(".")[0] ?? "") : "";
        if (!score && hostCore.length >= 5 && lettersAndDigits(option.label).includes(hostCore)) score = 50;
      }
      if (!option.usable) score -= 15;
      return { option, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.option.label.localeCompare(b.option.label));
  return scored.slice(0, 5).map((entry) => entry.option);
}

/** The stored value in the form options use, or null when nothing usable is stored. */
export function normalizeStoredValue(source: SourceKey, raw: string | null | undefined): string | null {
  const value = (raw ?? "").trim();
  if (!value) return null;
  if (source === "ga4") {
    const digits = value.replace(/^properties\//i, "");
    return /^\d+$/.test(digits) ? digits : null;
  }
  if (source === "ads") {
    const digits = value.replace(/\D/g, "");
    return /^\d{10}$/.test(digits) ? digits : null;
  }
  return value;
}

/** A value the picker may save, normalised, or the reason it can't be. */
export function validateChoice(source: SourceKey, raw: unknown): { value: string } | { error: string } {
  const value = typeof raw === "string" ? raw.trim() : "";
  if (!value) return { error: "Choose something to connect." };
  if (source === "search_console") {
    if (value.length > 500) return { error: "That Search Console site is too long." };
    if (!value.startsWith("sc-domain:") && !/^https?:\/\//i.test(value)) {
      return { error: "A Search Console site starts with https:// or sc-domain:." };
    }
    if (!siteHost(value)) return { error: "That isn't a Search Console site." };
    return { value };
  }
  const normalized = normalizeStoredValue(source, value);
  if (!normalized) {
    return {
      error:
        source === "ga4"
          ? "A GA4 property ID is digits only, like 123456789. A G- ID is the website's tag, not the property."
          : "A Google Ads customer ID has 10 digits, like 123-456-7890.",
    };
  }
  return { value: normalized };
}

/** Where the stored value stands against what our access can read. */
export type StoredStatus =
  | { state: "not_set" }
  | { state: "invalid"; stored: string }
  | { state: "readable"; value: string; readableBy: string[] }
  | { state: "listed_not_usable"; value: string; readableBy: string[] }
  | { state: "not_readable"; value: string };

export function storedStatus(source: SourceKey, raw: string | null | undefined, options: SourceOption[]): StoredStatus {
  const stored = (raw ?? "").trim();
  if (!stored) return { state: "not_set" };
  const value = normalizeStoredValue(source, stored);
  if (!value) return { state: "invalid", stored };
  let match = options.find((option) => option.value === value);
  if (!match && source === "search_console") {
    // The sync accepts a site stored without its trailing slash or "www".
    const host = siteHost(value);
    match = options.find((option) => option.usable && siteHost(option.value) === host);
  }
  if (!match) return { state: "not_readable", value };
  return match.usable
    ? { state: "readable", value: match.value, readableBy: match.readableBy }
    : { state: "listed_not_usable", value: match.value, readableBy: match.readableBy };
}

/** Merge per-identity lists into one option per value, remembering who can read each. */
export function mergeOptions(lists: Array<{ identity: string; options: Array<Omit<SourceOption, "readableBy">> }>): SourceOption[] {
  const byValue = new Map<string, SourceOption>();
  for (const { identity, options } of lists) {
    for (const option of options) {
      const existing = byValue.get(option.value);
      if (!existing) {
        byValue.set(option.value, { ...option, readableBy: [identity] });
        continue;
      }
      if (!existing.readableBy.includes(identity)) existing.readableBy.push(identity);
      existing.usable = existing.usable || option.usable;
      existing.detail ??= option.detail;
    }
  }
  return [...byValue.values()].sort((a, b) => a.label.localeCompare(b.label));
}
