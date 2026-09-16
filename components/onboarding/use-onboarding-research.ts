"use client";

import { useCallback, useState } from "react";
import type { OnboardingDetails } from "@/lib/onboarding/onboarding-details";
import { SERVICE_OFF } from "@/lib/services/plan-edit";

/**
 * Running a client's onboarding research, in the order the pieces depend on.
 *
 * 1. Basecamp background first — the other scans read it.
 * 2. Market research, competitor offers, keywords and brand assets together;
 *    none needs another.
 * 3. The campaign plan last, because it is built from the competitor offers
 *    and the keywords.
 *
 * Each scan is its own request to its existing endpoint, so one slow web
 * search cannot run the others past a function time limit, and a failure stays
 * with its own row.
 */

export type ResearchKey = "basecamp" | "discovery" | "competitors" | "keywords" | "brand" | "campaign";

export type ResearchStatus = {
  state: "idle" | "running" | "done" | "skipped" | "error";
  message: string | null;
};

export type ResearchSummary = {
  discoveryAt: string | null;
  competitorAdsAt: string | null;
  campaignPlanAt: string | null;
  brandElementsAt: string | null;
  keywordCount: number;
};

export type ResearchStep = {
  key: ResearchKey;
  label: string;
  feeds: string;
  applies: boolean;
  /** Why it cannot run yet, when something it needs is missing. */
  blockedBy: string | null;
  lastRun: string | null;
  done: boolean;
};

const bought = (value: string | undefined) => Boolean(value && value !== SERVICE_OFF);

export function researchSteps(
  details: OnboardingDetails,
  research: ResearchSummary,
  basecampBackgroundAt: string | null,
): ResearchStep[] {
  const ppc = bought(details.services.ppc);
  return [
    {
      key: "basecamp",
      label: "Read Basecamp threads",
      feeds: "Background for all research",
      applies: true,
      blockedBy: null,
      lastRun: basecampBackgroundAt,
      done: Boolean(basecampBackgroundAt),
    },
    {
      key: "discovery",
      label: "Market research",
      feeds: "Client document",
      applies: true,
      blockedBy: details.city.trim() ? null : "Add the town first",
      lastRun: research.discoveryAt,
      done: Boolean(research.discoveryAt),
    },
    {
      key: "competitors",
      label: "Competitor offers",
      feeds: "Internal brief",
      applies: ppc,
      blockedBy: null,
      lastRun: research.competitorAdsAt,
      done: Boolean(research.competitorAdsAt),
    },
    {
      key: "keywords",
      label: "Keyword targets",
      feeds: "Rankings and campaign plan",
      applies: bought(details.services.seo),
      blockedBy: details.city.trim() ? null : "Add the town first",
      lastRun: null,
      done: research.keywordCount > 0,
    },
    {
      key: "brand",
      label: "Brand assets",
      feeds: "Social planner",
      applies: bought(details.services.smm),
      blockedBy: details.website.trim() ? null : "Add the website first",
      lastRun: research.brandElementsAt,
      done: Boolean(research.brandElementsAt),
    },
    {
      key: "campaign",
      label: "Campaign plan",
      feeds: "Internal brief",
      applies: ppc,
      blockedBy: null,
      lastRun: research.campaignPlanAt,
      done: Boolean(research.campaignPlanAt),
    },
  ];
}

async function post(url: string, body?: unknown) {
  const response = await fetch(url, {
    method: "POST",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) throw new Error((payload.error as string) ?? `Failed (HTTP ${response.status})`);
  return payload;
}

export function useOnboardingResearch(clientId: number, onFinished: () => void) {
  const [status, setStatus] = useState<Partial<Record<ResearchKey, ResearchStatus>>>({});
  const [running, setRunning] = useState(false);

  const mark = (key: ResearchKey, next: ResearchStatus) => setStatus((current) => ({ ...current, [key]: next }));

  const runStep = useCallback(
    async (key: ResearchKey): Promise<void> => {
      const base = `/api/clients/${clientId}/onboarding`;
      mark(key, { state: "running", message: null });
      try {
        if (key === "basecamp") {
          const result = await post(`${base}/basecamp-background`);
          if (result.ok === false) {
            // No project yet is normal; say so, don't call it a failure.
            mark(key, { state: "skipped", message: (result.reason as string) ?? "No Basecamp project to read." });
            return;
          }
          const skipped = (result.skipped as string[] | undefined) ?? [];
          mark(key, {
            state: "done",
            message: `Read ${result.threadsRead} threads${result.linked ? ` and linked "${result.projectName}"` : ""}${
              skipped.length ? `; skipped ${skipped.length} access thread${skipped.length === 1 ? "" : "s"}` : ""
            }.`,
          });
          return;
        }
        if (key === "keywords") {
          const response = await fetch(`${base}/keywords`, { cache: "no-store" });
          const plan = (await response.json()) as {
            error?: string;
            allowance?: number;
            candidates?: Array<{ keyword: string }>;
            existing?: string[];
          };
          if (!response.ok) throw new Error(plan.error ?? "Keyword research failed");
          if (!plan.allowance) {
            mark(key, { state: "skipped", message: "This SEO plan has no keyword allowance." });
            return;
          }
          if (plan.existing?.length) {
            // Someone already chose these; research does not overrule them.
            mark(key, { state: "done", message: `Keeping the ${plan.existing.length} keywords already chosen.` });
            return;
          }
          const picked = (plan.candidates ?? []).slice(0, plan.allowance).map((candidate) => candidate.keyword);
          await post(`${base}/keywords`, { keywords: picked });
          mark(key, { state: "done", message: `Picked the top ${picked.length} by local search volume.` });
          return;
        }
        const path = { discovery: "discovery", competitors: "competitor-ads", brand: "brand-elements", campaign: "campaign-plan" }[key];
        await post(`${base}/${path}`);
        mark(key, { state: "done", message: null });
      } catch (error) {
        mark(key, { state: "error", message: error instanceof Error ? error.message : "Failed" });
      }
    },
    [clientId],
  );

  const runAll = useCallback(
    async (steps: ResearchStep[]) => {
      const runnable = (key: ResearchKey) => steps.some((step) => step.key === key && step.applies && !step.blockedBy);
      setRunning(true);
      try {
        if (runnable("basecamp")) await runStep("basecamp");
        await Promise.all(
          (["discovery", "competitors", "keywords", "brand"] as ResearchKey[]).filter(runnable).map((key) => runStep(key)),
        );
        if (runnable("campaign")) await runStep("campaign");
      } finally {
        setRunning(false);
        onFinished();
      }
    },
    [runStep, onFinished],
  );

  const runOne = useCallback(
    async (key: ResearchKey) => {
      setRunning(true);
      try {
        await runStep(key);
      } finally {
        setRunning(false);
        onFinished();
      }
    },
    [runStep, onFinished],
  );

  return { status, running, runAll, runOne };
}
