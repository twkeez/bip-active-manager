"use client";

import Link from "next/link";
import { ArrowRight, FileText, GraduationCap } from "lucide-react";
import OnboardingWorkspace from "@/components/onboarding/onboarding-workspace";

/**
 * Onboarding as the client page shows it, since the checklist was removed
 * (2026-09-16).
 *
 * The client page used to embed the step-by-step checklist in three places.
 * Onboarding is now the sources → details → research → outputs workspace, so
 * the client page shows that instead: in full on the Onboarding tab for admins,
 * and as a short card everywhere else. Team members get the document links —
 * the research behind the workspace is admin-only.
 */

export default function ClientOnboardingPanel({
  clientId,
  onboardingStatus,
  isAdmin,
  variant = "card",
}: {
  clientId: number;
  onboardingStatus: string | null | undefined;
  /** Unknown in the older tab view; the link is shown, since admins use it. */
  isAdmin?: boolean;
  variant?: "card" | "full";
}) {
  const canManage = isAdmin !== false;

  if (variant === "full" && isAdmin) {
    return (
      <div className="space-y-3">
        <p className="text-xs text-bip-muted">
          The same workspace as the{" "}
          <Link href={`/onboarding?client=${clientId}`} className="text-bip-text hover:underline">
            Onboarding page
          </Link>
          .
        </p>
        <OnboardingWorkspace key={clientId} clientId={clientId} />
      </div>
    );
  }

  const status =
    onboardingStatus === "active"
      ? "This client is being onboarded."
      : onboardingStatus === "complete"
        ? "Onboarding is finished for this client."
        : "This client isn't in onboarding.";

  return (
    <div className="rounded-xl border border-bip-border bg-bip-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <GraduationCap className="mt-0.5 h-4 w-4 shrink-0 text-bip-accent" />
          <div>
            <p className="text-sm font-semibold text-bip-text">Onboarding</p>
            <p className="mt-0.5 text-xs text-bip-muted">
              {status} {canManage ? "Research, details, the Basecamp message and the client document are all on the Onboarding page." : ""}
            </p>
          </div>
        </div>
        {canManage && (
          <Link
            href={`/onboarding?client=${clientId}`}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-bip-accent px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
          >
            Open onboarding <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>
      <div className="mt-3 flex flex-wrap gap-2 border-t border-bip-border pt-3">
        <Link
          href={`/client-document/${clientId}`}
          className="inline-flex items-center gap-1.5 rounded-md border border-bip-border px-3 py-1.5 text-xs text-bip-text hover:bg-bip-fill"
        >
          <FileText className="h-3.5 w-3.5" /> Review &amp; edit client document
        </Link>
        <a
          href={`/client-expectations-print/${clientId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-md border border-bip-border px-3 py-1.5 text-xs text-bip-text hover:bg-bip-fill"
        >
          PDF
        </a>
      </div>
    </div>
  );
}
