"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, FileDown, Printer } from "lucide-react";
import ClientExpectationsDocument from "@/components/onboarding/client-expectations-document";
import {
  isDefaultSectionOrder,
  serialiseSectionOrder,
  SECTION_LABEL,
} from "@/lib/onboarding/document-order";
import { SECTION_ORDER_KEY } from "@/lib/onboarding/document-edits";
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
      order: model.sectionOrder,
      orderChanged: !isDefaultSectionOrder(model.sectionOrder),
      // Swapping the two sections, rather than shifting one by a position, is
      // what makes a move land where it looks like it will: a section this
      // client has nothing to print for still sits in the saved order.
      move: async (sectionKey, swapWith) => {
        const next = [...model.sectionOrder];
        const from = next.indexOf(sectionKey);
        const to = next.indexOf(swapWith);
        if (from === -1 || to === -1) return;
        next[from] = swapWith;
        next[to] = sectionKey;
        await send(editsUrl, {
          method: "PUT",
          body: JSON.stringify({ sectionKey: SECTION_ORDER_KEY, body: serialiseSectionOrder(next) }),
        });
        router.refresh();
      },
      resetOrder: async () => {
        await send(`${editsUrl}?sectionKey=${encodeURIComponent(SECTION_ORDER_KEY)}`, { method: "DELETE" });
        router.refresh();
      },
      setHidden: async (sectionKey, hidden) => {
        await send(editsUrl, { method: "PUT", body: JSON.stringify({ sectionKey, hidden }) });
        router.refresh();
      },
    }),
    [clientId, editsUrl, model.edits, model.sectionOrder, router],
  );

  const editedCount = model.edits.edited.length;
  const hiddenCount = model.edits.hidden.length;
  const orderChanged = !isDefaultSectionOrder(model.sectionOrder);

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
              Click any text to change it for this client. The arrows beside a section move the whole section up or
              down. Each change is saved as you go and appears in both the PDF
              and the Word version; other clients keep the standard wording. The plan, strategist and kickoff come from
              the client&apos;s records, so change those on the client page.
            </p>
            <p className="mt-2 text-xs text-bip-text">
              {editedCount === 0 && hiddenCount === 0 && !orderChanged
                ? "Standard wording and order throughout."
                : [
                    editedCount ? `${editedCount} section${editedCount === 1 ? "" : "s"} edited` : null,
                    hiddenCount ? `${hiddenCount} left out` : null,
                    orderChanged ? "reordered" : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
            </p>
            {orderChanged && (
              <button
                type="button"
                onClick={() => void api.resetOrder()}
                className="mt-1 text-xs text-bip-muted underline hover:text-bip-text"
              >
                Back to the standard order ({model.sectionOrder
                  .map((key) => SECTION_LABEL[key] ?? key)
                  .slice(0, 3)
                  .join(" → ")}
                …)
              </button>
            )}
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
