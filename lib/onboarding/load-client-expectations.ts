import type { SupabaseClient } from "@supabase/supabase-js";
import type { ClientRow } from "@/lib/types/client";
import { getClientActiveServices } from "@/lib/clients/service-active";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  resolveStrategistContacts,
  strategistDisplayName,
  type StaffProfile,
  type StrategistContact,
} from "@/lib/onboarding/expectation-people";
import type { GlossaryTerm } from "@/lib/onboarding/expectation-glossary";
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
  /** When onboarding started, e.g. "Jul 15, 2026". Null when not recorded. */
  kickoffDate: string | null;
  content: ServiceExpectationsModel;
};

/**
 * A fixed zone, so the same timestamp prints the same date wherever the page is
 * generated — a server in another zone would otherwise move a kickoff by a day.
 */
function formatKickoff(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

// Loads the client-expectations document model: the client's active services drive
// which service sections appear; the shared master blocks supply the copy. Content
// is service-default (no per-client override). Returns null if the client is missing.
export async function loadClientExpectations(
  supabase: SupabaseClient,
  clientId: number,
): Promise<ClientExpectationsModel | null> {
  const { data: clientRaw } = await supabase.from("clients").select("*").eq("id", clientId).maybeSingle();
  if (!clientRaw) return null;
  const client = clientRaw as ClientRow;

  const [{ data: blockRows }, { data: glossaryRows }] = await Promise.all([
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

  const content = assembleServiceExpectations(blocks, {
    clientName,
    strategist,
    city: client.city,
    activeServices: getClientActiveServices(client),
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

  return {
    clientName,
    strategist,
    strategistContacts,
    town: cityForCopy(client.city),
    kickoffDate: formatKickoff(client.onboarding_started_at),
    content,
  };
}
