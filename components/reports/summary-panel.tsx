"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, Plus, Save, Sparkles, Trash2 } from "lucide-react";
import type { ReportRecommendationItem } from "@/lib/reporting/types";
import { monthLabel, type MonthKey } from "@/lib/reporting/monthly";
import {
  hasSummaryContent,
  RECOMMENDATIONS_MAX,
  type LoadedMonthSummary,
  type MonthSummary,
} from "@/lib/reporting/month-summary";

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/New_York" });

function sameRecs(a: ReportRecommendationItem[], b: ReportRecommendationItem[]) {
  return a.length === b.length && a.every((r, i) => r.priority === b[i].priority && r.text.trim() === b[i].text.trim());
}

/**
 * The month's summary and next steps. The AI can fill a first draft; nothing
 * reaches the client until a strategist presses Save and approve. Saving a
 * draft, or changing approved text, takes it back off the report.
 */
export default function SummaryPanel({
  clientId,
  month,
  loaded,
  legacyNarrative,
  onSaved,
}: {
  clientId: number;
  month: MonthKey;
  loaded: LoadedMonthSummary;
  /** The old per-client intro, offered as a starting point when this month has nothing. */
  legacyNarrative: string | null;
  onSaved: (summary: MonthSummary) => void;
}) {
  const saved0 = loaded.available ? loaded.summary : null;
  const useLegacy = !!saved0 && !hasSummaryContent(saved0) && !!legacyNarrative?.trim();
  const [saved, setSaved] = useState<MonthSummary | null>(saved0);
  const [text, setText] = useState(useLegacy ? legacyNarrative!.trim() : (saved0?.summary ?? ""));
  const [recs, setRecs] = useState<ReportRecommendationItem[]>(saved0?.recommendations ?? []);
  const [aiDrafted, setAiDrafted] = useState(saved0?.aiDrafted ?? false);
  const [fromLegacy, setFromLegacy] = useState(useLegacy);
  const [busy, setBusy] = useState<"generate" | "draft" | "approve" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const label = monthLabel(month);

  if (!loaded.available) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
        {loaded.error}
      </div>
    );
  }

  const cleanRecs = recs.filter((r) => r.text.trim());
  const changed = !saved || text.trim() !== saved.summary.trim() || !sameRecs(cleanRecs, saved.recommendations);
  const approved = !!saved?.approvedAt && !changed;
  const empty = !text.trim() && cleanRecs.length === 0;

  async function generate() {
    setBusy("generate");
    setError(null);
    try {
      const res = await fetch(`/api/reports/${clientId}/summary/generate`, { method: "POST" });
      const body = (await res.json().catch(() => ({}))) as {
        summary?: string;
        recommendations?: ReportRecommendationItem[];
        error?: string;
      };
      if (!res.ok || !body.summary) {
        setError(body.error ?? `The AI draft failed (${res.status}).`);
        return;
      }
      setText(body.summary);
      setRecs(body.recommendations ?? []);
      setAiDrafted(true);
      setFromLegacy(false);
    } catch (caught) {
      setError(`The AI draft failed: ${(caught as Error).message}`);
    } finally {
      setBusy(null);
    }
  }

  async function save(approve: boolean) {
    setBusy(approve ? "approve" : "draft");
    setError(null);
    try {
      const res = await fetch(`/api/reports/${clientId}/summary`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month, summary: text, recommendations: cleanRecs, aiDrafted, approve }),
      });
      const body = (await res.json().catch(() => ({}))) as { summary?: MonthSummary; error?: string };
      if (!res.ok || !body.summary) {
        setError(body.error ?? `Could not save (${res.status}).`);
        return;
      }
      setSaved(body.summary);
      setText(body.summary.summary);
      setRecs(body.summary.recommendations);
      setFromLegacy(false);
      onSaved(body.summary);
    } catch (caught) {
      setError(`Could not save: ${(caught as Error).message}`);
    } finally {
      setBusy(null);
    }
  }

  const state = empty
    ? saved && hasSummaryContent(saved)
      ? "Cleared here, not saved yet."
      : "Nothing written yet. The report goes out without a summary."
    : approved
      ? `Approved ${shortDate(saved!.approvedAt!)}. This is on the report.`
      : saved?.approvedAt
        ? "Changed since it was approved, not saved. The report still shows the approved version: Save draft takes it off, Save and approve updates it."
        : "Draft. Not on the report until you approve it.";

  const field =
    "w-full rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-800 placeholder-gray-400 focus:border-blue-400 focus:outline-none";
  const button =
    "inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium disabled:opacity-50 transition-colors";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400">{label} summary</p>
        <button
          type="button"
          onClick={() => void generate()}
          disabled={busy !== null}
          className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1 text-[10px] font-medium text-gray-500 hover:border-blue-300 hover:text-blue-600 disabled:opacity-50"
        >
          {busy === "generate" ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />}
          Draft with AI
        </button>
      </div>

      <p className={`rounded-md px-2.5 py-1.5 text-[11px] ${approved ? "bg-emerald-50 text-emerald-800" : "bg-gray-100 text-gray-700"}`}>
        {state}
      </p>
      {aiDrafted && !approved && !empty && (
        <p className="text-[11px] text-gray-500">
          Written by AI from the report&apos;s numbers (about the last 30 days of synced data). Check every figure and
          edit it before you approve.
        </p>
      )}
      {fromLegacy && (
        <p className="text-[11px] text-gray-500">
          This is the intro saved before reports were kept by month. Check it against this month&apos;s numbers before
          you save it.
        </p>
      )}

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={6}
        placeholder="What happened this month, in a few plain sentences…"
        className={`${field} resize-y`}
      />

      <div className="space-y-2">
        <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400">Next steps</p>
        {recs.map((rec, index) => (
          <div key={index} className="flex items-start gap-1.5">
            <select
              value={rec.priority}
              onChange={(e) =>
                setRecs((prev) =>
                  prev.map((r, i) => (i === index ? { ...r, priority: e.target.value as ReportRecommendationItem["priority"] } : r)),
                )
              }
              className="rounded-md border border-gray-200 px-1.5 py-1.5 text-[11px] text-gray-700"
              aria-label="Priority"
            >
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            <textarea
              value={rec.text}
              onChange={(e) => setRecs((prev) => prev.map((r, i) => (i === index ? { ...r, text: e.target.value } : r)))}
              rows={2}
              className={`${field} flex-1 resize-y`}
            />
            <button
              type="button"
              onClick={() => setRecs((prev) => prev.filter((_, i) => i !== index))}
              className="rounded-md p-1.5 text-gray-400 hover:text-red-600"
              aria-label="Remove this next step"
            >
              <Trash2 size={12} />
            </button>
          </div>
        ))}
        {recs.length < RECOMMENDATIONS_MAX && (
          <button
            type="button"
            onClick={() => setRecs((prev) => [...prev, { priority: "medium", text: "" }])}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:text-blue-700"
          >
            <Plus size={11} /> Add a next step
          </button>
        )}
      </div>

      {error && <p className="rounded-md bg-red-50 px-2.5 py-1.5 text-[11px] text-red-700">{error}</p>}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => void save(false)}
          disabled={busy !== null || !changed}
          className={`${button} flex-1 border border-gray-200 text-gray-700 hover:bg-gray-50`}
        >
          {busy === "draft" ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
          {empty ? "Save (clear)" : "Save draft"}
        </button>
        <button
          type="button"
          onClick={() => void save(true)}
          disabled={busy !== null || empty || approved}
          className={`${button} flex-1 bg-blue-600 text-white hover:bg-blue-700`}
        >
          {busy === "approve" ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
          Save and approve
        </button>
      </div>
      <p className="text-[10px] text-gray-400">
        Only approved text goes on the PDF and Word report. The report can&apos;t be marked Reviewed or Sent while a
        draft waits.
      </p>
    </div>
  );
}
