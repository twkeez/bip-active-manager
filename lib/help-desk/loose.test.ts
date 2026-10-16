import { describe, expect, it } from "vitest";
import type { MasterSheetRow } from "@/lib/clients/master-sheet";
import { normalizeClientName } from "@/lib/clients/normalize-name";
import { applyHighConfidenceGuesses } from "@/lib/help-desk/loose";
import type { TicketMatch } from "@/lib/help-desk/match";

function practice(practiceName: string, url: string, former = false): MasterSheetRow {
  return { practiceName, normalizedName: normalizeClientName(practiceName), url, city: null, state: null, packageValue: null, strategist: null, former };
}

const quitman = practice("Quitman Animal Clinic", "quitmanvetclinic.com");
const oldOak = practice("Old Oak Veterinary Clinic", "oldoakvet.com", true);
const schertz = practice("Schertz Animal Hospital", "schertzvet.com");

describe("applyHighConfidenceGuesses", () => {
  it("accepts High guesses for current clients only, and leaves hand fixes alone", () => {
    const unmatched = (id: number): TicketMatch => ({ ticketId: id, practice: null, method: null, ignored: false });
    const matches = new Map<number, TicketMatch>([
      [1, unmatched(1)],
      [2, unmatched(2)],
      [3, unmatched(3)],
      [4, unmatched(4)],
      [5, { ticketId: 5, practice: null, method: null, ignored: true }],
      [6, unmatched(6)],
    ]);
    const applied = applyHighConfidenceGuesses({
      practices: [quitman, oldOak, schertz],
      tickets: [1, 2, 3, 4, 5, 6].map((id) => ({ id, requesterId: id <= 2 ? 10 : id + 10, organizationId: null, mentionedDomains: [] })),
      matches,
      users: [
        { id: 10, name: null, email: "quitmananimalclinic@gmail.com", role: "end-user", organizationId: null }, // High, current
        { id: 13, name: null, email: "oldoakvet@gmail.com", role: "end-user", organizationId: null }, // High, but former
        { id: 14, name: null, email: "schertzanimalhosptech@gmail.com", role: "end-user", organizationId: null }, // Medium
        { id: 15, name: null, email: "quitmananimalclinic@yahoo.com", role: "end-user", organizationId: null }, // IGNOREd by hand
        { id: 16, name: null, email: "quitmananimalclinic@beyondindigo.com", role: "agent", organizationId: null }, // staff
      ],
      organizations: [],
      internalDomains: ["beyondindigo.com"],
    });
    expect(applied).toBe(2);
    expect(matches.get(1)).toMatchObject({ practice: quitman, method: "loose-high" });
    expect(matches.get(2)).toMatchObject({ practice: quitman, method: "loose-high" });
    expect(matches.get(3)?.practice).toBeNull();
    expect(matches.get(4)?.practice).toBeNull();
    expect(matches.get(5)).toMatchObject({ ignored: true });
    expect(matches.get(6)?.practice).toBeNull();
  });
});
