import type { SupabaseClient } from "@supabase/supabase-js";
import type { ClientRow } from "@/lib/types/client";
import { getClientActiveServices } from "@/lib/clients/service-active";
import type { GlossaryTerm } from "@/lib/onboarding/expectation-glossary";
import type { ClientServiceKey } from "@/lib/clients/types";
import {
  assembleServiceExpectations,
  type ExpectationBlock,
  type ServiceExpectationsModel,
} from "@/lib/onboarding/service-expectations";

export type ClientExpectationsModel = {
  clientName: string;
  strategist: string;
  content: ServiceExpectationsModel;
};

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
  const clientName = client.account_name;
  const strategist = client.marketing_strategist ?? "";

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

  return { clientName, strategist, content };
}
