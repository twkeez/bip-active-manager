import { NextResponse } from "next/server";
import { bareDomain } from "@/lib/website-audit/crawl";
import { requireAuditAdmin } from "@/lib/website-audit/access";
import { locationFromWebsite, splitTypedLocation } from "@/lib/website-audit/site-location";
import { createAdminClient } from "@/lib/supabase/admin";

/** POST starts a new audit (no work yet: each step is run from the audit page). */
export async function POST(request: Request) {
  const auth = await requireAuditAdmin();
  if ("error" in auth) return auth.error;
  const body = (await request.json().catch(() => null)) as {
    domain?: string;
    practiceName?: string;
    city?: string;
    state?: string;
    competitors?: string[];
    clientId?: number | null;
  } | null;
  const domain = bareDomain(body?.domain ?? "");
  const practiceName = body?.practiceName?.trim() ?? "";
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(domain)) return NextResponse.json({ error: "Enter a website domain, like dhah.org." }, { status: 400 });
  if (!practiceName) return NextResponse.json({ error: "Enter the practice name." }, { status: 400 });

  // The town and state come from the practice's own website when it shows an
  // address; what was typed (or copied from the client record) is the fallback.
  const fromSite = await locationFromWebsite(domain);
  const typed = splitTypedLocation(body?.city, body?.state);
  const city = fromSite?.city ?? typed.city;
  const state = fromSite?.state ?? typed.state;

  const { data, error } = await createAdminClient()
    .from("website_audits")
    .insert({
      created_by: auth.email || null,
      client_id: typeof body?.clientId === "number" ? body.clientId : null,
      domain,
      practice_name: practiceName,
      city,
      state,
      competitors: (body?.competitors ?? []).map(bareDomain).filter(Boolean).slice(0, 5),
    })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.id, city, state, locationFrom: fromSite ? "website" : "typed" });
}
