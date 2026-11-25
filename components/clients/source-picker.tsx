"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Loader, RefreshCw, Search } from "lucide-react";
import { SOURCE_LABELS, type SourceKey, type SourceOption, type StoredStatus } from "@/lib/connections/match";

/**
 * Pick a client's Search Console site, GA4 property or Google Ads account from
 * what the agency's own access can read, instead of typing IDs. When what
 * they want isn't listed, it says exactly what to ask the practice for.
 */

type Listing = {
  stored: string | null;
  status: StoredStatus;
  suggested: string[];
  options: SourceOption[];
  failures: string[];
  grantAccess: string;
};

const SOURCES: SourceKey[] = ["search_console", "ga4", "ads"];

/** The list shows this many at once; typing narrows it. */
const SHOWN = 40;

function statusLine(status: StoredStatus, byValue: Map<string, SourceOption>, source: SourceKey) {
  const name = (value: string) => byValue.get(value)?.label ?? value;
  switch (status.state) {
    case "not_set":
      return { tone: "muted", text: "Not connected." };
    case "invalid":
      return {
        tone: "warn",
        text:
          source === "ga4" && /^G-/i.test(status.stored)
            ? `${status.stored} is the website's measurement ID, not its GA4 property. Choose the property below.`
            : `The saved value "${status.stored}" can't be used. Choose one below.`,
      };
    case "readable":
      return { tone: "good", text: `Connected to ${name(status.value)}. Readable by ${status.readableBy.join(" and ")}.` };
    case "listed_not_usable":
      return { tone: "warn", text: `Connected to ${name(status.value)}, but our access there can't read its data yet.` };
    case "not_readable":
      return { tone: "warn", text: `Saved as ${status.value}, but none of our access can read it.` };
  }
}

const TONE: Record<string, string> = {
  muted: "text-bip-muted",
  good: "text-green-400",
  warn: "text-[var(--warning-fg)]",
};

function SourceRow({ clientId, source, onSaved }: { clientId: number; source: SourceKey; onSaved?: () => void }) {
  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const fetchListing = useCallback(async (): Promise<Listing> => {
    const res = await fetch(`/api/clients/${clientId}/connections?source=${source}`, { cache: "no-store" });
    const json = (await res.json().catch(() => ({}))) as Listing & { error?: string };
    if (!res.ok) throw new Error(json.error ?? "Couldn't check access");
    return json;
  }, [clientId, source]);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      setListing(await fetchListing());
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Couldn't check access");
    } finally {
      setLoading(false);
    }
  }, [fetchListing]);

  // First check on open. State changes only once the answer is in.
  useEffect(() => {
    let cancelled = false;
    fetchListing()
      .then((result) => {
        if (!cancelled) setListing(result);
      })
      .catch((error: unknown) => {
        if (!cancelled) setLoadError(error instanceof Error ? error.message : "Couldn't check access");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fetchListing]);

  async function connect(value: string) {
    setSaving(value);
    setSaveError(null);
    try {
      const res = await fetch(`/api/clients/${clientId}/connections`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source, value }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Couldn't save");
      setOpen(false);
      setQuery("");
      await load();
      onSaved?.();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Couldn't save");
    } finally {
      setSaving(null);
    }
  }

  const byValue = useMemo(() => new Map((listing?.options ?? []).map((o) => [o.value, o])), [listing]);
  const suggested = useMemo(
    () => (listing?.suggested ?? []).map((value) => byValue.get(value)).filter((o): o is SourceOption => Boolean(o)),
    [listing, byValue],
  );
  const matching = useMemo(() => {
    const q = query.trim().toLowerCase();
    const all = listing?.options ?? [];
    return q ? all.filter((o) => `${o.label} ${o.detail ?? ""} ${o.value}`.toLowerCase().includes(q)) : all;
  }, [listing, query]);

  const line = listing ? statusLine(listing.status, byValue, source) : null;
  const needsAccess = listing && ["not_readable", "listed_not_usable"].includes(listing.status.state);

  const currentValue = listing && "value" in listing.status ? listing.status.value : null;
  const optionRow = (option: SourceOption) => {
    const current = currentValue === option.value;
    return (
      <li key={option.value} className="flex items-center justify-between gap-3 py-1.5">
        <div className="min-w-0">
          <p className="truncate text-xs text-bip-text">{option.label}</p>
          <p className="truncate text-[0.65rem] text-bip-subtle">
            {[option.detail, option.usable ? null : "listed, but our access can't read its data"].filter(Boolean).join(" · ")}
          </p>
        </div>
        {current ? (
          <span className="inline-flex items-center gap-1 text-[0.65rem] text-green-400"><Check size={11} /> Connected</span>
        ) : (
          <button
            type="button"
            onClick={() => void connect(option.value)}
            disabled={saving !== null}
            className="shrink-0 rounded border border-bip-accent/40 bg-bip-accent/10 px-2 py-1 text-[0.65rem] font-medium text-bip-accent hover:bg-bip-accent/20 disabled:opacity-40"
          >
            {saving === option.value ? "Saving…" : "Connect"}
          </button>
        )}
      </li>
    );
  };

  return (
    <div className="border-b border-bip-border py-3 last:border-0">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-medium text-bip-text">{SOURCE_LABELS[source]}</p>
          {loading && !listing ? (
            <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-bip-muted"><Loader size={11} className="animate-spin" /> Checking our access…</p>
          ) : loadError ? (
            <p className="mt-0.5 text-xs text-red-400">{loadError}</p>
          ) : line ? (
            <p className={`mt-0.5 text-xs ${TONE[line.tone]}`}>{line.text}</p>
          ) : null}
          {needsAccess && listing && <p className="mt-1 text-xs text-bip-muted">{listing.grantAccess}</p>}
          {listing?.failures.map((failure) => (
            <p key={failure} className="mt-1 text-[0.65rem] text-[var(--warning-fg)]">{failure}</p>
          ))}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            title="Check our access again"
            className="inline-flex items-center gap-1 rounded-lg border border-bip-border px-2.5 py-1.5 text-xs text-bip-muted hover:text-bip-text disabled:opacity-40"
          >
            <RefreshCw size={11} className={loading ? "animate-spin" : ""} /> Check
          </button>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            disabled={!listing}
            className="rounded-lg border border-bip-border px-2.5 py-1.5 text-xs text-bip-muted hover:text-bip-text disabled:opacity-40"
          >
            {open ? "Close" : "Choose"}
          </button>
        </div>
      </div>

      {open && listing && (
        <div className="mt-3 rounded-lg border border-bip-border bg-bip-hover/40 p-3">
          {saveError && <p className="mb-2 text-xs text-red-400">{saveError}</p>}
          {suggested.length > 0 && (
            <>
              <p className="text-[0.65rem] uppercase tracking-wide text-bip-subtle">Looks like this client</p>
              <ul className="mb-3">{suggested.map(optionRow)}</ul>
            </>
          )}
          <div className="mb-1 flex items-center gap-2">
            <Search size={12} className="text-bip-subtle" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search all ${listing.options.length}`}
              className="flex-1 rounded border border-bip-border bg-bip-hover px-2 py-1 text-xs text-bip-text focus:border-bip-accent/50 focus:outline-none"
            />
          </div>
          {matching.length === 0 ? (
            <p className="py-2 text-xs text-bip-muted">Nothing our access can read matches.</p>
          ) : (
            <ul className="max-h-72 overflow-y-auto">{matching.slice(0, SHOWN).map(optionRow)}</ul>
          )}
          {matching.length > SHOWN && (
            <p className="pt-1 text-[0.65rem] text-bip-subtle">Showing {SHOWN} of {matching.length}. Type to narrow the list.</p>
          )}
          <p className="mt-2 border-t border-bip-border pt-2 text-xs text-bip-muted">
            Not listed? {listing.grantAccess} Then press Check.
          </p>
        </div>
      )}
    </div>
  );
}

export default function SourcePicker({ clientId, onSaved }: { clientId: number; onSaved?: () => void }) {
  return (
    <div className="bip-card p-5">
      <p className="bip-section-label mb-1">Data sources</p>
      <p className="mb-2 text-xs text-bip-subtle">Choose from what the agency&apos;s Google access can already read.</p>
      {SOURCES.map((source) => (
        <SourceRow key={source} clientId={clientId} source={source} onSaved={onSaved} />
      ))}
    </div>
  );
}
