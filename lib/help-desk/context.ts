import { parseMasterSheetRows, type MasterSheetRow } from "@/lib/clients/master-sheet";
import { fetchAllRows } from "@/lib/data-integrity/fetch-all";
import { getInternalEmailDomains } from "@/lib/env";
import { fetchMasterSheetRows } from "@/lib/google/master-sheet-source";
import { isLikelyWebsite } from "@/lib/help-desk/domains";
import {
  combinePractices,
  matchTickets,
  type MatchResult,
  type ZendeskOrgForMatch,
  type ZendeskUserForMatch,
} from "@/lib/help-desk/match";
import type { ReportTicket } from "@/lib/help-desk/report";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Everything the matching needs, loaded once: both Master Sheet tabs and the
 * Zendesk copy in Supabase. Shared by the report (which writes the sheet) and
 * the categorizer (which only sorts tickets that matched a current client).
 */

/** The Master Sheet tab of practices we no longer serve. */
export const FORMER_CLIENTS_TAB = "Clients Who Left";

/** Our domains: configured ones plus Beyond Indigo's, which must never count as a client's. */
export function helpDeskInternalDomains() {
  return [...new Set([...getInternalEmailDomains(), "beyondindigo.com", "beyondindigopets.com"])];
}

export type MatchContext = MatchResult & {
  practices: MasterSheetRow[];
  currentCount: number;
  formerCount: number;
  /** Set when the former-clients tab could not be read; the report still runs. */
  formerWarning: string | null;
  tickets: (ReportTicket & { categorized: boolean })[];
  users: ZendeskUserForMatch[];
  organizations: ZendeskOrgForMatch[];
  overrides: { value: string; practice_name: string }[];
  internalDomains: string[];
};

type Admin = ReturnType<typeof createAdminClient>;

export async function loadMatchContext(admin: Admin): Promise<MatchContext> {
  const internalDomains = helpDeskInternalDomains();

  const current = parseMasterSheetRows(await fetchMasterSheetRows());
  if (current.length < 25) {
    throw new Error(`Only ${current.length} practices came back from the Master Sheet — that looks like a partial read, so nothing was written.`);
  }
  let former: MasterSheetRow[] = [];
  let formerWarning: string | null = null;
  try {
    former = parseMasterSheetRows(await fetchMasterSheetRows(FORMER_CLIENTS_TAB));
    if (former.length === 0) formerWarning = `The "${FORMER_CLIENTS_TAB}" tab had no Practice Name column, so former clients were not matched.`;
  } catch (error) {
    formerWarning = `Could not read "${FORMER_CLIENTS_TAB}": ${error instanceof Error ? error.message : String(error)}`;
  }
  const practices = combinePractices(current, former);

  const [overrides, organizations, users, tickets] = await Promise.all([
    fetchAllRows<{ value: string; practice_name: string }>(
      (from, to) => admin.from("help_desk_match_overrides").select("value, practice_name").order("id").range(from, to),
      "help_desk_match_overrides",
    ),
    fetchAllRows<{ id: number; name: string; domain_names: string[] | null }>(
      (from, to) => admin.from("zendesk_organizations").select("id, name, domain_names").order("id").range(from, to),
      "zendesk_organizations",
    ),
    fetchAllRows<{ id: number; name: string | null; email: string | null; role: string | null; organization_id: number | null }>(
      (from, to) => admin.from("zendesk_users").select("id, name, email, role, organization_id").order("id").range(from, to),
      "zendesk_users",
    ),
    fetchAllRows<{
      id: number;
      subject: string | null;
      status: string | null;
      requester_id: number | null;
      organization_id: number | null;
      mentioned_domains: string[] | null;
      source_created_at: string | null;
      category: string | null;
      gist: string | null;
      categorized_at: string | null;
    }>(
      (from, to) =>
        admin
          .from("zendesk_tickets")
          .select("id, subject, status, requester_id, organization_id, mentioned_domains, source_created_at, category, gist, categorized_at")
          .order("id")
          .range(from, to),
      "zendesk_tickets",
    ),
  ]);
  if (tickets.length === 0) {
    throw new Error("No Zendesk tickets have been synced yet — run the Zendesk sync first.");
  }

  const zendeskUsers = users.map((u) => ({
    id: u.id, name: u.name, email: u.email, role: u.role, organizationId: u.organization_id,
  }));
  const zendeskOrgs = organizations.map((o) => ({ id: o.id, name: o.name, domainNames: o.domain_names ?? [] }));
  const contextTickets = tickets.map((t) => ({
    id: t.id,
    subject: t.subject,
    status: t.status,
    requesterId: t.requester_id,
    organizationId: t.organization_id,
    // Older syncs saved page names ("services.html") too; drop them here.
    mentionedDomains: (t.mentioned_domains ?? []).filter(isLikelyWebsite),
    createdAt: t.source_created_at,
    category: t.category,
    gist: t.gist,
    categorized: Boolean(t.categorized_at),
  }));

  const match = matchTickets({
    practices,
    tickets: contextTickets,
    users: zendeskUsers,
    organizations: zendeskOrgs,
    overrides: overrides.map((o) => ({ requesterEmail: o.value, practiceName: o.practice_name })),
    internalDomains,
  });

  return {
    ...match,
    practices,
    currentCount: current.length,
    formerCount: practices.length - current.length,
    formerWarning,
    tickets: contextTickets,
    users: zendeskUsers,
    organizations: zendeskOrgs,
    overrides,
    internalDomains,
  };
}
