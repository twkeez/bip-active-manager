import { describe, expect, it } from "vitest";
import type { MasterSheetRow } from "@/lib/clients/master-sheet";
import { normalizeClientName } from "@/lib/clients/normalize-name";
import { matchTickets, suggestPractice, type MatchInput, type TicketForMatch } from "@/lib/help-desk/match";

function practice(practiceName: string, url: string | null): MasterSheetRow {
  return {
    practiceName,
    normalizedName: normalizeClientName(practiceName),
    url,
    city: null,
    state: null,
    packageValue: null,
    strategist: null,
  };
}

const happyPaws = practice("Happy Paws Veterinary Hospital", "happypawsvet.com");
const oakCreek = practice("Oak Creek Animal Clinic", "https://www.oakcreekvet.com/");
const sisterA = practice("Riverside Vet North", "riversidevets.com");
const sisterB = practice("Riverside Vet South", "riversidevets.com");

function ticket(id: number, requesterId: number | null, extra: Partial<TicketForMatch> = {}): TicketForMatch {
  return { id, requesterId, organizationId: null, mentionedDomains: [], ...extra };
}

function run(partial: Partial<MatchInput>) {
  return matchTickets({
    practices: [happyPaws, oakCreek, sisterA, sisterB],
    tickets: [],
    users: [],
    organizations: [],
    overrides: [],
    internalDomains: ["beyondindigo.com"],
    ...partial,
  });
}

describe("matchTickets", () => {
  it("matches on the requester's email domain", () => {
    const { matches } = run({
      tickets: [ticket(1, 10)],
      users: [{ id: 10, name: "Jane", email: "jane@happypawsvet.com", role: "end-user", organizationId: null }],
    });
    expect(matches.get(1)).toMatchObject({ practice: happyPaws, method: "email-domain" });
  });

  it("matches a Gmail requester by the URL written in the ticket", () => {
    const { matches } = run({
      tickets: [ticket(1, 10, { mentionedDomains: ["oakcreekvet.com", "gmail.com"] })],
      users: [{ id: 10, name: "Bob", email: "bob@gmail.com", role: "end-user", organizationId: null }],
    });
    expect(matches.get(1)).toMatchObject({ practice: oakCreek, method: "ticket-url" });
  });

  it("prefers the Zendesk organization's domain over everything but a manual fix", () => {
    const { matches } = run({
      tickets: [ticket(1, 10, { organizationId: 5, mentionedDomains: ["happypawsvet.com"] })],
      users: [{ id: 10, name: "Bob", email: "bob@gmail.com", role: "end-user", organizationId: 5 }],
      organizations: [{ id: 5, name: "Some Name", domainNames: ["oakcreekvet.com"] }],
    });
    expect(matches.get(1)).toMatchObject({ practice: oakCreek, method: "org-domain" });
  });

  it("falls back to the organization's name", () => {
    const { matches } = run({
      tickets: [ticket(1, 10, { organizationId: 5 })],
      users: [{ id: 10, name: "Bob", email: "bob@gmail.com", role: "end-user", organizationId: null }],
      organizations: [{ id: 5, name: "Happy Paws Vet Hospital", domainNames: [] }],
    });
    expect(matches.get(1)).toMatchObject({ practice: happyPaws, method: "org-name" });
  });

  it("does not guess when a domain belongs to two practices", () => {
    const { matches } = run({
      tickets: [ticket(1, 10)],
      users: [{ id: 10, name: "Sam", email: "sam@riversidevets.com", role: "end-user", organizationId: null }],
    });
    expect(matches.get(1)?.practice).toBeNull();
  });

  it("does not guess when a ticket names two practices' sites", () => {
    const { matches } = run({
      tickets: [ticket(1, null, { mentionedDomains: ["happypawsvet.com", "oakcreekvet.com"] })],
    });
    expect(matches.get(1)?.practice).toBeNull();
  });

  it("carries a client's match to their other tickets, but never a staff member's", () => {
    const { matches } = run({
      tickets: [
        ticket(1, 10, { mentionedDomains: ["happypawsvet.com"] }),
        ticket(2, 10),
        ticket(3, 20, { mentionedDomains: ["oakcreekvet.com"] }),
        ticket(4, 20),
      ],
      users: [
        { id: 10, name: "Jane", email: "jane@gmail.com", role: "end-user", organizationId: null },
        { id: 20, name: "Tom", email: "tom@beyondindigo.com", role: "agent", organizationId: null },
      ],
    });
    expect(matches.get(2)).toMatchObject({ practice: happyPaws, method: "same-requester" });
    expect(matches.get(4)?.practice).toBeNull();
  });

  it("applies manual fixes first, including IGNORE, and reports unknown names", () => {
    const { matches, unknownOverrideNames } = run({
      tickets: [ticket(1, 10), ticket(2, 20), ticket(3, 30)],
      users: [
        { id: 10, name: "Jane", email: "JANE@gmail.com", role: "end-user", organizationId: null },
        { id: 20, name: "Spam", email: "spam@example.org", role: "end-user", organizationId: null },
        { id: 30, name: "Ann", email: "ann@yahoo.com", role: "end-user", organizationId: null },
      ],
      overrides: [
        { requesterEmail: "jane@gmail.com", practiceName: "oak creek animal clinic" },
        { requesterEmail: "spam@example.org", practiceName: "ignore" },
        { requesterEmail: "ann@yahoo.com", practiceName: "Nowhere Vet" },
      ],
    });
    expect(matches.get(1)).toMatchObject({ practice: oakCreek, method: "override" });
    expect(matches.get(2)).toMatchObject({ practice: null, ignored: true });
    expect(matches.get(3)?.practice).toBeNull();
    expect(unknownOverrideNames).toEqual(["Nowhere Vet"]);
  });
});

describe("suggestPractice", () => {
  it("suggests by a near-identical domain", () => {
    expect(
      suggestPractice([happyPaws, oakCreek], { email: "frontdesk@happypawsvethospital.com" }),
    ).toBe(happyPaws);
  });

  it("suggests nothing for a mailbox provider", () => {
    expect(suggestPractice([happyPaws, oakCreek], { email: "someone@gmail.com" })).toBeNull();
  });
});
