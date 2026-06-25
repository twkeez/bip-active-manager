"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Sparkles, Trophy, Copy, Check, RefreshCw } from "lucide-react";
import type {
  DraftedPlatformPosts,
  SocialPlatform,
  Win,
  WinSource,
} from "@/lib/wins/types";

const SOURCE_LABELS: Record<WinSource, string> = {
  ads: "Google Ads",
  organic: "Organic & traffic",
  social: "Social",
};

const PLATFORM_LABELS: Record<SocialPlatform, string> = {
  linkedin: "LinkedIn",
  facebook: "Facebook",
  instagram: "Instagram",
};

const ALL_PLATFORMS: SocialPlatform[] = ["linkedin", "facebook", "instagram"];

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="inline-flex items-center gap-1 rounded-md border border-bip-border px-2 py-1 text-[11px] text-bip-text hover:bg-bip-fill"
    >
      {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

export default function WinsStudio() {
  const [wins, setWins] = useState<Win[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [named, setNamed] = useState<Set<string>>(new Set());
  const [platforms, setPlatforms] = useState<Set<SocialPlatform>>(new Set(ALL_PLATFORMS));
  const [drafting, setDrafting] = useState(false);
  const [posts, setPosts] = useState<DraftedPlatformPosts[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/wins", { cache: "no-store" });
      const payload = (await res.json()) as { error?: string; wins?: Win[] };
      if (!res.ok) throw new Error(payload.error ?? "Failed to load wins");
      setWins(payload.wins ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load wins");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const grouped = useMemo(() => {
    const groups: Record<WinSource, Win[]> = { ads: [], organic: [], social: [] };
    for (const w of wins) groups[w.source]?.push(w);
    return groups;
  }, [wins]);

  function toggle(set: Set<string>, setter: (s: Set<string>) => void, id: string) {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setter(next);
  }

  function togglePlatform(p: SocialPlatform) {
    const next = new Set(platforms);
    if (next.has(p)) next.delete(p);
    else next.add(p);
    setPlatforms(next);
  }

  async function draft() {
    if (drafting) return;
    const chosen = wins.filter((w) => selected.has(w.id));
    if (!chosen.length || !platforms.size) return;
    setDrafting(true);
    setError(null);
    setPosts([]);
    try {
      const res = await fetch("/api/wins/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wins: chosen.map((w) => ({ win: w, use_name: named.has(w.id) })),
          platforms: [...platforms],
        }),
      });
      const payload = (await res.json()) as { error?: string; posts?: DraftedPlatformPosts[] };
      if (!res.ok) throw new Error(payload.error ?? "Failed to draft posts");
      setPosts(payload.posts ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to draft posts");
    } finally {
      setDrafting(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-amber-400" />
            <h1 className="text-xl font-semibold text-bip-text">Wins</h1>
          </div>
          <p className="mt-1 text-sm text-bip-muted">
            Brag-worthy client results mined from your data. Pick the ones to feature, then draft
            anonymized social posts. Client names are shown here for your reference only.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-lg border border-bip-border bg-bip-card/50 px-3 py-2 text-xs font-medium text-bip-text hover:bg-bip-fill disabled:opacity-60"
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Refresh
        </button>
      </div>

      {error && (
        <p className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {error}
        </p>
      )}

      {loading && (
        <p className="mt-6 text-sm text-bip-muted">Scanning client data for wins…</p>
      )}

      {!loading && wins.length === 0 && !error && (
        <p className="mt-6 text-sm text-bip-muted">
          No standout wins found right now. Sync more client data and check back.
        </p>
      )}

      {!loading && wins.length > 0 && (
        <div className="mt-5 grid gap-5 lg:grid-cols-[1.4fr_1fr]">
          {/* Wins list */}
          <div className="space-y-5">
            {(Object.keys(grouped) as WinSource[]).map((source) =>
              grouped[source].length === 0 ? null : (
                <div key={source}>
                  <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-bip-muted">
                    {SOURCE_LABELS[source]} · {grouped[source].length}
                  </h2>
                  <ul className="space-y-2">
                    {grouped[source].map((w) => {
                      const isSel = selected.has(w.id);
                      return (
                        <li
                          key={w.id}
                          className={`rounded-lg border p-3 transition ${isSel ? "border-bip-accent/50 bg-bip-accent/5" : "border-bip-border bg-bip-card/50"}`}
                        >
                          <div className="flex items-start gap-3">
                            <input
                              type="checkbox"
                              checked={isSel}
                              onChange={() => toggle(selected, setSelected, w.id)}
                              className="mt-1 h-4 w-4 shrink-0 accent-bip-accent"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="rounded-full border border-bip-border bg-bip-card px-2 py-0.5 text-[10px] uppercase tracking-wide text-bip-muted">
                                  {w.channel_label}
                                </span>
                                <span className="text-sm font-semibold text-bip-text">
                                  {w.metric_label}: {w.metric_value}
                                </span>
                              </div>
                              <p className="mt-1 text-xs text-bip-muted">{w.context}</p>
                              <label className="mt-1.5 inline-flex items-center gap-1.5 text-[11px] text-bip-muted">
                                <input
                                  type="checkbox"
                                  checked={named.has(w.id)}
                                  onChange={() => toggle(named, setNamed, w.id)}
                                  className="h-3 w-3 accent-bip-accent"
                                />
                                Name {w.client_name} in the post
                              </label>
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ),
            )}
          </div>

          {/* Draft controls + output */}
          <div className="space-y-4">
            <div className="sticky top-4 rounded-xl border border-bip-border bg-bip-card/60 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-bip-muted">Draft posts</p>
              <p className="mt-1 text-[11px] text-bip-muted">
                {selected.size} win{selected.size === 1 ? "" : "s"} selected
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {ALL_PLATFORMS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => togglePlatform(p)}
                    className={`rounded-full border px-2.5 py-1 text-[11px] ${platforms.has(p) ? "border-bip-accent/50 bg-bip-accent/10 text-bip-text" : "border-bip-border bg-bip-card/60 text-bip-muted"}`}
                  >
                    {PLATFORM_LABELS[p]}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => void draft()}
                disabled={drafting || selected.size === 0 || platforms.size === 0}
                className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-bip-accent px-3 py-2 text-xs font-medium text-bip-text transition hover:opacity-90 disabled:opacity-50"
              >
                {drafting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                {drafting ? "Drafting…" : "Draft social posts"}
              </button>
            </div>

            {posts.length > 0 && (
              <div className="space-y-3">
                {posts.map((pp) => (
                  <div key={pp.platform} className="rounded-xl border border-bip-border bg-bip-card/50 p-4">
                    <p className="mb-2 text-xs font-semibold text-bip-text">{PLATFORM_LABELS[pp.platform]}</p>
                    <div className="space-y-3">
                      {pp.variants.map((v, i) => {
                        const full = v.hashtags?.length ? `${v.text}\n\n${v.hashtags.join(" ")}` : v.text;
                        return (
                          <div key={i} className="rounded-lg border border-bip-border bg-bip-page p-3">
                            <p className="whitespace-pre-wrap text-xs text-bip-text">{v.text}</p>
                            {v.hashtags?.length > 0 && (
                              <p className="mt-2 text-[11px] text-bip-accent">{v.hashtags.join(" ")}</p>
                            )}
                            <div className="mt-2 flex justify-end">
                              <CopyButton text={full} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
