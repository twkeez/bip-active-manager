import { createClient } from "@supabase/supabase-js";
import { guardedFetch } from "@/lib/data-integrity/server";
import { getSupabaseServiceRoleConfig } from "@/lib/env";

export function createAdminClient() {
  const { url, key } = getSupabaseServiceRoleConfig();
  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    // Every read is checked for the silent 1000-row cap (lib/data-integrity).
    global: { fetch: guardedFetch },
  });
}
