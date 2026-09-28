import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { guardedFetch } from "@/lib/data-integrity/server";
import { getSupabasePublicConfig } from "@/lib/env";

export async function createClient() {
  const cookieStore = await cookies();
  const { url, key } = getSupabasePublicConfig();

  return createServerClient(url, key, {
    // Every read is checked for the silent 1000-row cap (lib/data-integrity).
    global: { fetch: guardedFetch },
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Called from a Server Component; middleware refreshes sessions.
        }
      },
    },
  });
}
