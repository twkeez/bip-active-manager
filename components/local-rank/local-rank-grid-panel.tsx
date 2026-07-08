"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, MapPin } from "lucide-react";
import {
  ALLOWED_RADIUS_MILES,
  DEFAULT_GRID_SIZE,
  DEFAULT_RADIUS_MILES,
  MAX_KEYWORDS,
  MAX_GRID_POINTS,
} from "@/lib/local-rank/constants";
import { rankHeatClass, summarizeKeywordGrid, summarizeCompetitors } from "@/lib/local-rank/summary";
import { buildLocalRankTips } from "@/lib/local-rank/recommendations";
import type {
  LocalRankGridCellRow,
  LocalRankGridRunRow,
} from "@/lib/local-rank/types";
import type { ClientKeywordTarget } from "@/lib/types/client";

interface LocalRankGridPanelProps {
  clientId: number;
  clientName: string;
  keywordTargets?: ClientKeywordTarget[];
  googlePlaceId?: string | null;
  websiteUrl?: string | null;
}

function toggleKeywordSelection(selected: string[], keyword: string): string[] {
  const trimmed = keyword.trim();
  if (!trimmed) return selected;
  if (selected.includes(trimmed)) {
    return selected.filter((item) => item !== trimmed);
  }
  if (selected.length >= MAX_KEYWORDS) {
    return selected;
  }
  return [...selected, trimmed];
}

function HeatmapGrid({
  keyword,
  cells,
  gridSize,
}: {
  keyword: string;
  cells: LocalRankGridCellRow[];
  gridSize: number;
}) {
  const keywordCells = cells.filter((cell) => cell.keyword === keyword);
  const byPosition = new Map(
    keywordCells.map((cell) => [`${cell.row_idx}:${cell.col_idx}`, cell] as const),
  );

  return (
    <div
      className="grid gap-1"
      style={{ gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))` }}
    >
      {Array.from({ length: gridSize * gridSize }).map((_, index) => {
        const row = Math.floor(index / gridSize);
        const col = index % gridSize;
        const cell = byPosition.get(`${row}:${col}`);
        const center = Math.floor(gridSize / 2);
        const isPractice = row === center && col === center;
        return (
          <div
            key={`${keyword}-${row}-${col}`}
            title={
              isPractice
                ? `Practice location${cell ? ` — rank ${cell.rank ?? "not in pack"}` : ""}`
                : cell
                  ? `${cell.label} — rank ${cell.rank ?? "not in pack"} (${cell.lat.toFixed(4)}, ${cell.lng.toFixed(4)})`
                  : `${row + 1},${col + 1}`
            }
            className={`flex aspect-square items-center justify-center rounded text-[10px] font-semibold ${rankHeatClass(cell?.rank ?? null)} ${isPractice ? "ring-2 ring-white ring-offset-1 ring-offset-bip-page" : ""}`}
          >
            {cell?.rank ?? "—"}
          </div>
        );
      })}
    </div>
  );
}

export default function LocalRankGridPanel({
  clientId,
  clientName,
  keywordTargets = [],
  googlePlaceId = null,
  websiteUrl = null,
}: LocalRankGridPanelProps) {
  const [selectedKeywords, setSelectedKeywords] = useState<string[]>([]);
  const [customKeyword, setCustomKeyword] = useState("");
  const [mapKeyword, setMapKeyword] = useState<string>("");
  const [radiusMiles, setRadiusMiles] = useState<number>(DEFAULT_RADIUS_MILES);
  const [runs, setRuns] = useState<LocalRankGridRunRow[]>([]);
  const [activeRunId, setActiveRunId] = useState<number | null>(null);
  const [cells, setCells] = useState<LocalRankGridCellRow[]>([]);
  const [loadingRuns, setLoadingRuns] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const suggestedKeywords = useMemo(() => {
    const fromTargets = keywordTargets
      .filter((row) => row.is_active)
      .sort((left, right) => right.priority - left.priority)
      .map((row) => row.keyword.trim())
      .filter(Boolean);
    const defaults = ["veterinarian near me", `animal hospital ${clientName.split(" ")[0]}`];
    return [...new Set([...fromTargets, ...defaults])].slice(0, 8);
  }, [keywordTargets, clientName]);

  useEffect(() => {
    if (!selectedKeywords.length && suggestedKeywords.length) {
      setSelectedKeywords(suggestedKeywords.slice(0, Math.min(2, MAX_KEYWORDS)));
    }
  }, [selectedKeywords.length, suggestedKeywords]);

  const plannedCalls = selectedKeywords.length * MAX_GRID_POINTS;

  async function loadRuns(selectLatest = false) {
    setLoadingRuns(true);
    setError(null);
    try {
      const res = await fetch(`/api/local-rank/runs?clientId=${clientId}`);
      const payload = (await res.json()) as {
        runs?: LocalRankGridRunRow[];
        error?: string;
      };
      if (!res.ok) {
        throw new Error(payload.error ?? "Failed to load grid runs.");
      }
      const nextRuns = payload.runs ?? [];
      setRuns(nextRuns);
      if (selectLatest && nextRuns[0]) {
        await loadRunDetail(nextRuns[0].id);
      } else if (activeRunId) {
        await loadRunDetail(activeRunId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load grid runs.");
    } finally {
      setLoadingRuns(false);
    }
  }

  async function loadRunDetail(runId: number) {
    setError(null);
    try {
      const res = await fetch(`/api/local-rank/runs/${runId}`);
      const payload = (await res.json()) as {
        run?: LocalRankGridRunRow;
        cells?: LocalRankGridCellRow[];
        error?: string;
      };
      if (!res.ok) {
        throw new Error(payload.error ?? "Failed to load run detail.");
      }
      setActiveRunId(runId);
      setCells(payload.cells ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load run detail.");
    }
  }

  useEffect(() => {
    void loadRuns(Boolean(runs.length === 0));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  async function handleRunScan() {
    if (!selectedKeywords.length) {
      setError("Select at least one keyword.");
      return;
    }
    setScanning(true);
    setError(null);
    try {
      const res = await fetch("/api/local-rank/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          keywords: selectedKeywords,
          radiusMiles,
          gridSize: DEFAULT_GRID_SIZE,
        }),
      });
      const payload = (await res.json()) as {
        run?: LocalRankGridRunRow;
        cells?: LocalRankGridCellRow[];
        error?: string;
      };
      if (!res.ok) {
        throw new Error(payload.error ?? "Grid scan failed.");
      }
      if (payload.run) {
        setRuns((prev) => [payload.run!, ...prev.filter((row) => row.id !== payload.run!.id)]);
        setActiveRunId(payload.run.id);
        setCells(payload.cells ?? []);
      } else {
        await loadRuns(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Grid scan failed.");
    } finally {
      setScanning(false);
    }
  }

  const activeRun = runs.find((run) => run.id === activeRunId) ?? null;
  const keywordSummaries = useMemo(() => {
    if (!activeRun) return [];
    return activeRun.keywords.map((keyword) => summarizeKeywordGrid(keyword, cells));
  }, [activeRun, cells]);

  return (
    <section className="rounded-lg border border-bip-border bg-bip-card p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-bip-muted">
            Local Grid Rank
          </p>
          <p className="mt-1 text-xs text-bip-muted">
            5×5 neighborhood grid ({MAX_GRID_POINTS} points) · max {MAX_KEYWORDS} keywords ·{" "}
            {plannedCalls || 0} API calls planned
          </p>
        </div>
        {!googlePlaceId ? (
          <p className="inline-flex items-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[11px] text-amber-200">
            <MapPin className="h-3.5 w-3.5" />
            Add Google Place ID on client record for center geocoding
          </p>
        ) : null}
      </div>

      <div className="space-y-3">
        <div>
          <p className="mb-1.5 text-xs font-medium text-bip-text">Keywords (max {MAX_KEYWORDS})</p>
          <div className="flex flex-wrap gap-1.5">
            {suggestedKeywords.map((keyword) => {
              const selected = selectedKeywords.includes(keyword);
              return (
                <button
                  key={keyword}
                  type="button"
                  onClick={() => setSelectedKeywords(toggleKeywordSelection(selectedKeywords, keyword))}
                  className={`rounded-full border px-2.5 py-1 text-xs transition ${
                    selected
                      ? "border-bip-accent bg-bip-accent/15 text-bip-accent"
                      : "border-bip-border text-bip-muted hover:border-bip-border"
                  }`}
                >
                  {keyword}
                </button>
              );
            })}
          </div>
          <div className="mt-2 flex gap-2">
            <input
              value={customKeyword}
              onChange={(event) => setCustomKeyword(event.target.value)}
              placeholder='Custom keyword, e.g. "animal clinic Granite Bay"'
              className="w-full rounded-md border border-bip-border bg-bip-page px-2 py-1.5 text-xs text-bip-text"
            />
            <button
              type="button"
              onClick={() => {
                setSelectedKeywords(toggleKeywordSelection(selectedKeywords, customKeyword));
                setCustomKeyword("");
              }}
              className="shrink-0 rounded-md border border-bip-border px-2 py-1 text-xs text-bip-text hover:bg-bip-fill"
            >
              Add
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="text-xs text-bip-text">
            Radius
            <select
              value={radiusMiles}
              onChange={(event) => setRadiusMiles(Number(event.target.value))}
              className="ml-2 rounded-md border border-bip-border bg-bip-page px-2 py-1 text-xs text-bip-text"
            >
              {ALLOWED_RADIUS_MILES.map((value) => (
                <option key={value} value={value}>
                  {value} mi
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            onClick={() => void handleRunScan()}
            disabled={scanning || !selectedKeywords.length}
            className="inline-flex items-center gap-2 rounded-md bg-bip-accent px-3 py-1.5 text-xs font-medium text-bip-page disabled:opacity-60"
          >
            {scanning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Run Grid Scan
          </button>

          <button
            type="button"
            onClick={() => void loadRuns()}
            disabled={loadingRuns}
            className="rounded-md border border-bip-border px-2 py-1.5 text-xs text-bip-text hover:bg-bip-fill disabled:opacity-60"
          >
            Refresh history
          </button>
        </div>

        {runs.length > 0 ? (
          <label className="block text-xs text-bip-text">
            Previous runs
            <select
              value={activeRunId ?? ""}
              onChange={(event) => void loadRunDetail(Number(event.target.value))}
              className="mt-1 w-full rounded-md border border-bip-border bg-bip-page px-2 py-1.5 text-xs text-bip-text"
            >
              {runs.map((run) => (
                <option key={run.id} value={run.id}>
                  {new Date(run.created_at).toLocaleString()} — {run.status} —{" "}
                  {run.keywords.join(", ")}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {error ? (
          <p className="rounded-md border border-bip-danger/30 bg-bip-danger/10 px-3 py-2 text-xs text-bip-danger">
            {error}
          </p>
        ) : null}

        {activeRun && cells.length > 0 ? (
          <div className="space-y-4 border-t border-bip-border pt-4">
            {/* How to read the heat map */}
            <div className="rounded-md border border-bip-border bg-bip-card/50 px-3 py-2">
              <p className="text-xs text-bip-muted">
                Each square is a spot on the map around the practice (the ringed center square is the
                practice itself). The number is where the practice ranks in Google&apos;s local pack for
                someone searching from that spot — so you can see how visibility changes by area.
              </p>
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-bip-text">
                <span className="inline-flex items-center gap-1">
                  <span className="inline-block h-3 w-3 rounded-sm bg-emerald-600/80" /> #1–3 Top of pack
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="inline-block h-3 w-3 rounded-sm bg-amber-500/80" /> #4–10 Mid
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="inline-block h-3 w-3 rounded-sm bg-red-500/70" /> #11+ Low
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="inline-block h-3 w-3 rounded-sm bg-zinc-700/80" /> Not in pack
                </span>
              </div>
            </div>
            {/* Keyword selector — show one heat map at a time */}
            {keywordSummaries.length > 1 && (
              <div className="flex flex-wrap gap-1.5">
                {keywordSummaries.map((summary) => {
                  const isActive = (mapKeyword || keywordSummaries[0]?.keyword) === summary.keyword;
                  return (
                    <button
                      key={summary.keyword}
                      type="button"
                      onClick={() => setMapKeyword(summary.keyword)}
                      className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                        isActive
                          ? "border-bip-accent bg-bip-accent/10 text-bip-accent"
                          : "border-bip-border text-bip-muted hover:bg-bip-fill"
                      }`}
                    >
                      {summary.keyword}
                    </button>
                  );
                })}
              </div>
            )}

            {(() => {
              const summary =
                keywordSummaries.find((s) => s.keyword === mapKeyword) ?? keywordSummaries[0];
              if (!summary) return null;
              const competitors = summarizeCompetitors(cells, summary.keyword, clientName, websiteUrl).slice(0, 5);
              const tips = buildLocalRankTips(cells, [summary.keyword], clientName, websiteUrl);
              const dot = (p: string) =>
                p === "high" ? "bg-red-500" : p === "medium" ? "bg-amber-500" : "bg-emerald-500";
              return (
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium text-bip-text">{summary.keyword}</p>
                    <p className="text-xs text-bip-muted">
                      Avg rank {summary.avgRank ?? "—"} · Top 3 in {summary.topThreePct}% of cells ·{" "}
                      {summary.cellsInPack}/{MAX_GRID_POINTS} in pack
                    </p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {/* Real map with colored rank pins */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/api/local-rank/staticmap?runId=${activeRun.id}&keyword=${encodeURIComponent(summary.keyword)}`}
                      alt={`Local rank map for ${summary.keyword}`}
                      className="w-full rounded-md border border-bip-border"
                      loading="lazy"
                    />
                    <HeatmapGrid
                      keyword={summary.keyword}
                      cells={cells}
                      gridSize={activeRun.grid_size}
                    />
                  </div>

                  {competitors.length > 0 && (
                    <details className="rounded-md border border-bip-border bg-bip-card/50 px-3 py-2">
                      <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-wide text-bip-muted">
                        Outranking you ({competitors.length})
                      </summary>
                      <ul className="mt-2 space-y-0.5">
                        {competitors.map((c) => (
                          <li key={c.domain ?? c.title} className="flex items-center justify-between gap-2 text-xs">
                            <span className="truncate text-bip-text">{c.title}</span>
                            <span className="ml-2 shrink-0 text-bip-muted">
                              {c.areas}/{MAX_GRID_POINTS} areas
                              {c.reviewCount != null ? ` · ${c.reviewCount.toLocaleString()} reviews` : ""}
                              {c.rating != null ? ` · ${c.rating}★` : ""}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}

                  {tips.length > 0 && (
                    <details className="rounded-md border border-bip-border bg-bip-card/50 px-3 py-2" open>
                      <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-wide text-bip-muted">
                        How to outrank the competition ({tips.length})
                      </summary>
                      <ul className="mt-2 space-y-1.5">
                        {tips.map((tip, i) => (
                          <li key={i} className="flex items-start gap-2 text-xs text-bip-text">
                            <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${dot(tip.priority)}`} />
                            <span className="leading-snug">{tip.text}</span>
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
              );
            })()}
          </div>
        ) : null}
      </div>
    </section>
  );
}
