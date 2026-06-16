"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  Copy,
  Download,
  FileText,
  Loader2,
  Sparkles,
} from "lucide-react";
import type { LlmsTxtClientOption, LlmsTxtGenerateResult } from "@/lib/llms-txt/types";

type Props = {
  clients: LlmsTxtClientOption[];
  userEmail: string | undefined;
};

type PreviewTab = "index" | "full";

function downloadTextFile(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function LlmsTxtManager({ clients, userEmail }: Props) {
  const [clientId, setClientId] = useState<number | "">(
    clients[0]?.id ?? "",
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<LlmsTxtGenerateResult | null>(null);
  const [tab, setTab] = useState<PreviewTab>("index");
  const [copyMessage, setCopyMessage] = useState<string | null>(null);

  const selectedClient = useMemo(
    () => clients.find((c) => c.id === clientId) ?? null,
    [clients, clientId],
  );

  async function handleGenerate() {
    if (clientId === "") {
      setError("Select a client.");
      return;
    }
    setLoading(true);
    setError(null);
    setCopyMessage(null);
    try {
      const response = await fetch("/api/llms-txt/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId }),
      });
      const payload = (await response.json()) as LlmsTxtGenerateResult & {
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to generate llms.txt");
      }
      setResult(payload);
      setTab("index");
    } catch (generateError) {
      setError(
        generateError instanceof Error
          ? generateError.message
          : "Failed to generate llms.txt",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    if (!result) return;
    const text = tab === "index" ? result.llmsTxt : result.llmsFullTxt;
    await navigator.clipboard.writeText(text);
    setCopyMessage(`Copied ${tab === "index" ? "llms.txt" : "llms-full.txt"}.`);
  }

  function handleDownloadIndex() {
    if (!result) return;
    downloadTextFile("llms.txt", result.llmsTxt);
  }

  function handleDownloadFull() {
    if (!result) return;
    downloadTextFile("llms-full.txt", result.llmsFullTxt);
  }

  function handleDownloadBoth() {
    if (!result) return;
    handleDownloadIndex();
    handleDownloadFull();
  }

  const previewContent =
    result == null ? "" : tab === "index" ? result.llmsTxt : result.llmsFullTxt;

  return (
    <div className="min-h-screen bg-bip-page font-sans text-white/75">
      <header className="border-b border-white/[0.08] px-6 py-5">
        <div className="mx-auto flex max-w-5xl items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <FileText className="text-bip-accent" size={20} />
              <h1 className="text-lg font-semibold tracking-tight text-white">
                llms.txt Generator
              </h1>
            </div>
            <p className="mt-1 text-xs text-white/50">
              Curated LLM index + full export · {userEmail ?? "Signed in"}
            </p>
          </div>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-lg border border-white/[0.08] bg-bip-card px-3 py-2 text-sm text-white/75 transition hover:bg-white/[0.06]"
          >
            <ArrowLeft className="h-4 w-4" />
            Dashboard
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">
        <p className="mb-6 text-sm text-white/60">
          Generate spec-compliant{" "}
          <a
            href="https://llmstxt.org/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-bip-accent underline-offset-2 hover:underline"
          >
            llms.txt
          </a>{" "}
          and{" "}
          <code className="rounded bg-white/5 px-1 py-0.5 text-xs">llms-full.txt</code>{" "}
          files for a client website. Upload both to the site root when ready (
          <code className="rounded bg-white/5 px-1 py-0.5 text-xs">
            https://domain/llms.txt
          </code>
          ).
        </p>

        <div className="rounded-xl border border-white/[0.08] bg-bip-card p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <label className="flex-1 text-sm">
              <span className="mb-2 block text-white/50">Client</span>
              <select
                value={clientId}
                onChange={(e) =>
                  setClientId(e.target.value ? Number(e.target.value) : "")
                }
                className="w-full rounded-lg border border-white/[0.08] bg-bip-page px-3 py-2.5 text-white outline-none focus:border-bip-accent/50"
                disabled={loading || clients.length === 0}
              >
                {clients.length === 0 ? (
                  <option value="">No clients with websites</option>
                ) : (
                  clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.account_name} — {client.website}
                    </option>
                  ))
                )}
              </select>
            </label>
            <button
              type="button"
              onClick={() => void handleGenerate()}
              disabled={loading || clients.length === 0}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-bip-accent px-5 py-2.5 text-sm font-medium text-bip-page transition hover:brightness-110 disabled:opacity-60"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              Generate
            </button>
          </div>

          {selectedClient ? (
            <p className="mt-3 text-xs text-white/40">
              Will crawl sitemap at{" "}
              <span className="text-white/60">{selectedClient.website}</span>
            </p>
          ) : null}

          {error ? (
            <p className="mt-4 rounded-lg border border-bip-danger/30 bg-bip-danger/10 px-4 py-3 text-sm text-bip-danger">
              {error}
            </p>
          ) : null}
        </div>

        {result ? (
          <div className="mt-8 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-white">
                  {result.clientName}
                </h2>
                <p className="text-xs text-white/50">
                  {result.stats.urlsDiscovered} URLs discovered ·{" "}
                  {result.stats.urlsIndexed} indexed · {result.stats.urlsInFull}{" "}
                  in full export · {formatBytes(result.stats.llmsFullBytes)}
                  {result.stats.truncated ? " · truncated" : ""}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void handleCopy()}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] px-3 py-2 text-xs text-white/75 hover:bg-white/[0.06]"
                >
                  <Copy className="h-3.5 w-3.5" />
                  Copy
                </button>
                <button
                  type="button"
                  onClick={handleDownloadIndex}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] px-3 py-2 text-xs text-white/75 hover:bg-white/[0.06]"
                >
                  <Download className="h-3.5 w-3.5" />
                  llms.txt
                </button>
                <button
                  type="button"
                  onClick={handleDownloadFull}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] px-3 py-2 text-xs text-white/75 hover:bg-white/[0.06]"
                >
                  <Download className="h-3.5 w-3.5" />
                  llms-full.txt
                </button>
                <button
                  type="button"
                  onClick={handleDownloadBoth}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-bip-accent/40 bg-bip-accent/10 px-3 py-2 text-xs text-bip-accent hover:bg-bip-accent/20"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download both
                </button>
              </div>
            </div>

            {copyMessage ? (
              <p className="text-xs text-bip-accent">{copyMessage}</p>
            ) : null}

            <div className="flex gap-2 border-b border-white/[0.08]">
              <button
                type="button"
                onClick={() => setTab("index")}
                className={`px-4 py-2 text-sm ${tab === "index" ? "border-b-2 border-bip-accent text-white" : "text-white/50"}`}
              >
                llms.txt
              </button>
              <button
                type="button"
                onClick={() => setTab("full")}
                className={`px-4 py-2 text-sm ${tab === "full" ? "border-b-2 border-bip-accent text-white" : "text-white/50"}`}
              >
                llms-full.txt
              </button>
            </div>

            <pre className="max-h-[60vh] overflow-auto rounded-xl border border-white/[0.08] bg-bip-page/80 p-4 text-xs leading-relaxed text-white/80 whitespace-pre-wrap">
              {previewContent}
            </pre>

            <p className="text-xs text-white/40">
              Deploy to{" "}
              <code className="text-white/60">
                https://{result.domain}/llms.txt
              </code>{" "}
              and{" "}
              <code className="text-white/60">
                https://{result.domain}/llms-full.txt
              </code>
            </p>
          </div>
        ) : null}
      </main>
    </div>
  );
}
