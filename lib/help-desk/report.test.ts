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
  };
}

const websiteClient = practice("Happy Paws Vet", "happypawsvet.com");
const marketingClient = practice("Oak Creek Clinic", "oakcreekvet.com", true);

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
  });
});

describe("buildReport", () => {
  const tickets = [
    ticket(1, 10, "2025-01-05T10:00:00Z", "Photo / image change"),
    ticket(2, 10, "2026-03-01T10:00:00Z", "Photo / image change"),
    ticket(3, 11, "2025-06-01T10:00:00Z", "Staff or doctor update"),
    ticket(4, 12, "2026-02-01T10:00:00Z", null),
    ticket(5, 13, "2026-04-01T10:00:00Z", null),
  ];
  const matches = new Map<number, TicketMatch>([
    [1, { ticketId: 1, practice: websiteClient, method: "email-domain" }],
    [2, { ticketId: 2, practice: websiteClient, method: "email-domain" }],
    [3, { ticketId: 3, practice: websiteClient, method: "ticket-url" }],
    [4, { ticketId: 4, practice: marketingClient, method: "email-domain" }],
    [5, { ticketId: 5, practice: null, method: null, ignored: false }],
  ]);
  const { tabs, summary } = buildReport({
    practices: [websiteClient, marketingClient],
    tickets,
    matches,
    users: [
      { id: 10, name: "Jane", email: "jane@happypawsvet.com", role: "end-user", organizationId: null },
      { id: 11, name: "Tom", email: "tom@beyondindigo.com", role: "agent", organizationId: null },
      { id: 12, name: "Ola", email: "ola@oakcreekvet.com", role: "end-user", organizationId: null },
      { id: 13, name: "Who", email: "who@gmail.com", role: "end-user", organizationId: null },
    ],
    organizations: [],
    basecampContacts: [{ practice: websiteClient, name: "Dr. Kim", email: "kim@happypawsvet.com", posts: 3, lastPostAt: "2026-05-01T00:00:00Z" }],
    internalDomains: ["beyondindigo.com"],
    zendeskHost: "beyondindigo.zendesk.com",
    unknownOverrideNames: [],
    overrideByEmail: new Map(),
    generatedAt: new Date("2026-10-15T12:00:00Z"),
  });
  const tab = (title: string) => tabs.find((t) => t.title === title)!.rows;

  it("lists only website-only clients, with counts, last contact and request mix", () => {
    const clients = tab("Clients");
    expect(clients).toHaveLength(2);
    const row = clients[1]!;
    expect(row[0]).toBe("Happy Paws Vet");
    expect(row[3]).toBe(3);
    expect(row[4]).toBe("2026-03-01");
    expect(row[5]).toBe("Photo / image change (2); Staff or doctor update (1)");
    // Staff who filed a ticket for the client are not the client's contacts.
    expect(row[7]).toBe("Jane <jane@happypawsvet.com> (2)");
    expect(row[8]).toBe("Dr. Kim <kim@happypawsvet.com>");
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
      tickets: 5,
      matchedTickets: 4,
      unmatchedTickets: 1,
      websiteOnlyClients: 1,
      websiteOnlyWithTickets: 1,
      uncategorized: 2,
    });
    expect(tab("Tickets")).toHaveLength(6);
  });
});
