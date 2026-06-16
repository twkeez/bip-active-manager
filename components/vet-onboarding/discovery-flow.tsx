"use client";

import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import BrandHeader from "@/components/vet-onboarding/brand-header";
import {
  AVG_TRANSACTION_VALUE_OPTIONS,
  BOOKING_AVAILABILITY_OPTIONS,
  CLIENT_FOCUS_OPTIONS,
  CLINIC_SETTING_OPTIONS,
  COMPETITOR_TYPE_OPTIONS,
  COMPETITORS_ADS_OPTIONS,
  COMPETITORS_SOCIAL_OPTIONS,
  CUSTOMER_LTV_OPTIONS,
  DIFFERENTIATOR_OPTIONS,
  DISCOVERY_STEPS,
  GOOGLE_RATING_OPTIONS,
  GOOGLE_REVIEW_COUNT_OPTIONS,
  INITIAL_DISCOVERY_FORM,
  MARKET_GAP_OPTIONS,
  ONLINE_BOOKING_OPTIONS,
  PRACTICE_SOFTWARE_OPTIONS,
  REVIEW_RESPONSE_OPTIONS,
  YES_NO_UNSURE_OPTIONS,
} from "@/lib/vet-onboarding/discovery-options";
import type {
  ClientFormData,
  DiscoveryFormData,
  DiscoveryReport,
  OnboardingPlan,
} from "@/types/onboarding";

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

function RadioGroup({
  name,
  options,
  value,
  onChange,
}: {
  name: string;
  options: readonly string[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      {options.map((option) => (
        <label
          key={option}
          className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 text-sm transition ${
            value === option
              ? "border-bip-accent bg-bip-accent/10 ring-1 ring-bip-accent text-white"
              : "border-white/[0.08] bg-bip-page text-white/75 hover:border-bip-accent"
          }`}
        >
          <input
            type="radio"
            name={name}
            value={option}
            checked={value === option}
            onChange={() => onChange(option)}
            className="sr-only"
          />
          <span
            className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
              value === option
                ? "border-bip-accent bg-bip-accent"
                : "border-white/30"
            }`}
          >
            {value === option ? (
              <span className="h-1.5 w-1.5 rounded-full bg-bip-page" />
            ) : null}
          </span>
          {option}
        </label>
      ))}
    </div>
  );
}

function MultiSelect({
  options,
  selected,
  onToggle,
}: {
  options: readonly string[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {options.map((option) => {
        const isSelected = selected.includes(option);
        return (
          <button
            key={option}
            type="button"
            onClick={() => onToggle(option)}
            className={`rounded-lg border px-4 py-3 text-left text-sm transition ${
              isSelected
                ? "border-bip-accent bg-bip-accent/10 text-white ring-1 ring-bip-accent"
                : "border-white/[0.08] bg-bip-page text-white/75 hover:border-bip-accent"
            }`}
          >
            <span className="mr-2">{isSelected ? "☑" : "☐"}</span>
            {option}
          </button>
        );
      })}
    </div>
  );
}

function validateDiscoveryStep(
  step: number,
  data: DiscoveryFormData,
): string | null {
  switch (step) {
    case 1:
      if (!data.clientFocus) return "Select whether they want more or higher-margin clients";
      if (!data.bookingAvailability) return "Select current booking availability";
      if (data.differentiators.length === 0) {
        return "Select at least one differentiator";
      }
      if (
        data.differentiators.includes("Other") &&
        !data.differentiatorOther.trim()
      ) {
        return "Please describe their other differentiator";
      }
      if (!data.avgTransactionValue) return "Select approximate average transaction value";
      if (!data.customerLifetimeValue) return "Select approximate customer lifetime value";
      return null;
    case 2:
      if (!data.googleRating) return "Select current Google star rating";
      if (!data.googleReviewCount) return "Select approximate review count";
      if (!data.reviewResponseHabit) return "Select review response habit";
      if (!data.mobileFriendly) return "Indicate if the website is mobile-friendly";
      if (!data.onlineBooking) return "Indicate online booking availability";
      if (!data.practiceSoftware) return "Select practice management / booking software";
      return null;
    case 3:
      if (!data.clinicSetting) return "Select clinic setting";
      if (data.competitorTypes.length === 0) {
        return "Select at least one competitor type";
      }
      if (!data.competitorsRunningAds) return "Indicate if competitors run Google Ads";
      if (!data.competitorsSocialActive) {
        return "Indicate competitor social media activity";
      }
      if (data.marketGaps.length === 0) return "Select at least one market gap";
      return null;
    default:
      return null;
  }
}

async function generateDiscoveryReport(
  clientData: ClientFormData,
  discoveryData: DiscoveryFormData,
  onboardingPlan: OnboardingPlan,
): Promise<DiscoveryReport> {
  const res = await fetch("/api/discovery", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      clientData,
      discoveryData,
      onboardingPlan,
    }),
  });

  if (!res.ok) {
    const body = (await res.json()) as { error?: string };
    throw new Error(body.error ?? "Failed to generate discovery report");
  }

  const payload = (await res.json()) as { discovery: DiscoveryReport };
  return payload.discovery;
}

interface DiscoveryFlowProps {
  clientData: ClientFormData;
  onboardingPlan: OnboardingPlan;
  onComplete: (result: {
    report: DiscoveryReport;
    formData: DiscoveryFormData;
  }) => void;
  onBack: () => void;
}

export default function DiscoveryFlow({
  clientData,
  onboardingPlan,
  onComplete,
  onBack,
}: DiscoveryFlowProps) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<DiscoveryFormData>(INITIAL_DISCOVERY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // #region agent log
  useEffect(() => {
    const undefinedFields = (
      Object.keys(INITIAL_DISCOVERY_FORM) as (keyof DiscoveryFormData)[]
    ).filter((key) => form[key] === undefined);
    if (undefinedFields.length > 0) {
      fetch("http://127.0.0.1:7929/ingest/6a0fb721-e102-4933-b813-4011803d5752", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Debug-Session-Id": "5b21af",
        },
        body: JSON.stringify({
          sessionId: "5b21af",
          location: "discovery-flow.tsx:form-state",
          message: "discovery form has undefined fields",
          data: { undefinedFields, step },
          timestamp: Date.now(),
          hypothesisId: "C",
        }),
      }).catch(() => {});
    }
  }, [form, step]);
  // #endregion

  function updateField<K extends keyof DiscoveryFormData>(
    key: K,
    value: DiscoveryFormData[K],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setError(null);
  }

  function toggleMultiSelect(
    key: "differentiators" | "competitorTypes" | "marketGaps",
    value: string,
  ) {
    setForm((prev) => ({
      ...prev,
      [key]: prev[key].includes(value)
        ? prev[key].filter((item) => item !== value)
        : [...prev[key], value],
    }));
    setError(null);
  }

  function handleNext() {
    const validationError = validateDiscoveryStep(step, form);
    if (validationError) {
      setError(validationError);
      return;
    }
    setStep((prev) => prev + 1);
  }

  function handleBack() {
    if (step === 1) {
      onBack();
      return;
    }
    setStep((prev) => prev - 1);
    setError(null);
  }

  async function handleSubmit() {
    const validationError = validateDiscoveryStep(3, form);
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const report = await generateDiscoveryReport(
        clientData,
        form,
        onboardingPlan,
      );
      onComplete({ report, formData: form });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to generate discovery report",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-bip-page font-sans text-white/75">
      <BrandHeader />
      <div className="px-4 py-10 sm:px-6">
        <div className="mx-auto max-w-2xl">
          <div className="mb-6 flex items-center justify-between">
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-2 rounded-lg border border-white/[0.08] bg-bip-card px-3 py-2 text-sm text-white/75 transition hover:bg-white/[0.06]"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to plan
            </button>
            <p className="text-xs text-white/50">{clientData.practiceName}</p>
          </div>

          <header className="mb-8 text-center">
            <h1 className="text-2xl font-bold text-white">Full Discovery</h1>
            <p className="mt-2 text-sm text-white/75">
              A deeper diagnostic for {clientData.practiceName} — building on your
              onboarding intake to produce a strategic discovery report.
            </p>
          </header>

          <div className="mb-8 flex items-center justify-center gap-2">
            {DISCOVERY_STEPS.map((label, i) => {
              const stepNum = i + 1;
              const active = step === stepNum;
              const done = step > stepNum;
              return (
                <div key={label} className="flex items-center gap-2">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${
                      active
                        ? "bg-bip-accent text-bip-page"
                        : done
                          ? "bg-bip-accent/20 text-bip-accent"
                          : "bg-white/[0.06] text-white/40"
                    }`}
                  >
                    {stepNum}
                  </div>
                  <span
                    className={`hidden text-sm sm:inline ${
                      active ? "font-medium text-white" : "text-white/50"
                    }`}
                  >
                    {label}
                  </span>
                  {i < DISCOVERY_STEPS.length - 1 ? (
                    <div
                      className={`mx-1 h-px w-8 sm:w-12 ${
                        done ? "bg-bip-accent" : "bg-white/[0.08]"
                      }`}
                    />
                  ) : null}
                </div>
              );
            })}
          </div>

          <div className="rounded-2xl border border-white/[0.08] bg-bip-card p-6 shadow-none sm:p-8">
            {step === 1 ? (
              <div className="space-y-5">
                <h2 className="text-lg font-semibold text-white">
                  Capacity &amp; Practice DNA
                </h2>
                <Field label="Are they looking for more clients, or better/higher-margin clients?" required>
                  <RadioGroup
                    name="clientFocus"
                    options={CLIENT_FOCUS_OPTIONS}
                    value={form.clientFocus}
                    onChange={(value) => updateField("clientFocus", value)}
                  />
                </Field>
                <Field label="Current booking availability" required>
                  <select
                    value={form.bookingAvailability}
                    onChange={(e) =>
                      updateField("bookingAvailability", e.target.value)
                    }
                    className={inputClass}
                  >
                    <option value="">Select availability</option>
                    {BOOKING_AVAILABILITY_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Standout differentiator / UVP" required>
                  <MultiSelect
                    options={DIFFERENTIATOR_OPTIONS}
                    selected={form.differentiators}
                    onToggle={(value) =>
                      toggleMultiSelect("differentiators", value)
                    }
                  />
                </Field>
                {form.differentiators.includes("Other") ? (
                  <Field label="Describe other differentiator" required>
                    <input
                      type="text"
                      value={form.differentiatorOther}
                      onChange={(e) =>
                        updateField("differentiatorOther", e.target.value)
                      }
                      className={inputClass}
                      placeholder="e.g. Cat-only clinic, integrative oncology"
                    />
                  </Field>
                ) : null}
                <Field label="Approximate average transaction value" required>
                  <select
                    value={form.avgTransactionValue}
                    onChange={(e) =>
                      updateField("avgTransactionValue", e.target.value)
                    }
                    className={inputClass}
                  >
                    <option value="">Select range</option>
                    {AVG_TRANSACTION_VALUE_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Approximate customer lifetime value" required>
                  <select
                    value={form.customerLifetimeValue}
                    onChange={(e) =>
                      updateField("customerLifetimeValue", e.target.value)
                    }
                    className={inputClass}
                  >
                    <option value="">Select range</option>
                    {CUSTOMER_LTV_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
            ) : null}

            {step === 2 ? (
              <div className="space-y-5">
                <h2 className="text-lg font-semibold text-white">
                  Reputation &amp; Digital Audit
                </h2>
                <Field label="Current Google star rating" required>
                  <select
                    value={form.googleRating}
                    onChange={(e) => updateField("googleRating", e.target.value)}
                    className={inputClass}
                  >
                    <option value="">Select rating range</option>
                    {GOOGLE_RATING_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Approx number of Google reviews" required>
                  <select
                    value={form.googleReviewCount}
                    onChange={(e) =>
                      updateField("googleReviewCount", e.target.value)
                    }
                    className={inputClass}
                  >
                    <option value="">Select review count</option>
                    {GOOGLE_REVIEW_COUNT_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Do they respond to reviews?" required>
                  <select
                    value={form.reviewResponseHabit}
                    onChange={(e) =>
                      updateField("reviewResponseHabit", e.target.value)
                    }
                    className={inputClass}
                  >
                    <option value="">Select response habit</option>
                    {REVIEW_RESPONSE_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Is the website mobile-friendly?" required>
                  <RadioGroup
                    name="mobileFriendly"
                    options={YES_NO_UNSURE_OPTIONS}
                    value={form.mobileFriendly}
                    onChange={(value) => updateField("mobileFriendly", value)}
                  />
                </Field>
                <Field label="Is there a clear online booking button?" required>
                  <RadioGroup
                    name="onlineBooking"
                    options={ONLINE_BOOKING_OPTIONS}
                    value={form.onlineBooking}
                    onChange={(value) => updateField("onlineBooking", value)}
                  />
                </Field>
                <Field
                  label="Which practice management / booking software do they use?"
                  required
                >
                  <select
                    value={form.practiceSoftware}
                    onChange={(e) =>
                      updateField("practiceSoftware", e.target.value)
                    }
                    className={inputClass}
                  >
                    <option value="">Select software</option>
                    {PRACTICE_SOFTWARE_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
            ) : null}

            {step === 3 ? (
              <div className="space-y-5">
                <h2 className="text-lg font-semibold text-white">
                  Competitive Landscape
                </h2>
                <Field label="Clinic setting" required>
                  <RadioGroup
                    name="clinicSetting"
                    options={CLINIC_SETTING_OPTIONS}
                    value={form.clinicSetting}
                    onChange={(value) => updateField("clinicSetting", value)}
                  />
                </Field>
                <Field label="Primary competitor type" required>
                  <MultiSelect
                    options={COMPETITOR_TYPE_OPTIONS}
                    selected={form.competitorTypes}
                    onToggle={(value) =>
                      toggleMultiSelect("competitorTypes", value)
                    }
                  />
                </Field>
                <Field label="Are competitors running Google Ads?" required>
                  <RadioGroup
                    name="competitorsRunningAds"
                    options={COMPETITORS_ADS_OPTIONS}
                    value={form.competitorsRunningAds}
                    onChange={(value) =>
                      updateField("competitorsRunningAds", value)
                    }
                  />
                </Field>
                <Field label="Are competitors active on social media?" required>
                  <RadioGroup
                    name="competitorsSocialActive"
                    options={COMPETITORS_SOCIAL_OPTIONS}
                    value={form.competitorsSocialActive}
                    onChange={(value) =>
                      updateField("competitorsSocialActive", value)
                    }
                  />
                </Field>
                <Field label="What gaps exist that this clinic could fill?" required>
                  <MultiSelect
                    options={MARKET_GAP_OPTIONS}
                    selected={form.marketGaps}
                    onToggle={(value) => toggleMultiSelect("marketGaps", value)}
                  />
                </Field>
                <Field label="Specific competitor names to analyse (optional)">
                  <input
                    type="text"
                    value={form.competitorNames}
                    onChange={(e) =>
                      updateField("competitorNames", e.target.value)
                    }
                    className={inputClass}
                    placeholder="e.g. Riverside Animal Hospital, VCA Austin"
                  />
                  <p className="mt-1 text-xs text-white/50">
                    Comma-separated — we will look up ratings, ads, and social
                    presence.
                  </p>
                </Field>
              </div>
            ) : null}

            {error ? (
              <p className="mt-4 rounded-lg border border-bip-danger/30 bg-bip-danger/10 px-4 py-3 text-sm text-bip-danger">
                {error}
              </p>
            ) : null}

            <div className="mt-8 flex justify-between">
              <button
                type="button"
                onClick={handleBack}
                className="rounded-lg border border-white/[0.08] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-white/[0.06]"
              >
                Back
              </button>

              {step < 3 ? (
                <button
                  type="button"
                  onClick={handleNext}
                  className="rounded-lg bg-bip-accent px-5 py-2.5 text-sm font-medium text-bip-page transition hover:brightness-110"
                >
                  Continue
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={loading}
                  className="flex items-center gap-2 rounded-lg bg-bip-accent px-5 py-2.5 text-sm font-medium text-bip-page transition hover:brightness-110 disabled:opacity-60"
                >
                  {loading ? (
                    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-bip-page border-t-transparent" />
                  ) : null}
                  {loading ? "Researching & generating…" : "Generate Discovery Report"}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
