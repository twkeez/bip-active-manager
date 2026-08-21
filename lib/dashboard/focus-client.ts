import type { SupabaseClient } from "@supabase/supabase-js";

export type FocusClient = { id: number; name: string };

/**
 * Resolves `?clientId=` into the client a portfolio-wide tool should narrow to.
 *
 * The radars (Conversion Integrity, PPC Defense) scan every account by design,
 * so arriving from a client workspace shouldn't change what was scanned — only
 * which findings are shown. Returns null when no client was asked for, or when
 * the id doesn't resolve, in which case the tool stays portfolio-wide.
 */
export async function resolveFocusClient(
  supabase: SupabaseClient,
  searchParams: Promise<{ clientId?: string }>,
): Promise<FocusClient | null> {
  const requested = Number((await searchParams).clientId);
  if (!Number.isInteger(requested) || requested <= 0) return null;

  const { data } = await supabase
    .from("clients")
    .select("id, account_name")
    .eq("id", requested)
    .maybeSingle();

  if (!data) return null;
  return { id: data.id as number, name: data.account_name as string };
}
