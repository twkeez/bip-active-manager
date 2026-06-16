"use client";
import { useMemo, useState } from "react";
import {
  Loader2,
  ClipboardCopy,
  Rocket,
  Globe,
  AlertTriangle,
  ArrowLeft,
} from "lucide-react";
import type {
  SalesProspectAiOutputs,
  SalesProspectAudit,
  SalesProspectRun,
} from "@/lib/types/client";
type Props = {
  initialRuns: SalesProspectRun[];
  initialSelectedRun: SalesProspectRun | null;
  initialSelectedAudit: SalesProspectAudit | null;
  initialSelectedAiOutputs: SalesProspectAiOutputs | null;
  userEmail: string | undefined;
};
function formatDateTime(value: string | null | undefined) {
  if (!value) return "Never";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Unknown";
  return parsed.toISOString().replace("T", "").slice(0, 16) + " UTC";
}
async function copyText(value: string) {
  await navigator.clipboard.writeText(value);
}
export default function SalesLabManager({
  initialRuns,
  initialSelectedRun,
  initialSelectedAudit,
  initialSelectedAiOutputs,
  userEmail,
}: Props) {
  const [runs, setRuns] = useState<SalesProspectRun[]>(initialRuns);
  const [selectedRun, setSelectedRun] = useState<SalesProspectRun | null>(
    initialSelectedRun,
  );
  const [selectedAudit, setSelectedAudit] = useState<SalesProspectAudit | null>(
    initialSelectedAudit,
  );
  const [selectedAiOutputs, setSelectedAiOutputs] =
    useState<SalesProspectAiOutputs | null>(initialSelectedAiOutputs);
  const [prospectName, setProspectName] = useState("");
  const [prospectUrl, setProspectUrl] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [logoUpload, setLogoUpload] = useState<File | null>(null);
  const [targetKeyword, setTargetKeyword] = useState("");
  const [competitorUrl, setCompetitorUrl] = useState("");
  const [valueProposition, setValueProposition] = useState("");
  const [clientTestimonial, setClientTestimonial] = useState("");
  const [crawlMode, setCrawlMode] = useState<"all_pages" | "core_pages">(
    "all_pages",
  );
  const [maxPages, setMaxPages] = useState(50);
  const [promptStyle, setPromptStyle] = useState<"full" | "short">("full");
  const [runLoading, setRunLoading] = useState(false);
  const [loadDetailsLoading, setLoadDetailsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [editablePrompt, setEditablePrompt] = useState(
    initialSelectedAiOutputs?.hostinger_prompt ?? "",
  );
  const summaryText = useMemo(() => {
    const summary = selectedAiOutputs?.summary_json;
    if (!summary) return "";
    return [
      `The Win: ${summary.theWin}`,
      `The Concern: ${summary.theConcern}`,
      `The Next Move: ${summary.theNextMove}`,
    ].join("\n");
  }, [selectedAiOutputs?.summary_json]);
  const siteExtract = selectedAudit?.site_extract
    ? {
        scannedUrls: selectedAudit.site_extract.scannedUrls ?? 0,
        sourceUrls: selectedAudit.site_extract.sourceUrls ?? [],
        valueProps: selectedAudit.site_extract.valueProps ?? [],
        reviews: selectedAudit.site_extract.reviews ?? [],
        services: selectedAudit.site_extract.services ?? [],
        ctas: selectedAudit.site_extract.ctas ?? [],
        contactPoints: selectedAudit.site_extract.contactPoints ?? [],
        serviceAreas: selectedAudit.site_extract.serviceAreas ?? [],
        trustSignals: selectedAudit.site_extract.trustSignals ?? [],
        missingSections: selectedAudit.site_extract.missingSections ?? [],
        crawlDiagnostics: selectedAudit.site_extract.crawlDiagnostics ?? {
          attemptedUrls: 0,
          skippedUrls: 0,
          skippedByReason: {},
        },
      }
    : {
        scannedUrls: 0,
        sourceUrls: [],
        valueProps: [],
        reviews: [],
        services: [],
        ctas: [],
        contactPoints: [],
        serviceAreas: [],
        trustSignals: [],
        missingSections: [],
        crawlDiagnostics: {
          attemptedUrls: 0,
          skippedUrls: 0,
          skippedByReason: {},
        },
      };
  async function loadRunDetails(runId: number) {
    setLoadDetailsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/sales-lab/runs/${runId}`, {
        cache: "no-store",
      });
      const payload = (await response.json()) as {
        error?: string;
        run?: SalesProspectRun;
        audit?: SalesProspectAudit | null;
        aiOutputs?: SalesProspectAiOutputs | null;
      };
      if (!response.ok || !payload.run) {
        throw new Error(payload.error ?? "Failed to load run details.");
      }
      setSelectedRun(payload.run);
      setSelectedAudit(payload.audit ?? null);
      setSelectedAiOutputs(payload.aiOutputs ?? null);
      setEditablePrompt(payload.aiOutputs?.hostinger_prompt ?? "");
    } catch (fetchError) {
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : "Failed to load run details.",
      );
    } finally {
      setLoadDetailsLoading(false);
    }
  }
  async function handleRunAudit() {
    if (!prospectUrl.trim()) {
      setError("Prospect URL is required.");
      return;
    }
    setRunLoading(true);
    setError(null);
    setCopied(null);
    try {
      const response = await fetch("/api/sales-lab/run", {
        method: "POST",
        body: (() => {
          const form = new FormData();
          form.set("prospectName", prospectName);
          form.set("prospectUrl", prospectUrl);
          form.set("logoUrl", logoUrl);
          form.set("targetKeyword", targetKeyword);
          form.set("competitorUrl", competitorUrl);
          form.set("valueProposition", valueProposition);
          form.set("clientTestimonial", clientTestimonial);
          form.set("crawlMode", crawlMode);
          form.set("maxPages", String(maxPages));
          form.set("promptStyle", promptStyle);
          if (logoUpload) {
            form.set("logoUpload", logoUpload);
          }
          return form;
        })(),
      });
      const payload = (await response.json()) as {
        error?: string;
        run?: SalesProspectRun;
        audit?: SalesProspectAudit;
        aiOutputs?: SalesProspectAiOutputs;
      };
      if (
        !response.ok ||
        !payload.run ||
        !payload.audit ||
        !payload.aiOutputs
      ) {
        throw new Error(payload.error ?? "Failed to build demo prompt.");
      }
      setRuns((prev) => [
        payload.run!,
        ...prev.filter((item) => item.id !== payload.run!.id),
      ]);
      setSelectedRun(payload.run);
      setSelectedAudit(payload.audit);
      setSelectedAiOutputs(payload.aiOutputs);
      setEditablePrompt(payload.aiOutputs.hostinger_prompt);
    } catch (runError) {
      setError(
        runError instanceof Error
          ? runError.message
          : "Failed to build demo prompt.",
      );
    } finally {
      setRunLoading(false);
    }
  }
  return (
    <div className="flex min-h-screen flex-col bg-bip-page">
      
      <header className="border-b border-white/[0.08] bg-bip-card px-6 py-4">
        
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between">
          
          <div>
            
            <p className="text-xs uppercase tracking-wide text-white/50">
              
              Sales Lab
            </p>
            <h1 className="text-lg font-semibold text-white">
              
              Sales Demo Prompt Builder
            </h1>
            <p className="text-xs text-white/50">
              {userEmail ?? "Signed in"}
            </p>
          </div>
          <a
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-lg border border-white/[0.08] px-3 py-2 text-sm text-white/75 hover:bg-white/[0.06]"
          >
            
            <ArrowLeft className="h-4 w-4" /> Back to dashboard
          </a>
        </div>
      </header>
      <main className="mx-auto grid w-full max-w-7xl flex-1 grid-cols-1 gap-5 p-6 xl:grid-cols-[320px_1fr]">
        
        <aside className="space-y-4">
          
          <div className="rounded-xl border border-white/[0.08] bg-bip-card p-4 shadow-none">
            
            <p className="text-xs font-semibold uppercase tracking-wide text-white/50">
              
              New demo brief
            </p>
            <div className="mt-3 space-y-3">
              
              <label className="block">
                
                <span className="mb-1 block text-xs text-white/75">
                  
                  Prospect name (optional)
                </span>
                <input
                  value={prospectName}
                  onChange={(event) => setProspectName(event.target.value)}
                  className="w-full rounded-lg border border-white/[0.08] px-3 py-2 text-sm"
                  placeholder="Example Vet Clinic"
                />
              </label>
              <label className="block">
                
                <span className="mb-1 block text-xs text-white/75">
                  
                  Prospect URL
                </span>
                <input
                  value={prospectUrl}
                  onChange={(event) => setProspectUrl(event.target.value)}
                  className="w-full rounded-lg border border-white/[0.08] px-3 py-2 text-sm"
                  placeholder="https://example.com"
                />
              </label>
              <label className="block">
                
                <span className="mb-1 block text-xs text-white/75">
                  
                  Logo URL (optional)
                </span>
                <input
                  value={logoUrl}
                  onChange={(event) => setLogoUrl(event.target.value)}
                  className="w-full rounded-lg border border-white/[0.08] px-3 py-2 text-sm"
                  placeholder="https://example.com/logo.png"
                />
              </label>
              <label className="block">
                
                <span className="mb-1 block text-xs text-white/75">
                  
                  Logo upload (optional)
                </span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) =>
                    setLogoUpload(event.target.files?.[0] ?? null)
                  }
                  className="w-full rounded-lg border border-white/[0.08] px-3 py-2 text-xs"
                />
              </label>
              <label className="block">
                
                <span className="mb-1 block text-xs text-white/75">
                  
                  Target keyword (optional)
                </span>
                <input
                  value={targetKeyword}
                  onChange={(event) => setTargetKeyword(event.target.value)}
                  className="w-full rounded-lg border border-white/[0.08] px-3 py-2 text-sm"
                  placeholder="vet clinic in Naples"
                />
              </label>
              <label className="block">
                
                <span className="mb-1 block text-xs text-white/75">
                  
                  Competitor URL (optional)
                </span>
                <input
                  value={competitorUrl}
                  onChange={(event) => setCompetitorUrl(event.target.value)}
                  className="w-full rounded-lg border border-white/[0.08] px-3 py-2 text-sm"
                  placeholder="https://competitor.com"
                />
              </label>
              <label className="block">
                
                <span className="mb-1 block text-xs text-white/75">
                  
                  Value proposition (optional)
                </span>
                <input
                  value={valueProposition}
                  onChange={(event) => setValueProposition(event.target.value)}
                  className="w-full rounded-lg border border-white/[0.08] px-3 py-2 text-sm"
                  placeholder="Trusted care with same-day appointments."
                />
              </label>
              <label className="block">
                
                <span className="mb-1 block text-xs text-white/75">
                  
                  Client testimonial (optional)
                </span>
                <textarea
                  value={clientTestimonial}
                  onChange={(event) => setClientTestimonial(event.target.value)}
                  rows={2}
                  className="w-full rounded-lg border border-white/[0.08] px-3 py-2 text-sm"
                  placeholder="They always make us feel cared for and informed."
                />
              </label>
              <div className="grid grid-cols-2 gap-2">
                
                <label className="block">
                  
                  <span className="mb-1 block text-xs text-white/75">
                    
                    Crawl mode
                  </span>
                  <select
                    value={crawlMode}
                    onChange={(event) =>
                      setCrawlMode(
                        event.target.value === "core_pages"
                          ? "core_pages"
                          : "all_pages",
                      )
                    }
                    className="w-full rounded-lg border border-white/[0.08] px-3 py-2 text-sm"
                  >
                    
                    <option value="all_pages">All pages</option>
                    <option value="core_pages">Core pages only</option>
                  </select>
                </label>
                <label className="block">
                  
                  <span className="mb-1 block text-xs text-white/75">
                    
                    Max pages
                  </span>
                  <input
                    type="number"
                    min={10}
                    max={120}
                    value={maxPages}
                    onChange={(event) =>
                      setMaxPages(Number(event.target.value) || 50)
                    }
                    className="w-full rounded-lg border border-white/[0.08] px-3 py-2 text-sm"
                  />
                </label>
              </div>
              <label className="block">
                
                <span className="mb-1 block text-xs text-white/75">
                  
                  Prompt style
                </span>
                <select
                  value={promptStyle}
                  onChange={(event) =>
                    setPromptStyle(
                      event.target.value === "short" ? "short" : "full",
                    )
                  }
                  className="w-full rounded-lg border border-white/[0.08] px-3 py-2 text-sm"
                >
                  
                  <option value="full">Full (detailed)</option>
                  <option value="short">Short production</option>
                </select>
              </label>
              <button
                type="button"
                onClick={() => void handleRunAudit()}
                disabled={runLoading}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-bip-card px-3 py-2 text-sm font-medium text-white hover:bg-bip-card disabled:opacity-60"
              >
                
                {runLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Rocket className="h-4 w-4" />
                )}
                Build demo prompt
              </button>
            </div>
          </div>
          <div className="rounded-xl border border-white/[0.08] bg-bip-card p-4 shadow-none">
            
            <p className="text-xs font-semibold uppercase tracking-wide text-white/50">
              
              Recent runs
            </p>
            {runs.length === 0 ? (
              <p className="mt-3 text-sm text-white/50">No runs yet.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                
                {runs.map((run) => (
                  <li key={run.id}>
                    
                    <button
                      type="button"
                      onClick={() => void loadRunDetails(run.id)}
                      className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${selectedRun?.id === run.id ? "border-zinc-900 bg-white/[0.06]" : "border-white/[0.08] bg-bip-card hover:bg-bip-page"}`}
                    >
                      
                      <p className="font-medium text-white">
                        
                        {run.prospect_name || run.prospect_url}
                      </p>
                      <p className="mt-0.5 text-xs text-white/50">
                        
                        {run.status.toUpperCase()} ·
                        {formatDateTime(run.created_at)}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
        <section className="space-y-4">
          
          {error && (
            <p className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-400">
              
              {error}
            </p>
          )}
          {loadDetailsLoading ? (
            <div className="rounded-xl border border-white/[0.08] bg-bip-card p-6">
              
              <div className="inline-flex items-center gap-2 text-sm text-white/75">
                
                <Loader2 className="h-4 w-4 animate-spin" /> Loading run
                details...
              </div>
            </div>
          ) : selectedRun && selectedAudit ? (
            <>
              
              <div className="rounded-xl border border-white/[0.08] bg-bip-card p-4 shadow-none">
                
                <div className="flex flex-wrap items-center justify-between gap-2">
                  
                  <div>
                    
                    <p className="text-xs uppercase tracking-wide text-white/50">
                      
                      Prospect
                    </p>
                    <p className="text-base font-semibold text-white">
                      
                      {selectedRun.prospect_name ||
                        selectedRun.prospect_url}
                    </p>
                    <a
                      href={selectedRun.prospect_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm text-white/75 underline decoration-zinc-300 underline-offset-2 hover:text-white"
                    >
                      
                      <Globe className="h-3.5 w-3.5" />
                      {selectedRun.prospect_url}
                    </a>
                    <p className="mt-1 text-xs text-white/50">
                      
                      Logo source used:{""}
                      {selectedAiOutputs?.prompt_brief?.logoSource === "upload"
                        ? "Uploaded file"
                        : selectedAiOutputs?.prompt_brief?.logoSource === "url"
                          ? "Provided logo URL"
                          : "Extracted from site assets"}
                    </p>
                  </div>
                  <p className="text-xs text-white/50">
                    
                    Last updated {formatDateTime(selectedRun.updated_at)}
                  </p>
                </div>
              </div>
              <div className="rounded-xl border border-white/[0.08] bg-bip-card p-4 shadow-none">
                
                <p className="text-xs font-semibold uppercase tracking-wide text-white/50">
                  
                  Extracted site inputs
                </p>
                {siteExtract.scannedUrls > 0 ? (
                  <div className="mt-2 space-y-3 text-sm text-white/75">
                    
                    <p className="text-xs text-white/50">
                      
                      Scanned {siteExtract.scannedUrls} page(s), using{""}
                      {siteExtract.sourceUrls.length} source URL(s).
                    </p>
                    <p className="text-xs text-white/50">
                      
                      Crawl attempts:
                      {siteExtract.crawlDiagnostics?.attemptedUrls ?? 0},
                      skipped:{""}
                      {siteExtract.crawlDiagnostics?.skippedUrls ?? 0}
                    </p>
                    <div>
                      
                      <p className="font-medium">Value props</p>
                      {siteExtract.valueProps.length > 0 ? (
                        <ul className="mt-1 list-disc space-y-1 pl-5 text-xs">
                          
                          {siteExtract.valueProps.slice(0, 3).map((item) => (
                            <li
                              key={`${item.sourceUrl}-${item.text.slice(0, 20)}`}
                            >
                              {item.text}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-xs text-white/50">
                          
                          No value props found; prompt will include
                          placeholders.
                        </p>
                      )}
                    </div>
                    <div>
                      
                      <p className="font-medium">Reviews / quotes</p>
                      {siteExtract.reviews.length > 0 ? (
                        <ul className="mt-1 list-disc space-y-1 pl-5 text-xs">
                          
                          {siteExtract.reviews.slice(0, 3).map((item) => (
                            <li
                              key={`${item.sourceUrl}-${item.text.slice(0, 20)}`}
                            >
                              {item.text}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-xs text-white/50">
                          
                          No reviews found; prompt will include
                          placeholders.
                        </p>
                      )}
                    </div>
                    <div>
                      
                      <p className="font-medium">Missing sections</p>
                      <p className="text-xs text-white/50">
                        
                        {siteExtract.missingSections.length > 0
                          ? siteExtract.missingSections.join(",")
                          : "None"}
                      </p>
                    </div>
                    <div>
                      
                      <p className="font-medium">CTAs</p>
                      <p className="text-xs text-white/50">
                        
                        {siteExtract.ctas.length > 0
                          ? siteExtract.ctas.slice(0, 4).join(",")
                          : "None extracted"}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-white/75">
                    
                    No extracted source content available for this run.
                  </p>
                )}
              </div>
              <div className="rounded-xl border border-white/[0.08] bg-bip-card p-4 shadow-none">
                
                <div className="mb-2 flex items-center justify-between gap-2">
                  
                  <p className="text-xs font-semibold uppercase tracking-wide text-white/50">
                    
                    Strategist summary
                  </p>
                  <button
                    type="button"
                    disabled={!summaryText}
                    onClick={() =>
                      void copyText(summaryText).then(() =>
                        setCopied("Summary copied."),
                      )
                    }
                    className="inline-flex items-center gap-1 rounded-md border border-white/[0.08] px-2 py-1 text-xs font-medium text-white/75 hover:bg-white/[0.06] disabled:opacity-60"
                  >
                    
                    <ClipboardCopy className="h-3.5 w-3.5" /> Copy summary
                  </button>
                </div>
                {selectedAiOutputs?.summary_json ? (
                  <div className="space-y-2 text-sm text-white/75">
                    
                    <p>
                      <span className="font-semibold">The Win:</span>
                      {selectedAiOutputs.summary_json.theWin}
                    </p>
                    <p>
                      <span className="font-semibold">The Concern:</span>
                      {selectedAiOutputs.summary_json.theConcern}
                    </p>
                    <p>
                      <span className="font-semibold">The Next Move:</span>
                      {selectedAiOutputs.summary_json.theNextMove}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-white/75">No summary available.</p>
                )}
              </div>
              <div className="rounded-xl border border-white/[0.08] bg-bip-card p-4 shadow-none">
                
                <div className="mb-2 flex items-center justify-between gap-2">
                  
                  <p className="text-xs font-semibold uppercase tracking-wide text-white/50">
                    
                    Demo Builder Prompt (Hostinger Horizons)
                  </p>
                  <button
                    type="button"
                    disabled={!editablePrompt}
                    onClick={() =>
                      void copyText(editablePrompt).then(() =>
                        setCopied("Hostinger prompt copied."),
                      )
                    }
                    className="inline-flex items-center gap-1 rounded-md border border-white/[0.08] px-2 py-1 text-xs font-medium text-white/75 hover:bg-white/[0.06] disabled:opacity-60"
                  >
                    
                    <ClipboardCopy className="h-3.5 w-3.5" /> Copy prompt
                  </button>
                </div>
                <textarea
                  value={editablePrompt}
                  onChange={(event) => setEditablePrompt(event.target.value)}
                  rows={16}
                  className="w-full rounded-lg border border-white/[0.08] bg-bip-page px-3 py-2 text-xs text-white"
                />
              </div>
              {copied && <p className="text-xs text-white/50">{copied}</p>}
            </>
          ) : (
            <div className="rounded-xl border border-white/[0.08] bg-bip-card p-6 shadow-none">
              
              <div className="inline-flex items-center gap-2 text-sm text-white/75">
                
                <AlertTriangle className="h-4 w-4" /> Build a demo prompt to
                generate a sales-ready sample site concept.
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
