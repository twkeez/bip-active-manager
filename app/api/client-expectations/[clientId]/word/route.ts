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

  const model = await loadClientExpectations(supabase, clientId);
  if (!model) return NextResponse.json({ error: "Client not found" }, { status: 404 });

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
