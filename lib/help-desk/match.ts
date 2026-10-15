import { matchToMasterSheet, type MasterSheetRow } from "@/lib/clients/master-sheet";
import { normalizeClientName } from "@/lib/clients/normalize-name";
import {
  domainMatches,
  emailDomain,
  isIgnorableDomain,
  normalizeDomain,
} from "@/lib/help-desk/domains";

/**
 * Decides which Master Sheet practice each Zendesk ticket belongs to.
 *
 * Zendesk has no field that says "this is Happy Paws". What it has is who
 * wrote in, the organization Zendesk filed them under (if anyone set one up),
 * and what they wrote. So each ticket is tried against a ladder of evidence,
 * strongest first, and the rung that matched is recorded so the sheet can
 * show *why* a ticket landed where it did:
 *
 *   1. override          — someone fixed it by hand on the Unmatched tab
 *   2. org-domain        — the Zendesk organization's domains include the practice's URL
 *   3. email-domain      — the requester writes from @<practice URL>
 *   4. ticket-url        — the ticket text names the practice's URL
 *   5. org-name          — the Zendesk organization's name matches the practice name
 *   6. same-requester    — this person's other tickets all matched one practice
 *
 * A signal that points at more than one practice (sister practices sharing a
 * domain, a ticket naming two sites) is not used: a wrong match is worse than
 * an honest "unmatched", because nobody goes looking for it.
 */

export type MatchMethod =
  | "override"
  | "org-domain"
  | "email-domain"
  | "ticket-url"
  | "org-name"
  | "same-requester";

export type TicketForMatch = {
  id: number;
  requesterId: number | null;
  organizationId: number | null;
  mentionedDomains: string[];
};

export type ZendeskUserForMatch = {
  id: number;
  name: string | null;
  email: string | null;
  role: string | null;
  organizationId: number | null;
};

export type ZendeskOrgForMatch = {
  id: number;
  name: string;
  domainNames: string[];
};

export type MatchOverride = { requesterEmail: string; practiceName: string };

/** practiceName on an override that marks a requester as not a client. */
export const IGNORE = "IGNORE";

export type TicketMatch =
  | { ticketId: number; practice: MasterSheetRow; method: MatchMethod }
  | { ticketId: number; practice: null; method: null; ignored: boolean };

export type MatchInput = {
  practices: MasterSheetRow[];
  tickets: TicketForMatch[];
  users: ZendeskUserForMatch[];
  organizations: ZendeskOrgForMatch[];
  overrides: MatchOverride[];
  /** Our own email domains — staff filing tickets for clients prove nothing. */
  internalDomains: string[];
};

export type MatchResult = {
  matches: Map<number, TicketMatch>;
  /** Overrides whose practice name is not on the Master Sheet. */
  unknownOverrideNames: string[];
};

/**
 * Current practices plus the "Clients Who Left" tab, marked former. A former
 * row that is also on the current roster (same name or same website) is
 * dropped: they came back, and their tickets belong to the current row.
 */
export function combinePractices(current: MasterSheetRow[], former: MasterSheetRow[]): MasterSheetRow[] {
  const currentNames = new Set(current.map((p) => p.normalizedName));
  const currentDomains = new Set(current.map((p) => normalizeDomain(p.url)).filter(Boolean));
  const departed = former
    .filter((p) => !currentNames.has(p.normalizedName))
    .filter((p) => {
      const domain = normalizeDomain(p.url);
      return !domain || !currentDomains.has(domain);
    })
    .map((p) => ({ ...p, former: true }));
  // Current rows first, so a name lookup that finds both prefers the current one.
  return [...current, ...departed];
}

/** Practices by website domain. A domain shared by two practices maps to both. */
export function buildDomainIndex(practices: MasterSheetRow[]) {
  const index = new Map<string, MasterSheetRow[]>();
  for (const practice of practices) {
    const domain = normalizeDomain(practice.url);
    if (!domain) continue;
    const list = index.get(domain) ?? [];
    list.push(practice);
    index.set(domain, list);
  }
  return index;
}

/** The one practice a domain belongs to, or null if none or several. */
export function practiceForDomain(
  domain: string | null,
  index: Map<string, MasterSheetRow[]>,
  internalDomains: string[],
): MasterSheetRow | null {
  if (!domain || isIgnorableDomain(domain, internalDomains)) return null;
  const exact = index.get(domain);
  if (exact) return exact.length === 1 ? exact[0]! : null;
  // mail.happypawsvet.com → happypawsvet.com
  const found = new Set<MasterSheetRow>();
  for (const [practiceDomain, rows] of index) {
    if (domainMatches(domain, practiceDomain)) rows.forEach((row) => found.add(row));
  }
  return found.size === 1 ? [...found][0]! : null;
}

/** The single practice all of `domains` point at, or null if none or several. */
function practiceForDomains(
  domains: string[],
  index: Map<string, MasterSheetRow[]>,
  internalDomains: string[],
): MasterSheetRow | null {
  const found = new Set<MasterSheetRow>();
  for (const domain of domains) {
    const practice = practiceForDomain(normalizeDomain(domain), index, internalDomains);
    if (practice) found.add(practice);
  }
  return found.size === 1 ? [...found][0]! : null;
}

export function isInternalEmail(email: string | null, internalDomains: string[]) {
  const domain = emailDomain(email);
  return Boolean(domain && internalDomains.some((d) => domainMatches(domain, d)));
}

export function matchTickets(input: MatchInput): MatchResult {
  const { practices, tickets, internalDomains } = input;
  const domainIndex = buildDomainIndex(practices);
  const byNormalizedName = new Map(practices.map((p) => [p.normalizedName, p]));
  const users = new Map(input.users.map((u) => [u.id, u]));
  const organizations = new Map(input.organizations.map((o) => [o.id, o]));

  const overrides = new Map<string, MasterSheetRow | typeof IGNORE>();
  const unknownOverrideNames: string[] = [];
  for (const override of input.overrides) {
    const email = override.requesterEmail.trim().toLowerCase();
    const name = override.practiceName.trim();
    if (name.toUpperCase() === IGNORE) {
      overrides.set(email, IGNORE);
      continue;
    }
    const practice = byNormalizedName.get(normalizeClientName(name));
    if (practice) overrides.set(email, practice);
    else unknownOverrideNames.push(name);
  }

  // Organization → practice, worked out once per organization.
  const orgPractice = new Map<number, { practice: MasterSheetRow; method: MatchMethod } | null>();
  for (const org of organizations.values()) {
    const byDomain = practiceForDomains(org.domainNames, domainIndex, internalDomains);
    if (byDomain) {
      orgPractice.set(org.id, { practice: byDomain, method: "org-domain" });
      continue;
    }
    const byName = matchToMasterSheet(org.name, practices);
    orgPractice.set(org.id, byName.row ? { practice: byName.row, method: "org-name" } : null);
  }

  const matches = new Map<number, TicketMatch>();
  for (const ticket of tickets) {
    const user = ticket.requesterId ? users.get(ticket.requesterId) : undefined;
    const email = user?.email?.toLowerCase() ?? null;
    const unmatched: TicketMatch = { ticketId: ticket.id, practice: null, method: null, ignored: false };

    const override = email ? overrides.get(email) : undefined;
    if (override === IGNORE) {
      matches.set(ticket.id, { ...unmatched, ignored: true });
      continue;
    }
    if (override) {
      matches.set(ticket.id, { ticketId: ticket.id, practice: override, method: "override" });
      continue;
    }

    const orgId = ticket.organizationId ?? user?.organizationId ?? null;
    const org = orgId ? orgPractice.get(orgId) ?? null : null;
    if (org?.method === "org-domain") {
      matches.set(ticket.id, { ticketId: ticket.id, ...org });
      continue;
    }

    const byEmail = practiceForDomain(emailDomain(email), domainIndex, internalDomains);
    if (byEmail) {
      matches.set(ticket.id, { ticketId: ticket.id, practice: byEmail, method: "email-domain" });
      continue;
    }

    const byText = practiceForDomains(ticket.mentionedDomains, domainIndex, internalDomains);
    if (byText) {
      matches.set(ticket.id, { ticketId: ticket.id, practice: byText, method: "ticket-url" });
      continue;
    }

    if (org) {
      matches.set(ticket.id, { ticketId: ticket.id, ...org });
      continue;
    }

    matches.set(ticket.id, unmatched);
  }

  // A client who once wrote "re: happypawsvet.com" from their Gmail and then
  // sent ten more tickets without saying so: those ten are theirs too. Staff
  // file tickets for many clients, so their addresses never carry over.
  const practicesByRequester = new Map<number, Set<MasterSheetRow>>();
  for (const ticket of tickets) {
    const match = matches.get(ticket.id);
    if (!ticket.requesterId || !match?.practice) continue;
    const set = practicesByRequester.get(ticket.requesterId) ?? new Set();
    set.add(match.practice);
    practicesByRequester.set(ticket.requesterId, set);
  }
  for (const ticket of tickets) {
    const match = matches.get(ticket.id);
    if (!ticket.requesterId || match?.practice || (match && "ignored" in match && match.ignored)) continue;
    const user = users.get(ticket.requesterId);
    if (isInternalEmail(user?.email ?? null, internalDomains)) continue;
    const known = practicesByRequester.get(ticket.requesterId);
    if (known?.size === 1) {
      matches.set(ticket.id, { ticketId: ticket.id, practice: [...known][0]!, method: "same-requester" });
    }
  }

  return { matches, unknownOverrideNames };
}
