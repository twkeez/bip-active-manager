"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { CONVERSION_TYPES, CONVERSION_TYPE_LABEL, type ConversionType } from "@/lib/onboarding/client-wording";
import { PRACTICE_TYPES, PRACTICE_TYPE_LABEL, type PracticeType } from "@/lib/onboarding/practice-type";

/**
 * The practice facts research and the plan document use: what kind of
 * practice it is, when it opens, the agreed ad budget, and what counts as a
 * lead. Each is optional; empty keeps the standard wording.
 */

const TONE = { ink: "#1A1A1A", secondary: "#6B6B6B", faint: "#9A9A9A", primary: "#C2185B", border: "#E9E6DD" };

type Props = {
  clientId: number;
  practiceType: string | null;
  openingDate: string | null;
  adBudget: string | null;
  conversionTypes: string[] | null;
};

function fmtDate(value: string | null): string | null {
  if (!value) return null;
  return new Date(`${value}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

export default function ClientPracticeProfile({ clientId, practiceType, openingDate, adBudget, conversionTypes }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [type, setType] = useState(practiceType ?? "");
  const [opening, setOpening] = useState(openingDate ?? "");
  const [budget, setBudget] = useState(adBudget ?? "");
  const [conversions, setConversions] = useState<string[]>(conversionTypes ?? []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const summary = [
    practiceType ? PRACTICE_TYPE_LABEL[practiceType as PracticeType] ?? practiceType : null,
    openingDate ? `opens ${fmtDate(openingDate)}` : null,
    adBudget ? `ad budget ${adBudget}` : null,
    conversionTypes?.length ? `leads: ${conversionTypes.map((c) => CONVERSION_TYPE_LABEL[c as ConversionType]?.toLowerCase() ?? c).join(", ")}` : null,
  ].filter(Boolean);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/clients/${clientId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          practice_type: type,
          practice_opening_date: opening,
          ad_budget_monthly: budget,
          conversion_types: conversions,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Could not save");
      setEditing(false);
      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <p className="mt-1.5 text-[12px]" style={{ color: TONE.secondary }}>
        <span style={{ color: TONE.faint }}>Practice: </span>
        {summary.length ? summary.join(" · ") : <span style={{ color: TONE.faint }}>type, opening, ad budget and lead types not set</span>}{" "}
        <button type="button" onClick={() => setEditing(true)} style={{ color: TONE.primary }} className="font-semibold hover:underline">
          {summary.length ? "Edit" : "Add"}
        </button>
      </p>
    );
  }

  const field = "rounded-md border bg-white px-2 py-1 text-[12px] focus:outline-none";
  return (
    <div className="mt-2 space-y-2 rounded-lg border p-3 text-[12px]" style={{ borderColor: TONE.border, color: TONE.ink }}>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-1.5">
          Practice type
          <select value={type} onChange={(e) => setType(e.target.value)} className={field} style={{ borderColor: TONE.border }}>
            <option value="">Not set (general practice wording)</option>
            {PRACTICE_TYPES.map((value) => (
              <option key={value} value={value}>
                {PRACTICE_TYPE_LABEL[value]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1.5">
          Opening date
          <input type="date" value={opening} onChange={(e) => setOpening(e.target.value)} className={field} style={{ borderColor: TONE.border }} />
        </label>
        <label className="flex items-center gap-1.5">
          Agreed ad budget
          <input
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
            placeholder="e.g. $400–$700"
            className={`${field} w-32`}
            style={{ borderColor: TONE.border }}
          />
          <span style={{ color: TONE.faint }}>a month</span>
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <span>Leads come from</span>
        {CONVERSION_TYPES.map((value) => (
          <label key={value} className="flex items-center gap-1">
            <input
              type="checkbox"
              checked={conversions.includes(value)}
              onChange={(e) => setConversions(e.target.checked ? [...conversions, value] : conversions.filter((c) => c !== value))}
            />
            {CONVERSION_TYPE_LABEL[value]}
          </label>
        ))}
      </div>
      <p style={{ color: TONE.faint }}>
        Used by the market research and the client&apos;s plan document. Anything left empty keeps the standard wording.
      </p>
      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={saving}
          onClick={() => void save()}
          style={{ color: TONE.primary }}
          className="inline-flex items-center gap-1 font-semibold hover:underline disabled:opacity-50"
        >
          {saving && <Loader2 size={11} className="animate-spin" />}
          {saving ? "Saving…" : "Save"}
        </button>
        <button type="button" onClick={() => setEditing(false)} style={{ color: TONE.faint }} className="hover:underline">
          Cancel
        </button>
        {error && <span style={{ color: "#B42318" }}>{error}</span>}
      </div>
    </div>
  );
}
