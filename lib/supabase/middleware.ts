import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { getSupabasePublicConfig } from "@/lib/env";

export type RefreshedSession = {
  /** Carries any refreshed auth cookies; return it, or copy its cookies. */
  response: NextResponse;
  supabase: SupabaseClient;
  user: User | null;
};

/** Refreshes the auth cookies and reports who is signed in. */
export async function refreshSession(request: NextRequest): Promise<RefreshedSession> {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const { url, key } = getSupabasePublicConfig();

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { response: supabaseResponse, supabase, user };
}

export async function updateSession(request: NextRequest) {
  return (await refreshSession(request)).response;
}
