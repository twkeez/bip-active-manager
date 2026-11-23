"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

const money = (usd: number) => (usd < 1 ? `${Math.round(usd * 100)}¢` : `$${usd.toFixed(2)}`);

/** "Run now" for a tracker: says what it costs, asks first, and reports how it went. */
export function RunNowButton({ trackerId, practice, costUsd }: { trackerId: number; practice: string; costUsd: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);
  const run = async () => {
    if (!window.confirm(`Run the Google Maps searches for ${practice} now?\n\nThis costs about ${money(costUsd)} in DataForSEO credits and takes about two minutes. It also runs by itself on schedule.`)) return;
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/maps-rank/trackers/${trackerId}/run`, { method: "POST" });
      const body = (await response.json().catch(() => null)) as { error?: string; run?: { status: string; error: string | null } } | null;
      if (!response.ok) setMessage({ tone: "bad", text: body?.error ?? `The scan failed (${response.status}).` });
      else if (body?.run?.status === "partial") setMessage({ tone: "bad", text: `Finished, but not everything could be read: ${body.run.error ?? ""}` });
      else setMessage({ tone: "ok", text: "Done. The new run is in the list below." });
      router.refresh();
    } catch {
      setMessage({ tone: "bad", text: "The scan didn't finish: the connection dropped or it ran out of time. Check the list below before running again." });
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex flex-col items-end gap-1">
      <button type="button" onClick={run} disabled={busy} className="rounded-md bg-bip-accent px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60">
        {busy ? "Searching… about two minutes" : `Run now · about ${money(costUsd)}`}
      </button>
      {message && <p className={`max-w-xs text-right text-xs ${message.tone === "ok" ? "text-emerald-300" : "text-red-300"}`}>{message.text}</p>}
    </div>
  );
}

/** Makes (or opens) the Google Doc version of one run's report. */
export function GoogleDocButton({ runId, docUrl, hasFolder }: { runId: number; docUrl: string | null; hasFolder: boolean }) {
  const [busy, setBusy] = useState(false);
  const [url, setUrl] = useState(docUrl);
  const [problem, setProblem] = useState<string | null>(null);
  if (url && !problem)
    return (
      <a href={url} target="_blank" rel="noreferrer" className="text-sm text-bip-accent underline">
        Open Google Doc
      </a>
    );
  const make = async () => {
    setBusy(true);
    setProblem(null);
    try {
      const response = await fetch(`/api/maps-rank/runs/${runId}/google-doc`, { method: "POST" });
      const body = (await response.json().catch(() => null)) as { url?: string; error?: string; warning?: string | null } | null;
      if (!response.ok || !body?.url) setProblem(body?.error ?? `Couldn't make the Google Doc (${response.status}).`);
      else {
        setUrl(body.url);
        if (body.warning) setProblem(body.warning);
        window.open(body.url, "_blank", "noopener");
      }
    } catch {
      setProblem("Couldn't make the Google Doc: the connection dropped.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <span className="inline-flex flex-col items-start gap-0.5">
      {url ? (
        <a href={url} target="_blank" rel="noreferrer" className="text-sm text-bip-accent underline">
          Open Google Doc
        </a>
      ) : (
        <button type="button" onClick={make} disabled={busy || !hasFolder} title={hasFolder ? undefined : "This tracker has no Google Drive folder yet"} className="text-sm text-bip-accent underline disabled:cursor-not-allowed disabled:opacity-50">
          {busy ? "Making the Doc…" : "Make Google Doc"}
        </button>
      )}
      {problem && <span className="max-w-xs text-xs text-red-300">{problem}</span>}
    </span>
  );
}

type ClientOption = { id: number; name: string };

/** Sets up tracking for another client. */
export function NewTrackerForm({ clients }: { clients: ClientOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [clientId, setClientId] = useState("");
  const [townLabel, setTownLabel] = useState("");
  const [townPoint, setTownPoint] = useState("");
  const [goalDate, setGoalDate] = useState("");
  const [folder, setFolder] = useState("");
  const [searches, setSearches] = useState([
    { keyword: "", goal: "3" },
    { keyword: "", goal: "5" },
    { keyword: "", goal: "5" },
  ]);
  const input = "w-full rounded-md border border-bip-border bg-bip-bg px-2 py-1.5 text-sm text-bip-text";
  const save = async () => {
    setBusy(true);
    setProblem(null);
    try {
      const response = await fetch("/api/maps-rank/trackers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: Number(clientId),
          townLabel,
          townPoint,
          goalDate: goalDate || null,
          driveFolderUrl: folder || null,
          searches: searches.filter((s) => s.keyword.trim()).map((s) => ({ keyword: s.keyword, goal: Number(s.goal) })),
        }),
      });
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) setProblem(body?.error ?? `Couldn't set up the tracker (${response.status}).`);
      else {
        setOpen(false);
        router.refresh();
      }
    } catch {
      setProblem("Couldn't set up the tracker: the connection dropped.");
    } finally {
      setBusy(false);
    }
  };
  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="rounded-md border border-bip-border px-3 py-1.5 text-sm text-bip-text hover:bg-bip-card">
        Track another client
      </button>
    );
  return (
    <section className="space-y-3 rounded-xl border border-bip-border bg-bip-card p-4">
      <h2 className="text-sm font-semibold text-bip-text">Track another client</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-xs text-bip-muted">
          Client (needs a Google Place ID on its record)
          <select value={clientId} onChange={(e) => setClientId(e.target.value)} className={input}>
            <option value="">Choose a client</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-xs text-bip-muted">
          Goals due (optional)
          <input type="date" value={goalDate} onChange={(e) => setGoalDate(e.target.value)} className={input} />
        </label>
        <label className="space-y-1 text-xs text-bip-muted">
          Name of the fixed search point
          <input value={townLabel} onChange={(e) => setTownLabel(e.target.value)} placeholder="Rockville town center" className={input} />
        </label>
        <label className="space-y-1 text-xs text-bip-muted">
          Its coordinates (right-click the spot in Google Maps to copy)
          <input value={townPoint} onChange={(e) => setTownPoint(e.target.value)} placeholder="39.0840, -77.1528" className={input} />
        </label>
      </div>
      <div className="space-y-2">
        <p className="text-xs text-bip-muted">Searches, exactly as the client words them, each with the rank to reach</p>
        {searches.map((s, i) => (
          <div key={i} className="flex gap-2">
            <input value={s.keyword} onChange={(e) => setSearches(searches.map((x, j) => (j === i ? { ...x, keyword: e.target.value } : x)))} placeholder="dog boarding Rockville MD" className={input} />
            <label className="flex shrink-0 items-center gap-1 text-xs text-bip-muted">
              Top
              <input type="number" min={1} max={20} value={s.goal} onChange={(e) => setSearches(searches.map((x, j) => (j === i ? { ...x, goal: e.target.value } : x)))} className={`${input} w-16`} />
            </label>
          </div>
        ))}
      </div>
      <label className="block space-y-1 text-xs text-bip-muted">
        Google Drive folder for the Google Doc version (optional; a folder in a shared drive the app can write to)
        <input value={folder} onChange={(e) => setFolder(e.target.value)} placeholder="https://drive.google.com/drive/folders/…" className={input} />
      </label>
      {problem && <p className="text-sm text-red-300">{problem}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={save} disabled={busy || !clientId} className="rounded-md bg-bip-accent px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60">
          {busy ? "Setting up…" : "Save tracker"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-md border border-bip-border px-3 py-1.5 text-sm text-bip-text hover:bg-bip-card">
          Cancel
        </button>
      </div>
      <p className="text-xs text-bip-muted">Saving reads the practice&apos;s Google listing once (under a cent). Nothing is searched until the first run.</p>
    </section>
  );
}
