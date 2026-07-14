"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { ArrowLeft, FileUp, Upload } from "lucide-react";
import BrandHeader from "@/components/vet-onboarding/brand-header";
import DiscoveryFlow from "@/components/vet-onboarding/discovery-flow";
import DiscoveryOutput from "@/components/vet-onboarding/discovery-output";
import OnboardingOutput from "@/components/vet-onboarding/onboarding-output";
import {
  BUDGET_OPTIONS,
  MAIN_GOALS,
  NUM_VETS_OPTIONS,
  PRESENCE_OPTIONS,
  PRACTICE_TYPES,
  SERVICES,
  TIMELINE_OPTIONS,
} from "@/lib/vet-onboarding/form-options";
import DigitalFootprintFields from "@/components/vet-onboarding/digital-footprint-fields";
import { normalizeClientFormData } from "@/lib/vet-onboarding/normalize-form-data";
import type {
  ClientFormData,
  DiscoveryFormData,
  DiscoveryReport,
  OnboardingPlan,
} from "@/types/onboarding";

type Props = {
  userEmail?: string;
};

type IntakeMode = "form" | "upload";

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
  websiteUrl: "",
  googleBusinessProfileUrls: "",
  facebookUrl: "",
  instagramUrl: "",
  otherSocialUrls: "",
  practicePhone: "",
  onlineBookingUrl: "",
  serviceAreaNotes: "",
  marketingManagedBy: "",
  previousAgencyName: "",
  intakeGoals: [],
  intakeSummary: "",
};

const STEPS = [
  "Practice Info",
  "Goals & Services",
  "Budget, Timeline & Digital Footprint",
];

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
      if (data.services.length === 0) return "Select at least one service";
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

function validateFullForm(data: ClientFormData): string | null {
  for (let step = 1; step <= 3; step += 1) {
    const err = validateStep(step, data);
    if (err) return err;
  }
  return null;
}

async function generatePlan(formData: ClientFormData): Promise<OnboardingPlan> {
  const res = await fetch("/api/vet-onboarding/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(formData),
  });

  if (!res.ok) {
    const body = (await res.json()) as { error?: string };
    throw new Error(body.error ?? "Failed to generate plan");
  }

  return (await res.json()) as OnboardingPlan;
}

export default function VetClientOnboarding({ userEmail }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [intakeMode, setIntakeMode] = useState<IntakeMode>("form");
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<ClientFormData>(INITIAL_FORM);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [documentExtracted, setDocumentExtracted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [plan, setPlan] = useState<OnboardingPlan | null>(null);
  const [discoveryReport, setDiscoveryReport] = useState<DiscoveryReport | null>(
    null,
  );
  const [discoveryFormData, setDiscoveryFormData] =
    useState<DiscoveryFormData | null>(null);
  const [showDiscoveryFlow, setShowDiscoveryFlow] = useState(false);

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

  function switchIntakeMode(mode: IntakeMode) {
    setIntakeMode(mode);
    setError(null);
    setStep(1);
    if (mode === "form") {
      setUploadFile(null);
      setDocumentExtracted(false);
    }
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setUploadFile(file);
    setDocumentExtracted(false);
    setError(null);
  }

  async function handleExtractDocument() {
    if (!uploadFile) {
      setError("Choose a .pdf, .docx, or .txt file first.");
      return;
    }

    setLoading(true);
    setLoadingMessage("Reading document…");
    setError(null);

    try {
      const body = new FormData();
      body.append("document", uploadFile);

      const res = await fetch("/api/vet-onboarding/parse-document", {
        method: "POST",
        body,
      });

      if (!res.ok) {
        const payload = (await res.json()) as { error?: string };
        throw new Error(payload.error ?? "Failed to parse document");
      }

      const extracted = (await res.json()) as ClientFormData;
      setForm(extracted);
      setDocumentExtracted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse document");
    } finally {
      setLoading(false);
      setLoadingMessage("");
    }
  }

  async function handleGenerate() {
    const validationError =
      intakeMode === "form" ? validateStep(3, form) : validateFullForm(form);
    if (validationError) {
      setError(
        intakeMode === "upload" && !documentExtracted
          ? "Extract intake fields from your document first."
          : validationError,
      );
      return;
    }

    setLoading(true);
    setLoadingMessage("Researching & generating…");
    setError(null);

    try {
      const normalized = normalizeClientFormData(form);
      setForm(normalized);
      const data = await generatePlan(normalized);
      setPlan(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate plan");
    } finally {
      setLoading(false);
      setLoadingMessage("");
    }
  }

  async function handleUploadAndGenerate() {
    if (!uploadFile) {
      setError("Choose a .pdf, .docx, or .txt file first.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      setLoadingMessage("Reading document…");
      const body = new FormData();
      body.append("document", uploadFile);

      const parseRes = await fetch("/api/vet-onboarding/parse-document", {
        method: "POST",
        body,
      });

      if (!parseRes.ok) {
        const payload = (await parseRes.json()) as { error?: string };
        throw new Error(payload.error ?? "Failed to parse document");
      }

      const extracted = (await parseRes.json()) as ClientFormData;
      setForm(extracted);
      setDocumentExtracted(true);

      const validationError = validateFullForm(extracted);
      if (validationError) {
        throw new Error(
          `${validationError} Review the extracted fields below, fill any gaps, then generate again.`,
        );
      }

      setLoadingMessage("Researching & generating…");
      const data = await generatePlan(extracted);
      setPlan(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate plan");
    } finally {
      setLoading(false);
      setLoadingMessage("");
    }
  }

  function handleStartOver() {
    setForm(INITIAL_FORM);
    setStep(1);
    setPlan(null);
    setDiscoveryReport(null);
    setDiscoveryFormData(null);
    setShowDiscoveryFlow(false);
    setError(null);
    setUploadFile(null);
    setDocumentExtracted(false);
    setIntakeMode("form");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  if (plan && discoveryReport) {
    return (
      <div className="min-h-screen bg-bip-page font-sans text-bip-text">
        <BrandHeader />
        <div className="px-4 py-10 sm:px-6">
          <div className="mx-auto mb-8 flex max-w-4xl items-center justify-between print:hidden">
            <Link
              href="/sales-lab"
              className="inline-flex items-center gap-2 rounded-lg border border-bip-border bg-bip-card px-3 py-2 text-sm text-bip-text transition hover:bg-bip-fill"
            >
              <ArrowLeft className="h-4 w-4" />
              Sales Lab
            </Link>
            <button
              type="button"
              onClick={handleStartOver}
              className="rounded-lg border border-bip-border bg-bip-card px-4 py-2 text-sm font-medium text-bip-text transition hover:bg-bip-fill"
            >
              Start Over
            </button>
          </div>
          <DiscoveryOutput
            plan={plan}
            discovery={discoveryReport}
            clientName={form.practiceName}
            intakeGoals={form.intakeGoals}
            clientFormData={form}
            discoveryFormData={discoveryFormData ?? undefined}
          />
        </div>
      </div>
    );
  }

  if (plan && showDiscoveryFlow) {
    return (
      <DiscoveryFlow
        clientData={form}
        onboardingPlan={plan}
        onComplete={({ report, formData }) => {
          setDiscoveryReport(report);
          setDiscoveryFormData(formData);
          setShowDiscoveryFlow(false);
        }}
        onBack={() => setShowDiscoveryFlow(false)}
      />
    );
  }

  if (plan) {
    return (
      <div className="min-h-screen bg-bip-page font-sans text-bip-text">
        <BrandHeader />
        <div className="px-4 py-10 sm:px-6">
          <div className="mx-auto mb-8 flex max-w-4xl items-center justify-between print:hidden">
            <Link
              href="/sales-lab"
              className="inline-flex items-center gap-2 rounded-lg border border-bip-border bg-bip-card px-3 py-2 text-sm text-bip-text transition hover:bg-bip-fill"
            >
              <ArrowLeft className="h-4 w-4" />
              Sales Lab
            </Link>
            <button
              type="button"
              onClick={handleStartOver}
              className="rounded-lg border border-bip-border bg-bip-card px-4 py-2 text-sm font-medium text-bip-text transition hover:bg-bip-fill"
            >
              Start Over
            </button>
          </div>
          <OnboardingOutput
            plan={plan}
            clientName={form.practiceName}
            intakeGoals={form.intakeGoals}
            clientFormData={form}
            onRunDiscovery={() => setShowDiscoveryFlow(true)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bip-page font-sans text-bip-text">
      <BrandHeader />
      <div className="px-4 py-10 sm:px-6">
        <div className="mx-auto max-w-2xl">
          <div className="mb-6 flex items-center justify-between">
            <Link
              href="/sales-lab"
              className="inline-flex items-center gap-2 rounded-lg border border-bip-border bg-bip-card px-3 py-2 text-sm text-bip-text transition hover:bg-bip-fill"
            >
              <ArrowLeft className="h-4 w-4" />
              Sales Lab
            </Link>
            {userEmail ? (
              <p className="text-xs text-bip-muted">{userEmail}</p>
            ) : null}
          </div>

          <header className="mb-8 text-center">
            <h1 className="text-2xl font-bold text-bip-text">
              Veterinary Client Onboarding
            </h1>
            <p className="mt-2 text-sm text-bip-text">
              Fill out the intake form or upload a PDF intake form — Beyond
              Indigo Pets will identify your goals and build a personalized
              marketing plan.
            </p>
          </header>

          <div className="mb-6 flex rounded-lg border border-bip-border bg-bip-card p-1">
            <button
              type="button"
              onClick={() => switchIntakeMode("form")}
              className={`flex-1 rounded-md py-2 text-sm font-medium transition ${
                intakeMode === "form"
                  ? "bg-bip-accent text-bip-page shadow-sm"
                  : "text-bip-text hover:text-bip-text"
              }`}
            >
              Fill out form
            </button>
            <button
              type="button"
              onClick={() => switchIntakeMode("upload")}
              className={`flex-1 rounded-md py-2 text-sm font-medium transition ${
                intakeMode === "upload"
                  ? "bg-bip-accent text-bip-page shadow-sm"
                  : "text-bip-text hover:text-bip-text"
              }`}
            >
              Upload document
            </button>
          </div>

          {intakeMode === "form" ? (
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
                          ? "bg-bip-accent text-bip-page"
                          : done
                            ? "bg-bip-accent/20 text-bip-accent"
                            : "bg-bip-fill text-bip-muted"
                      }`}
                    >
                      {stepNum}
                    </div>
                    <span
                      className={`hidden text-sm sm:inline ${
                        active
                          ? "font-medium text-bip-text"
                          : "text-bip-muted"
                      }`}
                    >
                      {label}
                    </span>
                    {i < STEPS.length - 1 ? (
                      <div
                        className={`mx-1 h-px w-8 sm:w-12 ${
                          done ? "bg-bip-accent" : "bg-bip-fill"
                        }`}
                      />
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : null}

          <div className="rounded-2xl border border-bip-border bg-bip-card p-6 shadow-none sm:p-8">
            {intakeMode === "upload" ? (
              <UploadIntakePanel
                uploadFile={uploadFile}
                documentExtracted={documentExtracted}
                form={form}
                fileInputRef={fileInputRef}
                onFileChange={handleFileChange}
                onExtract={handleExtractDocument}
                onUploadAndGenerate={handleUploadAndGenerate}
                onGenerate={handleGenerate}
                onUpdateField={updateField}
                onToggleService={toggleService}
                loading={loading}
                loadingMessage={loadingMessage}
              />
            ) : (
              <FormIntakePanel
                step={step}
                form={form}
                onUpdateField={updateField}
                onToggleService={toggleService}
              />
            )}

            {error ? (
              <p className="mt-4 rounded-lg border border-bip-danger/30 bg-bip-danger/10 px-4 py-3 text-sm text-bip-danger">
                {error}
              </p>
            ) : null}

            {intakeMode === "form" ? (
              <div className="mt-8 flex justify-between">
                {step > 1 ? (
                  <button
                    type="button"
                    onClick={handleBack}
                    className="rounded-lg border border-bip-border px-5 py-2.5 text-sm font-medium text-bip-text transition hover:bg-bip-fill"
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
                    className="rounded-lg bg-bip-accent px-5 py-2.5 text-sm font-medium text-bip-page transition hover:brightness-110"
                  >
                    Continue
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleGenerate}
                    disabled={loading}
                    className="flex items-center gap-2 rounded-lg bg-bip-accent px-5 py-2.5 text-sm font-medium text-bip-page transition hover:brightness-110 disabled:opacity-60"
                  >
                    {loading ? (
                      <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-bip-page border-t-transparent" />
                    ) : null}
                    {loading
                      ? loadingMessage || "Researching & generating…"
                      : "Generate Onboarding Plan"}
                  </button>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

const inputClass =
  "w-full rounded-lg border border-bip-border bg-bip-page px-3 py-2.5 text-sm text-bip-text placeholder:text-bip-muted focus:border-bip-accent focus:outline-none focus:ring-2 focus:ring-bip-accent/30";

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
      <span className="mb-1.5 block text-sm font-medium text-bip-text">
        {label}
        {required ? <span className="text-bip-danger"> *</span> : null}
      </span>
      {children}
    </label>
  );
}

function FormIntakePanel({
  step,
  form,
  onUpdateField,
  onToggleService,
}: {
  step: number;
  form: ClientFormData;
  onUpdateField: <K extends keyof ClientFormData>(
    key: K,
    value: ClientFormData[K],
  ) => void;
  onToggleService: (service: string) => void;
}) {
  if (step === 1) {
    return (
      <div className="space-y-5">
        <h2 className="text-lg font-semibold text-bip-text">
          Practice Information
        </h2>
        <Field label="Practice Name" required>
          <input
            type="text"
            value={form.practiceName}
            onChange={(e) => onUpdateField("practiceName", e.target.value)}
            className={inputClass}
            placeholder="e.g. Paws & Claws Veterinary Clinic"
          />
        </Field>
        <Field label="Contact Name" required>
          <input
            type="text"
            value={form.contactName}
            onChange={(e) => onUpdateField("contactName", e.target.value)}
            className={inputClass}
            placeholder="e.g. Dr. Sarah Johnson"
          />
        </Field>
        <Field label="Location" required>
          <input
            type="text"
            value={form.location}
            onChange={(e) => onUpdateField("location", e.target.value)}
            className={inputClass}
            placeholder="e.g. Austin, TX"
          />
        </Field>
        <Field label="Practice Type" required>
          <select
            value={form.practiceType}
            onChange={(e) => onUpdateField("practiceType", e.target.value)}
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
            onChange={(e) => onUpdateField("numVets", e.target.value)}
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
    );
  }

  if (step === 2) {
    return (
      <div className="space-y-5">
        <h2 className="text-lg font-semibold text-bip-text">
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
                  onClick={() => onToggleService(service)}
                  className={`rounded-lg border px-4 py-3 text-left text-sm transition ${
                    selected
                      ? "border-bip-accent bg-bip-accent/10 text-bip-text ring-1 ring-bip-accent"
                      : "border-bip-border bg-bip-page text-bip-text hover:border-bip-accent"
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
            onChange={(e) => onUpdateField("mainGoal", e.target.value)}
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
            onChange={(e) => onUpdateField("challenge", e.target.value)}
            rows={4}
            className={inputClass}
            placeholder="What's the biggest challenge your practice faces with marketing?"
          />
        </Field>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <h2 className="text-lg font-semibold text-bip-text">
        Budget, Timeline &amp; Digital Footprint
      </h2>
      <Field label="Monthly Marketing Budget" required>
        <select
          value={form.budget}
          onChange={(e) => onUpdateField("budget", e.target.value)}
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
          onChange={(e) => onUpdateField("timeline", e.target.value)}
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
          onChange={(e) => onUpdateField("presence", e.target.value)}
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

      <DigitalFootprintFields form={form} onUpdateField={onUpdateField} />

      <Field label="Additional Notes">
        <textarea
          value={form.notes}
          onChange={(e) => onUpdateField("notes", e.target.value)}
          rows={3}
          className={inputClass}
          placeholder="Anything else we should know? (optional)"
        />
      </Field>
    </div>
  );
}

function UploadIntakePanel({
  uploadFile,
  documentExtracted,
  form,
  fileInputRef,
  onFileChange,
  onExtract,
  onUploadAndGenerate,
  onGenerate,
  onUpdateField,
  onToggleService,
  loading,
  loadingMessage,
}: {
  uploadFile: File | null;
  documentExtracted: boolean;
  form: ClientFormData;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onExtract: () => void;
  onUploadAndGenerate: () => void;
  onGenerate: () => void;
  onUpdateField: <K extends keyof ClientFormData>(
    key: K,
    value: ClientFormData[K],
  ) => void;
  onToggleService: (service: string) => void;
  loading: boolean;
  loadingMessage: string;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-bip-text">
          Upload Sales Brief
        </h2>
        <p className="mt-1 text-sm text-bip-muted">
          Upload a PDF intake form, Word document (.docx), or plain text file
          (.txt). AI reads your form, identifies client goals, and generates the
          same plan as the manual intake.
        </p>
      </div>

      <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-bip-border bg-bip-page px-6 py-10 transition hover:border-bip-accent/50 hover:bg-bip-hover">
        <Upload className="mb-3 h-8 w-8 text-bip-accent" />
        <span className="text-sm font-medium text-bip-text">
          {uploadFile ? uploadFile.name : "Choose .pdf, .docx, or .txt file"}
        </span>
        <span className="mt-1 text-xs text-bip-muted">
          Max 4MB · PDF forms supported
        </span>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,.txt,application/pdf,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          onChange={onFileChange}
          className="sr-only"
        />
      </label>

      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={onExtract}
          disabled={loading || !uploadFile}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-bip-border bg-bip-card px-4 py-2.5 text-sm font-medium text-bip-text transition hover:bg-bip-fill disabled:opacity-60"
        >
          <FileUp className="h-4 w-4 text-bip-accent" />
          {loading && loadingMessage === "Reading document…"
            ? "Extracting…"
            : "Extract intake fields"}
        </button>
        <button
          type="button"
          onClick={onUploadAndGenerate}
          disabled={loading || !uploadFile}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-bip-accent px-4 py-2.5 text-sm font-medium text-bip-page transition hover:brightness-110 disabled:opacity-60"
        >
          {loading ? (
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-bip-border border-t-transparent" />
          ) : null}
          {loading ? loadingMessage || "Working…" : "Upload & generate plan"}
        </button>
      </div>

      {documentExtracted ? (
        <div className="space-y-4 border-t border-bip-border pt-6">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-bip-accent">
              Extracted fields — review &amp; edit
            </h3>
            <button
              type="button"
              onClick={onGenerate}
              disabled={loading}
              className="rounded-lg bg-bip-accent px-4 py-2 text-xs font-medium text-bip-page transition hover:brightness-110 disabled:opacity-60"
            >
              Generate plan
            </button>
          </div>
          <ExtractedFieldsEditor
            form={form}
            onUpdateField={onUpdateField}
            onToggleService={onToggleService}
          />
        </div>
      ) : null}
    </div>
  );
}

function ExtractedFieldsEditor({
  form,
  onUpdateField,
  onToggleService,
}: {
  form: ClientFormData;
  onUpdateField: <K extends keyof ClientFormData>(
    key: K,
    value: ClientFormData[K],
  ) => void;
  onToggleService: (service: string) => void;
}) {
  return (
    <div className="space-y-4 text-sm">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Practice Name" required>
          <input
            type="text"
            value={form.practiceName}
            onChange={(e) => onUpdateField("practiceName", e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Contact Name" required>
          <input
            type="text"
            value={form.contactName}
            onChange={(e) => onUpdateField("contactName", e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Location" required>
          <input
            type="text"
            value={form.location}
            onChange={(e) => onUpdateField("location", e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Practice Type" required>
          <select
            value={form.practiceType}
            onChange={(e) => onUpdateField("practiceType", e.target.value)}
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
            onChange={(e) => onUpdateField("numVets", e.target.value)}
            className={inputClass}
          >
            <option value="">Select</option>
            {NUM_VETS_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Main Goal" required>
        <select
          value={form.mainGoal}
          onChange={(e) => onUpdateField("mainGoal", e.target.value)}
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
      <Field label="Services of Interest" required>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {SERVICES.map((service) => {
            const selected = form.services.includes(service);
            return (
              <button
                key={service}
                type="button"
                onClick={() => onToggleService(service)}
                className={`rounded-lg border px-3 py-2 text-left text-xs transition ${
                  selected
                    ? "border-bip-accent bg-bip-accent/10 ring-1 ring-bip-accent"
                    : "border-bip-border hover:border-bip-accent"
                }`}
              >
                {selected ? "☑" : "☐"} {service}
              </button>
            );
          })}
        </div>
      </Field>
      <Field label="Biggest Marketing Challenge" required>
        <textarea
          value={form.challenge}
          onChange={(e) => onUpdateField("challenge", e.target.value)}
          rows={3}
          className={inputClass}
        />
      </Field>
      {form.intakeGoals.length > 0 ? (
        <div className="rounded-lg border border-bip-border bg-bip-accent/10 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-bip-accent">
            Goals identified from document
          </p>
          <ul className="mt-2 space-y-1 text-sm text-bip-text">
            {form.intakeGoals.map((goal) => (
              <li key={goal}>• {goal}</li>
            ))}
          </ul>
          {form.intakeSummary ? (
            <p className="mt-2 text-xs leading-relaxed text-bip-muted">
              {form.intakeSummary}
            </p>
          ) : null}
        </div>
      ) : null}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label="Budget" required>
          <select
            value={form.budget}
            onChange={(e) => onUpdateField("budget", e.target.value)}
            className={inputClass}
          >
            <option value="">Select</option>
            {BUDGET_OPTIONS.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Timeline" required>
          <select
            value={form.timeline}
            onChange={(e) => onUpdateField("timeline", e.target.value)}
            className={inputClass}
          >
            <option value="">Select</option>
            {TIMELINE_OPTIONS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Digital Presence" required>
          <select
            value={form.presence}
            onChange={(e) => onUpdateField("presence", e.target.value)}
            className={inputClass}
          >
            <option value="">Select</option>
            {PRESENCE_OPTIONS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <DigitalFootprintFields
        form={form}
        onUpdateField={onUpdateField}
        compact
      />
    </div>
  );
}
