import { NextResponse } from "next/server";
import { requireSignedIn } from "@/lib/auth/guard";
import { isAdmin } from "@/lib/auth/profile";
import { rejectUnlessClientVisible } from "@/lib/reporting/client-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { listSource } from "@/lib/connections/sources";
import { storedStatus, suggestOptions, validateChoice, type SourceKey } from "@/lib/connections/match";

/**
 * The Connections picker for one client: Search Console, GA4 and Google Ads.
 *
 * GET ?source=… lists what the agency's own Google access can read, the
 * entries that look like this client, where the stored value stands, and what
 * to ask the practice for when it isn't listed. Read-only, at Google too.
 *
 * PUT { source, value } saves a choice on the client. It goes through the
 * caller's own session, so the clients table's rule decides who may change
 * which client, exactly as the Connections tab's Edit button does.
 *
 * Any signed-in person may use it for a client they can see: strategists
 * connect their own clients' sources (Tom, Nov 25).
 */

const COLUMN: Record<SourceKey, "sc_url" | "ga4_property_id" | "ads_customer_id"> = {
  search_console: "sc_url",
  ga4: "ga4_property_id",
  ads: "ads_customer_id",
};

type ClientFields = {
  id: number;
  account_name: string;
  website: string | null;
  sc_url: string | null;
  ga4_property_id: string | null;
  ga4_id: string | null;
  ads_customer_id: string | null;
};

function parseSource(value: unknown): SourceKey | null {
  return value === "search_console" || value === "ga4" || value === "ads" ? value : null;
}

function parseClientId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireSignedIn();
  if ("response" in auth) return auth.response;
  const clientId = parseClientId((await context.params).id);
  if (!clientId) return NextResponse.json({ error: "Invalid client ID" }, { status: 400 });
  const source = parseSource(new URL(request.url).searchParams.get("source"));
  if (!source) return NextResponse.json({ error: "source must be search_console, ga4 or ads" }, { status: 400 });

  const rejected = await rejectUnlessClientVisible(auth.supabase, clientId);
  if (rejected) return rejected;

  const { data: client, error } = await auth.supabase
    .from("clients")
    .select("id,account_name,website,sc_url,ga4_property_id,ga4_id,ads_customer_id")
    .eq("id", clientId)
    .single<ClientFields>();
  if (error || !client) {
    return NextResponse.json({ error: `Could not read the client: ${error?.message ?? "not found"}` }, { status: 500 });
  }

  const listing = await listSource(source, createAdminClient());
  // GA4 used to be stored in either column; the one a sync would read decides.
  const stored =
    source === "ga4"
      ? (client.ga4_property_id ?? "").trim() || (client.ga4_id ?? "").trim() || null
      : client[COLUMN[source]];
  return NextResponse.json({
    source,
    stored: stored ?? null,
    status: storedStatus(source, stored, listing.options),
    suggested: suggestOptions(source, client, listing.options).map((option) => option.value),
    options: listing.options,
    failures: listing.failures,
    grantAccess: listing.grantAccess,
  });
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireSignedIn();
  if ("response" in auth) return auth.response;
  const clientId = parseClientId((await context.params).id);
  if (!clientId) return NextResponse.json({ error: "Invalid client ID" }, { status: 400 });

  const body = (await request.json().catch(() => null)) as { source?: unknown; value?: unknown } | null;
  const source = parseSource(body?.source);
  if (!source) return NextResponse.json({ error: "source must be search_console, ga4 or ads" }, { status: 400 });
  const choice = validateChoice(source, body?.value);
  if ("error" in choice) return NextResponse.json({ error: choice.error }, { status: 400 });

  const rejected = await rejectUnlessClientVisible(auth.supabase, clientId);
  if (rejected) return rejected;

  if (source === "ads") {
    // Two clients on one account would double-count spend, and usually means
    // the wrong one was picked from a group that shares a name.
    const { data: clashes, error: clashError } = await createAdminClient()
      .from("clients")
      .select("id,account_name")
      .eq("ads_customer_id", choice.value)
      .neq("id", clientId)
      .limit(1);
    if (clashError) {
      return NextResponse.json({ error: `Could not check whether the account is in use: ${clashError.message}` }, { status: 503 });
    }
    const clash = (clashes ?? [])[0] as { account_name: string } | undefined;
    if (clash) {
      const who = isAdmin(auth.profile) ? clash.account_name : "another client";
      return NextResponse.json({ error: `That Google Ads account is already connected to ${who}.` }, { status: 409 });
    }
  }

  const { data: updated, error } = await auth.supabase
    .from("clients")
    .update({ [COLUMN[source]]: choice.value })
    .eq("id", clientId)
    .select("id");
  if (error) return NextResponse.json({ error: `Could not save: ${error.message}` }, { status: 500 });
  if (!updated || updated.length === 0) {
    return NextResponse.json({ error: "You can't change this client's connections." }, { status: 403 });
  }
  return NextResponse.json({ ok: true, source, value: choice.value });
}
