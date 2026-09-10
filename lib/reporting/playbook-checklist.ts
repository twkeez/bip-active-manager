import type { createClient } from "@/lib/supabase/server";
import { getClientTierKeys } from "@/lib/playbook/client-tiers";
import type { PlaybookItem } from "@/lib/playbook/types";
import { runVerifications } from "@/lib/playbook/verify";
import type { ClientRow } from "@/lib/types/client";
import type { ClientReportModel } from "@/lib/reporting/types";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

// Active playbook items for the client's service tiers, each auto-verified
// where possible. Tier keys come from getClientTierKeys (e.g. "Premium" SEO →
// "seo-premium"), matching playbook_items.tier_key.
export async function loadPlaybookChecklist(
  supabase: ServerClient,
  client: ClientRow,
): Promise<ClientReportModel["playbookChecklist"]> {
  const tierKeys = getClientTierKeys(client);
  if (tierKeys.length === 0) return [];

  const { data } = await supabase
    .from("playbook_items")
    .select("id,title,category,tier_key,type,auto_verify_key,sort_order,is_active")
    .in("tier_key", tierKeys)
    .eq("is_active", true)
    .order("sort_order")
    .order("id");
  const items = (data ?? []) as PlaybookItem[];

  return items.map((item) => {
    const verifyResult = item.auto_verify_key ? runVerifications([item.auto_verify_key], client)[0] ?? null : null;
    return {
      id: item.id,
      title: item.title,
      category: item.category,
      tier_key: item.tier_key,
      type: item.type,
      status: verifyResult ? (verifyResult.pass ? "pass" : "fail") : "manual",
      verify_label: verifyResult?.label ?? null,
    };
  });
}
