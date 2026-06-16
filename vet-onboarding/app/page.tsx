"use client";

import { useState } from "react";
import OnboardingOutput from "@/app/components/OnboardingOutput";
import type { ClientFormData, OnboardingPlan } from "@/types/onboarding";

const PRACTICE_TYPES = [
  "General Practice",
  "Emergency / Urgent Care",
  "Specialty / Referral",
  "Mobile / House Call",
  "Mixed Animal",
  "Exotic / Avian",
];

const NUM_VETS_OPTIONS = ["1", "2-3", "4-6", "7-10", "11+"];

const SERVICES = [
  "SEO / Local Search",
  "Google Ads / PPC",
  "Social Media Management",
  "Content Marketing",
  "Google Business Profile Optimisation",
  "Review Management",
];

const MAIN_GOALS = [
  "Increase new client appointments",
  "Improve online visibility",
  "Build brand awareness",
  "Retain existing clients",
  "Launch a new location or service",
  "Recover from a reputation issue",
];

const BUDGET_OPTIONS = [
  "Under $1,000/month",
  "$1,000 – $2,500/month",
  "$2,500 – $5,000/month",
  "$5,000 – $10,000/month",
  "$10,000+/month",
];

const TIMELINE_OPTIONS = [
  "ASAP — need results within 30 days",
  "1–3 months",
  "3–6 months",
  "6–12 months",
  "Ongoing / no rush",
];

const PRESENCE_OPTIONS = [
  "No website or social media",
  "Basic website, minimal marketing",
  "Active website, some SEO/ads",
  "Established presence, want to scale",
  "Switching from another agency",
];

const INITIAL_FORM: ClientFormData = {
  practiceName: "",
  contactName: "",
  location: "",
  practiceType: "",
  numVets: "",
  services: [],
  mainGoal: "",
  challenge: "",
  budget: "",
  timeline: "",
  presence: "",
  notes: "",
};

const STEPS = ["Practice Info", "Goals & Services", "Budget & Timeline"];

function validateStep(step: number, data: ClientFormData): string | null {
  switch (step) {
    case 1:
      if (!data.practiceName.trim()) return "Practice name is required";
      if (!data.contactName.trim()) return "Contact name is required";
      if (!data.location.trim()) return "Location is required";
      if (!data.practiceType) return "Practice type is required";
      if (!data.numVets) return "Number of veterinarians is required";
      return null;
    case 2:
      if (data.services.length === 0)
        return "Select at least one service";
      if (!data.mainGoal) return "Main goal is required";
      if (!data.challenge.trim()) return "Biggest challenge is required";
      return null;
    case 3:
      if (!data.budget) return "Monthly budget is required";
      if (!data.timeline) return "Timeline is required";
      if (!data.presence) return "Existing digital presence is required";
      return null;
    default:
      return null;
  }
}

export default function Home() {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<ClientFormData>(INITIAL_FORM);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState<OnboardingPlan | null>(null);

  function updateField<K extends keyof ClientFormData>(
    key: K,
    value: ClientFormData[K],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setError(null);
  }

  function toggleService(service: string) {
    setForm((prev) => ({
      ...prev,
      services: prev.services.includes(service)
        ? prev.services.filter((s) => s !== service)
        : [...prev.services, service],
    }));
    setError(null);
  }

  function handleNext() {
    const validationError = validateStep(step, form);
    if (validationError) {
      setError(validationError);
      return;
    }
    setStep((s) => s + 1);
  }

  function handleBack() {
    setError(null);
    setStep((s) => s - 1);
  }

  async function handleGenerate() {
    const validationError = validateStep(3, form);
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error ?? "Failed to generate plan");
      }

      const data = (await res.json()) as OnboardingPlan;
      setPlan(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to generate plan",
      );
    } finally {
      setLoading(false);
    }
  }

  function handleStartOver() {
    setForm(INITIAL_FORM);
    setStep(1);
    setPlan(null);
    setError(null);
  }

  if (plan) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-10 sm:px-6">
        <div className="mb-8 flex items-center justify-between print:hidden">
          <h1 className="text-xl font-semibold text-slate-900">
            Veterinary Client Onboarding
          </h1>
          <button
            type="button"
            onClick={handleStartOver}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Start Over
          </button>
        </div>
        <OnboardingOutput plan={plan} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-2xl">
        <header className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-slate-900">
            Veterinary Client Onboarding
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Tell us about your practice and we&apos;ll build a personalized
            marketing onboarding plan.
          </p>
        </header>

        <div className="mb-8 flex items-center justify-center gap-2">
          {STEPS.map((label, i) => {
            const stepNum = i + 1;
            const active = step === stepNum;
            const done = step > stepNum;
            return (
              <div key={label} className="flex items-center gap-2">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${
                    active
                      ? "bg-teal-600 text-white"
                      : done
                        ? "bg-teal-100 text-teal-700"
                        : "bg-slate-200 text-slate-500"
                  }`}
                >
                  {stepNum}
                </div>
                <span
                  className={`hidden text-sm sm:inline ${
                    active ? "font-medium text-slate-900" : "text-slate-500"
                  }`}
                >
                  {label}
                </span>
                {i < STEPS.length - 1 && (
                  <div
                    className={`mx-1 h-px w-8 sm:w-12 ${
                      done ? "bg-teal-300" : "bg-slate-200"
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          {step === 1 && (
            <div className="space-y-5">
              <h2 className="text-lg font-semibold text-slate-900">
                Practice Information
              </h2>
              <Field label="Practice Name" required>
                <input
                  type="text"
                  value={form.practiceName}
                  onChange={(e) => updateField("practiceName", e.target.value)}
                  className={inputClass}
                  placeholder="e.g. Paws & Claws Veterinary Clinic"
                />
              </Field>
              <Field label="Contact Name" required>
                <input
                  type="text"
                  value={form.contactName}
                  onChange={(e) => updateField("contactName", e.target.value)}
                  className={inputClass}
                  placeholder="e.g. Dr. Sarah Johnson"
                />
              </Field>
              <Field label="Location" required>
                <input
                  type="text"
                  value={form.location}
                  onChange={(e) => updateField("location", e.target.value)}
                  className={inputClass}
                  placeholder="e.g. Austin, TX"
                />
              </Field>
              <Field label="Practice Type" required>
                <select
                  value={form.practiceType}
                  onChange={(e) => updateField("practiceType", e.target.value)}
                  className={inputClass}
                >
                  <option value="">Select practice type</option>
                  {PRACTICE_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Number of Veterinarians" required>
                <select
                  value={form.numVets}
                  onChange={(e) => updateField("numVets", e.target.value)}
                  className={inputClass}
                >
                  <option value="">Select number of vets</option>
                  {NUM_VETS_OPTIONS.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <h2 className="text-lg font-semibold text-slate-900">
                Goals &amp; Services
              </h2>
              <Field label="Services of Interest" required>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {SERVICES.map((service) => {
                    const selected = form.services.includes(service);
                    return (
                      <button
                        key={service}
                        type="button"
                        onClick={() => toggleService(service)}
                        className={`rounded-lg border px-4 py-3 text-left text-sm transition ${
                          selected
                            ? "border-teal-500 bg-teal-50 text-teal-900 ring-1 ring-teal-500"
                            : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                        }`}
                      >
                        <span className="mr-2">{selected ? "☑" : "☐"}</span>
                        {service}
                      </button>
                    );
                  })}
                </div>
              </Field>
              <Field label="Main Goal" required>
                <select
                  value={form.mainGoal}
                  onChange={(e) => updateField("mainGoal", e.target.value)}
                  className={inputClass}
                >
                  <option value="">Select main goal</option>
                  {MAIN_GOALS.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Biggest Marketing Challenge" required>
                <textarea
                  value={form.challenge}
                  onChange={(e) => updateField("challenge", e.target.value)}
                  rows={4}
                  className={inputClass}
                  placeholder="What's the biggest challenge your practice faces with marketing?"
                />
              </Field>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <h2 className="text-lg font-semibold text-slate-900">
                Budget &amp; Timeline
              </h2>
              <Field label="Monthly Marketing Budget" required>
                <select
                  value={form.budget}
                  onChange={(e) => updateField("budget", e.target.value)}
                  className={inputClass}
                >
                  <option value="">Select budget range</option>
                  {BUDGET_OPTIONS.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Desired Timeline" required>
                <select
                  value={form.timeline}
                  onChange={(e) => updateField("timeline", e.target.value)}
                  className={inputClass}
                >
                  <option value="">Select timeline</option>
                  {TIMELINE_OPTIONS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Existing Digital Presence" required>
                <select
                  value={form.presence}
                  onChange={(e) => updateField("presence", e.target.value)}
                  className={inputClass}
                >
                  <option value="">Select current presence</option>
                  {PRESENCE_OPTIONS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Additional Notes">
                <textarea
                  value={form.notes}
                  onChange={(e) => updateField("notes", e.target.value)}
                  rows={3}
                  className={inputClass}
                  placeholder="Anything else we should know? (optional)"
                />
              </Field>
            </div>
          )}

          {error && (
            <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </p>
          )}

          <div className="mt-8 flex justify-between">
            {step > 1 ? (
              <button
                type="button"
                onClick={handleBack}
                className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Back
              </button>
            ) : (
              <div />
            )}

            {step < 3 ? (
              <button
                type="button"
                onClick={handleNext}
                className="rounded-lg bg-teal-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-teal-500"
              >
                Continue
              </button>
            ) : (
              <button
                type="button"
                onClick={handleGenerate}
                disabled={loading}
                className="flex items-center gap-2 rounded-lg bg-teal-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-teal-500 disabled:opacity-60"
              >
                {loading && (
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                )}
                {loading ? "Generating…" : "Generate Onboarding Plan"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const inputClass =
  "w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500";

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
      <span className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </span>
      {children}
    </label>
  );
}
