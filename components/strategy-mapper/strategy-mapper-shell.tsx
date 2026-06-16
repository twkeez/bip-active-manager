"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import BrandHeader from "@/components/vet-onboarding/brand-header";
import StrategyMapperForm from "@/components/strategy-mapper/strategy-mapper-form";
import StrategyMapperOutput from "@/components/strategy-mapper/strategy-mapper-output";
import StrategyMapperStaging from "@/components/strategy-mapper/strategy-mapper-staging";
import { STRATEGY_MAPPER_MOCK_RESEARCH_STORAGE_KEY } from "@/lib/strategy-mapper/mock-research";
import type {
  StrategyMapperFormData,
  StrategyMapperGenerateResult,
  StrategyMapperPreCheckResult,
  StrategyMapperStagingState,
  WebsiteSeoAuditResult,
} from "@/types/strategy-mapper";

type ViewState = "form" | "fetching" | "staging" | "generating" | "output";

export default function StrategyMapperShell() {
  const [view, setView] = useState<ViewState>("form");
  const [form, setForm] = useState<StrategyMapperFormData | null>(null);
  const [staging, setStaging] = useState<StrategyMapperStagingState | null>(null);
  const [result, setResult] = useState<StrategyMapperGenerateResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [auditing, setAuditing] = useState(false);

  async function handleFetchData(
    formData: StrategyMapperFormData,
    options: { useMockResearch: boolean },
  ) {
    setView("fetching");
    setError(null);
    setForm(formData);
    try {
      const res = await fetch("/api/strategy-mapper/pre-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          form: formData,
          useMockResearch: options.useMockResearch,
        }),
      });
      const payload = (await res.json()) as StrategyMapperPreCheckResult & {
        error?: string;
      };
      if (!res.ok) {
        throw new Error(payload.error ?? "Failed to fetch research data");
      }
      if (payload.mockFallbackReason) {
        try {
          localStorage.setItem(STRATEGY_MAPPER_MOCK_RESEARCH_STORAGE_KEY, "true");
        } catch {
          // Ignore storage errors in private browsing.
        }
      }
      setStaging({
        form: formData,
        research: payload.research,
        radius: payload.radius,
        activeServices: payload.activeServices,
        mockMode: payload.mockMode,
        mockFallbackReason: payload.mockFallbackReason,
      });
      setView("staging");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch research data");
      setView("form");
    }
  }

  async function handleAuditWebsite() {
    if (!staging) return;
    setAuditing(true);
    setAuditError(null);
    try {
      const res = await fetch("/api/strategy-mapper/website-audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          form: staging.form,
          research: staging.research,
          radius: staging.radius,
          activeServices: staging.activeServices,
        }),
      });
      const payload = (await res.json()) as WebsiteSeoAuditResult & { error?: string };
      if (!res.ok) {
        throw new Error(payload.error ?? "Failed to run website audit");
      }
      setStaging({ ...staging, websiteAudit: payload });
    } catch (err) {
      setAuditError(err instanceof Error ? err.message : "Failed to run website audit");
    } finally {
      setAuditing(false);
    }
  }

  async function handleApproveAndGenerate() {
    if (!staging) return;
    setView("generating");
    setError(null);
    try {
      const res = await fetch("/api/strategy-mapper/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          form: staging.form,
          research: staging.research,
          websiteAudit: staging.websiteAudit,
        }),
      });
      const payload = (await res.json()) as StrategyMapperGenerateResult & {
        error?: string;
      };
      if (!res.ok) {
        throw new Error(payload.error ?? "Failed to generate plan");
      }
      setForm(staging.form);
      setResult(payload);
      setView("output");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate plan");
      setView("staging");
    }
  }

  function handleStartOver() {
    setView("form");
    setForm(null);
    setStaging(null);
    setResult(null);
    setError(null);
    setAuditError(null);
  }

  function handleBackToForm() {
    setError(null);
    setView("form");
  }

  return (
    <div className="min-h-screen bg-bip-page font-sans text-white/75">
      <BrandHeader />
      <div className="px-4 py-10 sm:px-6">
        <div className="mx-auto mb-8 flex max-w-4xl items-center justify-between print:hidden">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-lg border border-white/[0.08] bg-bip-card px-3 py-2 text-sm text-white/75 transition hover:bg-white/[0.06]"
          >
            <ArrowLeft className="h-4 w-4" />
            Dashboard
          </Link>
          <div className="flex gap-2">
            <Link
              href="/onboarding-strategy-mapper/sample"
              className="rounded-lg border border-white/[0.08] bg-bip-card px-4 py-2 text-sm text-white/75 transition hover:bg-white/[0.06]"
            >
              Sample Output
            </Link>
            <Link
              href="/onboarding-strategy-mapper/content-library"
              className="rounded-lg border border-white/[0.08] bg-bip-card px-4 py-2 text-sm text-white/75 transition hover:bg-white/[0.06]"
            >
              Content Library
            </Link>
            <Link
              href="/onboarding-strategy-mapper/tier-library"
              className="rounded-lg border border-white/[0.08] bg-bip-card px-4 py-2 text-sm text-white/75 transition hover:bg-white/[0.06]"
            >
              Tier Library
            </Link>
            {view === "output" ? (
              <button
                type="button"
                onClick={handleStartOver}
                className="rounded-lg border border-white/[0.08] bg-bip-card px-4 py-2 text-sm font-medium text-white transition hover:bg-white/[0.06]"
              >
                Start Over
              </button>
            ) : null}
          </div>
        </div>

        <div className="mx-auto max-w-4xl">
          <div className="mb-8 print:hidden">
            <h1 className="text-2xl font-bold text-white">
              Onboarding Research and Strategy Mapper
            </h1>
            <p className="mt-2 text-sm text-white/50">
              Local competitive audit, Phase 1 service strategy, and data-backed
              soft-upsell opportunities — ready to copy into Google Docs.
            </p>
          </div>

          {view === "form" ? (
            <>
              {error ? (
                <p className="mb-4 rounded-lg border border-bip-danger/30 bg-bip-danger/10 px-4 py-3 text-sm text-bip-danger">
                  {error}
                </p>
              ) : null}
              <StrategyMapperForm onFetchData={handleFetchData} loading={false} />
            </>
          ) : null}

          {view === "fetching" ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-white/[0.08] bg-bip-card py-20 text-center">
              <span className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-2 border-bip-accent border-t-transparent" />
              <p className="text-sm text-white/75">
                Searching local market and competitors…
              </p>
              <p className="mt-2 text-xs text-white/40">
                This may take 30–60 seconds while we search the local market.
              </p>
            </div>
          ) : null}

          {view === "staging" && staging ? (
            <StrategyMapperStaging
              staging={staging}
              onChange={setStaging}
              onBack={handleBackToForm}
              onApprove={() => void handleApproveAndGenerate()}
              onAuditWebsite={handleAuditWebsite}
              loading={false}
              auditing={auditing}
              auditError={auditError}
              error={error}
            />
          ) : null}

          {view === "generating" ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-white/[0.08] bg-bip-card py-20 text-center">
              <span className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-2 border-bip-accent border-t-transparent" />
              <p className="text-sm text-white/75">Assembling report from libraries…</p>
              <p className="mt-2 text-xs text-white/40">
                Phase 1 tactics and report sections come from the tier and content
                libraries — no AI narrative step.
              </p>
            </div>
          ) : null}

          {view === "output" && form && result ? (
            <StrategyMapperOutput
              form={form}
              result={result}
              onStartOver={handleStartOver}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
