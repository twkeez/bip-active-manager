import { exportBlockedMessage } from "@/components/data-integrity/export-blocked";
import { withIntegrityScope } from "@/lib/data-integrity/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadClientExpectations } from "@/lib/onboarding/load-client-expectations";
import { renderExpectationsWord, expectationsWordFilename } from "@/lib/onboarding/expectations-word";

export async function GET(request: Request, context: { params: Promise<{ clientId: string }> }) {
  const { clientId: clientIdRaw } = await context.params;
  const clientId = Number(clientIdRaw);
  if (!Number.isInteger(clientId) || clientId <= 0) {
    return NextResponse.json({ error: "Invalid client id" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { result: model, truncated } = await withIntegrityScope(() => loadClientExpectations(supabase, clientId));
  if (!model) return NextResponse.json({ error: "Client not found" }, { status: 404 });
  if (truncated.length) {
    return NextResponse.json({ error: exportBlockedMessage("client document", truncated) }, { status: 409 });
  }

  const generatedAt = new Date().toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const html = renderExpectationsWord(model, generatedAt);
  const filename = expectationsWordFilename(model);

  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "application/msword; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
