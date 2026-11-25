import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import type { UserProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";

/**
 * The one access check for API routes. Every route either calls one of these,
 * carries its own credential check (cron secret, OAuth state, MCP token), or is
 * listed with its reason in lib/auth/route-access.test.ts, which fails the build
 * otherwise.
 *
 *   const auth = await requireSignedIn();
 *   if ("response" in auth) return auth.response;
 *   const { supabase, profile } = auth;
 *
 * Unlike getProfile(), a failed profile read is reported (503) rather than
 * looking like a signed-out caller.
 */

export type GuardPass = { supabase: SupabaseClient; profile: UserProfile };
export type GuardFail = { response: NextResponse };

export async function requireSignedIn(): Promise<GuardPass | GuardFail> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { response: NextResponse.json({ error: "Sign in first." }, { status: 401 }) };
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, full_name, role")
    .eq("id", user.id)
    .maybeSingle();
  if (error) {
    return {
      response: NextResponse.json(
        { error: `Could not read your profile: ${error.message}` },
        { status: 503 },
      ),
    };
  }
  if (!data) {
    return { response: NextResponse.json({ error: "No profile for this account." }, { status: 403 }) };
  }
  return { supabase, profile: data as UserProfile };
}

export async function requireAdminRole(): Promise<GuardPass | GuardFail> {
  const auth = await requireSignedIn();
  if ("response" in auth) return auth;
  if (auth.profile.role !== "admin") {
    return { response: NextResponse.json({ error: "Admins only." }, { status: 403 }) };
  }
  return auth;
}
