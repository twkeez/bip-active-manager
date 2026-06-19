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
import { rankHeatClass, summarizeKeywordGrid } from "@/lib/local-rank/summary";
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
        return (
          <div
            key={`${keyword}-${row}-${col}`}
            title={
              cell
                ? `${cell.label} — rank ${cell.rank ?? "not in pack"} (${cell.lat.toFixed(4)}, ${cell.lng.toFixed(4)})`
                : `${row + 1},${col + 1}`
            }
            className={`flex aspect-square items-center justify-center rounded text-[10px] font-semibold ${rankHeatClass(cell?.rank ?? null)}`}
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
}: LocalRankGridPanelProps) {
  const [selectedKeywords, setSelectedKeywords] = useState<string[]>([]);
  const [customKeyword, setCustomKeyword] = useState("");
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
            {keywordSummaries.map((summary) => (
              <div key={summary.keyword} className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-bip-text">{summary.keyword}</p>
                  <p className="text-xs text-bip-muted">
                    Avg rank {summary.avgRank ?? "—"} · Top 3 in {summary.topThreePct}% of cells ·{" "}
                    {summary.cellsInPack}/{MAX_GRID_POINTS} in pack
                  </p>
                </div>
                <HeatmapGrid
                  keyword={summary.keyword}
                  cells={cells}
                  gridSize={activeRun.grid_size}
                />
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
