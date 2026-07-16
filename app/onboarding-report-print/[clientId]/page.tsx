import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadOnboardingReport } from "@/lib/onboarding/load-onboarding-report";
import OnboardingReportPrintClient from "@/components/onboarding/onboarding-report-print-client";

// Chrome-free print view of a client's onboarding report. ?mode=client|internal.
// Lives outside the (app) route group so it prints without the sidebar.
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

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const model = await loadOnboardingReport(supabase, user.id, id);
  if (!model) notFound();

  const reportMode: "client" | "internal" = mode === "internal" ? "internal" : "client";
  return <OnboardingReportPrintClient model={model} mode={reportMode} />;
}
