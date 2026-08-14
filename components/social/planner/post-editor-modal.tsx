"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { CONTENT_PILLARS } from "@/lib/social/taxonomy";
import { T, FONT, MONTH_NAMES, daysInMonth, selectDateLabel } from "./tokens";

export type EditorProvenance = "idea" | "seasonal" | "series" | "custom";

/** What the modal edits. Mirrors the export sheet's five fields plus origin. */
export type EditorDraft = {
  /** Present when editing an existing post; absent when creating. */
  postId?: number;
  day: number;
  contentPillar: string;
  headline: string;
  subheadline: string;
  photoSuggestion: string;
  provenance: EditorProvenance;
  ideaId?: number | null;
  awarenessDayId?: number | null;
  seriesId?: number | null;
};

const PROVENANCE_CHIP: Record<EditorProvenance, { label: string; bg: string; fg: string }> = {
  idea: { label: "From ideas", bg: "#E8EAFD", fg: T.primary },
  seasonal: { label: "Seasonal", bg: T.amberTint, fg: T.amber },
  series: { label: "Series", bg: T.greenTint, fg: T.green },
  custom: { label: "Custom", bg: "#F0EEE7", fg: T.secondary },
};

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label
      style={{ color: T.muted, letterSpacing: "0.09em" }}
      className="mb-1.5 block text-[10.5px] font-bold uppercase"
    >
      {children}
    </label>
  );
}

const fieldStyle = {
  background: T.fill,
  borderColor: T.border,
  color: T.ink,
} as const;

const FIELD_CLASS =
  "w-full rounded-[9px] border px-[11px] py-[9px] text-[13px] outline-none focus:!border-[#2B3FE4] focus:!bg-white";

export function PostEditorModal({
  draft: initialDraft,
  month,
  year,
  onSave,
  onDelete,
  onDuplicate,
  onClose,
}: {
  draft: EditorDraft;
  month: number;
  year: number;
  onSave: (draft: EditorDraft) => Promise<void>;
  onDelete?: (postId: number) => Promise<void>;
  onDuplicate?: (draft: EditorDraft) => Promise<void>;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<EditorDraft>(initialDraft);
  const [busy, setBusy] = useState<null | "save" | "delete" | "duplicate">(null);
  const [error, setError] = useState<string | null>(null);
  const headlineRef = useRef<HTMLInputElement>(null);

  const isEdit = draft.postId != null;
  const chip = PROVENANCE_CHIP[draft.provenance];
  const dayCount = daysInMonth(year, month);

  useEffect(() => {
    headlineRef.current?.focus();
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && busy === null) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, busy]);

  function set<K extends keyof EditorDraft>(key: K, value: EditorDraft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
    setError(null);
  }

  async function handleSave() {
    // Headline and pillar both gate the save — an export row without either is
    // useless to the SMM team.
    if (!draft.headline.trim()) {
      setError("Add a headline before saving.");
      headlineRef.current?.focus();
      return;
    }
    if (!draft.contentPillar) {
      setError("Choose a content pillar before saving.");
      return;
    }
    setBusy("save");
    try {
      await onSave({ ...draft, headline: draft.headline.trim() });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
      setBusy(null);
    }
  }

  async function run(kind: "delete" | "duplicate", fn: () => Promise<void>) {
    setBusy(kind);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setBusy(null);
    }
  }

  return (
    <>
      <div
        onClick={() => busy === null && onClose()}
        style={{ background: "rgba(20,18,10,0.36)" }}
        className="fixed inset-0 z-50"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={isEdit ? "Edit post" : "New post"}
        style={{
          background: T.card,
          fontFamily: FONT,
          boxShadow: "0 30px 70px rgba(20,18,10,0.28)",
        }}
        className="fixed left-1/2 top-1/2 z-50 max-h-[92vh] w-[540px] max-w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-[18px] px-6 py-[22px]"
      >
        <div className="flex items-center justify-between gap-3">
          <h2 style={{ color: T.ink }} className="text-[16px] font-bold">
            {isEdit ? "Edit post" : `New post — ${MONTH_NAMES[month]} ${year}`}
          </h2>
          <span
            style={{ background: chip.bg, color: chip.fg }}
            className="shrink-0 rounded-full px-2.5 py-[3px] text-[11px] font-bold"
          >
            {chip.label}
          </span>
        </div>

        <div className="mt-4 flex gap-2.5">
          <div style={{ flex: "1 1 0" }}>
            <Label>Date</Label>
            <select
              value={draft.day}
              onChange={(e) => set("day", Number(e.target.value))}
              style={fieldStyle}
              className={FIELD_CLASS}
            >
              {Array.from({ length: dayCount }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>
                  {selectDateLabel(year, month, d)}
                </option>
              ))}
            </select>
          </div>
          <div style={{ flex: "1.4 1 0" }}>
            <Label>Content pillar</Label>
            <select
              value={draft.contentPillar}
              onChange={(e) => set("contentPillar", e.target.value)}
              style={fieldStyle}
              className={FIELD_CLASS}
            >
              <option value="">Choose a pillar…</option>
              {CONTENT_PILLARS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-3.5">
          <Label>Headline</Label>
          <input
            ref={headlineRef}
            value={draft.headline}
            onChange={(e) => set("headline", e.target.value)}
            placeholder="The hook — what stops the scroll"
            style={fieldStyle}
            className={`${FIELD_CLASS} !text-[13.5px] font-semibold`}
          />
        </div>

        <div className="mt-3.5">
          <Label>Subheadline</Label>
          <textarea
            rows={2}
            value={draft.subheadline}
            onChange={(e) => set("subheadline", e.target.value)}
            placeholder="One supporting sentence."
            style={fieldStyle}
            className={`${FIELD_CLASS} resize-y`}
          />
        </div>

        <div className="mt-3.5">
          <Label>Photo suggestion</Label>
          <textarea
            rows={2}
            value={draft.photoSuggestion}
            onChange={(e) => set("photoSuggestion", e.target.value)}
            placeholder="What the practice should photograph."
            style={fieldStyle}
            className={`${FIELD_CLASS} resize-y`}
          />
        </div>

        {error && (
          <p style={{ color: T.rust }} className="mt-3 text-[12px] font-semibold">
            {error}
          </p>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-2">
          {isEdit && onDelete && (
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void run("delete", () => onDelete(draft.postId!))}
              style={{ color: T.rust }}
              className="rounded-[9px] px-3 py-2 text-[12.5px] font-semibold transition-colors hover:!bg-[#FBF1EF] disabled:opacity-50"
            >
              {busy === "delete" ? "Deleting…" : "Delete"}
            </button>
          )}
          {isEdit && onDuplicate && (
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void run("duplicate", () => onDuplicate(draft))}
              style={{ borderColor: T.border, color: T.secondary }}
              className="rounded-[9px] border px-3 py-2 text-[12.5px] font-semibold transition-colors hover:!border-[#C9C4B5] hover:!text-[#191813] disabled:opacity-50"
            >
              {busy === "duplicate" ? "Copying…" : "Duplicate → next day"}
            </button>
          )}

          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              disabled={busy !== null}
              onClick={onClose}
              style={{ borderColor: T.border, color: T.secondary }}
              className="rounded-full border px-4 py-2 text-[12.5px] font-semibold transition-colors hover:!border-[#C9C4B5] hover:!text-[#191813] disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void handleSave()}
              style={{ background: T.primary, color: "#fff" }}
              className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[12.5px] font-semibold transition-colors hover:!bg-[#1F31C8] disabled:opacity-60"
            >
              {busy === "save" && <Loader2 size={12} className="animate-spin" />}
              Save to calendar
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
