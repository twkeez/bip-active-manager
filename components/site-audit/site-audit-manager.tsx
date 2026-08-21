"use client";
import { useState } from "react";
import { ArrowLeft, FileDown, Loader2, Play, Search } from "lucide-react";
import AuditExportDialog from "@/components/site-audit/audit-export-dialog";
import AuditReport from "@/components/site-audit/audit-report";
import { AUDIT_STAGES } from "@/lib/site-audit/types";
import type { WebsiteAuditRun } from "@/lib/site-audit/types";
type ForClient = { id: number; name: string; website: string | null };
type Props = {
  initialRuns: WebsiteAuditRun[];
  userEmail: string | undefined;
  /** Set when opened from a client workspace — pre-fills that client's site. */
  forClient?: ForClient | null;
};
function formatWhen(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
}
export default function SiteAuditManager({
  initialRuns,
  userEmail,
  forClient = null,
}: Props) {
  const [runs, setRuns] = useState(initialRuns);
  const [selectedRunId, setSelectedRunId] = useState<number | null>(
    initialRuns[0]?.id ?? null,
  );
  const [selectedRun, setSelectedRun] = useState<WebsiteAuditRun | null>(
    initialRuns[0] ?? null,
  );
  const [url, setUrl] = useState(forClient?.website ?? "");
  const [loading, setLoading] = useState(false);
  const [runningStage, setRunningStage] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function refreshRun(runId: number) {
    const response = await fetch(`/api/site-audit/runs/${runId}`, {
      cache: "no-store",
    });
    const payload = (await response.json()) as {
      error?: string;
      run?: WebsiteAuditRun;
    };
    if (!response.ok || !payload.run) {
      throw new Error(payload.error ?? "Failed to load audit run");
    }
    setSelectedRun(payload.run);
    setRuns((prev) =>
      prev.map((run) => (run.id === runId ? payload.run! : run)),
    );
    return payload.run;
  }
  async function handleCreate() {
    const trimmed = url.trim();
    if (!trimmed) {
      setError("Enter a URL to audit.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/site-audit/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmed }),
      });
      const payload = (await response.json()) as {
        error?: string;
        run?: WebsiteAuditRun;
      };
      if (!response.ok || !payload.run) {
        throw new Error(payload.error ?? "Failed to create audit");
      }
      setRuns((prev) => [payload.run!, ...prev]);
      setSelectedRunId(payload.run.id);
      setSelectedRun(payload.run);
      setUrl("");
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : "Failed to create audit",
      );
    } finally {
      setLoading(false);
    }
  }
  async function runStage(runId: number, stage: (typeof AUDIT_STAGES)[number]) {
    setRunningStage(stage);
    setError(null);
    try {
      const response = await fetch(
        `/api/site-audit/runs/${runId}/stages/${stage}`,
        { method: "POST" },
      );
      const payload = (await response.json()) as {
        error?: string;
        run?: WebsiteAuditRun;
      };
      if (!response.ok || !payload.run) {
        throw new Error(payload.error ?? `Stage ${stage} failed`);
      }
      setSelectedRun(payload.run);
      setRuns((prev) =>
        prev.map((run) => (run.id === runId ? payload.run! : run)),
      );
      if (payload.run.stage_status?.[stage]?.status === "failed") {
        throw new Error(
          payload.run.stage_status[stage]?.error ?? `Stage ${stage} failed`,
        );
      }
    } finally {
      setRunningStage(null);
    }
  }
  async function handleRunAll(runId: number) {
    setLoading(true);
    setError(null);
    try {
      for (const stage of AUDIT_STAGES) {
        const fresh = await refreshRun(runId);
        if (fresh.stage_status?.[stage]?.status === "done") continue;
        await runStage(runId, stage);
      }
      await refreshRun(runId);
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : "Audit failed");
    } finally {
      setLoading(false);
    }
  }
  async function handleSelectRun(runId: number) {
    setSelectedRunId(runId);
    setError(null);
    try {
      await refreshRun(runId);
    } catch (selectError) {
      setError(
        selectError instanceof Error
          ? selectError.message
          : "Failed to load run",
      );
    }
  }
  return (
    <div className="flex min-h-screen flex-col bg-bip-page">
      
      <header className="border-b border-bip-border bg-bip-card px-6 py-4">
        
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
          
          <div>
            
            <h1 className="text-lg font-semibold text-bip-text">
              Site Audit
            </h1>
            <p className="text-xs text-bip-muted">
              {userEmail ?? "Signed in"}
            </p>
          </div>
          <a
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-lg border border-bip-border px-3 py-2 text-sm text-bip-text hover:bg-bip-fill"
          >
            
            <ArrowLeft className="h-4 w-4" /> Dashboard
          </a>
        </div>
      </header>
      <main className="mx-auto grid w-full max-w-7xl flex-1 grid-cols-1 gap-5 p-6 xl:grid-cols-[320px_1fr]">
        
        <aside className="space-y-4">
          
          <div className="rounded-xl border border-bip-border bg-bip-card p-4 shadow-none">
            
            <p className="text-xs font-semibold uppercase tracking-wide text-bip-muted">
              New audit
            </p>
            {forClient && (
              <p className="mt-1 text-xs text-bip-muted">
                {forClient.website
                  ? `Pre-filled with ${forClient.name}'s website.`
                  : `${forClient.name} has no website on file — enter one below.`}
              </p>
            )}
            <div className="mt-3 flex gap-2">
              
              <label className="relative flex-1">
                
                <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-bip-muted" />
                <input
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                  placeholder="https://example.com"
                  className="w-full rounded-lg border border-bip-border py-2 pl-7 pr-2 text-sm"
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void handleCreate();
                  }}
                />
              </label>
              <button
                type="button"
                disabled={loading}
                onClick={() => void handleCreate()}
                className="rounded-lg bg-bip-card px-3 py-2 text-sm font-medium text-bip-text hover:bg-bip-card disabled:opacity-60"
              >
                
                Add
              </button>
            </div>
          </div>
          <div className="rounded-xl border border-bip-border bg-bip-card p-4 shadow-none">
            
            <p className="text-xs font-semibold uppercase tracking-wide text-bip-muted">
              Recent audits
            </p>
            {runs.length === 0 ? (
              <p className="mt-3 text-sm text-bip-muted">No audits yet.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                
                {runs.map((run) => (
                  <li key={run.id}>
                    
                    <button
                      type="button"
                      onClick={() => void handleSelectRun(run.id)}
                      className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${selectedRunId === run.id ? "border-zinc-900 bg-bip-fill" : "border-bip-border hover:bg-bip-page"}`}
                    >
                      
                      <p className="truncate font-medium">
                        {run.input_url}
                      </p>
                      <p className="mt-0.5 text-xs text-bip-muted">
                        
                        {run.status} · {formatWhen(run.updated_at)}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
        <section className="space-y-4">
          
          {!selectedRun ? (
            <p className="text-sm text-bip-muted">
              Create or select an audit to view the report.
            </p>
          ) : (
            <>
              
              <div className="flex flex-wrap items-center gap-2">
                
                <button
                  type="button"
                  disabled={loading || Boolean(runningStage)}
                  onClick={() => void handleRunAll(selectedRun.id)}
                  className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-60"
                >
                  
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                  Run full audit
                </button>
                <button
                  type="button"
                  onClick={() => setExportOpen(true)}
                  className="inline-flex items-center gap-2 rounded-lg border border-bip-border bg-bip-card px-3 py-2 text-sm font-medium text-bip-text hover:bg-bip-fill"
                >
                  <FileDown className="h-4 w-4" />
                  Export PDF
                </button>
                {AUDIT_STAGES.map((stage) => (
                  <button
                    key={stage}
                    type="button"
                    disabled={loading || Boolean(runningStage)}
                    onClick={() => void runStage(selectedRun.id, stage)}
                    className="rounded-md border border-bip-border px-2 py-1 text-[11px] hover:bg-bip-fill disabled:opacity-60"
                  >
                    
                    {runningStage === stage ? "…" : stage.replace("_", "")}
                  </button>
                ))}
              </div>
              <AuditReport run={selectedRun} />
            </>
          )}
          {error ? (
            <p className="rounded-md border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-400">
              
              {error}
            </p>
          ) : null}
        </section>
      </main>
      {exportOpen && selectedRun ? (
        <AuditExportDialog run={selectedRun} onClose={() => setExportOpen(false)} />
      ) : null}
    </div>
  );
}
