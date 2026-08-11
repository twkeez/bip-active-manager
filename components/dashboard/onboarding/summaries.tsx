"use client";

import type React from "react";
import { tierOption, type StepModuleContext } from "./types";

// Short, safe date formatter for captured-value summaries.
function fmtDate(v: string | null | undefined): string {
  if (!v) return "";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

// The active-service labels used for the "Services" step summary.
const SERVICE_SUMMARY_LABELS: Array<{ key: "seo" | "ppc" | "smm" | "blog" | "orm"; label: string }> = [
  { key: "seo", label: "SEO" },
  { key: "ppc", label: "Ads" },
  { key: "smm", label: "Social" },
  { key: "blog", label: "Blog" },
  { key: "orm", label: "Reviews" },
];

// A compact "captured value" line for a step card in the by-service map. Uses
// ONLY data already on the controller — no fetching. Falls back to done/hint.
export function StepSummary({ item, controller }: StepModuleContext): React.ReactNode {
  const { clientProfile, initialData, evaluation } = controller;

  switch (item.verification) {
    case "manual:intake_profile": {
      const strategist = clientProfile?.marketing_strategist?.trim();
      const tier = clientProfile?.tier?.trim();
      return `${strategist || "No strategist"} · ${tier || "no tier"}`;
    }
    case "manual:intake_services": {
      const active = SERVICE_SUMMARY_LABELS.filter(
        (s) => tierOption(clientProfile?.[s.key]) !== "",
      ).map((s) => s.label);
      return active.length ? active.join(", ") : "No services set";
    }
    case "manual:arm_strategist": {
      const discovery = initialData.discovery;
      return discovery ? `${discovery.competitors?.length ?? 0} competitors researched` : "Not run";
    }
    case "state:kickoff_meeting": {
      const at = initialData.kickoffMeetingAt;
      return at ? `Scheduled ${fmtDate(at)}` : "Not scheduled";
    }
    case "manual:ppc_competitors": {
      const offers = initialData.competitorOffers;
      return offers?.length ? `${offers.length} competitor offers` : "Not run";
    }
    case "manual:ppc_campaign": {
      const plan = initialData.campaignPlan;
      return plan ? `Plan drafted (${plan.adGroups?.length ?? 0} ad groups)` : "Not started";
    }
    case "manual:smm_brand_assets": {
      return initialData.brandElements ? "Brand elements pulled" : "Not pulled";
    }
    case "comms:weekly_cadence": {
      return evaluation?.commsCadenceLabel ?? "—";
    }
    default: {
      if (item.deferred) return "Comes at launch";
      if (item.done) {
        return item.autoVerified
          ? "Auto-verified ✓"
          : `Done${item.completedAt ? " · " + fmtDate(item.completedAt) : ""}`;
      }
      return item.hint ?? "Not started";
    }
  }
}
