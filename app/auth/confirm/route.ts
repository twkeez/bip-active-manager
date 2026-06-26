import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";

// Verifies an email/recovery token_hash and establishes a session, then sends the
// user on to `next`. Unlike the PKCE `?code=` + exchangeCodeForSession flow (which
// needs a code_verifier cookie from a client-initiated request), verifyOtp works
// for admin-generated and emailed links — so set-password links work in any
// browser. The link points at our own app, so it also doesn't depend on the
// Supabase redirect-URL allow-list.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/dashboard";

  if (tokenHash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
