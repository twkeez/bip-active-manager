"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, ExternalLink, Loader2, Save } from "lucide-react";
import {
  EXPECTATION_FIELDS,
  EXPECTATION_FIELD_LABEL,
  SERVICE_EXPECTATION_BLOCK_KEYS,
  SERVICE_EXPECTATION_LABEL,
  SERVICE_EXPECTATION_ORDER,
  serviceBlockKey,
  type ExpectationBlock,
} from "@/lib/onboarding/service-expectations";

type ClientOption = { id: number; account_name: string };

const GENERAL_LABELS: Record<string, string> = {
  intro: "Intro — always shown",
  timetable: "Timetable — the overall 90-day schedule",
  closing: "Closing — always shown",
};

function emptyBodies(): Record<string, string> {
  return Object.fromEntries(SERVICE_EXPECTATION_BLOCK_KEYS.map((k) => [k, ""]));
}

function Textarea({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-bip-muted">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 min-h-24 w-full rounded border border-bip-border bg-bip-card/85 px-2 py-1.5 text-sm leading-relaxed text-bip-text focus:border-bip-accent focus:outline-none"
      />
    </div>
  );
}

export default function ClientExpectationsEditor({ clients }: { clients: ClientOption[] }) {
  const [bodies, setBodies] = useState<Record<string, string>>(emptyBodies);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [selectedClientId, setSelectedClientId] = useState<number | null>(clients[0]?.id ?? null);

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch("/api/service-expectations/blocks", { cache: "no-store" });
        const payload = (await response.json()) as { error?: string; blocks?: ExpectationBlock[] };
        if (!response.ok || !payload.blocks) throw new Error(payload.error ?? "Failed to load template");
        setBodies((prev) => {
          const next = { ...prev };
          for (const block of payload.blocks!) next[block.block_key] = block.body;
          return next;
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load template");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function updateBody(key: string, value: string) {
    setBodies((prev) => ({ ...prev, [key]: value }));
    setSavedAt(null);
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const blocks = SERVICE_EXPECTATION_BLOCK_KEYS.map((key) => ({ block_key: key, body: bodies[key] ?? "" }));
      const response = await fetch("/api/service-expectations/blocks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blocks }),
      });
      const payload = (await response.json()) as { error?: string; blocks?: ExpectationBlock[] };
      if (!response.ok || !payload.blocks) throw new Error(payload.error ?? "Failed to save");
      const next = emptyBodies();
      for (const block of payload.blocks) next[block.block_key] = block.body;
      setBodies(next);
      setSavedAt(new Date().toLocaleTimeString());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  const pdfHref = useMemo(
    () => (selectedClientId ? `/client-expectations-print/${selectedClientId}` : null),
    [selectedClientId],
  );
  const wordHref = useMemo(
    () => (selectedClientId ? `/api/client-expectations/${selectedClientId}/word` : null),
    [selectedClientId],
  );

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-bip-muted">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading content…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Generate the document for a client */}
      <div className="rounded-lg border border-bip-border bg-bip-card p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-bip-muted">Generate for a client</p>
        <p className="mt-1 text-[11px] text-bip-muted">
          The document includes only the services this client has active. Content is the shared default below.
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <select
            value={selectedClientId ?? ""}
            onChange={(e) => setSelectedClientId(e.target.value ? Number(e.target.value) : null)}
            className="min-w-56 rounded border border-bip-border bg-bip-card/85 px-2 py-1.5 text-sm text-bip-text focus:border-bip-accent focus:outline-none"
          >
            {clients.length === 0 && <option value="">No clients found</option>}
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.account_name}
              </option>
            ))}
          </select>
          <a
            href={pdfHref ?? "#"}
            target="_blank"
            rel="noopener noreferrer"
            aria-disabled={!pdfHref}
            className={`inline-flex items-center gap-1.5 rounded-md border border-bip-border px-3 py-1.5 text-xs text-bip-text hover:bg-bip-fill ${pdfHref ? "" : "pointer-events-none opacity-50"}`}
          >
            <ExternalLink className="h-3.5 w-3.5" /> Open PDF
          </a>
          <a
            href={wordHref ?? "#"}
            aria-disabled={!wordHref}
            className={`inline-flex items-center gap-1.5 rounded-md border border-bip-border px-3 py-1.5 text-xs text-bip-text hover:bg-bip-fill ${wordHref ? "" : "pointer-events-none opacity-50"}`}
          >
            <Download className="h-3.5 w-3.5" /> Download Word
          </a>
        </div>
      </div>

      <p className="text-xs text-bip-muted">
        Master content, shared across every client. Each service block appears only when that service is active.
        Merge fields: <code className="rounded bg-bip-fill px-1">{"{{client_name}}"}</code>{" "}
        <code className="rounded bg-bip-fill px-1">{"{{strategist}}"}</code>.
      </p>

      {/* Intro + timetable */}
      <div className="space-y-3 rounded-lg border border-bip-border bg-bip-card p-3">
        <Textarea label={GENERAL_LABELS.intro} value={bodies.intro ?? ""} onChange={(v) => updateBody("intro", v)} />
        <Textarea
          label={GENERAL_LABELS.timetable}
          value={bodies.timetable ?? ""}
          onChange={(v) => updateBody("timetable", v)}
        />
      </div>

      {/* Per-service structured fields */}
      {SERVICE_EXPECTATION_ORDER.map((service) => (
        <div key={service} className="space-y-3 rounded-lg border border-bip-border bg-bip-card p-3">
          <p className="text-sm font-semibold text-bip-text">
            {SERVICE_EXPECTATION_LABEL[service]}{" "}
            <span className="text-xs font-normal text-bip-muted">— shown when this service is active</span>
          </p>
          {EXPECTATION_FIELDS.map((field) => {
            const key = serviceBlockKey(service, field);
            return (
              <Textarea
                key={key}
                label={EXPECTATION_FIELD_LABEL[field]}
                value={bodies[key] ?? ""}
                onChange={(v) => updateBody(key, v)}
              />
            );
          })}
        </div>
      ))}

      {/* Closing */}
      <div className="rounded-lg border border-bip-border bg-bip-card p-3">
        <Textarea label={GENERAL_LABELS.closing} value={bodies.closing ?? ""} onChange={(v) => updateBody("closing", v)} />
      </div>

      <div className="sticky bottom-0 flex items-center gap-2 border-t border-bip-border bg-bip-page/95 py-3 backdrop-blur">
        <button
          type="button"
          disabled={saving}
          onClick={() => void save()}
          className="inline-flex items-center gap-2 rounded-lg bg-bip-accent px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save content
        </button>
        {savedAt && <span className="text-xs text-bip-muted">Saved {savedAt}</span>}
        {error && <span className="text-xs text-red-400">{error}</span>}
      </div>
    </div>
  );
}
