import type { MasterSheetRow } from "@/lib/clients/master-sheet";
import { normalizeDomain } from "@/lib/help-desk/domains";
import {
  isInternalEmail,
  suggestPractice,
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
  generatedAt: Date;
};

export type Cell = string | number;
export type Tab = { title: string; rows: Cell[][] };

/** Website-only: nothing in the Master Sheet's "Marketing Services" columns. */
export function isWebsiteOnly(practice: MasterSheetRow) {
  return !practice.packageValue && !practice.strategist;
}

/** Column headings the next run reads back from the Unmatched tab. */
export const UNMATCHED_EMAIL_HEADER = "Requester email";
export const UNMATCHED_ASSIGN_HEADER = "Assign to practice (type exact Master Sheet name, or IGNORE)";

const METHOD_LABEL: Record<MatchMethod, string> = {
  override: "Fixed by hand",
  "org-domain": "Zendesk org domain = URL",
  "email-domain": "Email domain = URL",
  "ticket-url": "URL in ticket",
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

  // ── Clients: one row per website-only practice ──────────────────────────
  const websiteOnly = practices.filter(isWebsiteOnly).sort((a, b) => a.practiceName.localeCompare(b.practiceName));
  const clientRows: Cell[][] = [[
    "Practice Name", "URL", "Website Product", "Zendesk Tickets", "Last Help Desk Contact",
    "What They Ask For (by ticket count)", "Recent Requests", "Zendesk Contacts", "Basecamp Contacts", "How Tickets Were Matched",
  ]];
  let websiteOnlyWithTickets = 0;
  for (const practice of websiteOnly) {
    const s = stats.get(practice);
    if (s?.tickets.length) websiteOnlyWithTickets += 1;

    const categories = new Map<string, number>();
    for (const t of s?.tickets ?? []) {
      const c = t.category ?? "Not yet categorized";
      categories.set(c, (categories.get(c) ?? 0) + 1);
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
      practice.url ?? "",
      practice.websiteProduct ?? "",
      s?.tickets.length ?? 0,
      day(s?.lastAt ?? null),
      categorySummary,
      recent,
      zendeskContacts,
      basecampContacts,
      methods,
    ]);
  }

  // ── People: every client contact, from both sources ─────────────────────
  const peopleRows: Cell[][] = [["Practice Name", "Website Only?", "Source", "Name", "Email", "Tickets / Posts", "Last Contact"]];
  const peopleOut: Cell[][] = [];
  for (const [practice, s] of stats) {
    for (const r of clientRequesters(s)) {
      peopleOut.push([practice.practiceName, isWebsiteOnly(practice) ? "Yes" : "No", "Zendesk", r.user!.name ?? "", r.user!.email ?? "", r.tickets, day(r.last)]);
    }
  }
  for (const contact of input.basecampContacts) {
    peopleOut.push([
      contact.practice.practiceName, isWebsiteOnly(contact.practice) ? "Yes" : "No", "Basecamp",
      contact.name ?? "", contact.email, contact.posts, day(contact.lastPostAt),
    ]);
  }
  peopleOut.sort((a, b) => String(a[0]).localeCompare(String(b[0])) || String(a[2]).localeCompare(String(b[2])));
  peopleRows.push(...peopleOut);

  // ── Tickets: every ticket, for checking the work ────────────────────────
  const ticketRows: Cell[][] = [[
    "Ticket", "Created", "Practice Name", "Website Only?", "Requester", "Requester Email",
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
  const unmatchedRows: Cell[][] = [[
    UNMATCHED_EMAIL_HEADER, "Requester", "Zendesk Org", "Unmatched Tickets", "Last Ticket",
    "Sample Subjects", "URLs Mentioned", "Suggested Practice (a guess — check it)", UNMATCHED_ASSIGN_HEADER,
  ]];
  const unmatchedOut: { tickets: number; row: Cell[] }[] = [];
  let unmatchedTickets = 0;
  for (const [requesterId, list] of unmatchedByRequester) {
    unmatchedTickets += list.length;
    const user = requesterId ? users.get(requesterId) : undefined;
    const orgId = list.find((t) => t.organizationId)?.organizationId ?? user?.organizationId ?? null;
    const org = orgId ? organizations.get(orgId) : undefined;
    const mentioned = [...new Set(list.flatMap((t) => t.mentionedDomains))]
      .filter((d) => normalizeDomain(d))
      .slice(0, 5);
    const suggestion = isInternalEmail(user?.email ?? null, internalDomains)
      ? null
      : suggestPractice(practices, { organizationName: org?.name, email: user?.email, mentionedDomains: mentioned });
    const last = list.reduce<string | null>((acc, t) => later(acc, t.createdAt), null);
    unmatchedOut.push({
      tickets: list.length,
      row: [
        user?.email ?? "",
        user?.name ?? (requesterId ? `Zendesk user ${requesterId}` : "(no requester)"),
        org?.name ?? "",
        list.length,
        day(last),
        list.slice(0, 3).map((t) => t.subject ?? "").filter(Boolean).join(" | "),
        mentioned.join(", "),
        suggestion?.practiceName ?? "",
        (user?.email && input.overrideByEmail.get(user.email.toLowerCase())) ?? "",
      ],
    });
  }
  unmatchedOut.sort((a, b) => b.tickets - a.tickets);
  unmatchedRows.push(...unmatchedOut.map((u) => u.row));

  // ── Summary ─────────────────────────────────────────────────────────────
  const created = tickets.map((t) => t.createdAt).filter((d): d is string => Boolean(d)).sort();
  const matchedTickets = tickets.length - unmatchedTickets - ignoredTickets;
  const summary: Record<string, number | string> = {
    tickets: tickets.length,
    matchedTickets,
    unmatchedTickets,
    ignoredTickets,
    unmatchedRequesters: unmatchedByRequester.size,
    websiteOnlyClients: websiteOnly.length,
    websiteOnlyWithTickets,
    uncategorized: tickets.filter((t) => !t.category).length,
  };
  const pct = (n: number) => (tickets.length ? `${Math.round((n / tickets.length) * 100)}%` : "—");
  const summaryRows: Cell[][] = [
    ["Help Desk Report", ""],
    ["Generated", input.generatedAt.toISOString().replace("T", " ").slice(0, 16) + " UTC"],
    ["Tickets covered", created.length ? `${day(created[0]!)} to ${day(created[created.length - 1]!)}` : "none"],
    ["", ""],
    ["Zendesk tickets", tickets.length],
    ["Matched to a Master Sheet practice", `${matchedTickets} (${pct(matchedTickets)})`],
    ["Unmatched (see Unmatched tab)", `${unmatchedTickets} (${pct(unmatchedTickets)}) from ${unmatchedByRequester.size} people`],
    ["Marked IGNORE by hand", ignoredTickets],
    ["", ""],
    ["How tickets were matched", ""],
    ...(Object.keys(METHOD_LABEL) as MatchMethod[]).map((m) => [`  ${METHOD_LABEL[m]}`, methodCounts.get(m) ?? 0] as Cell[]),
    ["", ""],
    ["Website-only clients on the Master Sheet", websiteOnly.length],
    ["  …with at least one ticket", websiteOnlyWithTickets],
    ["  …with no tickets found", websiteOnly.length - websiteOnlyWithTickets],
    ["Tickets not yet categorized", summary.uncategorized],
    ["", ""],
    ["Notes", ""],
    ["Website-only", "A Master Sheet row with no Package and no Strategist (the Marketing Services columns)."],
    ["Fixing matches", `On the Unmatched tab, type the exact Master Sheet practice name (or IGNORE) in the last column, then run the report again. Fixes are remembered.`],
    ["Basecamp contacts", "Client-side people who have posted in the practice's Basecamp project, from the app's Basecamp sync."],
    ["Former clients", "Tickets from practices no longer on the Master tab cannot match and appear as Unmatched; IGNORE them."],
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
