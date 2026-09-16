import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth/require-admin";
import { summariseBackground } from "@/lib/onboarding/background";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { readDocumentPayload } from "@/lib/vet-onboarding/document-input";

/**
 * The website team's kickoff doc, read into background for onboarding research.
 *
 * General information — the practice, its brand, its plans — kept as a summary.
 * The document itself is not stored. Word and text files have credential-shaped
 * lines removed before Claude reads them; a PDF is read as a document, so for
 * PDFs the protection is the summary rules plus scrubbing the summary after.
 */

export const maxDuration = 300;

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const clientId = Number((await context.params).id);
  if (!Number.isInteger(clientId) || clientId <= 0) {
    return NextResponse.json({ error: "Invalid client id" }, { status: 400 });
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isAdmin(supabase))) return NextResponse.json({ error: "Admins only" }, { status: 403 });

  const form = await request.formData().catch(() => null);
  const file = form?.get("document");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Choose the kickoff doc to upload." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: client } = await admin.from("clients").select("id, account_name").eq("id", clientId).maybeSingle();
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  try {
    const payload = await readDocumentPayload(file);
    const summary = await summariseBackground(
      payload.kind === "pdf"
        ? [{ type: "document", source: { type: "base64", media_type: "application/pdf", data: payload.base64 }, title: payload.fileName }]
        : payload.text,
      { clientName: client.account_name as string, sourceLabel: "the website team's kickoff doc" },
    );

    const at = new Date().toISOString();
    const { error } = await admin.from("client_onboarding_intake").upsert(
      {
        client_id: clientId,
        kickoff_doc_summary: summary,
        kickoff_doc_filename: file.name,
        kickoff_doc_at: at,
        updated_at: at,
      },
      { onConflict: "client_id" },
    );
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true, summary, filename: file.name, at });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not read the kickoff doc" },
      { status: 500 },
    );
  }
}
