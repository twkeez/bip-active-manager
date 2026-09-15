"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, MapPin } from "lucide-react";

/**
 * Setting a client's town, from the page where you notice it is missing.
 *
 * Until now the only place a city could be set was the New client drawer, at
 * the moment the record was created — so the 37 clients created without one had
 * no way back. The Background panel even told you to add a Google Place ID on
 * the Profile tab, which does not set the city: the place lookup reads the city,
 * it never writes it.
 *
 * Location is not cosmetic. Without it candidateSeoKeywords() drops its entire
 * local branch and returns "vet near me" plus the practice name, search volumes
 * come back null, and the market research refuses to run at all rather than
 * produce something generic.
 */

type Props = {
  clientId: number;
  city: string | null;
  state: string | null;
  /** Rendered when there is nothing on file yet — the prompt to add one. */
  emptyLabel?: string;
};

const TONE = {
  ink: "#1A1A1A",
  secondary: "#6B6B6B",
  faint: "#9A9A9A",
  primary: "#C2185B",
  border: "#E9E6DD",
};

export default function ClientLocationEditor({
  clientId,
  city,
  state,
  emptyLabel = "Add town",
}: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [cityValue, setCityValue] = useState(city ?? "");
  const [stateValue, setStateValue] = useState(state ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const label = [city?.trim(), state?.trim()].filter(Boolean).join(", ");

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/clients/${clientId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          city: cityValue.trim(),
          // Two letters is the convention the master sheet uses, and what
          // reads correctly in "Marietta, GA".
          state: stateValue.trim().toUpperCase(),
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Could not save the location");
      setEditing(false);
      // The research button, the keyword tools and the expectations copy all
      // read this, so the whole page needs to know.
      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save the location");
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        style={{ color: label ? TONE.ink : TONE.primary }}
        className="inline-flex items-center gap-1 font-semibold hover:underline"
        title={label ? "Change the town" : "The town is what makes research and keywords local"}
      >
        <MapPin size={12} strokeWidth={2} />
        {label || emptyLabel}
      </button>
    );
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <input
        autoFocus
        value={cityValue}
        onChange={(event) => setCityValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") void save();
          if (event.key === "Escape") setEditing(false);
        }}
        placeholder="Town"
        style={{ borderColor: TONE.border, color: TONE.ink }}
        className="w-36 rounded-md border bg-white px-2 py-1 text-[12px] focus:outline-none"
      />
      <input
        value={stateValue}
        onChange={(event) => setStateValue(event.target.value.slice(0, 2))}
        onKeyDown={(event) => {
          if (event.key === "Enter") void save();
          if (event.key === "Escape") setEditing(false);
        }}
        placeholder="ST"
        style={{ borderColor: TONE.border, color: TONE.ink }}
        className="w-12 rounded-md border bg-white px-2 py-1 text-[12px] uppercase focus:outline-none"
      />
      <button
        type="button"
        disabled={saving}
        onClick={() => void save()}
        style={{ color: TONE.primary }}
        className="inline-flex items-center gap-1 text-[12px] font-semibold hover:underline disabled:opacity-50"
      >
        {saving && <Loader2 size={11} className="animate-spin" />}
        {saving ? "Saving…" : "Save"}
      </button>
      <button
        type="button"
        onClick={() => setEditing(false)}
        style={{ color: TONE.faint }}
        className="text-[12px] hover:underline"
      >
        Cancel
      </button>
      {error && (
        <span style={{ color: "#B42318" }} className="text-[10.5px]">
          {error}
        </span>
      )}
    </span>
  );
}
