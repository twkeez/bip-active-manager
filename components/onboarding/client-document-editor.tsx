"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, FileDown, Printer } from "lucide-react";
import ClientExpectationsDocument from "@/components/onboarding/client-expectations-document";
import { DocumentEditContext, type DocumentEditApi } from "@/components/onboarding/document-editable";
import type { ClientExpectationsModel } from "@/lib/onboarding/load-client-expectations";

/**
 * The client document, editable in place.
 *
 * Every save goes straight to the server and the page reloads its model, so
 * what is on screen is always what will print — there is no unsaved state to
 * lose, and the PDF and Word exports read the same saved edits.
 */

async function send(url: string, init: RequestInit) {
  const response = await fetch(url, { ...init, headers: { "Content-Type": "application/json" } });
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(payload.error ?? `Could not save (HTTP ${response.status}).`);
  }
}

export default function ClientDocumentEditor({
  clientId,
  model,
  generatedAt,
}: {
  clientId: number;
  model: ClientExpectationsModel;
  generatedAt: string;
}) {
  const router = useRouter();
  const editsUrl = `/api/client-expectations/${clientId}/edits`;

  const api = useMemo<DocumentEditApi>(
    () => ({
      edited: new Set(model.edits.edited),
      hidden: new Set(model.edits.hidden),
      save: async (sectionKey, body) => {
        // The strategist note has always lived on the client record; editing it
        // here writes it there, so the client page shows the same note.
        if (sectionKey === "note") {
          await send(`/api/clients/${clientId}`, {
            method: "PATCH",
            body: JSON.stringify({ expectations_note: body }),
          });
        } else {
          await send(editsUrl, { method: "PUT", body: JSON.stringify({ sectionKey, body }) });
        }
        router.refresh();
      },
      reset: async (sectionKey) => {
        await send(`${editsUrl}?sectionKey=${encodeURIComponent(sectionKey)}`, { method: "DELETE" });
        router.refresh();
      },
      setHidden: async (sectionKey, hidden) => {
        await send(editsUrl, { method: "PUT", body: JSON.stringify({ sectionKey, hidden }) });
        router.refresh();
      },
    }),
    [clientId, editsUrl, model.edits, router],
  );

  const editedCount = model.edits.edited.length;
  const hiddenCount = model.edits.hidden.length;

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4 p-6">
      <div className="rounded-xl border border-bip-border bg-bip-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <Link
              href={`/dashboard/clients/${clientId}`}
              className="inline-flex items-center gap-1 text-xs text-bip-muted hover:text-bip-text"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back to client
            </Link>
            <h1 className="mt-1 text-lg font-semibold text-bip-text">Review &amp; edit · {model.clientName}</h1>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-bip-muted">
              Click any text to change it for this client. Each change is saved as you go and appears in both the PDF
              and the Word version; other clients keep the standard wording. The plan, strategist and kickoff come from
              the client&apos;s records, so change those on the client page.
            </p>
            <p className="mt-2 text-xs text-bip-text">
              {editedCount === 0 && hiddenCount === 0
                ? "Standard wording throughout."
                : [
                    editedCount ? `${editedCount} section${editedCount === 1 ? "" : "s"} edited` : null,
                    hiddenCount ? `${hiddenCount} left out` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <a
              href={`/client-expectations-print/${clientId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md bg-bip-accent px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
            >
              <Printer className="h-3.5 w-3.5" /> Print / Save as PDF
            </a>
            <a
              href={`/api/client-expectations/${clientId}/word`}
              className="inline-flex items-center gap-1.5 rounded-md border border-bip-border px-3 py-1.5 text-xs text-bip-text hover:bg-bip-fill"
            >
              <FileDown className="h-3.5 w-3.5" /> Word
            </a>
          </div>
        </div>
      </div>

      {/* The real document, on white, exactly as it prints. */}
      <div className="overflow-hidden rounded-xl border border-bip-border bg-white shadow-sm">
        <DocumentEditContext.Provider value={api}>
          <ClientExpectationsDocument model={model} generatedAt={generatedAt} />
        </DocumentEditContext.Provider>
      </div>
    </div>
  );
}
