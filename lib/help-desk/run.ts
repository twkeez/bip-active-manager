import { matchToMasterSheet, type MasterSheetRow } from "@/lib/clients/master-sheet";
import { fetchAllRows } from "@/lib/data-integrity/fetch-all";
import { getZendeskConfig } from "@/lib/env";
import { readSheetTab, sheetUrl, writeSheetTabs } from "@/lib/google/sheets-writer";
import { categorizeCutoff } from "@/lib/help-desk/categorize";
import { loadMatchContext } from "@/lib/help-desk/context";
import { emailDomain } from "@/lib/help-desk/domains";
import { isInternalEmail, buildDomainIndex, practiceForDomain } from "@/lib/help-desk/match";
import {
  buildReport,
  UNMATCHED_ASSIGN_HEADER,
  UNMATCHED_EMAIL_HEADER,
  type BasecampContact,
} from "@/lib/help-desk/report";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Builds the help desk report from what is already in Supabase (run the
 * Zendesk sync first) and writes it to the report's Google Sheet.
 */

/** "Help Desk Report" in Tom's Drive. Override to move it. */
const DEFAULT_REPORT_SHEET_ID = "1gaFBgQBIvvhOWPg7oeP4KUa7vjKuHJhBUxg6CWCKSOk";

export function getHelpDeskReportSheetId() {
  return (process.env.HELP_DESK_REPORT_SHEET_ID ?? "").trim() || DEFAULT_REPORT_SHEET_ID;
}

type Admin = ReturnType<typeof createAdminClient>;

/**
 * Saves whatever was typed into the Unmatched tab's last column on the
 * previous run, before that tab is overwritten.
 */
async function saveFixesFromSheet(admin: Admin, sheetId: string, savedBy: string | null) {
  const rows = await readSheetTab(sheetId, "Unmatched");
  if (rows.length < 2) return 0;
  const header = rows[0]!.map((h) => h.trim());
  const emailCol = header.indexOf(UNMATCHED_EMAIL_HEADER);
  const assignCol = header.indexOf(UNMATCHED_ASSIGN_HEADER);
  if (emailCol === -1 || assignCol === -1) return 0;

  const fixes = new Map<string, string>();
  for (const row of rows.slice(1)) {
    const email = (row[emailCol] ?? "").trim().toLowerCase();
    const practice = (row[assignCol] ?? "").trim();
    if (email.includes("@") && practice) fixes.set(email, practice);
  }
  if (fixes.size === 0) return 0;
  const { error } = await admin.from("help_desk_match_overrides").upsert(
    [...fixes].map(([value, practice_name]) => ({
      kind: "requester_email",
      value,
      practice_name,
      created_by: savedBy,
    })),
    { onConflict: "kind,value" },
  );
  if (error) throw new Error(`help_desk_match_overrides: ${error.message}`);
  return fixes.size;
}

/**
 * Client-side people who have posted in each practice's Basecamp project.
 * A project counts as the practice's when its name matches the Master Sheet
 * name; failing that, a poster whose email domain is the practice's URL still
 * counts.
 */
async function loadBasecampContacts(admin: Admin, practices: MasterSheetRow[], internalDomains: string[]) {
  const projects = await fetchAllRows<{ basecamp_project_id: string; name: string }>(
    (from, to) =>
      admin.from("basecamp_projects").select("basecamp_project_id, name").order("basecamp_project_id").range(from, to),
    "basecamp_projects",
  );
  const projectPractice = new Map<string, MasterSheetRow>();
  for (const project of projects) {
    const match = matchToMasterSheet(project.name, practices);
    if (match.row) projectPractice.set(project.basecamp_project_id, match.row);
  }

  const events = await fetchAllRows<{
    basecamp_project_id: string;
    author_email: string | null;
    author_name: string | null;
    occurred_at: string | null;
  }>(
    (from, to) =>
      admin
        .from("basecamp_communication_events")
        .select("basecamp_project_id, author_email, author_name, occurred_at")
        .eq("is_internal", false)
        .not("author_email", "is", null)
        .order("id")
        .range(from, to),
    "basecamp_communication_events",
  );

  const domainIndex = buildDomainIndex(practices);
  const contacts = new Map<string, BasecampContact>();
  for (const event of events) {
    const email = (event.author_email ?? "").trim().toLowerCase();
    if (!email || isInternalEmail(email, internalDomains)) continue;
    const practice =
      projectPractice.get(event.basecamp_project_id) ??
      practiceForDomain(emailDomain(email), domainIndex, internalDomains);
    if (!practice) continue;
    const key = `${practice.normalizedName}|${email}`;
    const contact = contacts.get(key) ?? { practice, name: null, email, posts: 0, lastPostAt: null };
    contact.posts += 1;
    if (event.author_name) contact.name = event.author_name;
    if (event.occurred_at && (!contact.lastPostAt || event.occurred_at > contact.lastPostAt)) {
      contact.lastPostAt = event.occurred_at;
    }
    contacts.set(key, contact);
  }
  return { contacts: [...contacts.values()], projectsMatched: projectPractice.size, projects: projects.length };
}

export type HelpDeskReportResult = {
  sheetUrl: string;
  fixesSaved: number;
  summary: Record<string, number | string>;
};

export async function buildHelpDeskReport(ranBy: string | null): Promise<HelpDeskReportResult> {
  const admin = createAdminClient();
  const sheetId = getHelpDeskReportSheetId();

  // Before loading the overrides, so fixes typed since the last run count.
  const fixesSaved = await saveFixesFromSheet(admin, sheetId, ranBy);
  const context = await loadMatchContext(admin);
  const { practices, internalDomains } = context;

  const basecamp = await loadBasecampContacts(admin, practices, internalDomains);

  const { tabs, summary } = buildReport({
    practices,
    tickets: context.tickets,
    matches: context.matches,
    users: context.users,
    organizations: context.organizations,
    basecampContacts: basecamp.contacts,
    internalDomains,
    zendeskHost: `${getZendeskConfig()?.subdomain ?? "beyondindigo"}.zendesk.com`,
    unknownOverrideNames: context.unknownOverrideNames,
    overrideByEmail: new Map(context.overrides.map((o) => [o.value, o.practice_name])),
    categoryCutoff: categorizeCutoff(),
    formerWarning: context.formerWarning,
    generatedAt: new Date(),
  });

  await writeSheetTabs(sheetId, tabs);

  const fullSummary = {
    ...summary,
    fixesSaved,
    basecampProjects: basecamp.projects,
    basecampProjectsMatched: basecamp.projectsMatched,
    basecampContacts: basecamp.contacts.length,
  };
  await admin.from("help_desk_report_runs").insert({ ran_by: ranBy, summary: fullSummary });

  return { sheetUrl: sheetUrl(sheetId), fixesSaved, summary: fullSummary };
}
