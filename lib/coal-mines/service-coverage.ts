import type { ClientServiceKey } from "@/lib/clients/types";

/**
 * Clients paying for a service we hold no data for.
 *
 * This is the gap the briefings exposed. Sixteen clients bought Google Ads and
 * had never had a single snapshot — ten of them because the customer ID field
 * held a note ("Needs added", "verify account") instead of an ID. Sixty-eight
 * had no Search Console access. Nothing was watching for it, because every
 * screen only ever showed the clients it *could* show: a client with no data
 * simply does not appear, so the absence is invisible by construction.
 *
 * Pure look-and-report, like every canary. Two states worth telling apart:
 *
 * - **Not connected**: we never had the key — no customer ID, no property, no
 *   page. Usually ours to fix, and often a typo or a to-do left in a field.
 * - **No access**: we have the key and the provider refuses us. Needs the
 *   practice to grant something, so it is a conversation, not a correction.
 *
 * Website-only clients are not here; they buy none of this.
 */

export type ServiceSource = {
  /** What the client bought that needs this data. */
  service: ClientServiceKey;
  /** "Google Ads", "Search Console" — named as a strategist would say it. */
  label: string;
};

export const COVERAGE_SOURCES: Record<string, ServiceSource> = {
  ads: { service: "ppc", label: "Google Ads" },
  searchConsole: { service: "seo", label: "Search Console" },
  social: { service: "smm", label: "Facebook and Instagram" },
  reviews: { service: "orm", label: "Google reviews" },
};

export type CoverageClient = {
  id: number;
  accountName: string;
  /** Services the client actively buys. */
  services: ClientServiceKey[];
  /** The stored identifier for each source, as stored — notes and typos included. */
  keys: Partial<Record<keyof typeof COVERAGE_SOURCES, string | null>>;
  /** When each source last produced data. Missing means never. */
  lastData: Partial<Record<keyof typeof COVERAGE_SOURCES, string | null>>;
};

export type CoverageProblem = {
  clientId: number;
  accountName: string;
  source: keyof typeof COVERAGE_SOURCES;
  sourceLabel: string;
  kind: "not_connected" | "placeholder" | "no_data";
  /** One line naming what is wrong, in the words someone would act on. */
  note: string;
};

/**
 * Text people type into an identifier field when they mean "someone deal with
 * this". Worth calling out separately: it looks connected on every screen that
 * only checks whether the field is empty.
 */
const PLACEHOLDER = /needs?\s|check\s|verify|different account|unknown|tbd|n\/?a\b|pending|see\s/i;

/** An ID that is really a note rather than an account number. */
export function isPlaceholderKey(value: string | null | undefined): boolean {
  const text = (value ?? "").trim();
  if (!text) return false;
  // A real Google Ads ID is digits and dashes; a GA4 property is digits; a page
  // ID is digits; a property URL contains a dot. Anything else prose-like is a
  // note somebody left behind.
  if (/^[\d-]{6,}$/.test(text)) return false;
  if (/^https?:\/\//i.test(text) || /^sc-domain:/i.test(text) || text.includes(".")) return false;
  return PLACEHOLDER.test(text) || /\s/.test(text);
}

/** How long a source may go without data before it counts as not reporting. */
export const COVERAGE_SILENT_DAYS = 7;

export function findCoverageProblems(
  clients: CoverageClient[],
  now: Date = new Date(),
): CoverageProblem[] {
  const problems: CoverageProblem[] = [];
  const cutoff = now.getTime() - COVERAGE_SILENT_DAYS * 86_400_000;

  for (const client of clients) {
    for (const [source, { service, label }] of Object.entries(COVERAGE_SOURCES) as Array<
      [keyof typeof COVERAGE_SOURCES, ServiceSource]
    >) {
      if (!client.services.includes(service)) continue;

      const key = client.keys[source] ?? null;
      const lastData = client.lastData[source] ?? null;
      const fresh = lastData !== null && Date.parse(lastData) >= cutoff;
      if (fresh) continue;

      const base = { clientId: client.id, accountName: client.accountName, source, sourceLabel: label };
      if (isPlaceholderKey(key)) {
        problems.push({
          ...base,
          kind: "placeholder",
          note: `${label}: the ID field holds a note, not an ID — "${(key ?? "").trim()}"`,
        });
      } else if (!(key ?? "").trim()) {
        problems.push({ ...base, kind: "not_connected", note: `${label}: nothing connected` });
      } else if (lastData === null) {
        problems.push({ ...base, kind: "no_data", note: `${label}: connected, but has never returned data` });
      } else {
        problems.push({
          ...base,
          kind: "no_data",
          note: `${label}: no data since ${lastData.slice(0, 10)}`,
        });
      }
    }
  }

  return problems;
}

/**
 * The headline count is clients, not problems: "nine clients" is a thing you
 * can picture, where "fourteen sources" is not.
 */
export function summariseCoverage(problems: CoverageProblem[]) {
  const clients = new Set(problems.map((problem) => problem.clientId));
  const placeholders = problems.filter((problem) => problem.kind === "placeholder");
  const notConnected = problems.filter((problem) => problem.kind === "not_connected");
  return {
    clients: clients.size,
    problems: problems.length,
    placeholders: placeholders.length,
    notConnected: notConnected.length,
    noData: problems.filter((problem) => problem.kind === "no_data").length,
  };
}
