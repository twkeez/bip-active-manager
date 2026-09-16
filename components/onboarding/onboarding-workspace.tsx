"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  CircleDashed,
  Copy,
  FileText,
  Loader2,
  MinusCircle,
  Play,
  RotateCcw,
  Sparkles,
  Upload,
} from "lucide-react";
import OnboardingDetailsForm from "@/components/onboarding/onboarding-details-form";
import {
  researchSteps,
  useOnboardingResearch,
  type ResearchStep,
  type ResearchSummary,
} from "@/components/onboarding/use-onboarding-research";
import type { OnboardingDetails } from "@/lib/onboarding/onboarding-details";

/**
 * One client's onboarding, reduced to what produces something: the sources
 * that are read, the details everything is built from, the research, and the
 * two things that get sent — the Basecamp message and the client document.
 *
 * The old checklist is deliberately absent. It still exists underneath for
 * Coal Mines and the planning assistant; it just no longer stands between a
 * pipeline form and a finished document.
 */

type Workspace = {
  clientId: number;
  details: OnboardingDetails;
  staffNames: string[];
  sources: {
    pipelineFilename: string | null;
    hasPipelineNotes: boolean;
    kickoffDocFilename: string | null;
    kickoffDocSummary: string | null;
    kickoffDocAt: string | null;
    basecampLinked: boolean;
    basecampBackground: string | null;
    basecampBackgroundAt: string | null;
    basecampThreadsRead: number | null;
  };
  research: ResearchSummary;
};

type Kickoff = { title: string; body: string; isOverride: boolean };

const fmt = (value: string | null) =>
  value ? new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : null;

function Card({ step, title, children, aside }: { step: number; title: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-bip-border bg-bip-card p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-bip-text">
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-bip-accent/15 text-[11px] font-bold text-bip-accent">
            {step}
          </span>
          {title}
        </h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

function Summary({ text }: { text: string }) {
  return (
    <details className="mt-1.5">
      <summary className="inline-flex cursor-pointer items-center gap-1 text-[11px] text-bip-muted hover:text-bip-text">
        <ChevronDown className="h-3 w-3" /> What it found
      </summary>
      <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded-md bg-bip-fill p-3 font-sans text-xs leading-relaxed text-bip-text">
        {text}
      </pre>
    </details>
  );
}

function StepIcon({ step, state }: { step: ResearchStep; state?: string }) {
  if (state === "running") return <Loader2 className="h-4 w-4 animate-spin text-bip-accent" />;
  if (state === "error") return <AlertTriangle className="h-4 w-4 text-red-400" />;
  if (state === "skipped") return <MinusCircle className="h-4 w-4 text-bip-muted" />;
  if (state === "done" || step.done) return <Check className="h-4 w-4 text-emerald-500" />;
  return <CircleDashed className="h-4 w-4 text-bip-muted" />;
}

export default function OnboardingWorkspace({
  clientId,
  autoRun = false,
}: {
  clientId: number;
  /** Start the research as soon as the client loads — set right after creating it. */
  autoRun?: boolean;
}) {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [draft, setDraft] = useState<OnboardingDetails | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [detailsNotice, setDetailsNotice] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [kickoff, setKickoff] = useState<Kickoff | null>(null);
  const [editingMessage, setEditingMessage] = useState(false);
  const [messageDraft, setMessageDraft] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const autoRan = useRef(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const [workspaceResponse, kickoffResponse] = await Promise.all([
      fetch(`/api/clients/${clientId}/onboarding/workspace`, { cache: "no-store" }),
      fetch(`/api/clients/${clientId}/onboarding/kickoff`, { cache: "no-store" }),
    ]);
    const payload = (await workspaceResponse.json()) as Workspace & { error?: string };
    if (!workspaceResponse.ok) {
      setLoadError(payload.error ?? "Could not load this client.");
      return null;
    }
    setWorkspace(payload);
    setDraft(payload.details);
    if (kickoffResponse.ok) setKickoff((await kickoffResponse.json()) as Kickoff);
    return payload;
  }, [clientId]);

  const { status, running, runAll, runOne } = useOnboardingResearch(clientId, () => void load());

  // The page gives each client its own workspace (keyed by client), so there is
  // no previous client's state to clear here — just load.
  useEffect(() => {
    void load();
  }, [load]);

  const steps = workspace ? researchSteps(workspace.details, workspace.research, workspace.sources.basecampBackgroundAt) : [];
  const applicable = steps.filter((step) => step.applies);

  // Right after a client is created from a pipeline form, the research simply
  // starts. Opening an existing client never spends money on its own.
  useEffect(() => {
    if (!autoRun || autoRan.current || !workspace || running) return;
    if (applicable.every((step) => !step.done)) {
      autoRan.current = true;
      void runAll(applicable);
    }
  }, [autoRun, workspace, running, applicable, runAll]);

  if (loadError) return <p className="rounded-xl border border-red-500/40 bg-bip-card p-4 text-sm text-red-400">{loadError}</p>;
  if (!workspace || !draft) {
    return (
      <p className="flex items-center gap-2 rounded-xl border border-bip-border bg-bip-card p-4 text-sm text-bip-muted">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </p>
    );
  }

  const dirty = JSON.stringify(draft) !== JSON.stringify(workspace.details);

  async function saveDetails() {
    setSaving(true);
    setDetailsNotice(null);
    try {
      const response = await fetch(`/api/clients/${clientId}/onboarding/details`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Could not save.");
      await load();
      setDetailsNotice("Saved. The document and Basecamp message use these details.");
    } catch (error) {
      setDetailsNotice(error instanceof Error ? error.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  }

  async function uploadKickoffDoc(file: File) {
    setUploading(true);
    setUploadError(null);
    try {
      const form = new FormData();
      form.append("document", file);
      const response = await fetch(`/api/clients/${clientId}/onboarding/kickoff-doc`, { method: "POST", body: form });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Could not read the kickoff doc.");
      await load();
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Could not read the kickoff doc.");
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function saveMessage(body: string | null) {
    await fetch(`/api/clients/${clientId}/onboarding/kickoff`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: kickoff?.title ?? null, body }),
    });
    setEditingMessage(false);
    await load();
  }

  async function copy(label: string, text: string) {
    await navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 1600);
  }

  const { sources, research } = workspace;
  const backgroundAt = [sources.kickoffDocAt, sources.basecampBackgroundAt].filter(Boolean).sort().pop() ?? null;
  const researchStale = Boolean(backgroundAt && research.discoveryAt && backgroundAt > research.discoveryAt);
  const anyMissing = applicable.some((step) => !step.done && !step.blockedBy);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-lg font-semibold text-bip-text">{workspace.details.accountName}</h1>
        <Link href={`/dashboard/clients/${clientId}`} className="text-xs text-bip-muted hover:text-bip-text">
          Open client page →
        </Link>
      </div>

      <Card step={1} title="What we've read">
        <ul className="space-y-3 text-sm">
          <li>
            <p className="text-bip-text">
              <span className="font-medium">Pipeline form</span>{" "}
              <span className="text-bip-muted">
                {sources.pipelineFilename ?? (sources.hasPipelineNotes ? "on file" : "none on file")}
              </span>
            </p>
          </li>
          <li>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-bip-text">
                <span className="font-medium">Kickoff doc</span>{" "}
                <span className="text-bip-muted">
                  {sources.kickoffDocFilename ? `${sources.kickoffDocFilename} · read ${fmt(sources.kickoffDocAt)}` : "optional — from the website team"}
                </span>
              </p>
              <input
                ref={fileInput}
                type="file"
                accept=".pdf,.docx,.txt"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void uploadKickoffDoc(file);
                }}
              />
              <button
                type="button"
                disabled={uploading}
                onClick={() => fileInput.current?.click()}
                className="inline-flex items-center gap-1.5 rounded-md border border-bip-border px-2.5 py-1 text-xs text-bip-text hover:bg-bip-fill disabled:opacity-60"
              >
                {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                {uploading ? "Reading…" : sources.kickoffDocFilename ? "Replace" : "Upload"}
              </button>
            </div>
            {uploadError && <p className="mt-1 text-xs text-red-400">{uploadError}</p>}
            {sources.kickoffDocSummary && <Summary text={sources.kickoffDocSummary} />}
          </li>
          <li>
            <p className="text-bip-text">
              <span className="font-medium">Basecamp threads</span>{" "}
              <span className="text-bip-muted">
                {sources.basecampBackgroundAt
                  ? `${sources.basecampThreadsRead ?? 0} threads read ${fmt(sources.basecampBackgroundAt)}`
                  : sources.basecampLinked
                    ? "read when research runs"
                    : "no project linked yet — research will look for one"}
              </span>
            </p>
            {sources.basecampBackground && <Summary text={sources.basecampBackground} />}
          </li>
        </ul>
        <p className="mt-3 text-[11px] leading-relaxed text-bip-muted">
          Access and login threads are never read, and anything that looks like a password or code is removed. Only a summary is kept.
        </p>
      </Card>

      <Card
        step={2}
        title="Details"
        aside={
          dirty ? (
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setDraft(workspace.details)} className="text-xs text-bip-muted hover:text-bip-text">
                Undo changes
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void saveDetails()}
                className="rounded-md bg-bip-accent px-3 py-1 text-xs font-medium text-white hover:opacity-90 disabled:opacity-60"
              >
                {saving ? "Saving…" : "Save details"}
              </button>
            </div>
          ) : detailsNotice ? (
            <span className="text-[11px] text-bip-muted">{detailsNotice}</span>
          ) : null
        }
      >
        <OnboardingDetailsForm value={draft} onChange={setDraft} staffNames={workspace.staffNames} disabled={saving} />
      </Card>

      <Card
        step={3}
        title="Research"
        aside={
          <button
            type="button"
            disabled={running || dirty}
            title={dirty ? "Save the details first" : undefined}
            onClick={() => void runAll(applicable)}
            className="inline-flex items-center gap-1.5 rounded-md bg-bip-accent px-3 py-1 text-xs font-medium text-white hover:opacity-90 disabled:opacity-60"
          >
            {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            {running ? "Running…" : anyMissing ? "Run research" : "Run all again"}
          </button>
        }
      >
        {researchStale && (
          <p className="mb-3 rounded-md border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-xs text-bip-text">
            New background was added after the market research ran. Run it again so the document reflects it.
          </p>
        )}
        <ul className="divide-y divide-bip-border">
          {applicable.map((step) => {
            const current = status[step.key];
            return (
              <li key={step.key} className="flex items-start justify-between gap-3 py-2.5">
                <div className="flex min-w-0 items-start gap-2.5">
                  <span className="mt-0.5">
                    <StepIcon step={step} state={current?.state} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm text-bip-text">
                      {step.label} <span className="text-[11px] text-bip-muted">· {step.feeds}</span>
                    </p>
                    <p className={`text-[11px] ${current?.state === "error" ? "text-red-400" : "text-bip-muted"}`}>
                      {current?.message ??
                        (step.blockedBy ?? (step.done ? (step.lastRun ? `Done ${fmt(step.lastRun)}` : "Done") : "Not run yet"))}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={running || Boolean(step.blockedBy) || dirty}
                  onClick={() => void runOne(step.key)}
                  className="inline-flex shrink-0 items-center gap-1 rounded-md border border-bip-border px-2 py-1 text-[11px] text-bip-text hover:bg-bip-fill disabled:opacity-50"
                >
                  {step.done ? <RotateCcw className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                  {step.done ? "Re-run" : "Run"}
                </button>
              </li>
            );
          })}
        </ul>
      </Card>

      <Card step={4} title="Ready to send">
        <div className="space-y-4">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium text-bip-text">
                Basecamp message{" "}
                {kickoff?.isOverride && <span className="ml-1 rounded-full bg-amber-400/20 px-1.5 text-[10px] text-amber-600">Edited</span>}
              </p>
              {kickoff && !editingMessage && (
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => void copy("title", kickoff.title)} className="inline-flex items-center gap-1 text-[11px] text-bip-muted hover:text-bip-text">
                    <Copy className="h-3 w-3" /> {copied === "title" ? "Copied" : "Copy title"}
                  </button>
                  <button type="button" onClick={() => void copy("body", kickoff.body)} className="inline-flex items-center gap-1 rounded-md bg-bip-accent px-2.5 py-1 text-[11px] font-medium text-white hover:opacity-90">
                    <Copy className="h-3 w-3" /> {copied === "body" ? "Copied" : "Copy message"}
                  </button>
                </div>
              )}
            </div>
            {kickoff ? (
              editingMessage ? (
                <div className="mt-2">
                  <textarea
                    value={messageDraft}
                    onChange={(event) => setMessageDraft(event.target.value)}
                    rows={12}
                    className="w-full rounded-md border border-bip-border bg-bip-card p-2.5 text-sm text-bip-text focus:outline-none focus:ring-1 focus:ring-bip-accent"
                  />
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    <button type="button" onClick={() => void saveMessage(messageDraft)} className="rounded-md bg-bip-accent px-3 py-1 text-xs font-medium text-white hover:opacity-90">
                      Save for this client
                    </button>
                    <button type="button" onClick={() => setEditingMessage(false)} className="text-xs text-bip-muted hover:text-bip-text">
                      Cancel
                    </button>
                    {kickoff.isOverride && (
                      <button type="button" onClick={() => void saveMessage(null)} className="ml-auto text-xs text-bip-muted underline hover:text-bip-text">
                        Back to the standard message
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <>
                  <p className="mt-1 text-[11px] text-bip-muted">Thread title: {kickoff.title}</p>
                  <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded-md bg-bip-fill p-3 font-sans text-xs leading-relaxed text-bip-text">
                    {kickoff.body || "No kickoff template yet — set one up in Onboarding Settings."}
                  </pre>
                  <button
                    type="button"
                    onClick={() => {
                      setMessageDraft(kickoff.body);
                      setEditingMessage(true);
                    }}
                    className="mt-1.5 text-[11px] text-bip-muted hover:text-bip-text"
                  >
                    Edit for this client
                  </button>
                </>
              )
            ) : (
              <p className="mt-1 text-xs text-bip-muted">Loading…</p>
            )}
          </div>

          <div className="border-t border-bip-border pt-3">
            <p className="text-sm font-medium text-bip-text">Client document</p>
            <p className="mt-0.5 text-[11px] text-bip-muted">
              {research.discoveryAt ? "Includes the local market research." : "Run the market research to add the local market section."}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Link
                href={`/client-document/${clientId}`}
                className="inline-flex items-center gap-1.5 rounded-md bg-bip-accent px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
              >
                <FileText className="h-3.5 w-3.5" /> Review &amp; edit
              </Link>
              <a
                href={`/client-expectations-print/${clientId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-md border border-bip-border px-3 py-1.5 text-xs text-bip-text hover:bg-bip-fill"
              >
                PDF
              </a>
              <a
                href={`/api/client-expectations/${clientId}/word`}
                className="inline-flex items-center gap-1.5 rounded-md border border-bip-border px-3 py-1.5 text-xs text-bip-text hover:bg-bip-fill"
              >
                Word
              </a>
              <a
                href={`/onboarding-report-print/${clientId}?mode=internal`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-md border border-bip-border px-3 py-1.5 text-xs text-bip-muted hover:bg-bip-fill hover:text-bip-text"
              >
                Internal brief
              </a>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
