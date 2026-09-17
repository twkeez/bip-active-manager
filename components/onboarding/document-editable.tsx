"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { SECTION_LABEL } from "@/lib/onboarding/document-order";

/**
 * Editing in place, inside the real client document.
 *
 * The document component wraps its text in these. On the print page there is
 * no edit context, so each one renders its children and nothing else — the
 * printed markup is byte-for-byte what it was before editing existed. Inside
 * the editor the same document gains click-to-edit, so what you edit is exactly
 * what prints, not a form that approximates it.
 */

export type DocumentEditApi = {
  edited: Set<string>;
  /** This client's section order, and whether it differs from the standard one. */
  order: string[];
  orderChanged: boolean;
  /** Swap two whole sections, so a move lands past sections with nothing in them. */
  move: (sectionKey: string, swapWith: string) => Promise<void>;
  resetOrder: () => Promise<void>;
  hidden: Set<string>;
  /** Replace a section's text for this client. */
  save: (sectionKey: string, body: string) => Promise<void>;
  /** Back to the standard wording: removes the client's edit and any hiding. */
  reset: (sectionKey: string) => Promise<void>;
  setHidden: (sectionKey: string, hidden: boolean) => Promise<void>;
};

export const DocumentEditContext = createContext<DocumentEditApi | null>(null);

/** True inside the editor. Lets the document show empty sections so they can be refilled. */
export function useDocumentEditing(): boolean {
  return useContext(DocumentEditContext) !== null;
}

function AutoTextarea({
  value,
  onChange,
  onKeyDown,
}: {
  value: string;
  onChange: (value: string) => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${element.scrollHeight + 2}px`;
  }, [value]);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      onKeyDown={onKeyDown}
      className="block w-full resize-none rounded-md border border-indigo-300 bg-white p-2 text-sm leading-relaxed text-gray-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
    />
  );
}

export function Editable({
  sectionKey,
  value,
  children,
  hint,
}: {
  sectionKey: string;
  /** The text as it can be edited — for a list, one item per line. */
  value: string;
  /** How it normally looks. Rendered untouched on the print page. */
  children: ReactNode;
  /** Shown in the editor under the text box, e.g. "One item per line". */
  hint?: string;
}) {
  const api = useContext(DocumentEditContext);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!api) return <>{children}</>;

  const edited = api.edited.has(sectionKey);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      setEditing(false);
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <div className="relative -mx-2 my-1 rounded-lg bg-indigo-50/70 p-2">
        <AutoTextarea
          value={draft}
          onChange={setDraft}
          onKeyDown={(event) => {
            if (event.key === "Escape") setEditing(false);
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) void run(() => api.save(sectionKey, draft));
          }}
        />
        {hint && <p className="mt-1 text-[11px] text-gray-500">{hint}</p>}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void run(() => api.save(sectionKey, draft))}
            className="rounded-md bg-indigo-700 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-800 disabled:opacity-50"
          >
            {busy ? "Saving…" : "Save for this client"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setDraft(value);
              setEditing(false);
            }}
            className="text-xs text-gray-500 hover:text-gray-800"
          >
            Cancel
          </button>
          {edited && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void run(() => api.reset(sectionKey))}
              className="ml-auto text-xs text-gray-500 underline hover:text-gray-800"
            >
              Back to standard wording
            </button>
          )}
          {error && <span className="text-xs text-red-600">{error}</span>}
        </div>
      </div>
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      title="Click to edit for this client"
      onClick={() => {
        setDraft(value);
        setEditing(true);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          setDraft(value);
          setEditing(true);
        }
      }}
      className={`group relative -mx-2 cursor-text rounded-md px-2 transition-colors hover:bg-indigo-50 ${
        edited ? "bg-amber-50/80 ring-1 ring-amber-300" : ""
      }`}
    >
      {edited && (
        <span className="absolute -top-2 right-1 rounded-full bg-amber-400 px-1.5 py-px text-[9.5px] font-semibold uppercase tracking-wide text-white">
          Edited
        </span>
      )}
      {value.trim() ? (
        children
      ) : (
        <p className="py-1 text-sm italic text-gray-400">Empty — won&apos;t print. Click to add text.</p>
      )}
      <span className="pointer-events-none absolute bottom-1 right-1 hidden rounded bg-indigo-700 px-1.5 py-px text-[10px] text-white group-hover:inline">
        Edit
      </span>
    </div>
  );
}

/**
 * A section that can be left out of the document. In the editor a left-out
 * section stays visible but faded, with a way back; on the print page it has
 * already been removed from the model, so this renders its children.
 */
export function Removable({
  sectionKey,
  label,
  children,
}: {
  sectionKey: string;
  label: string;
  children: ReactNode;
}) {
  const api = useContext(DocumentEditContext);
  const [busy, setBusy] = useState(false);
  if (!api) return <>{children}</>;
  const hidden = api.hidden.has(sectionKey);

  return (
    <div className="relative">
      <div className="mb-1 flex justify-end">
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await api.setHidden(sectionKey, !hidden);
            } finally {
              setBusy(false);
            }
          }}
          className={`rounded-full border px-2 py-0.5 text-[10.5px] font-medium ${
            hidden
              ? "border-indigo-300 bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
              : "border-gray-200 text-gray-500 hover:border-gray-400 hover:text-gray-800"
          } disabled:opacity-50`}
        >
          {busy ? "…" : hidden ? `Put ${label} back` : `Leave ${label} out`}
        </button>
      </div>
      <div className={hidden ? "pointer-events-none select-none opacity-35" : ""}>{children}</div>
      {hidden && (
        <p className="absolute inset-x-0 top-8 text-center text-xs font-semibold uppercase tracking-wide text-gray-500">
          Left out of this client&apos;s document
        </p>
      )}
    </div>
  );
}

/**
 * A whole section, movable in the editor.
 *
 * Outside the editor this is its children and nothing else, so the printed
 * document is unchanged. Inside it, each section gains a small header with its
 * name and arrows. Sections this client has nothing to print for are left out
 * rather than shown as empty rows to shuffle.
 */
export function Movable({
  sectionKey,
  above,
  below,
  children,
}: {
  sectionKey: string;
  /** The section printed above this one for this client, or null when first. */
  above: string | null;
  below: string | null;
  children: ReactNode;
}) {
  const api = useContext(DocumentEditContext);
  const [busy, setBusy] = useState<"up" | "down" | null>(null);
  if (!api) return <>{children}</>;
  const editApi = api;

  async function move(direction: "up" | "down", swapWith: string) {
    setBusy(direction);
    try {
      await editApi.move(sectionKey, swapWith);
    } finally {
      setBusy(null);
    }
  }

  const arrow =
    "rounded-md border border-gray-200 px-1.5 py-0.5 text-gray-500 hover:border-gray-400 hover:text-gray-800 disabled:opacity-30";

  return (
    <div className="relative rounded-lg ring-1 ring-transparent transition hover:ring-indigo-100">
      <div className="mb-1 flex items-center gap-1.5">
        <span className="text-[10.5px] font-semibold uppercase tracking-wide text-gray-400">
          {SECTION_LABEL[sectionKey] ?? sectionKey}
        </span>
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            title={above ? `Move above ${SECTION_LABEL[above] ?? above}` : "Already first"}
            disabled={!above || busy !== null}
            onClick={() => above && void move("up", above)}
            className={arrow}
          >
            {busy === "up" ? "…" : "↑"}
          </button>
          <button
            type="button"
            title={below ? `Move below ${SECTION_LABEL[below] ?? below}` : "Already last"}
            disabled={!below || busy !== null}
            onClick={() => below && void move("down", below)}
            className={arrow}
          >
            {busy === "down" ? "…" : "↓"}
          </button>
        </div>
      </div>
      {children}
    </div>
  );
}
