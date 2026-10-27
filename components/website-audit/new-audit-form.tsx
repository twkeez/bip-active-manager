"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

type ClientOption = { id: number; account_name: string; website: string | null; city: string | null; state: string | null };

/** Start an audit for a client (fills the details in) or for any prospect's website. */
export default function NewWebsiteAuditForm({ clients }: { clients: ClientOption[] }) {
  const router = useRouter();
  const [clientId, setClientId] = useState<number | null>(null);
  const [domain, setDomain] = useState("");
  const [practiceName, setPracticeName] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [competitors, setCompetitors] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function pickClient(id: string) {
    const client = clients.find((c) => String(c.id) === id);
    setClientId(client?.id ?? null);
    if (!client) return;
    setDomain(client.website ?? "");
    setPracticeName(client.account_name);
    setCity(client.city ?? "");
    setState(client.state ?? "");
  }

  async function start() {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/website-audits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          domain,
          practiceName,
          city,
          state,
          competitors: competitors.split(/[\s,]+/).filter(Boolean),
        }),
      });
      const payload = (await response.json()) as { id?: number; error?: string };
      if (!response.ok || !payload.id) throw new Error(payload.error ?? "Couldn't start the audit");
      router.push(`/website-audits/${payload.id}`);
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : "Couldn't start the audit");
      setSaving(false);
    }
  }

  const input = "rounded-md bip-input text-sm shadow-none";
  return (
    <section className="space-y-3 rounded-xl border border-bip-border bg-bip-card p-4">
      <h2 className="text-sm font-semibold text-bip-text">New audit</h2>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <select className={input} value={clientId ?? ""} onChange={(e) => pickClient(e.target.value)}>
          <option value="">A prospect (not a client)</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.account_name}
            </option>
          ))}
        </select>
        <input className={input} placeholder="Website, e.g. dhah.org" value={domain} onChange={(e) => setDomain(e.target.value)} />
        <input className={input} placeholder="Practice name" value={practiceName} onChange={(e) => setPracticeName(e.target.value)} />
        <input className={input} placeholder="City" value={city} onChange={(e) => setCity(e.target.value)} />
        <input className={input} placeholder="State, e.g. GA" value={state} onChange={(e) => setState(e.target.value)} />
        <input
          className={input}
          placeholder="Competitor websites (optional, comma separated)"
          value={competitors}
          onChange={(e) => setCompetitors(e.target.value)}
        />
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={saving || !domain.trim() || !practiceName.trim()}
          onClick={() => void start()}
          className="rounded-md bg-bip-accent px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
        >
          {saving ? "Starting…" : "Start audit"}
        </button>
        {error && <span className="text-sm text-red-300">{error}</span>}
      </div>
    </section>
  );
}
