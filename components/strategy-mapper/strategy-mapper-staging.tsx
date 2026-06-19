"use client";

import { Plus, Trash2 } from "lucide-react";
import WebsiteAuditPanel, {
  canBuildReport,
} from "@/components/strategy-mapper/website-audit-panel";
import { SERVICE_LABELS, INITIAL_SALES_CONTEXT, SITE_CONTEXT_OPTIONS } from "@/lib/strategy-mapper/form-options";
import type {
  DensityTier,
  SalesPdfExtract,
  SiteContext,
  StrategyMapperCompetitor,
  StrategyMapperStagingState,
} from "@/types/strategy-mapper";

const inputClass =
  "w-full rounded-lg border border-bip-border bg-bip-page px-3 py-2.5 text-sm text-bip-text placeholder:text-bip-muted focus:border-bip-accent focus:outline-none focus:ring-2 focus:ring-bip-accent/30";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-bip-text">{label}</span>
      {children}
    </label>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-bip-border bg-bip-card p-5 sm:p-6">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-bip-accent">
        {title}
      </h2>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

interface StrategyMapperStagingProps {
  staging: StrategyMapperStagingState;
  onChange: (next: StrategyMapperStagingState) => void;
  onBack: () => void;
  onApprove: () => void;
  onAuditWebsite: () => Promise<void>;
  loading?: boolean;
  auditing?: boolean;
  auditError?: string | null;
  error?: string | null;
}

function emptyCompetitor(): StrategyMapperCompetitor {
  return {
    name: "",
    distanceMiles: 0,
    googleRating: 0,
    reviewCount: 0,
    runsGoogleAds: false,
    scope: "local",
  };
}

function StringListEditor({
  label,
  items,
  onChange,
  placeholder,
}: {
  label: string;
  items: string[];
  onChange: (items: string[]) => void;
  placeholder?: string;
}) {
  function updateItem(index: number, value: string) {
    onChange(items.map((item, i) => (i === index ? value : item)));
  }

  function removeItem(index: number) {
    onChange(items.filter((_, i) => i !== index));
  }

  function addItem() {
    onChange([...items, ""]);
  }

  return (
    <div>
      <span className="mb-2 block text-sm font-medium text-bip-text">{label}</span>
      <div className="space-y-2">
        {items.map((item, index) => (
          <div key={index} className="flex gap-2">
            <input
              type="text"
              value={item}
              onChange={(e) => updateItem(index, e.target.value)}
              placeholder={placeholder}
              className={inputClass}
            />
            <button
              type="button"
              onClick={() => removeItem(index)}
              className="shrink-0 rounded-lg border border-bip-border px-2 text-bip-muted hover:bg-bip-fill hover:text-bip-danger"
              aria-label={`Remove ${label} item ${index + 1}`}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={addItem}
          className="inline-flex items-center gap-1.5 text-xs text-bip-accent hover:underline"
        >
          <Plus className="h-3.5 w-3.5" />
          Add item
        </button>
      </div>
    </div>
  );
}

export default function StrategyMapperStaging({
  staging,
  onChange,
  onBack,
  onApprove,
  onAuditWebsite,
  loading = false,
  auditing = false,
  auditError = null,
  error = null,
}: StrategyMapperStagingProps) {
  const { form, research, activeServices } = staging;
  const buildReady = canBuildReport(staging);

  function updateResearch(
    patch: Omit<Partial<typeof research>, "clientMetrics"> & {
      clientMetrics?: Partial<typeof research.clientMetrics>;
    },
  ) {
    onChange({
      ...staging,
      research: {
        ...research,
        ...patch,
        clientMetrics: patch.clientMetrics
          ? { ...research.clientMetrics, ...patch.clientMetrics }
          : research.clientMetrics,
      },
    });
  }

  function updateSalesExtract(patch: Partial<SalesPdfExtract>) {
    const current = form.salesPdfExtract ?? { ...INITIAL_SALES_CONTEXT };
    onChange({
      ...staging,
      form: {
        ...form,
        salesPdfExtract: { ...current, ...patch },
      },
    });
  }

  function updateCompetitor(index: number, patch: Partial<StrategyMapperCompetitor>) {
    const competitors = research.competitors.map((row, i) =>
      i === index ? { ...row, ...patch } : row,
    );
    updateResearch({ competitors });
  }

  function addCompetitor() {
    updateResearch({ competitors: [...research.competitors, emptyCompetitor()] });
  }

  function removeCompetitor(index: number) {
    updateResearch({
      competitors: research.competitors.filter((_, i) => i !== index),
    });
  }

  function handleClientRatingChange(value: string) {
    const rating = parseFloat(value.replace(/[^\d.]/g, ""));
    onChange({
      ...staging,
      form: { ...form, clientGoogleRating: value },
      research: {
        ...research,
        clientMetrics: {
          ...research.clientMetrics,
          ...(Number.isFinite(rating) ? { googleRating: rating } : {}),
        },
      },
    });
  }

  function handleClientReviewCountChange(value: string) {
    const count = parseInt(value.replace(/[^\d]/g, ""), 10);
    onChange({
      ...staging,
      form: { ...form, clientReviewCount: value },
      research: {
        ...research,
        clientMetrics: {
          ...research.clientMetrics,
          ...(Number.isFinite(count) ? { reviewCount: count } : {}),
        },
      },
    });
  }

  const extract = form.salesPdfExtract ?? INITIAL_SALES_CONTEXT;

  return (
    <div className="space-y-6">
      {staging.mockMode ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          <p className="font-medium">Placeholder competitor research</p>
          <p className="mt-1 text-xs text-amber-200/80">
            {staging.mockFallbackReason ??
              "Competitor rows are samples — edit before building the report. To use live Anthropic research again, choose Live research on the form."}
          </p>
        </div>
      ) : null}
      <div className="rounded-xl border border-bip-accent/30 bg-bip-accent/5 px-4 py-3 text-sm text-bip-text">
        <p className="font-medium text-bip-text">Review &amp; edit research data</p>
        <p className="mt-1 text-xs text-bip-muted">
          Verify competitor data and sales context before building the report. Phase 1
          services:{" "}
          {activeServices.map((s) => SERVICE_LABELS[s]).join(", ") || "None"}
        </p>
      </div>

      <Section title="Website / Platform Situation">
        <Field label="Site context">
          <select
            value={form.siteContext ?? "existing_active"}
            onChange={(e) =>
              onChange({
                ...staging,
                form: { ...form, siteContext: e.target.value as SiteContext },
              })
            }
            className={inputClass}
          >
            {SITE_CONTEXT_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>
      </Section>

      <Section title="Client Google Business Profile">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Google rating">
            <input
              type="text"
              value={
                form.clientGoogleRating ??
                String(research.clientMetrics.googleRating)
              }
              onChange={(e) => handleClientRatingChange(e.target.value)}
              className={inputClass}
              placeholder="e.g. 4.3"
            />
          </Field>
          <Field label="Review count">
            <input
              type="text"
              value={
                form.clientReviewCount ??
                String(research.clientMetrics.reviewCount)
              }
              onChange={(e) => handleClientReviewCountChange(e.target.value)}
              className={inputClass}
              placeholder="e.g. 142"
            />
          </Field>
        </div>
        <label className="flex cursor-pointer items-center gap-3 text-sm text-bip-text">
          <input
            type="checkbox"
            checked={research.clientMetrics.runsGoogleAds}
            onChange={(e) =>
              updateResearch({
                clientMetrics: { runsGoogleAds: e.target.checked },
              })
            }
            className="h-4 w-4 rounded border-bip-border bg-bip-page text-bip-accent focus:ring-bip-accent"
          />
          Client runs Google Ads
        </label>
      </Section>

      <Section title="Market Radius">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Density tier">
            <select
              value={research.densityTier}
              onChange={(e) =>
                updateResearch({ densityTier: e.target.value as DensityTier })
              }
              className={inputClass}
            >
              <option value="urban">Urban</option>
              <option value="suburban">Suburban</option>
              <option value="rural">Rural</option>
            </select>
          </Field>
          <Field label="Wellness radius (miles)">
            <input
              type="number"
              min={1}
              max={50}
              value={research.wellnessRadiusMiles}
              onChange={(e) =>
                updateResearch({
                  wellnessRadiusMiles: parseInt(e.target.value, 10) || 0,
                })
              }
              className={inputClass}
            />
          </Field>
        </div>
        <label className="flex cursor-pointer items-center gap-3 text-sm text-bip-text">
          <input
            type="checkbox"
            checked={research.specialtyRadiusEnabled}
            onChange={(e) =>
              updateResearch({ specialtyRadiusEnabled: e.target.checked })
            }
            className="h-4 w-4 rounded border-bip-border bg-bip-page text-bip-accent focus:ring-bip-accent"
          />
          Enable specialty / regional radius
        </label>
        {research.specialtyRadiusEnabled ? (
          <Field label="Specialty radius (miles)">
            <input
              type="number"
              min={1}
              max={100}
              value={research.specialtyRadiusMiles ?? ""}
              onChange={(e) =>
                updateResearch({
                  specialtyRadiusMiles: parseInt(e.target.value, 10) || null,
                })
              }
              className={inputClass}
            />
          </Field>
        ) : null}
        <Field label="Radius rationale">
          <textarea
            value={research.radiusRationale}
            onChange={(e) => updateResearch({ radiusRationale: e.target.value })}
            rows={3}
            className={inputClass}
          />
        </Field>
      </Section>

      <Section title="Competitors">
        <div className="space-y-4">
          {research.competitors.map((competitor, index) => (
            <div
              key={index}
              className="rounded-lg border border-bip-border bg-bip-page/50 p-4"
            >
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wide text-bip-muted">
                  Competitor {index + 1}
                </span>
                <button
                  type="button"
                  onClick={() => removeCompetitor(index)}
                  className="inline-flex items-center gap-1 text-xs text-bip-muted hover:text-bip-danger"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Remove
                </button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Practice name">
                  <input
                    type="text"
                    value={competitor.name}
                    onChange={(e) =>
                      updateCompetitor(index, { name: e.target.value })
                    }
                    className={inputClass}
                  />
                </Field>
                <Field label="Distance (miles)">
                  <input
                    type="number"
                    step="0.1"
                    min={0}
                    value={competitor.distanceMiles}
                    onChange={(e) =>
                      updateCompetitor(index, {
                        distanceMiles: parseFloat(e.target.value) || 0,
                      })
                    }
                    className={inputClass}
                  />
                </Field>
                <Field label="Google rating">
                  <input
                    type="number"
                    step="0.1"
                    min={0}
                    max={5}
                    value={competitor.googleRating}
                    onChange={(e) =>
                      updateCompetitor(index, {
                        googleRating: parseFloat(e.target.value) || 0,
                      })
                    }
                    className={inputClass}
                  />
                </Field>
                <Field label="Review count">
                  <input
                    type="number"
                    min={0}
                    value={competitor.reviewCount}
                    onChange={(e) =>
                      updateCompetitor(index, {
                        reviewCount: parseInt(e.target.value, 10) || 0,
                      })
                    }
                    className={inputClass}
                  />
                </Field>
                <Field label="Scope">
                  <select
                    value={competitor.scope}
                    onChange={(e) =>
                      updateCompetitor(index, {
                        scope: e.target.value as "local" | "regional",
                      })
                    }
                    className={inputClass}
                  >
                    <option value="local">Local</option>
                    <option value="regional">Regional</option>
                  </select>
                </Field>
                <label className="flex cursor-pointer items-center gap-3 self-end pb-2 text-sm text-bip-text">
                  <input
                    type="checkbox"
                    checked={competitor.runsGoogleAds}
                    onChange={(e) =>
                      updateCompetitor(index, { runsGoogleAds: e.target.checked })
                    }
                    className="h-4 w-4 rounded border-bip-border bg-bip-page text-bip-accent focus:ring-bip-accent"
                  />
                  Runs Google Ads
                </label>
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={addCompetitor}
            className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-bip-border px-4 py-2 text-sm text-bip-accent hover:border-bip-accent/50"
          >
            <Plus className="h-4 w-4" />
            Add competitor
          </button>
        </div>
      </Section>

      <Section title="Sales Context">
          <Field label="Summary">
            <textarea
              value={extract.summary}
              onChange={(e) => updateSalesExtract({ summary: e.target.value })}
              rows={3}
              className={inputClass}
            />
          </Field>
          <Field label="Clinical differentiator">
            <input
              type="text"
              value={extract.clinicalDifferentiator}
              onChange={(e) =>
                updateSalesExtract({ clinicalDifferentiator: e.target.value })
              }
              className={inputClass}
            />
          </Field>
          <StringListEditor
            label="Pain points"
            items={extract.painPoints}
            onChange={(painPoints) => updateSalesExtract({ painPoints })}
            placeholder="Client pain point"
          />
          <StringListEditor
            label="Goals"
            items={extract.goals}
            onChange={(goals) => updateSalesExtract({ goals })}
            placeholder="Client goal"
          />
          <StringListEditor
            label="Agency frustrations"
            items={extract.agencyFrustrations}
            onChange={(agencyFrustrations) => updateSalesExtract({ agencyFrustrations })}
            placeholder="Past agency frustration"
          />
        </Section>

      <WebsiteAuditPanel
        staging={staging}
        onChange={onChange}
        onAudit={onAuditWebsite}
        auditing={auditing}
        error={auditError}
      />

      {error ? (
        <p className="rounded-lg border border-bip-danger/30 bg-bip-danger/10 px-4 py-3 text-sm text-bip-danger">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          disabled={loading}
          className="rounded-lg border border-bip-border bg-bip-card px-5 py-3 text-sm text-bip-text transition hover:bg-bip-fill disabled:opacity-60"
        >
          Back to form
        </button>
        <button
          type="button"
          onClick={onApprove}
          disabled={loading || !buildReady}
          className="flex items-center gap-2 rounded-lg bg-bip-accent px-6 py-3 text-sm font-medium text-bip-page transition hover:brightness-110 disabled:opacity-60"
        >
          {loading ? (
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-bip-page border-t-transparent" />
          ) : null}
          Approve &amp; Build Report
        </button>
      </div>
      {!buildReady ? (
        <p className="text-xs text-bip-muted">
          Run the website SEO audit before building the report when a URL is required or
          provided.
        </p>
      ) : null}
    </div>
  );
}
