import type { SupabaseClient } from "@supabase/supabase-js";
import type { ClientRow } from "@/lib/types/client";
import { getClientActiveServices } from "@/lib/clients/service-active";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  noteHeading,
  resolveStrategistContacts,
  strategistDisplayName,
  type StaffProfile,
  type StrategistContact,
} from "@/lib/onboarding/expectation-people";
import type { GlossaryTerm } from "@/lib/onboarding/expectation-glossary";
import { buildClientMarket, type ClientMarket, type DiscoveryResearch } from "@/lib/onboarding/client-market";
import { buildPlanTimeline, type PlanTimeline, type ServiceStartPlan } from "@/lib/onboarding/client-timeline";
import { applyDocumentEdits, type DocumentEdit } from "@/lib/onboarding/document-edits";
import { DEFAULT_SECTION_ORDER } from "@/lib/onboarding/document-order";
import type { ClientServiceKey } from "@/lib/clients/types";
import {
  assembleServiceExpectations,
  cityForCopy,
  type ExpectationBlock,
  type ServiceExpectationsModel,
} from "@/lib/onboarding/service-expectations";

export type ClientExpectationsModel = {
  clientName: string;
  /** Cleaned display name ("Melissa and Stephanie"), or "" when none is a person. */
  strategist: string;
  strategistContacts: StrategistContact[];
  /** The town alone — "Oshawa", not "Oshawa, Ontario, Canada". */
  town: string;
  /** Kickoff meeting, website timing, and which services wait for launch. */
  timeline: PlanTimeline;
  /**
   * The client-safe slice of onboarding research: market summary, search
   * landscape, nearby practices. Null when no research has been run.
   */
  market: ClientMarket | null;
  /**
   * What the client told us they want — services to push, areas, budget,
   * booking. Written per client in the document editor; there is no standard
   * wording, so it is empty until someone fills it in and only prints then.
   */
  priorities: string[];
  /** The order this client's sections print in. See document-order.ts. */
  sectionOrder: string[];
  /** The strategist's note for this client, trimmed. "" when none. */
  note: string;
  /** "A note from Stephanie". */
  noteHeading: string;
  content: ServiceExpectationsModel;
  /** What this client's saved edits changed. Empty when nothing was edited. */
  edits: { edited: string[]; hidden: string[] };
};

// Loads the client document: the client's active services drive which service
// sections appear and the shared master blocks supply the copy. Since
// 2026-09-16 it is also the onboarding report's client version — the two had
// drifted into contradicting each other — so it carries the kickoff timing and
// the client-safe part of the onboarding research as well. Returns null if the
// client is missing.
export async function loadClientExpectations(
  supabase: SupabaseClient,
  clientId: number,
  /**
   * "print" removes sections left out; "editor" keeps them so they can be
   * brought back; "standard" ignores this client's edits entirely.
   */
  { edits: editMode = "print" }: { edits?: "print" | "editor" | "standard" } = {},
): Promise<ClientExpectationsModel | null> {
  const { data: clientRaw } = await supabase.from("clients").select("*").eq("id", clientId).maybeSingle();
  if (!clientRaw) return null;
  const client = clientRaw as ClientRow;

  const [{ data: blockRows }, { data: glossaryRows }, { data: intake }, { data: editRows }] = await Promise.all([
    supabase
      .from("service_expectation_blocks")
      .select("block_key, body, sort_order")
      .order("sort_order", { ascending: true }),
    // A missing glossary table just means no definitions yet — the document is
    // still worth generating without them.
    supabase
      .from("expectation_glossary")
      .select("id, term, definition, services, sort_order")
      .order("sort_order", { ascending: true })
      .then((result) => (result.error ? { data: [] } : result)),
    supabase
      .from("client_onboarding_intake")
      .select("kickoff_meeting_at, web_status, website_launch_date, service_start_plan, discovery")
      .eq("client_id", clientId)
      .maybeSingle(),
    // No table yet (migration not run) reads as "no edits", not a broken document.
    supabase
      .from("client_document_edits")
      .select("section_key, body, hidden")
      .eq("client_id", clientId)
      .order("id", { ascending: true })
      .then((result) => (result.error ? { data: [] } : result)),
  ]);

  const glossary: GlossaryTerm[] = (glossaryRows ?? []).map((row) => ({
    id: row.id as number,
    term: (row.term as string) ?? "",
    definition: (row.definition as string) ?? "",
    services: ((row.services as string[]) ?? []) as ClientServiceKey[],
    sortOrder: (row.sort_order as number) ?? 0,
  }));

  const blocks = (blockRows ?? []) as ExpectationBlock[];
  // Staff names and emails are read with the service role. Profiles are
  // readable only by their owner and by admins, so with the viewer's own client
  // a team member would see no strategist unless it happened to be them, and
  // the same document would read differently depending on who generated it.
  const { data: staffRows } = await createAdminClient()
    .from("profiles")
    .select("full_name, email");
  const strategistContacts = resolveStrategistContacts(
    client.marketing_strategist,
    (staffRows ?? []) as StaffProfile[],
  );

  const clientName = client.account_name;
  const strategist = strategistDisplayName(strategistContacts);

  const activeServices = getClientActiveServices(client);
  const content = assembleServiceExpectations(blocks, {
    clientName,
    strategist,
    city: client.city,
    activeServices,
    // The raw values decide each service's tier, and so which "What to expect"
    // the client reads.
    serviceValues: {
      seo: client.seo,
      ppc: client.ppc,
      smm: client.smm,
      blog: client.blog,
      orm: client.orm,
    },
    glossary,
  });

  const timeline = buildPlanTimeline({
    kickoffMeetingAt: intake?.kickoff_meeting_at as string | null | undefined,
    onboardingStartedAt: client.onboarding_started_at,
    webStatus: intake?.web_status as string | null | undefined,
    websiteLaunchDate: intake?.website_launch_date as string | null | undefined,
    servicePlan: (intake?.service_start_plan ?? null) as ServiceStartPlan,
    activeServices: (Object.keys(activeServices) as ClientServiceKey[]).filter((key) => activeServices[key]),
  });

  const standard: ClientExpectationsModel = {
    clientName,
    strategist,
    strategistContacts,
    town: cityForCopy(client.city),
    timeline,
    market: buildClientMarket((intake?.discovery ?? null) as DiscoveryResearch),
    priorities: [],
    sectionOrder: DEFAULT_SECTION_ORDER,
    note: (client.expectations_note ?? "").trim(),
    noteHeading: noteHeading(strategistContacts),
    content,
    edits: { edited: [], hidden: [] },
  };

  if (editMode === "standard") return standard;
  const saved: DocumentEdit[] = (editRows ?? []).map((row) => ({
    sectionKey: row.section_key as string,
    body: (row.body as string | null) ?? null,
    hidden: Boolean(row.hidden),
  }));
  const applied = applyDocumentEdits(standard, saved, { keepHidden: editMode === "editor" });
  return { ...applied.model, edits: { edited: applied.edited, hidden: applied.hidden } };
}
