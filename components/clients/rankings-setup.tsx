"use client";

// Moved from the old Cockpit screen (parked): the client's tracked keywords
// and the extra ZIP-code locations the monthly organic rankings scan checks.
import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { seoKeywordAllowance } from "@/lib/playbook/client-tiers";
import type { ClientRow } from "@/lib/types/client";

type TrackedKeyword = { id: number; keyword: string };

type OrganicRank = {
  keyword: string;
  location: string;
  position: number | null;
  url: string | null;
  topDomain: string | null;
  checkedAt: string;
  delta: number | null;
};

type OrganicLocation = { id: number; zip: string; label: string };

const JSON_HEADERS = { "Content-Type": "application/json" };

export default function RankingsSetup({ client }: { client: ClientRow }) {
  const allowance = seoKeywordAllowance(client);
  const [rows, setRows] = useState<TrackedKeyword[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [organic, setOrganic] = useState<OrganicRank[]>([]);
  const [locations, setLocations] = useState<OrganicLocation[]>([]);
  const [suggestedZips, setSuggestedZips] = useState<string[]>([]);
  const [zipDraft, setZipDraft] = useState("");
  const [scanning, setScanning] = useState(false);

  const loadOrganic = useCallback(async () => {
    try {
      const res = await fetch(`/api/organic-rank?clientId=${client.id}`);
      const data = (await res.json()) as { results?: OrganicRank[] };
      setOrganic(data.results ?? []);
    } catch {
      /* non-fatal — the section still shows tracked keywords */
    }
  }, [client.id]);

  // First load. Written out rather than calling loadOrganic, so state
  // is only ever set once a response arrives (loadOrganic is for refreshes).
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/organic-rank?clientId=${client.id}`)
      .then((res) => res.json())
      .then((data: { results?: OrganicRank[] }) => {
        if (!cancelled) setOrganic(data.results ?? []);
      })
      .catch(() => {
        /* non-fatal — the section still shows tracked keywords */
      });
    Promise.all([
      fetch(`/api/organic-rank/locations?clientId=${client.id}`).then((r) => r.json()),
      fetch(`/api/organic-rank/suggest-locations?clientId=${client.id}`).then((r) => r.json()),
    ])
      .then(([locRes, sugRes]) => {
        if (cancelled) return;
        setLocations((locRes as { locations?: OrganicLocation[] }).locations ?? []);
        setSuggestedZips((sugRes as { zips?: string[] }).zips ?? []);
      })
      .catch(() => {
        /* non-fatal */
      });
    return () => {
      cancelled = true;
    };
  }, [client.id]);

  async function addLocation(zip: string) {
    const z = zip.trim();
    if (!z) return;
    try {
      const res = await fetch("/api/organic-rank/locations", {
        method: "PUT",
        headers: JSON_HEADERS,
        body: JSON.stringify({ clientId: client.id, add: { zip: z } }),
      });
      const data = (await res.json()) as { locations?: OrganicLocation[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to add location");
      setLocations(data.locations ?? []);
      setZipDraft("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add location");
    }
  }

  async function removeLocation(id: number) {
    try {
      const res = await fetch("/api/organic-rank/locations", {
        method: "PUT",
        headers: JSON_HEADERS,
        body: JSON.stringify({ clientId: client.id, deleteId: id }),
      });
      const data = (await res.json()) as { locations?: OrganicLocation[] };
      setLocations(data.locations ?? []);
    } catch {
      /* non-fatal */
    }
  }

  async function runOrganicScan() {
    if (scanning) return;
    setScanning(true);
    setError(null);
    try {
      const res = await fetch("/api/organic-rank/scan", {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({ clientId: client.id }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Scan failed");
      await loadOrganic();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Organic rank scan failed");
    } finally {
      setScanning(false);
    }
  }

  // Load current keywords and, for a Premium+ client with none, auto-seed the
  // tier defaults. The POST route handles both (seeding is idempotent).
  useEffect(() => {
    let cancelled = false;
    fetch("/api/reporting/keywords", {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({ clientId: client.id }),
    })
      .then((res) => res.json())
      .then((data: { rows?: TrackedKeyword[] }) => {
        if (!cancelled) setRows(data.rows ?? []);
      })
      .catch(() => {
        if (!cancelled) setError("Failed to load keywords");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [client.id]);

  const atCap = rows.length >= allowance;

  async function addKeyword(keyword: string) {
    const kw = keyword.trim();
    if (!kw || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/reporting/keywords", {
        method: "PUT",
        headers: JSON_HEADERS,
        body: JSON.stringify({ clientId: client.id, upserts: [{ keyword: kw }] }),
      });
      const data = (await res.json()) as { rows?: TrackedKeyword[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to add keyword");
      setRows(data.rows ?? []);
      setDraft("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add keyword");
    } finally {
      setBusy(false);
    }
  }

  async function removeKeyword(id: number) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/reporting/keywords", {
        method: "PUT",
        headers: JSON_HEADERS,
        body: JSON.stringify({ clientId: client.id, deleteIds: [id] }),
      });
      const data = (await res.json()) as { rows?: TrackedKeyword[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to remove keyword");
      setRows(data.rows ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to remove keyword");
    } finally {
      setBusy(false);
    }
  }

  const cityKeyword = (client.city ?? "").trim() ? `veterinarian in ${client.city!.trim()}` : null;
  const showCitySuggestion =
    cityKeyword != null &&
    !atCap &&
    !rows.some((r) => r.keyword.trim().toLowerCase() === cityKeyword.toLowerCase());

  const organicByKeyword = new Map<string, OrganicRank[]>();
  for (const r of organic) {
    const k = r.keyword.trim().toLowerCase();
    const arr = organicByKeyword.get(k) ?? [];
    arr.push(r);
    organicByKeyword.set(k, arr);
  }
  const savedZipSet = new Set(locations.map((l) => l.zip));
  const newSuggestions = suggestedZips.filter((z) => !savedZipSet.has(z));

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-bip-subtle">Tracked Keywords</p>
        {allowance > 0 && (
          <span className="text-[10px] font-medium text-bip-subtle">
            {rows.length} of {allowance} used
          </span>
        )}
      </div>

      {allowance === 0 ? (
        <p className="text-xs text-bip-subtle">
          Keyword tracking is a Premium feature — upgrade the SEO tier to track keywords.
        </p>
      ) : (
        <>
          <div className="flex gap-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") addKeyword(draft);
              }}
              disabled={atCap || busy}
              placeholder={atCap ? "Keyword limit reached" : "Add keyword phrase…"}
              className="min-w-0 flex-1 rounded-lg border border-bip-border bg-bip-card px-3 py-2 text-sm text-bip-text placeholder-bip-subtle focus:border-bip-accent focus:outline-none focus:ring-1 focus:ring-bip-accent/30 disabled:opacity-60"
            />
            <button
              type="button"
              onClick={() => addKeyword(draft)}
              disabled={atCap || busy || draft.trim().length === 0}
              className="shrink-0 rounded-lg border border-bip-border bg-bip-card px-3 py-2 text-xs font-medium text-bip-muted hover:border-bip-border hover:text-bip-text disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Add
            </button>
          </div>

          {showCitySuggestion && (
            <button
              type="button"
              onClick={() => addKeyword(cityKeyword)}
              disabled={busy}
              className="mt-2 inline-flex items-center gap-1 rounded-full border border-dashed border-bip-accent/40 px-2.5 py-1 text-xs font-medium text-bip-accent hover:bg-bip-accent/10 disabled:opacity-50 transition-colors"
            >
              + Add “{cityKeyword}”
            </button>
          )}

          {error && <p className="mt-1.5 text-[11px] font-medium text-red-600">{error}</p>}

          {loading ? (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-bip-subtle">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading keywords…
            </p>
          ) : rows.length > 0 ? (
            <ul className="mt-2 space-y-1">
              {rows.map((row) => {
                const kwResults = [...(organicByKeyword.get(row.keyword.trim().toLowerCase()) ?? [])].sort(
                  (a, b) => (a.location === "Practice" ? -1 : b.location === "Practice" ? 1 : a.location.localeCompare(b.location)),
                );
                return (
                  <li key={row.id} className="rounded-lg border border-bip-border px-2.5 py-1.5 text-sm text-bip-text">
                    <div className="flex items-center gap-2">
                      <span className="min-w-0 flex-1 truncate">{row.keyword}</span>
                      <button
                        type="button"
                        onClick={() => removeKeyword(row.id)}
                        disabled={busy}
                        className="shrink-0 text-xs text-bip-subtle hover:text-red-600 disabled:opacity-50"
                      >
                        Remove
                      </button>
                    </div>
                    {kwResults.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px]" title="Organic (blue-link) rank by location">
                        {kwResults.map((o) => (
                          <span key={o.location} className="inline-flex items-center gap-1">
                            <span className="text-bip-subtle">{o.location}</span>
                            <span className={o.position == null ? "text-bip-subtle" : "font-medium text-bip-text"}>
                              {o.position == null ? "—" : `#${o.position}`}
                            </span>
                            {o.delta != null && o.delta !== 0 && (
                              <span className={o.delta > 0 ? "text-emerald-600" : "text-red-500"}>
                                {o.delta > 0 ? `▲${o.delta}` : `▼${Math.abs(o.delta)}`}
                              </span>
                            )}
                          </span>
                        ))}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-2 text-xs text-bip-subtle">No tracked keywords yet.</p>
          )}

          {rows.length > 0 && (
            <div className="mt-3 rounded-lg border border-bip-border bg-bip-fill px-3 py-2">
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-bip-subtle">
                Organic rank locations
              </p>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="inline-flex items-center rounded-full bg-bip-card px-2 py-0.5 text-[11px] font-medium text-bip-muted ring-1 ring-bip-border">
                  Practice
                </span>
                {locations.map((loc) => (
                  <span key={loc.id} className="inline-flex items-center gap-1 rounded-full bg-bip-card px-2 py-0.5 text-[11px] text-bip-text ring-1 ring-bip-border">
                    {loc.label}
                    <button type="button" onClick={() => removeLocation(loc.id)} className="text-bip-subtle hover:text-red-600" aria-label={`Remove ${loc.label}`}>
                      ×
                    </button>
                  </span>
                ))}
                <input
                  value={zipDraft}
                  onChange={(e) => setZipDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") addLocation(zipDraft);
                  }}
                  placeholder="Add ZIP…"
                  className="w-24 rounded-lg border border-bip-border bg-bip-card px-2 py-1 text-xs text-bip-text placeholder-bip-subtle focus:border-bip-accent focus:outline-none"
                />
              </div>
              {newSuggestions.length > 0 && (
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] text-bip-subtle">Suggested:</span>
                  {newSuggestions.map((z) => (
                    <button
                      key={z}
                      type="button"
                      onClick={() => addLocation(z)}
                      className="inline-flex items-center gap-1 rounded-full border border-dashed border-bip-accent/40 px-2 py-0.5 text-[11px] font-medium text-bip-accent hover:bg-bip-accent/10"
                    >
                      + {z}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {rows.length > 0 && (
            <div className="mt-2 flex items-center justify-between">
              <button
                type="button"
                onClick={runOrganicScan}
                disabled={scanning}
                className="inline-flex items-center gap-1 rounded-lg border border-bip-border bg-bip-card px-2.5 py-1 text-xs font-medium text-bip-muted hover:border-bip-border hover:text-bip-text disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {scanning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                {scanning ? "Checking…" : "Check organic rankings"}
              </button>
              <span className="text-[10px] text-bip-subtle">Organic blue-link position by location</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
