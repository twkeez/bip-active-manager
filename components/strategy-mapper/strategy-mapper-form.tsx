"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CORE_SERVICE_OPTIONS,
  INITIAL_SALES_CONTEXT,
  INITIAL_STRATEGY_MAPPER_FORM,
  normalizeWebsiteUrl,
  PRIMARY_GOAL_OPTIONS,
  resolveActiveServices,
  resolveSiteContext,
  SITE_CONTEXT_OPTIONS,
  SPECIALIZATION_OPTIONS,
  websiteUrlRequiredForSiteContext,
} from "@/lib/strategy-mapper/form-options";
import { STRATEGY_MAPPER_MOCK_RESEARCH_STORAGE_KEY } from "@/lib/strategy-mapper/mock-research";
import type { ServiceTierTemplate } from "@/lib/strategy-mapper/tier-library";
import { resolveSelectedTiers } from "@/lib/strategy-mapper/tier-resolver";
import type {
  ClientPersonaTone,
  PrimaryBusinessGoal,
  SalesPdfExtract,
  SalesPdfReference,
  SiteContext,
  StrategyMapperFormData,
  StrategyMapperService,
} from "@/types/strategy-mapper";

const inputClass =
  "w-full rounded-lg border border-white/[0.12] bg-bip-page px-3 py-2.5 text-sm text-white placeholder:text-white/40 focus:border-bip-accent focus:outline-none focus:ring-2 focus:ring-bip-accent/30";

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-white/75">
        {label}
        {required ? <span className="text-bip-danger"> *</span> : null}
      </span>
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
    <section className="rounded-xl border border-white/[0.08] bg-bip-card p-5 sm:p-6">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-bip-accent">
        {title}
      </h2>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function linesToList(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function listToLines(items: string[]): string {
  return items.join("\n");
}

interface StrategyMapperFormProps {
  onFetchData: (
    form: StrategyMapperFormData,
    options: { useMockResearch: boolean },
  ) => void;
  loading?: boolean;
}

export default function StrategyMapperForm({
  onFetchData,
  loading = false,
}: StrategyMapperFormProps) {
  const [form, setForm] = useState<StrategyMapperFormData>({
    ...INITIAL_STRATEGY_MAPPER_FORM,
    salesPdfExtract: { ...INITIAL_SALES_CONTEXT },
  });
  const [error, setError] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfReference, setPdfReference] = useState<SalesPdfReference | null>(null);
  const [showSalesContext, setShowSalesContext] = useState(false);
  const [tiers, setTiers] = useState<ServiceTierTemplate[]>([]);
  const [useMockResearch, setUseMockResearch] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STRATEGY_MAPPER_MOCK_RESEARCH_STORAGE_KEY);
      if (stored === "true") setUseMockResearch(true);
      if (stored === "false") setUseMockResearch(false);
    } catch {
      // Ignore storage errors in private browsing.
    }
  }, []);

  useEffect(() => {
    void fetch("/api/strategy-mapper/tiers")
      .then((res) => res.json())
      .then((payload: { tiers?: ServiceTierTemplate[] }) => {
        setTiers(payload.tiers ?? []);
      })
      .catch(() => {});
  }, []);

  const activeServicesForTiers = useMemo(
    () => resolveActiveServices(form.activeServices),
    [form.activeServices],
  );

  const resolvedTierSelections = useMemo(() => {
    if (!tiers.length || !activeServicesForTiers.length) return [];
    const selected = resolveSelectedTiers(form, activeServicesForTiers, tiers);
    return activeServicesForTiers.map((service) => ({
      service,
      tierKey: selected[service] ?? "",
    }));
  }, [form, activeServicesForTiers, tiers]);

  const sales = form.salesPdfExtract ?? INITIAL_SALES_CONTEXT;

  function setTierOverride(service: StrategyMapperService, tierKey: string) {
    setForm((prev) => ({
      ...prev,
      tierOverrides: {
        ...prev.tierOverrides,
        [service]: tierKey,
      },
    }));
  }

  function updateField<K extends keyof StrategyMapperFormData>(
    key: K,
    value: StrategyMapperFormData[K],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function updateSalesExtract(patch: Partial<SalesPdfExtract>) {
    setForm((prev) => ({
      ...prev,
      salesPdfExtract: {
        ...(prev.salesPdfExtract ?? INITIAL_SALES_CONTEXT),
        ...patch,
      },
    }));
  }

  function toggleSpecialization(option: string) {
    setForm((prev) => ({
      ...prev,
      specializations: prev.specializations.includes(option)
        ? prev.specializations.filter((item) => item !== option)
        : [...prev.specializations, option],
    }));
  }

  function toggleService(service: StrategyMapperService) {
    setForm((prev) => ({
      ...prev,
      activeServices: prev.activeServices.includes(service)
        ? prev.activeServices.filter((item) => item !== service)
        : [...prev.activeServices, service],
    }));
  }

  async function handleLogoChange(file: File | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Logo must be a PNG or JPG image.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      updateField("logoDataUrl", String(reader.result ?? ""));
    };
    reader.readAsDataURL(file);
  }

  async function handlePdfChange(file: File | null) {
    if (!file) return;
    setPdfLoading(true);
    setError(null);
    try {
      const body = new FormData();
      body.append("document", file);
      const res = await fetch("/api/strategy-mapper/upload-sales-pdf", {
        method: "POST",
        body,
      });
      const payload = (await res.json()) as SalesPdfReference & { error?: string };
      if (!res.ok) {
        throw new Error(payload.error ?? "Failed to upload sales document");
      }
      setPdfReference(payload);
      setForm((prev) => ({
        ...prev,
        salesPdfReference: {
          fileName: payload.fileName,
          storagePath: payload.storagePath,
          uploadedAt: payload.uploadedAt,
        },
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload sales document");
    } finally {
      setPdfLoading(false);
    }
  }

  function setUseMockResearchPersisted(value: boolean) {
    setUseMockResearch(value);
    try {
      localStorage.setItem(STRATEGY_MAPPER_MOCK_RESEARCH_STORAGE_KEY, String(value));
    } catch {
      // Ignore storage errors in private browsing.
    }
  }

  function handleSubmit() {
    if (!form.practiceName.trim()) {
      setError("Practice name is required.");
      return;
    }
    if (!form.streetAddress.trim()) {
      setError("Street address is required.");
      return;
    }
    if (!form.activeServices.length) {
      setError("Select at least one core marketing service.");
      return;
    }
    if (!form.primaryGoal) {
      setError("Select a primary business goal.");
      return;
    }
    const siteContext = resolveSiteContext(form);
    const websiteUrl = normalizeWebsiteUrl(form.websiteUrl ?? "");
    if (websiteUrlRequiredForSiteContext(siteContext) && !websiteUrl) {
      setError("Current website URL is required for this site context.");
      return;
    }
    setError(null);
    onFetchData(
      {
        ...form,
        websiteUrl: websiteUrl || undefined,
        salesPdfExtract: form.salesPdfExtract ?? { ...INITIAL_SALES_CONTEXT },
        salesPdfReference: form.salesPdfReference ?? pdfReference ?? undefined,
      },
      { useMockResearch },
    );
  }

  return (
    <div className="space-y-6">
      <Section title="A. Practice Details">
        <Field label="Practice Name" required>
          <input
            type="text"
            value={form.practiceName}
            onChange={(e) => updateField("practiceName", e.target.value)}
            className={inputClass}
            placeholder="Bayside Animal Hospital"
          />
        </Field>
        <Field label="Practice Owner Name">
          <input
            type="text"
            value={form.practiceOwnerName}
            onChange={(e) => updateField("practiceOwnerName", e.target.value)}
            className={inputClass}
            placeholder="Dr. Jane Smith"
          />
        </Field>
        <Field label="Street Address" required>
          <input
            type="text"
            value={form.streetAddress}
            onChange={(e) => updateField("streetAddress", e.target.value)}
            className={inputClass}
            placeholder="123 Main St, Howell, NJ 07731"
          />
        </Field>
        <Field label="Client Location Notes">
          <textarea
            value={form.locationNotes}
            onChange={(e) => updateField("locationNotes", e.target.value)}
            className={`${inputClass} min-h-[80px]`}
            placeholder="Located next to a massive new housing development..."
          />
        </Field>
        <Field label="Website / platform situation" required>
          <select
            value={form.siteContext ?? "existing_active"}
            onChange={(e) => updateField("siteContext", e.target.value as SiteContext)}
            className={inputClass}
          >
            {SITE_CONTEXT_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
          <p className="mt-1.5 text-xs text-white/45">
            Marketing scope only — BIP is framed as web development solely for brand
            new ground-up clinics; all other contexts use optimization or blueprint
            language.
          </p>
        </Field>
        <Field
          label="Current website URL"
          required={websiteUrlRequiredForSiteContext(form.siteContext ?? "existing_active")}
        >
          <input
            type="url"
            value={form.websiteUrl ?? ""}
            onChange={(e) => updateField("websiteUrl", e.target.value)}
            className={inputClass}
            placeholder="https://examplevet.com"
          />
          <p className="mt-1.5 text-xs text-white/45">
            Used for the post-staging SEO audit (title, meta, crawl, keyword coverage).
          </p>
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Your Google Rating (optional override)">
            <input
              type="text"
              value={form.clientGoogleRating ?? ""}
              onChange={(e) => updateField("clientGoogleRating", e.target.value)}
              className={inputClass}
              placeholder="4.2"
            />
          </Field>
          <Field label="Your Review Count (optional override)">
            <input
              type="text"
              value={form.clientReviewCount ?? ""}
              onChange={(e) => updateField("clientReviewCount", e.target.value)}
              className={inputClass}
              placeholder="128"
            />
          </Field>
        </div>
        <Field label="Logo Upload (optional)">
          <input
            ref={logoInputRef}
            type="file"
            accept="image/png,image/jpeg,image/jpg"
            onChange={(e) => void handleLogoChange(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-white/60 file:mr-3 file:rounded-md file:border-0 file:bg-bip-accent file:px-3 file:py-2 file:text-sm file:font-medium file:text-bip-page"
          />
          {form.logoDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={form.logoDataUrl}
              alt="Practice logo preview"
              className="mt-3 max-h-16 rounded border border-white/[0.08]"
            />
          ) : null}
        </Field>
      </Section>

      <Section title="B. Animal Specializations">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {SPECIALIZATION_OPTIONS.map((option) => (
            <label
              key={option}
              className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 text-sm transition ${
                form.specializations.includes(option)
                  ? "border-bip-accent bg-bip-accent/10 text-white"
                  : "border-white/[0.08] text-white/75 hover:border-bip-accent"
              }`}
            >
              <input
                type="checkbox"
                checked={form.specializations.includes(option)}
                onChange={() => toggleSpecialization(option)}
                className="accent-bip-accent"
              />
              {option}
            </label>
          ))}
        </div>
        <Field label="+ Add Custom Specialization">
          <input
            type="text"
            value={form.customSpecialization}
            onChange={(e) => updateField("customSpecialization", e.target.value)}
            className={inputClass}
            placeholder="e.g. Feline-only practice"
          />
        </Field>
      </Section>

      <Section title="C. Core Marketing Services">
        <p className="text-xs text-white/50">
          Select Phase 1 services manually. Tier overrides appear once services are selected.
        </p>
        <div className="grid grid-cols-1 gap-2">
          {CORE_SERVICE_OPTIONS.map((option) => (
            <label
              key={option.id}
              className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 text-sm transition ${
                form.activeServices.includes(option.id)
                  ? "border-bip-accent bg-bip-accent/10 text-white"
                  : "border-white/[0.08] text-white/75 hover:border-bip-accent"
              }`}
            >
              <input
                type="checkbox"
                checked={form.activeServices.includes(option.id)}
                onChange={() => toggleService(option.id)}
                className="accent-bip-accent"
              />
              {option.label}
            </label>
          ))}
        </div>
        {resolvedTierSelections.length > 0 && tiers.length > 0 ? (
          <div className="space-y-3 rounded-lg border border-white/[0.08] bg-bip-page/60 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-white/50">
              Resolved service tiers (override if needed)
            </p>
            {resolvedTierSelections.map(({ service, tierKey }) => {
              const serviceTiers = tiers
                .filter((t) => t.service === service)
                .sort((a, b) => a.tierRank - b.tierRank);
              const label =
                CORE_SERVICE_OPTIONS.find((o) => o.id === service)?.label ?? service;
              return (
                <label key={service} className="block text-sm">
                  <span className="mb-1 block text-white/60">{label}</span>
                  <select
                    value={form.tierOverrides?.[service] ?? tierKey}
                    onChange={(e) => setTierOverride(service, e.target.value)}
                    className={inputClass}
                  >
                    {serviceTiers.map((tier) => (
                      <option key={tier.tierKey} value={tier.tierKey}>
                        {tier.tierLabel}
                      </option>
                    ))}
                  </select>
                </label>
              );
            })}
          </div>
        ) : null}
      </Section>

      <Section title="D. Goal-Driven Customization">
        <Field label="Primary Business Goal" required>
          <select
            value={form.primaryGoal}
            onChange={(e) =>
              updateField("primaryGoal", e.target.value as PrimaryBusinessGoal | "")
            }
            className={inputClass}
          >
            <option value="">Select a goal...</option>
            {PRIMARY_GOAL_OPTIONS.map((goal) => (
              <option key={goal} value={goal}>
                {goal}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Strategic Context Notes">
          <textarea
            value={form.strategicContextNotes}
            onChange={(e) => updateField("strategicContextNotes", e.target.value)}
            className={`${inputClass} min-h-[100px]`}
            placeholder="Dr. Smith is retiring in 6 months; need to migrate her patient base..."
          />
        </Field>
      </Section>

      <Section title="E. Sales Document (reference)">
        <p className="text-xs text-white/50">
          Upload a sales PDF for reference only — it is stored securely and is not parsed
          automatically. Enter sales context manually below.
        </p>
        <Field label="Sales File Upload">
          <input
            ref={pdfInputRef}
            type="file"
            accept=".pdf,.docx,.txt,application/pdf"
            onChange={(e) => void handlePdfChange(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-white/60 file:mr-3 file:rounded-md file:border-0 file:bg-bip-accent file:px-3 file:py-2 file:text-sm file:font-medium file:text-bip-page"
          />
        </Field>
        {pdfLoading ? (
          <p className="text-sm text-white/50">Uploading document…</p>
        ) : null}
        {(pdfReference ?? form.salesPdfReference) ? (
          <p className="rounded-lg border border-white/[0.08] bg-bip-page/60 px-4 py-3 text-sm text-white/70">
            Stored for reference:{" "}
            <span className="font-medium text-white">
              {(pdfReference ?? form.salesPdfReference)!.fileName}
            </span>
          </p>
        ) : null}
      </Section>

      <section className="rounded-xl border border-white/[0.08] bg-bip-card p-5 sm:p-6">
        <button
          type="button"
          onClick={() => setShowSalesContext((open) => !open)}
          className="flex w-full items-center justify-between text-left text-sm font-semibold uppercase tracking-wide text-bip-accent"
        >
          F. Sales Context (optional)
          <span className="text-xs normal-case text-white/50">
            {showSalesContext ? "Hide" : "Show"}
          </span>
        </button>
        {showSalesContext ? (
          <div className="mt-4 space-y-4">
            <Field label="Clinical differentiator">
              <input
                type="text"
                value={sales.clinicalDifferentiator}
                onChange={(e) =>
                  updateSalesExtract({ clinicalDifferentiator: e.target.value })
                }
                className={inputClass}
                placeholder="e.g. TPLO at ~half regional referral hospital cost"
              />
            </Field>
            <Field label="Primary procedures (one per line)">
              <textarea
                value={listToLines(sales.primaryProcedures)}
                onChange={(e) =>
                  updateSalesExtract({ primaryProcedures: linesToList(e.target.value) })
                }
                className={`${inputClass} min-h-[80px]`}
                placeholder="TPLO&#10;Tibial Plateau Leveling Osteotomy"
              />
            </Field>
            <Field label="Pain points (one per line)">
              <textarea
                value={listToLines(sales.painPoints)}
                onChange={(e) =>
                  updateSalesExtract({ painPoints: linesToList(e.target.value) })
                }
                className={`${inputClass} min-h-[80px]`}
              />
            </Field>
            <Field label="Goals (one per line)">
              <textarea
                value={listToLines(sales.goals)}
                onChange={(e) => updateSalesExtract({ goals: linesToList(e.target.value) })}
                className={`${inputClass} min-h-[80px]`}
              />
            </Field>
            <Field label="Agency frustrations (one per line)">
              <textarea
                value={listToLines(sales.agencyFrustrations)}
                onChange={(e) =>
                  updateSalesExtract({ agencyFrustrations: linesToList(e.target.value) })
                }
                className={`${inputClass} min-h-[80px]`}
              />
            </Field>
            <label className="flex cursor-pointer items-center gap-3 text-sm text-white/75">
              <input
                type="checkbox"
                checked={sales.clientRunsOwnAds}
                onChange={(e) =>
                  updateSalesExtract({ clientRunsOwnAds: e.target.checked })
                }
                className="h-4 w-4 rounded border-white/20 bg-bip-page text-bip-accent focus:ring-bip-accent"
              />
              Client runs own Google Ads
            </label>
            <Field label="Client persona tone">
              <select
                value={sales.clientPersonaTone}
                onChange={(e) =>
                  updateSalesExtract({
                    clientPersonaTone: e.target.value as ClientPersonaTone,
                  })
                }
                className={inputClass}
              >
                <option value="standard">Standard — warm, expert</option>
                <option value="no-nonsense">No-nonsense — direct, data-driven</option>
              </select>
            </Field>
          </div>
        ) : null}
      </section>

      {error ? (
        <p className="rounded-lg border border-bip-danger/30 bg-bip-danger/10 px-4 py-3 text-sm text-bip-danger">
          {error}
        </p>
      ) : null}

      <Section title="Competitor research source">
        <p className="text-xs text-white/50">
          Choose how competitor rows are populated before staging. Your choice is
          remembered in this browser.
        </p>
        <div className="space-y-2">
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-white/[0.08] bg-bip-page/40 px-3 py-3 text-sm text-white/75">
            <input
              type="radio"
              name="research-source"
              checked={!useMockResearch}
              onChange={() => setUseMockResearchPersisted(false)}
              className="mt-0.5 h-4 w-4 border-white/20 bg-bip-page text-bip-accent focus:ring-bip-accent"
            />
            <span>
              <span className="font-medium text-white">Live research</span>
              <span className="mt-0.5 block text-xs text-white/50">
                Anthropic web search for nearby competitors and GBP signals. Uses
                API credits.
              </span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-white/[0.08] bg-bip-page/40 px-3 py-3 text-sm text-white/75">
            <input
              type="radio"
              name="research-source"
              checked={useMockResearch}
              onChange={() => setUseMockResearchPersisted(true)}
              className="mt-0.5 h-4 w-4 border-white/20 bg-bip-page text-bip-accent focus:ring-bip-accent"
            />
            <span>
              <span className="font-medium text-white">Placeholder research</span>
              <span className="mt-0.5 block text-xs text-white/50">
                Skip Anthropic — load editable sample competitors on staging. Best
                for testing without credits.
              </span>
            </span>
          </label>
        </div>
      </Section>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={loading}
          className="flex items-center gap-2 rounded-lg bg-bip-accent px-6 py-3 text-sm font-medium text-bip-page transition hover:brightness-110 disabled:opacity-60"
        >
          {loading ? (
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-bip-page border-t-transparent" />
          ) : null}
          Fetch Data
        </button>
      </div>
    </div>
  );
}
