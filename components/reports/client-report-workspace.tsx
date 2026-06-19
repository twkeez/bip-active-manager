"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, RefreshCw, Trash2, Save, Sparkles } from "lucide-react";
import ReportPreview from "@/components/reports/report-preview";
import ReportConfigEditor from "@/components/reports/report-config-editor";
import type { ClientReportModel } from "@/lib/reporting/types";
import type { ReportDraft } from "@/lib/reporting/draft-types";
import type { ReportConfig } from "@/lib/reporting/report-config-types";
import { SECTION_LABELS } from "@/lib/reporting/report-config-types";

type ManagedKeyword = {
  id: number;
  keyword: string;
  tag: string | null;
  priority: number;
  isActive: boolean;
};

type SyncTimestamps = {
  gsc: string | null;
  ads: string | null;
  social: string | null;
  gbp: string | null;
};

type Tab = "sync" | "layout" | "keywords" | "narrative";

type Props = {
  report: ClientReportModel;
  clientId: number;
  initialConfig: ReportConfig;
  initialDraft: ReportDraft | null;
  initialKeywords: ManagedKeyword[];
  syncTimestamps: SyncTimestamps;
};

function timeAgo(iso: string | null): string {
  if (!iso) return "Never";
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 2) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  return `${diffDays}d ago`;
}

function freshnessColor(iso: string | null): string {
  if (!iso) return "bg-gray-300";
  const diffHrs = (Date.now() - new Date(iso).getTime()) / 3600000;
  if (diffHrs < 25) return "bg-emerald-400";
  if (diffHrs < 72) return "bg-amber-400";
  return "bg-red-400";
}

export default function ClientReportWorkspace({
  report,
  clientId,
  initialConfig,
  initialDraft,
  initialKeywords,
  syncTimestamps,
}: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("sync");

  // ── Layout config ──────────────────────────────────────────────────────────
  const [layoutConfig, setLayoutConfig] = useState<ReportConfig>(initialConfig);
  const [savingLayout, setSavingLayout] = useState(false);

  async function saveLayout() {
    setSavingLayout(true);
    try {
      await fetch("/api/reporting/client-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, config: layoutConfig }),
      });
    } finally {
      setSavingLayout(false);
    }
  }

  // ── Draft / Narrative ──────────────────────────────────────────────────────
  const [windowLabel, setWindowLabel] = useState(
    initialDraft?.window_label ?? "Last 30 days",
  );
  const [narrative, setNarrative] = useState(initialDraft?.narrative ?? "");
  const [sectionComments, setSectionComments] = useState<Record<string, string>>(
    initialDraft?.section_comments ?? {},
  );
  const [savingDraft, setSavingDraft] = useState(false);
  const [generatingIntro, setGeneratingIntro] = useState(false);

  const builtDraft: ReportDraft | null = {
    id: initialDraft?.id ?? "",
    client_id: clientId,
    window_label: windowLabel,
    narrative: narrative || null,
    section_visibility: {},
    kpi_overrides: initialDraft?.kpi_overrides ?? {},
    section_comments: sectionComments,
    created_at: initialDraft?.created_at ?? new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  async function saveDraft() {
    setSavingDraft(true);
    try {
      await fetch(`/api/reports/${clientId}/draft`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          window_label: windowLabel,
          narrative: narrative || null,
          section_visibility: {},
          kpi_overrides: initialDraft?.kpi_overrides ?? {},
          section_comments: sectionComments,
        }),
      });
    } finally {
      setSavingDraft(false);
    }
  }

  async function generateIntro() {
    setGeneratingIntro(true);
    try {
      const snapshot = {
        clientName: report.client.account_name,
        strategist: report.client.marketing_strategist ?? null,
        windowLabel,
        kpis: report.kpis.map((k) => ({ label: k.label, value: k.value })),
        gains: report.executiveSummary.topGains
          .filter((g) => (g.deltaPercent ?? 0) > 0)
          .map((g) => ({ label: g.label, deltaPercent: g.deltaPercent ?? 0 })),
        channels: [
          {
            title: "Organic Search",
            metrics: report.channels.searchConsole.metrics.map((m) => ({
              label: m.label,
              current: m.current,
              valueSuffix: m.valueSuffix ?? null,
            })),
          },
          {
            title: "Google Ads",
            metrics: report.channels.ads.metrics.map((m) => ({
              label: m.label,
              current: m.current,
              valueSuffix: m.valueSuffix ?? null,
            })),
          },
          {
            title: "Website Traffic",
            metrics: report.channels.ga4.metrics.map((m) => ({
              label: m.label,
              current: m.current,
              valueSuffix: m.valueSuffix ?? null,
            })),
          },
        ],
        recommendations: report.actions.map((a) => ({
          priority: a.priority,
          text: a.title,
        })),
      };
      const res = await fetch(`/api/reports/${clientId}/generate-intro`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(snapshot),
      });
      const json = (await res.json()) as { intro?: string };
      if (json.intro) setNarrative(json.intro);
    } finally {
      setGeneratingIntro(false);
    }
  }

  // ── Keywords ───────────────────────────────────────────────────────────────
  const [keywords, setKeywords] = useState<ManagedKeyword[]>(initialKeywords);
  const [newKeyword, setNewKeyword] = useState("");
  const [newTag, setNewTag] = useState("");
  const [addingKeyword, setAddingKeyword] = useState(false);
  const [removingId, setRemovingId] = useState<number | null>(null);
  const [keywordError, setKeywordError] = useState<string | null>(null);

  type KeywordRow = { id: number; keyword: string; tag: string | null; priority: number; is_active?: boolean; isActive?: boolean };

  function mapKeywordRows(rows: KeywordRow[]): ManagedKeyword[] {
    return rows.map((r) => ({
      id: r.id,
      keyword: r.keyword,
      tag: r.tag,
      priority: r.priority,
      isActive: r.is_active ?? r.isActive ?? true,
    }));
  }

  async function addKeyword() {
    const kw = newKeyword.trim();
    if (!kw) return;
    setAddingKeyword(true);
    setKeywordError(null);
    try {
      const res = await fetch("/api/reporting/keywords", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          upserts: [{ keyword: kw, tag: newTag.trim() || null, priority: 50, isActive: true }],
        }),
      });
      const json = (await res.json()) as { rows?: KeywordRow[]; error?: string };
      if (!res.ok || json.error) {
        setKeywordError(json.error ?? "Failed to add keyword");
        return;
      }
      if (json.rows) setKeywords(mapKeywordRows(json.rows));
      setNewKeyword("");
      setNewTag("");
    } catch {
      setKeywordError("Network error — please try again");
    } finally {
      setAddingKeyword(false);
    }
  }

  async function removeKeyword(id: number) {
    setRemovingId(id);
    setKeywordError(null);
    try {
      const res = await fetch("/api/reporting/keywords", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, deleteIds: [id] }),
      });
      const json = (await res.json()) as { rows?: KeywordRow[]; error?: string };
      if (!res.ok || json.error) {
        setKeywordError(json.error ?? "Failed to remove keyword");
        return;
      }
      if (json.rows) setKeywords(mapKeywordRows(json.rows));
    } catch {
      setKeywordError("Network error — please try again");
    } finally {
      setRemovingId(null);
    }
  }

  // ── Sync ───────────────────────────────────────────────────────────────────
  const [syncing, setSyncing] = useState<Record<string, boolean>>({});
  const [syncErrors, setSyncErrors] = useState<Record<string, string>>({});

  const syncChannel = useCallback(
    async (channel: "gsc" | "ads" | "social" | "gbp") => {
      const endpoints: Record<string, string> = {
        gsc: "/api/seo/search-console/sync",
        ads: "/api/ads/sync",
        social: "/api/social/sync",
        gbp: "/api/gbp/sync",
      };
      setSyncing((s) => ({ ...s, [channel]: true }));
      setSyncErrors((e) => { const next = { ...e }; delete next[channel]; return next; });
      try {
        const res = await fetch(endpoints[channel], {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ clientId }),
        });
        if (!res.ok) {
          const json = (await res.json()) as { error?: string };
          throw new Error(json.error ?? `Sync failed (${res.status})`);
        }
        router.refresh();
      } catch (e) {
        setSyncErrors((prev) => ({
          ...prev,
          [channel]: e instanceof Error ? e.message : "Sync failed",
        }));
      } finally {
        setSyncing((s) => ({ ...s, [channel]: false }));
      }
    },
    [clientId, router],
  );

  // ── Render ─────────────────────────────────────────────────────────────────

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: "sync", label: "Sync" },
    { id: "layout", label: "Layout" },
    { id: "keywords", label: "Keywords" },
    { id: "narrative", label: "Narrative" },
  ];

  const visibleSectionKeys = layoutConfig.sections
    .filter((s) => s.visible)
    .map((s) => s.key);

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden">
      {/* ── Left panel ── */}
      <div className="w-80 shrink-0 border-r border-gray-200 bg-white flex flex-col overflow-hidden">
        {/* Tab bar */}
        <div className="flex border-b border-gray-200 shrink-0">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-3 text-xs font-medium transition-colors ${
                activeTab === tab.id
                  ? "border-b-2 border-blue-600 text-blue-700"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === "sync" && (
            <SyncPanel
              syncTimestamps={syncTimestamps}
              syncing={syncing}
              syncErrors={syncErrors}
              onSync={syncChannel}
            />
          )}
          {activeTab === "layout" && (
            <div className="p-4">
              <ReportConfigEditor
                config={layoutConfig}
                onChange={setLayoutConfig}
                saving={savingLayout}
                onSave={() => void saveLayout()}
              />
            </div>
          )}
          {activeTab === "keywords" && (
            <KeywordsPanel
              keywords={keywords}
              newKeyword={newKeyword}
              newTag={newTag}
              addingKeyword={addingKeyword}
              removingId={removingId}
              error={keywordError}
              onNewKeywordChange={setNewKeyword}
              onNewTagChange={setNewTag}
              onAdd={() => void addKeyword()}
              onRemove={(id) => void removeKeyword(id)}
            />
          )}
          {activeTab === "narrative" && (
            <NarrativePanel
              windowLabel={windowLabel}
              narrative={narrative}
              sectionComments={sectionComments}
              visibleSectionKeys={visibleSectionKeys}
              savingDraft={savingDraft}
              generatingIntro={generatingIntro}
              onWindowLabelChange={setWindowLabel}
              onNarrativeChange={setNarrative}
              onSectionCommentChange={(key, val) =>
                setSectionComments((prev) => ({ ...prev, [key]: val }))
              }
              onSave={() => void saveDraft()}
              onGenerateIntro={() => void generateIntro()}
            />
          )}
        </div>
      </div>

      {/* ── Right panel — live preview ── */}
      <div className="flex-1 overflow-y-auto bg-gray-50">
        <ReportPreview report={report} config={layoutConfig} draft={builtDraft} />
      </div>
    </div>
  );
}

// ── Sub-panels ─────────────────────────────────────────────────────────────

function SyncPanel({
  syncTimestamps,
  syncing,
  syncErrors,
  onSync,
}: {
  syncTimestamps: SyncTimestamps;
  syncing: Record<string, boolean>;
  syncErrors: Record<string, string>;
  onSync: (ch: "gsc" | "ads" | "social" | "gbp") => void;
}) {
  const channels: Array<{
    id: "gsc" | "ads" | "social" | "gbp";
    label: string;
    description: string;
  }> = [
    { id: "gsc", label: "Search Console", description: "Organic rankings & clicks" },
    { id: "ads", label: "Google Ads", description: "Ad spend & conversions" },
    { id: "social", label: "Social Media", description: "Facebook & Instagram" },
    { id: "gbp", label: "Google Business", description: "Reviews & local metrics" },
  ];

  return (
    <div className="p-4 space-y-3">
      <p className="text-xs text-gray-400 mb-4">
        Pull fresh data from each connected channel. After syncing, the preview updates automatically.
      </p>
      {channels.map((ch) => {
        const ts = syncTimestamps[ch.id];
        const isLoading = syncing[ch.id];
        const error = syncErrors[ch.id];
        return (
          <div key={ch.id} className="rounded-lg border border-gray-200 p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2 min-w-0">
                <span
                  className={`mt-1 shrink-0 h-2 w-2 rounded-full ${freshnessColor(ts)}`}
                />
                <div className="min-w-0">
                  <p className="text-xs font-medium text-gray-800">{ch.label}</p>
                  <p className="text-[10px] text-gray-400">{ch.description}</p>
                  <p className="text-[10px] text-gray-500 mt-0.5">
                    Last synced: {timeAgo(ts)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onSync(ch.id)}
                disabled={isLoading}
                className="shrink-0 inline-flex items-center gap-1 rounded-md border border-gray-200 px-2.5 py-1.5 text-[11px] font-medium text-gray-600 hover:border-blue-300 hover:text-blue-600 disabled:opacity-50 transition-colors"
              >
                {isLoading ? (
                  <Loader2 size={11} className="animate-spin" />
                ) : (
                  <RefreshCw size={11} />
                )}
                Sync
              </button>
            </div>
            {error && (
              <p className="mt-2 rounded bg-red-50 px-2 py-1 text-[10px] text-red-600">
                {error}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

function KeywordsPanel({
  keywords,
  newKeyword,
  newTag,
  addingKeyword,
  removingId,
  error,
  onNewKeywordChange,
  onNewTagChange,
  onAdd,
  onRemove,
}: {
  keywords: ManagedKeyword[];
  newKeyword: string;
  newTag: string;
  addingKeyword: boolean;
  removingId: number | null;
  error: string | null;
  onNewKeywordChange: (v: string) => void;
  onNewTagChange: (v: string) => void;
  onAdd: () => void;
  onRemove: (id: number) => void;
}) {
  return (
    <div className="p-4 space-y-4">
      <p className="text-xs text-gray-400">
        Track keyword rankings in the report. Data updates each time you sync Search Console.
      </p>
      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>
      )}

      {/* Add keyword form */}
      <div className="space-y-2">
        <input
          type="text"
          value={newKeyword}
          onChange={(e) => onNewKeywordChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onAdd()}
          placeholder="e.g. veterinary clinic near me"
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-800 placeholder-gray-400 focus:border-blue-400 focus:outline-none"
        />
        <div className="flex gap-2">
          <input
            type="text"
            value={newTag}
            onChange={(e) => onNewTagChange(e.target.value)}
            placeholder="Tag (optional)"
            className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-800 placeholder-gray-400 focus:border-blue-400 focus:outline-none"
          />
          <button
            type="button"
            onClick={onAdd}
            disabled={!newKeyword.trim() || addingKeyword}
            className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white disabled:opacity-50 hover:bg-blue-700 transition-colors"
          >
            {addingKeyword ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}
            Add
          </button>
        </div>
      </div>

      {/* Keyword list */}
      {keywords.length === 0 ? (
        <p className="text-center text-xs text-gray-400 py-6">No keywords tracked yet.</p>
      ) : (
        <div className="space-y-1">
          {keywords.map((kw) => (
            <div
              key={kw.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2"
            >
              <div className="min-w-0">
                <p className="text-xs font-medium text-gray-800 truncate">{kw.keyword}</p>
                {kw.tag && (
                  <p className="text-[10px] text-gray-400">{kw.tag}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => onRemove(kw.id)}
                disabled={removingId === kw.id}
                className="shrink-0 text-gray-300 hover:text-red-400 disabled:opacity-50 transition-colors"
              >
                {removingId === kw.id ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <Trash2 size={12} />
                )}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function NarrativePanel({
  windowLabel,
  narrative,
  sectionComments,
  visibleSectionKeys,
  savingDraft,
  generatingIntro,
  onWindowLabelChange,
  onNarrativeChange,
  onSectionCommentChange,
  onSave,
  onGenerateIntro,
}: {
  windowLabel: string;
  narrative: string;
  sectionComments: Record<string, string>;
  visibleSectionKeys: string[];
  savingDraft: boolean;
  generatingIntro: boolean;
  onWindowLabelChange: (v: string) => void;
  onNarrativeChange: (v: string) => void;
  onSectionCommentChange: (key: string, val: string) => void;
  onSave: () => void;
  onGenerateIntro: () => void;
}) {
  const windowOptions = [
    "Last 7 days",
    "Last 30 days",
    "Last 90 days",
    "Last 3 months",
    "Last 6 months",
  ];

  return (
    <div className="p-4 space-y-5">
      {/* Reporting window */}
      <div>
        <label className="block text-[10px] font-medium uppercase tracking-wider text-gray-400 mb-1.5">
          Reporting Window
        </label>
        <select
          value={windowLabel}
          onChange={(e) => onWindowLabelChange(e.target.value)}
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-800 focus:border-blue-400 focus:outline-none"
        >
          {windowOptions.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
          {!windowOptions.includes(windowLabel) && (
            <option value={windowLabel}>{windowLabel}</option>
          )}
        </select>
      </div>

      {/* Strategist intro */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="block text-[10px] font-medium uppercase tracking-wider text-gray-400">
            Strategist Intro
          </label>
          <button
            type="button"
            onClick={onGenerateIntro}
            disabled={generatingIntro}
            className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1 text-[10px] font-medium text-gray-500 hover:border-blue-300 hover:text-blue-600 disabled:opacity-50 transition-colors"
          >
            {generatingIntro ? (
              <Loader2 size={10} className="animate-spin" />
            ) : (
              <Sparkles size={10} />
            )}
            Generate
          </button>
        </div>
        <textarea
          value={narrative}
          onChange={(e) => onNarrativeChange(e.target.value)}
          rows={5}
          placeholder="Write a brief note to your client about this reporting period…"
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-800 placeholder-gray-400 focus:border-blue-400 focus:outline-none resize-none"
        />
      </div>

      {/* Per-section comments */}
      {visibleSectionKeys.length > 0 && (
        <div className="space-y-3">
          <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400">
            Section Notes
          </p>
          {visibleSectionKeys.map((key) => (
            <div key={key}>
              <label className="block text-[10px] text-gray-500 mb-1">
                {SECTION_LABELS[key] ?? key}
              </label>
              <textarea
                value={sectionComments[key] ?? ""}
                onChange={(e) => onSectionCommentChange(key, e.target.value)}
                rows={2}
                placeholder="Add a note below this section…"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-800 placeholder-gray-400 focus:border-blue-400 focus:outline-none resize-none"
              />
            </div>
          ))}
        </div>
      )}

      {/* Save button */}
      <button
        type="button"
        onClick={onSave}
        disabled={savingDraft}
        className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2.5 text-xs font-medium text-white disabled:opacity-50 hover:bg-blue-700 transition-colors"
      >
        {savingDraft ? (
          <Loader2 size={12} className="animate-spin" />
        ) : (
          <Save size={12} />
        )}
        Save Narrative
      </button>
    </div>
  );
}
