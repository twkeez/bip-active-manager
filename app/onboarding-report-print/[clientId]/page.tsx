import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadOnboardingReport } from "@/lib/onboarding/load-onboarding-report";
import OnboardingReportPrintClient from "@/components/onboarding/onboarding-report-print-client";

// Chrome-free print view of the internal onboarding brief. Lives outside the
// (app) route group so it prints without the sidebar.
//
// There used to be a ?mode=client version too. It carried its own hardcoded
// expectations that contradicted the edited expectations document, so the two
// were merged on 2026-09-16 and client links now go to that one document.
// Anything still asking for the client version is forwarded rather than shown
// a copy that no longer exists.
export default async function OnboardingReportPrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ clientId: string }>;
  searchParams: Promise<{ mode?: string }>;
}) {
  const { clientId } = await params;
  const { mode } = await searchParams;
  const id = Number(clientId);
  if (!Number.isInteger(id) || id <= 0) notFound();
  if (mode !== "internal") redirect(`/client-expectations-print/${id}`);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const model = await loadOnboardingReport(supabase, user.id, id);
  if (!model) notFound();

  return <OnboardingReportPrintClient model={model} />;
}
