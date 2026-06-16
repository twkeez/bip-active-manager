import { NextResponse } from "next/server";
import { getBasecampOAuthConfig, getInternalEmailDomains } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { markBasecampSyncError, runBasecampSync } from "@/lib/basecamp/sync";

export async function POST() {
  const hasSupabaseUrl = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim());
  const hasServiceRole = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim());
  if (!hasSupabaseUrl || !hasServiceRole) {
    return NextResponse.json(
      {
        error:
          "Missing Supabase server credentials. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local, then restart the dev server.",
      },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const hasClassicToken = Boolean(process.env.BASECAMP_ACCESS_TOKEN?.trim());
  const hasClassicUser = Boolean(
    (
      process.env.BASECAMP_BASIC_USER ??
      process.env.BASECAMP_USER_EMAIL ??
      ""
    ).trim(),
  );
  const hasClassicPassword = Boolean(process.env.BASECAMP_PASSWORD?.trim());
  const hasClassicAccountId = Boolean(process.env.BASECAMP_ACCOUNT_ID?.trim());
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const internalDomains = getInternalEmailDomains();
  let mode: "oauth" | "classic" = "oauth";
  try {
    getBasecampOAuthConfig();
    mode = "oauth";
  } catch {
    const canUseClassic = hasClassicAccountId && (hasClassicToken || (hasClassicUser && hasClassicPassword));
    if (!canUseClassic) {
      return NextResponse.json(
        {
          error:
            "Basecamp is not configured. Provide OAuth env (BASECAMP_CLIENT_ID/BASECAMP_CLIENT_SECRET) or Basecamp 2 env (BASECAMP_ACCOUNT_ID plus BASECAMP_ACCESS_TOKEN or BASECAMP_USER_EMAIL/BASECAMP_BASIC_USER + BASECAMP_PASSWORD).",
        },
        { status: 400 },
      );
    }
    mode = "classic";
  }
  const emailDomain = user.email?.toLowerCase().split("@")[1] ?? "";
  const domainAllowed =
    internalDomains.length === 0 || internalDomains.includes(emailDomain);
  if (!domainAllowed) {
    return NextResponse.json(
      { error: "Forbidden. Internal users only." },
      { status: 403 },
    );
  }

  try {
    const result = await runBasecampSync(mode);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sync failed";
    try {
      await markBasecampSyncError(message);
    } catch {
      // Ignore secondary logging/storage failures so the primary error response remains JSON.
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
