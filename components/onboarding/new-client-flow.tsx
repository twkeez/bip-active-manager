"use client";

import { useRef, useState } from "react";
import { AlertTriangle, FileUp, Loader2, Sparkles } from "lucide-react";
import OnboardingDetailsForm from "@/components/onboarding/onboarding-details-form";
import { detailsFromPipeline, type OnboardingDetails } from "@/lib/onboarding/onboarding-details";
import type { PipelineIntake } from "@/lib/onboarding/pipeline-intake";

/**
 * Starting onboarding: drop in the pipeline form, check what Claude read,
 * create the client. Research starts on its own once the client exists.
 *
 * The check step matters. The form reader got Tiburon's start timing backwards,
 * and this is the moment a person can see and fix that before anything is
 * built from it.
 */

type Duplicate = { id: number; name: string; website: string | null; onboarding: string | null };

export default function NewClientFlow({ onCreated }: { onCreated: (clientId: number) => void }) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [intake, setIntake] = useState<PipelineIntake | null>(null);
  const [filename, setFilename] = useState<string | null>(null);
  const [details, setDetails] = useState<OnboardingDetails | null>(null);
  const [saving, setSaving] = useState(false);
  const [duplicates, setDuplicates] = useState<Duplicate[] | null>(null);

  async function read(file: File) {
    setReading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("document", file);
      const response = await fetch("/api/onboarding/parse-pipeline", { method: "POST", body: form });
      const payload = (await response.json()) as { error?: string; intake?: PipelineIntake; sourceFilename?: string };
      if (!response.ok || !payload.intake) throw new Error(payload.error ?? "Could not read the pipeline form.");
      setIntake(payload.intake);
      setFilename(payload.sourceFilename ?? file.name);
      setDetails(detailsFromPipeline(payload.intake));
    } catch (readError) {
      setError(readError instanceof Error ? readError.message : "Could not read the pipeline form.");
    } finally {
      setReading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function create(choice: { useClientId?: number; createAnyway?: boolean } = {}) {
    if (!details) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/onboarding/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          details,
          pipelineNotes: intake?.notes ?? null,
          pipelineRaw: intake,
          sourceFilename: filename,
          ...choice,
        }),
      });
      const payload = (await response.json()) as { error?: string; clientId?: number; duplicates?: Duplicate[] };
      if (response.status === 409 && payload.duplicates) {
        setDuplicates(payload.duplicates);
        return;
      }
      if (!response.ok || !payload.clientId) throw new Error(payload.error ?? "Could not create the client.");
      onCreated(payload.clientId);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Could not create the client.");
    } finally {
      setSaving(false);
    }
  }

  if (!details) {
    return (
      <div className="rounded-xl border border-dashed border-bip-border bg-bip-card px-6 py-12 text-center">
        <FileUp className="mx-auto h-7 w-7 text-bip-accent" />
        <p className="mt-3 text-sm font-semibold text-bip-text">Start with the pipeline form</p>
        <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-bip-muted">
          Claude reads it and fills in the practice, services and timing for you to check. You can add the kickoff doc
          afterwards — Basecamp threads are read automatically.
        </p>
        <input
          ref={fileInput}
          type="file"
          accept=".pdf,.docx,.txt"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void read(file);
          }}
        />
        <button
          type="button"
          disabled={reading}
          onClick={() => fileInput.current?.click()}
          className="mt-5 inline-flex items-center gap-2 rounded-lg bg-bip-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
        >
          {reading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
          {reading ? "Reading the form…" : "Upload pipeline form"}
        </button>
        {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-bip-border bg-bip-card p-4">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-bip-text">Check what the form says</h2>
            <p className="text-[11px] text-bip-muted">
              Read from {filename}. Fix anything wrong now — especially when each service starts.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setDetails(null);
              setIntake(null);
              setDuplicates(null);
            }}
            className="text-xs text-bip-muted hover:text-bip-text"
          >
            Use a different form
          </button>
        </div>

        {intake?.locationConflict && (
          <p className="mb-3 flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-xs text-bip-text">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
            {intake.locationConflict}
          </p>
        )}

        <OnboardingDetailsForm value={details} onChange={setDetails} disabled={saving} />
      </div>

      {duplicates ? (
        <div className="rounded-xl border border-amber-500/40 bg-bip-card p-4">
          <p className="text-sm font-semibold text-bip-text">This practice may already have a client record</p>
          <p className="mt-0.5 text-xs text-bip-muted">
            A second record splits its Basecamp and reporting data, so use the existing one unless it really is a different
            practice.
          </p>
          <ul className="mt-3 space-y-2">
            {duplicates.map((duplicate) => (
              <li key={duplicate.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-bip-border px-3 py-2">
                <span className="text-sm text-bip-text">
                  {duplicate.name}
                  <span className="text-[11px] text-bip-muted">
                    {duplicate.website ? ` · ${duplicate.website}` : ""}
                    {duplicate.onboarding === "active" ? " · already onboarding" : ""}
                  </span>
                </span>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void create({ useClientId: duplicate.id })}
                  className="rounded-md bg-bip-accent px-3 py-1 text-xs font-medium text-white hover:opacity-90 disabled:opacity-60"
                >
                  Use this client
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            disabled={saving}
            onClick={() => void create({ createAnyway: true })}
            className="mt-3 text-xs text-bip-muted underline hover:text-bip-text"
          >
            It&apos;s a different practice — create a new client
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={saving || !details.accountName.trim()}
            onClick={() => void create()}
            className="inline-flex items-center gap-2 rounded-lg bg-bip-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {saving ? "Creating…" : "Create client and run research"}
          </button>
          {error && <span className="text-xs text-red-400">{error}</span>}
        </div>
      )}
    </div>
  );
}
