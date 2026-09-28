import ExportBlocked from "@/components/data-integrity/export-blocked";
import { withIntegrityScope } from "@/lib/data-integrity/server";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadClientExpectations } from "@/lib/onboarding/load-client-expectations";
import ClientExpectationsPrintClient from "@/components/onboarding/client-expectations-print-client";

// Chrome-free print view of a client's expectations document. Lives outside the
// (app) route group so it prints without the sidebar.
export default async function ClientExpectationsPrintPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  const id = Number(clientId);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { result: model, truncated } = await withIntegrityScope(() => loadClientExpectations(supabase, id));
  if (!model) notFound();
  if (truncated.length) return <ExportBlocked what="client document" truncated={truncated} />;

  const generatedAt = new Date().toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return <ClientExpectationsPrintClient model={model} generatedAt={generatedAt} />;
}
