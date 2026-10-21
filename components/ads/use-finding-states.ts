"use client";
import { useCallback, useEffect, useState } from "react";
import type { FindingState, FindingStateRow, FindingTool } from "@/lib/ads/finding-states";

/**
 * Saved decisions about one page's ads findings (Mute, Flag, Dismiss,
 * Snooze). Changes show at once and are saved for the whole team; a failed
 * save is undone on screen and reported in `error`, never left looking saved.
 */
export function useFindingStates(tool: FindingTool) {
  const [rows, setRows] = useState<FindingStateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/ads/finding-states?tool=${tool}`)
      .then(async (response) => {
        const payload = (await response.json().catch(() => ({}))) as { states?: FindingStateRow[]; error?: string };
        if (!response.ok) throw new Error(payload.error ?? "Could not load saved decisions");
        if (!cancelled) setRows(payload.states ?? []);
      })
      .catch((loadError: unknown) => {
        if (!cancelled)
          setError(
            `Saved mutes and flags couldn't be loaded, so everything is shown: ${
              loadError instanceof Error ? loadError.message : "unknown error"
            }`,
          );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tool]);

  const has = useCallback(
    (findingKey: string, state: FindingState) => rows.some((row) => row.finding_key === findingKey && row.state === state),
    [rows],
  );

  const rowFor = useCallback(
    (findingKey: string, state: FindingState) => rows.find((row) => row.finding_key === findingKey && row.state === state),
    [rows],
  );

  const set = useCallback(
    async (findingKey: string, clientId: number | null, state: FindingState) => {
      const optimistic: FindingStateRow = {
        finding_key: findingKey,
        client_id: clientId,
        state,
        snoozed_until: null,
        set_by: null,
        created_at: new Date().toISOString(),
      };
      setRows((current) => [...current.filter((row) => !(row.finding_key === findingKey && row.state === state)), optimistic]);
      setError(null);
      try {
        const response = await fetch("/api/ads/finding-states", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tool, findingKey, clientId, state }),
        });
        const payload = (await response.json().catch(() => ({}))) as { state?: FindingStateRow; error?: string };
        if (!response.ok || !payload.state) throw new Error(payload.error ?? "Save failed");
        const saved = payload.state;
        setRows((current) => current.map((row) => (row === optimistic ? saved : row)));
      } catch (saveError) {
        setRows((current) => current.filter((row) => row !== optimistic));
        setError(`Not saved: ${saveError instanceof Error ? saveError.message : "unknown error"}. Try again.`);
      }
    },
    [tool],
  );

  const unset = useCallback(
    async (findingKey: string, state: FindingState) => {
      const removed = rows.filter((row) => row.finding_key === findingKey && row.state === state);
      setRows((current) => current.filter((row) => !(row.finding_key === findingKey && row.state === state)));
      setError(null);
      try {
        const response = await fetch("/api/ads/finding-states", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tool, findingKey, state }),
        });
        if (!response.ok) {
          const payload = (await response.json().catch(() => ({}))) as { error?: string };
          throw new Error(payload.error ?? "Undo failed");
        }
      } catch (undoError) {
        setRows((current) => [...current, ...removed]);
        setError(`Not undone: ${undoError instanceof Error ? undoError.message : "unknown error"}. Try again.`);
      }
    },
    [rows, tool],
  );

  return { rows, loading, error, has, rowFor, set, unset };
}
