import { NextResponse } from "next/server";
import {
  canEditText,
  canHide,
  isValidSectionKey,
  MAX_EDIT_LENGTH,
} from "@/lib/onboarding/document-edits";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * Saving and resetting one client's document edits.
 *
 * Anyone who can open the client may edit its document — the same rule as the
 * strategist note, and the reason this sits in the client-expectations
 * namespace the team build already allows. Section keys are checked against the
 * places a document can actually be edited, so a request cannot store text the
 * renderers would never show or overwrite something it should not.
 */

type Context = { params: Promise<{ clientId: string }> };

async function authorise(context: Context) {
  const { clientId: raw } = await context.params;
  const clientId = Number(raw);
  if (!Number.isInteger(clientId) || clientId <= 0) {
    return { error: NextResponse.json({ error: "Invalid client id" }, { status: 400 }) };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };

  const { data: client } = await supabase.from("clients").select("id").eq("id", clientId).maybeSingle();
  if (!client) return { error: NextResponse.json({ error: "Client not found" }, { status: 404 }) };
  return { clientId, email: user.email ?? null };
}

export async function PUT(request: Request, context: Context) {
  const auth = await authorise(context);
  if ("error" in auth) return auth.error;

  const payload = (await request.json().catch(() => null)) as
    | { sectionKey?: unknown; body?: unknown; hidden?: unknown }
    | null;
  const sectionKey = typeof payload?.sectionKey === "string" ? payload.sectionKey : "";
  if (!isValidSectionKey(sectionKey)) {
    return NextResponse.json({ error: "That part of the document can't be edited." }, { status: 400 });
  }

  const hasBody = payload && "body" in payload;
  const hasHidden = payload && "hidden" in payload;
  if (!hasBody && !hasHidden) {
    return NextResponse.json({ error: "Nothing to save." }, { status: 400 });
  }
  if (hasBody) {
    if (!canEditText(sectionKey)) {
      return NextResponse.json({ error: "That section can be left out, but not reworded." }, { status: 400 });
    }
    if (typeof payload.body !== "string" || payload.body.length > MAX_EDIT_LENGTH) {
      return NextResponse.json({ error: `Text must be under ${MAX_EDIT_LENGTH.toLocaleString()} characters.` }, { status: 400 });
    }
  }
  if (hasHidden && (typeof payload.hidden !== "boolean" || !canHide(sectionKey))) {
    return NextResponse.json({ error: "That section can't be left out." }, { status: 400 });
  }

  const admin = createAdminClient();
  // Merge with what is already saved, so hiding a section keeps its edited
  // wording for when it is put back, and rewording keeps it hidden.
  const { data: existing, error: readError } = await admin
    .from("client_document_edits")
    .select("body, hidden")
    .eq("client_id", auth.clientId)
    .eq("section_key", sectionKey)
    .maybeSingle();
  if (readError) {
    return NextResponse.json(
      { error: /does not exist|schema cache/i.test(readError.message)
          ? "Document editing isn't set up yet — the database migration needs running."
          : readError.message },
      { status: 500 },
    );
  }

  const body = hasBody ? (payload.body as string) : ((existing?.body as string | null) ?? null);
  const hidden = hasHidden ? (payload.hidden as boolean) : Boolean(existing?.hidden);

  // Nothing left to remember: back to standard.
  if (body === null && !hidden) {
    await admin.from("client_document_edits").delete().eq("client_id", auth.clientId).eq("section_key", sectionKey);
    return NextResponse.json({ ok: true, reset: true });
  }

  const { error } = await admin.from("client_document_edits").upsert(
    {
      client_id: auth.clientId,
      section_key: sectionKey,
      body,
      hidden,
      updated_by: auth.email,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "client_id,section_key" },
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

/** Back to the standard wording: forgets this client's edit and any hiding. */
export async function DELETE(request: Request, context: Context) {
  const auth = await authorise(context);
  if ("error" in auth) return auth.error;

  const sectionKey = new URL(request.url).searchParams.get("sectionKey") ?? "";
  if (!isValidSectionKey(sectionKey)) {
    return NextResponse.json({ error: "That part of the document can't be edited." }, { status: 400 });
  }
  const { error } = await createAdminClient()
    .from("client_document_edits")
    .delete()
    .eq("client_id", auth.clientId)
    .eq("section_key", sectionKey);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
