import { createBrowserClient } from "@supabase/ssr";
import { browserGuardedFetch } from "@/lib/data-integrity/browser";
import { getSupabasePublicConfig } from "@/lib/env";

export function createClient() {
  const { url, key } = getSupabasePublicConfig();
  // Every read is checked for the silent 1000-row cap (lib/data-integrity).
  return createBrowserClient(url, key, { global: { fetch: browserGuardedFetch } });
}
