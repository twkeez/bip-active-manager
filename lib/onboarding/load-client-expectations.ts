import type { SupabaseClient } from "@supabase/supabase-js";
import type { ClientRow } from "@/lib/types/client";
import { getClientActiveServices } from "@/lib/clients/service-active";
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

  const { data: blockRows } = await supabase
    .from("service_expectation_blocks")
    .select("block_key, body, sort_order")
    .order("sort_order", { ascending: true });

  const blocks = (blockRows ?? []) as ExpectationBlock[];
  const clientName = client.account_name;
  const strategist = client.marketing_strategist ?? "";

  const content = assembleServiceExpectations(blocks, {
    clientName,
    strategist,
    activeServices: getClientActiveServices(client),
  });

  return { clientName, strategist, content };
}
