import { describe, expect, it } from "vitest";
import type { MasterSheetRow } from "@/lib/clients/master-sheet";
import { normalizeClientName } from "@/lib/clients/normalize-name";
import type { TicketMatch } from "@/lib/help-desk/match";
import { buildReport, isWebsiteOnly, UNMATCHED_ASSIGN_HEADER, type ReportTicket } from "@/lib/help-desk/report";

function practice(practiceName: string, url: string, marketing = false): MasterSheetRow {
  return {
    practiceName,
    normalizedName: normalizeClientName(practiceName),
    url,
    city: null,
    state: null,
    packageValue: marketing ? "5.00" : null,
    strategist: marketing ? "Alex" : null,
    websiteProduct: "Foundation +5",
    launchDate: "May 2022",
  };
}

const websiteClient = practice("Happy Paws Vet", "happypawsvet.com");
const marketingClient = practice("Oak Creek Clinic", "oakcreekvet.com", true);
const formerClient = { ...practice("Old Town Vet", "oldtownvet.com"), former: true, leftReason: "sold" };
const formerQuiet = { ...practice("Quiet Former Vet", "quietvet.com"), former: true };

function ticket(id: number, requesterId: number, createdAt: string, category: string | null): ReportTicket {
  return {
    id, subject: `Subject ${id}`, status: "solved", requesterId, organizationId: null,
    mentionedDomains: [], createdAt, category, gist: category ? `Gist ${id}` : null,
  };
}

describe("isWebsiteOnly", () => {
  it("means no Package and no Strategist", () => {
    expect(isWebsiteOnly(websiteClient)).toBe(true);
    expect(isWebsiteOnly(marketingClient)).toBe(false);
    // Former clients have no Package column at all; they are not website-only.
    expect(isWebsiteOnly(formerClient)).toBe(false);
  });
});

describe("buildReport", () => {
  const tickets = [
    ticket(1, 10, "2025-01-05T10:00:00Z", "Photo / image change"),
    ticket(2, 10, "2026-03-01T10:00:00Z", "Photo / image change"),
    ticket(3, 11, "2025-06-01T10:00:00Z", "Staff or doctor update"),
    ticket(4, 12, "2026-02-01T10:00:00Z", null),
    ticket(5, 13, "2026-04-01T10:00:00Z", null),
    ticket(6, 14, "2019-04-01T10:00:00Z", null),
    // Older than the two-year window: counted, but not in the request mix.
    ticket(7, 10, "2020-01-01T10:00:00Z", null),
  ];
  const matches = new Map<number, TicketMatch>([
    [1, { ticketId: 1, practice: websiteClient, method: "email-domain" }],
    [2, { ticketId: 2, practice: websiteClient, method: "email-domain" }],
    [3, { ticketId: 3, practice: websiteClient, method: "ticket-url" }],
    [4, { ticketId: 4, practice: marketingClient, method: "email-domain" }],
    [5, { ticketId: 5, practice: null, method: null, ignored: false }],
    [6, { ticketId: 6, practice: formerClient, method: "email-domain" }],
    [7, { ticketId: 7, practice: websiteClient, method: "email-domain" }],
  ]);
  const { tabs, summary } = buildReport({
    practices: [websiteClient, marketingClient, formerClient, formerQuiet],
    tickets,
    matches,
    users: [
      { id: 10, name: "Jane", email: "jane@happypawsvet.com", role: "end-user", organizationId: null },
      { id: 11, name: "Tom", email: "tom@beyondindigo.com", role: "agent", organizationId: null },
      { id: 12, name: "Ola", email: "ola@oakcreekvet.com", role: "end-user", organizationId: null },
      { id: 13, name: "Who", email: "who@gmail.com", role: "end-user", organizationId: null },
      { id: 14, name: "Ex", email: "ex@oldtownvet.com", role: "end-user", organizationId: null },
    ],
    organizations: [],
    basecampContacts: [{ practice: websiteClient, name: "Dr. Kim", email: "kim@happypawsvet.com", posts: 3, lastPostAt: "2026-05-01T00:00:00Z" }],
    internalDomains: ["beyondindigo.com"],
    zendeskHost: "beyondindigo.zendesk.com",
    unknownOverrideNames: [],
    overrideByEmail: new Map(),
    categoryCutoff: "2024-10-15T00:00:00.000Z",
    generatedAt: new Date("2026-10-15T12:00:00Z"),
  });
  const tab = (title: string) => tabs.find((t) => t.title === title)!.rows;

  it("lists every current client, then former clients that have tickets", () => {
    const clients = tab("Clients");
    expect(clients.map((r) => r[0])).toEqual(["Practice Name", "Happy Paws Vet", "Oak Creek Clinic", "Old Town Vet"]);
    const header = clients[0]!;
    const former = clients[3]!;
    expect(former[header.indexOf("Client Status")]).toBe("Former");
    expect(former[header.indexOf("Reason for Leaving")]).toBe("sold");
    expect(former[header.indexOf("Website Only?")]).toBe("No");
  });

  it("gives package, strategist, counts, last contact and the two-year request mix", () => {
    const clients = tab("Clients");
    const header = clients[0]!;
    const col = (name: string) => header.indexOf(name);
    const happy = clients.find((r) => r[0] === "Happy Paws Vet")!;
    const oak = clients.find((r) => r[0] === "Oak Creek Clinic")!;
    expect(happy[col("Website Only?")]).toBe("Yes");
    expect(happy[col("Package")]).toBe("");
    expect(happy[col("Launch Date")]).toBe("May 2022");
    expect(happy[col("Client Status")]).toBe("Current");
    expect(happy[col("Zendesk Tickets")]).toBe(4);
    expect(happy[col("Last Help Desk Contact")]).toBe("2026-03-01");
    expect(happy[col("What They Ask For (since 2024-10-15, by ticket count)")]).toBe("Photo / image change (2); Staff or doctor update (1)");
    // Staff who filed a ticket for the client are not the client's contacts.
    expect(happy[col("Zendesk Contacts")]).toBe("Jane <jane@happypawsvet.com> (3)");
    expect(happy[col("Basecamp Contacts")]).toBe("Dr. Kim <kim@happypawsvet.com>");
    expect(oak[col("Package")]).toBe("5.00");
    expect(oak[col("Strategist")]).toBe("Alex");
    expect(oak[col("Website Only?")]).toBe("No");
    expect(oak[col("Zendesk Tickets")]).toBe(1);
  });

  it("puts unmatched requesters on the Unmatched tab with an empty fix column", () => {
    const unmatched = tab("Unmatched");
    expect(unmatched[0]).toContain(UNMATCHED_ASSIGN_HEADER);
    expect(unmatched).toHaveLength(2);
    expect(unmatched[1]![0]).toBe("who@gmail.com");
    expect(unmatched[1]![unmatched[1]!.length - 1]).toBe("");
  });

  it("summarizes", () => {
    expect(summary).toMatchObject({
      tickets: 7,
      matchedTickets: 6,
      matchedCurrentTickets: 5,
      matchedFormerTickets: 1,
      formerClientsWithTickets: 1,
      unmatchedTickets: 1,
      clients: 2,
      clientsWithTickets: 2,
      websiteOnlyClients: 1,
      websiteOnlyWithTickets: 1,
      categorizeInScope: 4,
      uncategorized: 1,
    });
    expect(tab("Tickets")).toHaveLength(8);
  });
});
