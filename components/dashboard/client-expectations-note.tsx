"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

/**
 * The strategist's note on a client's expectations document.
 *
 * Two or three sentences written for this practice — what we will focus on first
 * and why. Everything else in the document is master copy shared by every
 * client; this is the part a client can tell a person wrote for them. Editable
 * by anyone who can open the client, team included, since strategists work from
 * the team app.
 */
export default function ClientExpectationsNote({
  clientId,
  note,
  accent,
}: {
  clientId: number;
  note: string | null | undefined;
  accent: string;
}) {
  const router = useRouter();
  const saved = (note ?? "").trim();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(saved);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/clients/${clientId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        // An empty note is sent as "" and stored as null, which clears it.
        body: JSON.stringify({ expectations_note: draft }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? `Save failed (${response.status})`);
      setEditing(false);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <div className="mt-3 border-t pt-3" style={{ borderColor: `${accent}33` }}>
        {saved ? (
          <>
            <p className="text-[11.5px] font-semibold" style={{ color: accent }}>
              Note for the client
            </p>
            <p className="mt-0.5 whitespace-pre-line text-[12.5px] leading-snug text-[#191813]">
              {saved}
            </p>
            <button
              type="button"
              onClick={() => {
                setDraft(saved);
                setEditing(true);
              }}
              style={{ color: accent }}
              className="mt-1 text-[11.5px] font-semibold hover:underline"
            >
              Edit note
            </button>
          </>
        ) : (
          <p className="text-[11.5px] text-[#6E6A5E]">
            <button
              type="button"
              onClick={() => {
                setDraft("");
                setEditing(true);
              }}
              style={{ color: accent }}
              className="font-semibold hover:underline"
            >
              + Add a note for the client
            </button>{" "}
            — it prints after the intro of their expectations document.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="mt-3 border-t pt-3" style={{ borderColor: `${accent}33` }}>
      <p className="text-[11.5px] font-semibold" style={{ color: accent }}>
        Note for the client
      </p>
      <textarea
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        rows={3}
        maxLength={1000}
        disabled={saving}
        placeholder="Two or three sentences for this practice — for example, what you'll focus on first and why."
        className="mt-1 w-full rounded-lg border border-[#E6E3DA] bg-white px-2.5 py-2 text-[12.5px] leading-snug text-[#191813] focus:outline-none"
      />
      {error && <p className="mt-1 text-[11.5px] text-red-600">{error}</p>}
      <div className="mt-1.5 flex items-center gap-2">
        <button
          type="button"
          disabled={saving}
          onClick={() => void save()}
          style={{ background: accent }}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-semibold text-white disabled:opacity-60"
        >
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Save note
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => {
            setEditing(false);
            setError(null);
          }}
          className="rounded-lg px-3 py-1.5 text-[12px] font-semibold text-[#6E6A5E] hover:underline"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
