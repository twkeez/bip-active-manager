import { createClient } from "@supabase/supabase-js";
import { getSupabaseServiceRoleConfig } from "@/lib/env";

export function createAdminClient() {
  const { url, key } = getSupabaseServiceRoleConfig();
  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
