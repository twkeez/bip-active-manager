import type { MasterSheetRow } from "@/lib/clients/master-sheet";
import { isSystemSender } from "@/lib/help-desk/domains";
import {
  isInternalEmail,
  type TicketMatch,
  type ZendeskOrgForMatch,
  type ZendeskUserForMatch,
} from "@/lib/help-desk/match";
import { suggestPracticeForRequester } from "@/lib/help-desk/suggest";

/**
 * Accepts the loose guesses that need no review: High confidence, pointing at
 * a current client. Agreed with Tom on the first live run — those were the
 * "quitmananimalclinic@gmail.com" cases, right on inspection.
 *
 * Applied fresh on every run rather than saved, so a rule fix reaches them,
 * and recorded as their own match method so the sheet always shows which
 * tickets got here this way. A hand fix (override or IGNORE) is applied
 * before this and always wins; former-client and Medium/Low guesses still
 * wait for a "Y" on the Unmatched tab.
 */

export type LooseTicket = {
  id: number;
  requesterId: number | null;
  organizationId: number | null;
  mentionedDomains: string[];
  subject?: string | null;
};

export function applyHighConfidenceGuesses(input: {
  practices: MasterSheetRow[];
  tickets: LooseTicket[];
  matches: Map<number, TicketMatch>;
  users: ZendeskUserForMatch[];
  organizations: ZendeskOrgForMatch[];
  internalDomains: string[];
}): number {
  const users = new Map(input.users.map((u) => [u.id, u]));
  const organizations = new Map(input.organizations.map((o) => [o.id, o]));

  const unmatched = new Map<number, LooseTicket[]>();
  for (const ticket of input.tickets) {
    const match = input.matches.get(ticket.id);
    if (!ticket.requesterId || match?.practice || (match && "ignored" in match && match.ignored)) continue;
    const list = unmatched.get(ticket.requesterId) ?? [];
    list.push(ticket);
    unmatched.set(ticket.requesterId, list);
  }

  let applied = 0;
  for (const [requesterId, list] of unmatched) {
    const user = users.get(requesterId);
    if (isInternalEmail(user?.email ?? null, input.internalDomains)) continue;
    if (isSystemSender(user?.email, user?.name)) continue;
    const orgId = list.find((t) => t.organizationId)?.organizationId ?? user?.organizationId ?? null;
    const suggestion = suggestPracticeForRequester(input.practices, {
      email: user?.email,
      requesterName: user?.name,
      organizationName: orgId ? organizations.get(orgId)?.name : null,
      mentionedDomains: [...new Set(list.flatMap((t) => t.mentionedDomains))],
      subjects: list.slice(0, 30).map((t) => t.subject ?? "").filter(Boolean),
    });
    if (suggestion?.confidence !== "High" || suggestion.practice.former) continue;
    for (const ticket of list) {
      input.matches.set(ticket.id, { ticketId: ticket.id, practice: suggestion.practice, method: "loose-high" });
      applied += 1;
    }
  }
  return applied;
}
