import type { MasterSheetRow } from "@/lib/clients/master-sheet";
import { isSystemSender, normalizeDomain } from "@/lib/help-desk/domains";
import { suggestPracticeForRequester, type Confidence } from "@/lib/help-desk/suggest";
import {
  isInternalEmail,
  type MatchMethod,
  type TicketMatch,
  type ZendeskOrgForMatch,
  type ZendeskUserForMatch,
} from "@/lib/help-desk/match";

/**
 * Turns matched tickets and Basecamp contacts into the rows of the Google
 * Sheet. Pure: everything it needs is passed in, so it can be tested without
 * Zendesk, Basecamp or Google.
 */

export type ReportTicket = {
  id: number;
  subject: string | null;
  status: string | null;
  requesterId: number | null;
  organizationId: number | null;
  mentionedDomains: string[];
  createdAt: string | null;
  category: string | null;
  gist: string | null;
};

export type BasecampContact = {
  practice: MasterSheetRow;
  name: string | null;
  email: string;
  posts: number;
  lastPostAt: string | null;
};

export type ReportInput = {
  practices: MasterSheetRow[];
  tickets: ReportTicket[];
  matches: Map<number, TicketMatch>;
  users: ZendeskUserForMatch[];
  organizations: ZendeskOrgForMatch[];
  basecampContacts: BasecampContact[];
  internalDomains: string[];
  zendeskHost: string;
  unknownOverrideNames: string[];
  /** Saved fixes by requester email, shown back in the Unmatched tab when they did not apply. */
  overrideByEmail: Map<string, string>;
  /** ISO date: request types are counted only for tickets opened since then. */
  categoryCutoff: string;
  /** Why former clients could not be matched, if they could not. */
  formerWarning?: string | null;
  generatedAt: Date;
};

export type Cell = string | number;
export type Tab = { title: string; rows: Cell[][] };

/**
 * Website-only: a current client with nothing in the Master Sheet's
 * "Marketing Services" columns. "Clients Who Left" has no such columns, so
 * former clients are never website-only.
 */
export function isWebsiteOnly(practice: MasterSheetRow) {
  return !practice.former && !practice.packageValue && !practice.strategist;
}

const clientStatus = (practice: MasterSheetRow) => (practice.former ? "Former" : "Current");

/** Column headings the next run reads back from the Unmatched tab. */
export const UNMATCHED_EMAIL_HEADER = "Requester email";
export const UNMATCHED_SUGGESTED_HEADER = "Suggested Practice";
export const UNMATCHED_APPROVE_HEADER = "Approve suggestion? (type Y)";
export const UNMATCHED_ASSIGN_HEADER = "Assign to practice (type exact Master Sheet name, or IGNORE)";

const METHOD_LABEL: Record<MatchMethod, string> = {
  override: "Fixed by hand",
  "org-domain": "Zendesk org domain = URL",
  "email-domain": "Email domain = URL",
  "ticket-url": "URL in ticket",
  "subject-name": "Practice name in subject",
  "org-name": "Zendesk org name",
  "same-requester": "Same person's other tickets",
};

const day = (iso: string | null) => (iso ? iso.slice(0, 10) : "");

function later(a: string | null, b: string | null) {
  if (!a) return b;
  if (!b) return a;
  return a > b ? a : b;
}

function person(name: string | null, email: string | null) {
  if (name && email) return `${name} <${email}>`;
  return name ?? email ?? "";
}

type PracticeStats = {
  tickets: ReportTicket[];
  methods: Map<MatchMethod, number>;
  requesters: Map<number, { tickets: number; last: string | null }>;
  lastAt: string | null;
};

export function buildReport(input: ReportInput): { tabs: Tab[]; summary: Record<string, number | string> } {
  const { practices, tickets, matches, internalDomains } = input;
  const users = new Map(input.users.map((u) => [u.id, u]));
  const organizations = new Map(input.organizations.map((o) => [o.id, o]));
  const ticketUrl = (id: number) => `https://${input.zendeskHost}/agent/tickets/${id}`;

  const stats = new Map<MasterSheetRow, PracticeStats>();
  const statsFor = (practice: MasterSheetRow) => {
    let s = stats.get(practice);
    if (!s) {
      s = { tickets: [], methods: new Map(), requesters: new Map(), lastAt: null };
      stats.set(practice, s);
    }
    return s;
  };

  const methodCounts = new Map<MatchMethod, number>();
  let ignoredTickets = 0;
  const unmatchedByRequester = new Map<number | null, ReportTicket[]>();

  for (const ticket of tickets) {
    const match = matches.get(ticket.id);
    if (!match?.practice) {
      if (match && "ignored" in match && match.ignored) {
        ignoredTickets += 1;
        continue;
      }
      const list = unmatchedByRequester.get(ticket.requesterId) ?? [];
      list.push(ticket);
      unmatchedByRequester.set(ticket.requesterId, list);
      continue;
    }
    methodCounts.set(match.method, (methodCounts.get(match.method) ?? 0) + 1);
    const s = statsFor(match.practice);
    s.tickets.push(ticket);
    s.methods.set(match.method, (s.methods.get(match.method) ?? 0) + 1);
    s.lastAt = later(s.lastAt, ticket.createdAt);
    if (ticket.requesterId) {
      const r = s.requesters.get(ticket.requesterId) ?? { tickets: 0, last: null };
      r.tickets += 1;
      r.last = later(r.last, ticket.createdAt);
      s.requesters.set(ticket.requesterId, r);
    }
  }

  const basecampByPractice = new Map<MasterSheetRow, BasecampContact[]>();
  for (const contact of input.basecampContacts) {
    const list = basecampByPractice.get(contact.practice) ?? [];
    list.push(contact);
    basecampByPractice.set(contact.practice, list);
  }

  const clientRequesters = (s: PracticeStats | undefined) =>
    [...(s?.requesters ?? new Map()).entries()]
      .map(([id, r]) => ({ user: users.get(id), ...r }))
      .filter((r) => r.user && !isInternalEmail(r.user.email, internalDomains) && r.user.role !== "agent" && r.user.role !== "admin")
      .sort((a, b) => b.tickets - a.tickets);

  // ── Clients: every current practice, then former ones that have tickets ──
  const byName = (a: MasterSheetRow, b: MasterSheetRow) => a.practiceName.localeCompare(b.practiceName);
  const currentClients = practices.filter((p) => !p.former).sort(byName);
  const formerWithTickets = practices.filter((p) => p.former && stats.get(p)?.tickets.length).sort(byName);
  const websiteOnly = currentClients.filter(isWebsiteOnly);
  const cutoff = input.categoryCutoff;
  const clientRows: Cell[][] = [[
    "Practice Name", "Client Status", "URL", "Package", "Strategist", "Website Only?", "Website Product", "Launch Date",
    "Zendesk Tickets", "Last Help Desk Contact", `What They Ask For (since ${day(cutoff)}, by ticket count)`, "Recent Requests",
    "Zendesk Contacts", "Basecamp Contacts", "How Tickets Were Matched", "Reason for Leaving",
  ]];
  let clientsWithTickets = 0;
  let websiteOnlyWithTickets = 0;
  for (const practice of [...currentClients, ...formerWithTickets]) {
    const s = stats.get(practice);
    if (s?.tickets.length && !practice.former) {
      clientsWithTickets += 1;
      if (isWebsiteOnly(practice)) websiteOnlyWithTickets += 1;
    }

    // Only recent tickets of current clients are categorized; counting older
    // ones would just add a large "not categorized" bucket.
    const categories = new Map<string, number>();
    if (!practice.former) {
      for (const t of s?.tickets ?? []) {
        if (!t.createdAt || t.createdAt < cutoff) continue;
        const c = t.category ?? "Not yet categorized";
        categories.set(c, (categories.get(c) ?? 0) + 1);
      }
    }
    const categorySummary = [...categories.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([c, n]) => `${c} (${n})`)
      .join("; ");
    const recent = [...(s?.tickets ?? [])]
      .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""))
      .slice(0, 5)
      .map((t) => `${day(t.createdAt)}: ${t.gist ?? t.subject ?? "(no subject)"}`)
      .join("\n");
    const zendeskContacts = clientRequesters(s)
      .map((r) => `${person(r.user!.name, r.user!.email)} (${r.tickets})`)
      .join("\n");
    const basecampContacts = (basecampByPractice.get(practice) ?? [])
      .sort((a, b) => b.posts - a.posts)
      .map((c) => person(c.name, c.email))
      .join("\n");
    const methods = [...(s?.methods ?? new Map()).entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([m, n]) => `${METHOD_LABEL[m as MatchMethod]} (${n})`)
      .join("; ");

    clientRows.push([
      practice.practiceName,
      clientStatus(practice),
      practice.url ?? "",
      practice.packageValue ?? "",
      practice.strategist ?? "",
      isWebsiteOnly(practice) ? "Yes" : "No",
      practice.websiteProduct ?? "",
      practice.launchDate ?? "",
      s?.tickets.length ?? 0,
      day(s?.lastAt ?? null),
      categorySummary,
      recent,
      zendeskContacts,
      basecampContacts,
      methods,
      practice.leftReason ?? "",
    ]);
  }

  // ── People: every client contact, from both sources ─────────────────────
  const peopleRows: Cell[][] = [["Practice Name", "Client Status", "Website Only?", "Source", "Name", "Email", "Tickets / Posts", "Last Contact"]];
  const peopleOut: Cell[][] = [];
  for (const [practice, s] of stats) {
    for (const r of clientRequesters(s)) {
      peopleOut.push([practice.practiceName, clientStatus(practice), isWebsiteOnly(practice) ? "Yes" : "No", "Zendesk", r.user!.name ?? "", r.user!.email ?? "", r.tickets, day(r.last)]);
    }
  }
  for (const contact of input.basecampContacts) {
    peopleOut.push([
      contact.practice.practiceName, clientStatus(contact.practice), isWebsiteOnly(contact.practice) ? "Yes" : "No", "Basecamp",
      contact.name ?? "", contact.email, contact.posts, day(contact.lastPostAt),
    ]);
  }
  peopleOut.sort((a, b) => String(a[0]).localeCompare(String(b[0])) || String(a[3]).localeCompare(String(b[3])));
  peopleRows.push(...peopleOut);

  // ── Tickets: every ticket, for checking the work ────────────────────────
  const ticketRows: Cell[][] = [[
    "Ticket", "Created", "Practice Name", "Client Status", "Website Only?", "Requester", "Requester Email",
    "Zendesk Org", "Category", "Gist", "Subject", "Status", "Matched By", "Link",
  ]];
  const sortedTickets = [...tickets].sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
  for (const ticket of sortedTickets) {
    const match = matches.get(ticket.id);
    const user = ticket.requesterId ? users.get(ticket.requesterId) : undefined;
    const org = ticket.organizationId ? organizations.get(ticket.organizationId) : undefined;
    const ignored = Boolean(match && "ignored" in match && match.ignored);
    ticketRows.push([
      ticket.id,
      day(ticket.createdAt),
      match?.practice?.practiceName ?? (ignored ? "(ignored)" : ""),
      match?.practice ? clientStatus(match.practice) : "",
      match?.practice ? (isWebsiteOnly(match.practice) ? "Yes" : "No") : "",
      user?.name ?? "",
      user?.email ?? "",
      org?.name ?? "",
      ticket.category ?? "",
      ticket.gist ?? "",
      ticket.subject ?? "",
      ticket.status ?? "",
      match?.method ? METHOD_LABEL[match.method] : ignored ? "Ignored by hand" : "Unmatched",
      ticketUrl(ticket.id),
    ]);
  }

  // ── Unmatched: one row per person whose tickets matched nothing ─────────
  // Each gets a loose guess with a confidence, grouped High → Medium → Low →
  // no guess, so the sure ones can be approved in a batch.
  const unmatchedRows: Cell[][] = [[
    UNMATCHED_EMAIL_HEADER, "Requester", "Zendesk Org", "Unmatched Tickets", "Last Ticket",
    "Sample Subjects", "URLs Mentioned", UNMATCHED_SUGGESTED_HEADER, "Suggested Client Status", "Confidence",
    "Why", UNMATCHED_APPROVE_HEADER, UNMATCHED_ASSIGN_HEADER,
  ]];
  const confidenceOrder: Record<Confidence | "", number> = { High: 0, Medium: 1, Low: 2, "": 3 };
  const unmatchedOut: { tickets: number; confidence: Confidence | ""; row: Cell[] }[] = [];
  const suggestionCounts: Record<Confidence, number> = { High: 0, Medium: 0, Low: 0 };
  let unmatchedTickets = 0;
  // Staff file tickets for many clients, and voicemail robots carry calls from
  // many practices: assigning either to one client would be wrong, so they
  // are counted on the Summary rather than listed here.
  let staffTickets = 0;
  let systemTickets = 0;
  for (const [requesterId, list] of unmatchedByRequester) {
    unmatchedTickets += list.length;
    const user = requesterId ? users.get(requesterId) : undefined;
    if (isInternalEmail(user?.email ?? null, internalDomains)) {
      staffTickets += list.length;
      continue;
    }
    if (isSystemSender(user?.email, user?.name)) {
      systemTickets += list.length;
      continue;
    }
    const orgId = list.find((t) => t.organizationId)?.organizationId ?? user?.organizationId ?? null;
    const org = orgId ? organizations.get(orgId) : undefined;
    const mentioned = [...new Set(list.flatMap((t) => t.mentionedDomains))]
      .filter((d) => normalizeDomain(d))
      .slice(0, 5);
    const suggestion = suggestPracticeForRequester(practices, {
      email: user?.email,
      requesterName: user?.name,
      organizationName: org?.name,
      mentionedDomains: [...new Set(list.flatMap((t) => t.mentionedDomains))],
      subjects: list.slice(0, 30).map((t) => t.subject ?? "").filter(Boolean),
    });
    if (suggestion) suggestionCounts[suggestion.confidence] += 1;
    const last = list.reduce<string | null>((acc, t) => later(acc, t.createdAt), null);
    unmatchedOut.push({
      tickets: list.length,
      confidence: suggestion?.confidence ?? "",
      row: [
        user?.email ?? "",
        user?.name ?? (requesterId ? `Zendesk user ${requesterId}` : "(no requester)"),
        org?.name ?? "",
        list.length,
        day(last),
        list.slice(0, 3).map((t) => t.subject ?? "").filter(Boolean).join(" | "),
        mentioned.join(", "),
        suggestion?.practice.practiceName ?? "",
        suggestion ? clientStatus(suggestion.practice) : "",
        suggestion?.confidence ?? "",
        suggestion?.reason ?? "",
        "",
        (user?.email && input.overrideByEmail.get(user.email.toLowerCase())) ?? "",
      ],
    });
  }
  unmatchedOut.sort((a, b) => confidenceOrder[a.confidence] - confidenceOrder[b.confidence] || b.tickets - a.tickets);
  unmatchedRows.push(...unmatchedOut.map((u) => u.row));

  // ── Summary ─────────────────────────────────────────────────────────────
  const created = tickets.map((t) => t.createdAt).filter((d): d is string => Boolean(d)).sort();
  const matchedTickets = tickets.length - unmatchedTickets - ignoredTickets;
  const matchedFormerTickets = [...stats].filter(([p]) => p.former).reduce((n, [, s]) => n + s.tickets.length, 0);
  const matchedCurrentTickets = matchedTickets - matchedFormerTickets;
  const inScope = [...stats]
    .filter(([p]) => !p.former)
    .flatMap(([, s]) => s.tickets)
    .filter((t) => t.createdAt && t.createdAt >= cutoff);
  const summary: Record<string, number | string> = {
    tickets: tickets.length,
    matchedTickets,
    matchedCurrentTickets,
    matchedFormerTickets,
    formerClientsWithTickets: formerWithTickets.length,
    unmatchedTickets,
    ignoredTickets,
    unmatchedRequesters: unmatchedOut.length,
    unmatchedStaffTickets: staffTickets,
    unmatchedSystemTickets: systemTickets,
    suggestedHigh: suggestionCounts.High,
    suggestedMedium: suggestionCounts.Medium,
    suggestedLow: suggestionCounts.Low,
    clients: currentClients.length,
    clientsWithTickets,
    websiteOnlyClients: websiteOnly.length,
    websiteOnlyWithTickets,
    categorizeInScope: inScope.length,
    uncategorized: inScope.filter((t) => !t.category).length,
  };
  const pct = (n: number) => (tickets.length ? `${Math.round((n / tickets.length) * 100)}%` : "—");
  const summaryRows: Cell[][] = [
    ["Help Desk Report", ""],
    ["Generated", input.generatedAt.toISOString().replace("T", " ").slice(0, 16) + " UTC"],
    ["Tickets covered", created.length ? `${day(created[0]!)} to ${day(created[created.length - 1]!)}` : "none"],
    ["", ""],
    ["Zendesk tickets", tickets.length],
    ["Matched to a current client (Master tab)", `${matchedCurrentTickets} (${pct(matchedCurrentTickets)})`],
    ["Matched to a former client (Clients Who Left)", `${matchedFormerTickets} (${pct(matchedFormerTickets)}) across ${formerWithTickets.length} practices`],
    ["Unmatched", `${unmatchedTickets} (${pct(unmatchedTickets)})`],
    ["  …filed by Beyond Indigo staff (not listed on Unmatched)", staffTickets],
    ["  …from voicemail / automated senders (not listed)", systemTickets],
    ["  …from clients and others (Unmatched tab)", `${unmatchedTickets - staffTickets - systemTickets} from ${unmatchedOut.length} people`],
    ["  …with a High-confidence guess", `${suggestionCounts.High} people`],
    ["  …with a Medium-confidence guess", `${suggestionCounts.Medium} people`],
    ["  …with a Low-confidence guess", `${suggestionCounts.Low} people`],
    ["Marked IGNORE by hand", ignoredTickets],
    ["", ""],
    ["How tickets were matched", ""],
    ...(Object.keys(METHOD_LABEL) as MatchMethod[]).map((m) => [`  ${METHOD_LABEL[m]}`, methodCounts.get(m) ?? 0] as Cell[]),
    ["", ""],
    ["Current clients (Master tab)", currentClients.length],
    ["  …with at least one ticket", clientsWithTickets],
    ["  …with no tickets found", currentClients.length - clientsWithTickets],
    ["Website-only clients (subset of the above)", websiteOnly.length],
    ["  …with at least one ticket", websiteOnlyWithTickets],
    ["  …with no tickets found", websiteOnly.length - websiteOnlyWithTickets],
    [`Current-client tickets since ${day(cutoff)} (the ones categorized)`, inScope.length],
    ["  …not yet categorized", summary.uncategorized],
    ["", ""],
    ["Notes", ""],
    ["Website-only", "A Master Sheet row with no Package and no Strategist (the Marketing Services columns)."],
    ["Fixing matches", `On the Unmatched tab, type Y in "${UNMATCHED_APPROVE_HEADER}" to accept the guess, or type the exact practice name (or IGNORE) in the last column, then write the sheet again. Fixes are remembered.`],
    ["Confidence", "High: the email or name IS the practice's name or web address. Medium: it contains the distinctive part of the name, or a ticket subject names the practice. Low: partial or similar-name evidence — check before approving."],
    ["Basecamp contacts", "Client-side people who have posted in the practice's Basecamp project, from the app's Basecamp sync."],
    ["Former clients", 'Practices on the Master Sheet\'s "Clients Who Left" tab are matched the same way and marked Former. Only those with tickets are listed on the Clients tab. A practice on both tabs counts as current.'],
    ["Request types", `Only current clients' tickets opened since ${day(cutoff)} are categorized. Ticket counts and last contact dates cover every year.`],
    ...(input.formerWarning ? [["Former clients not matched", input.formerWarning] as Cell[]] : []),
    ...(input.unknownOverrideNames.length
      ? [["Fixes not applied", `These names are not on the Master Sheet: ${[...new Set(input.unknownOverrideNames)].join(", ")}`] as Cell[]]
      : []),
  ];

  return {
    tabs: [
      { title: "Summary", rows: summaryRows },
      { title: "Clients", rows: clientRows },
      { title: "People", rows: peopleRows },
      { title: "Unmatched", rows: unmatchedRows },
      { title: "Tickets", rows: ticketRows },
    ],
    summary,
  };
}
