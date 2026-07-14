"use client";

import { useRef, useState } from "react";
import { Loader2, Upload, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  SERVICE_KEYS,
  type PipelineIntake,
  type ServiceKey,
  type StartTrigger,
  type Tier,
  type WebStatus,
} from "@/lib/onboarding/pipeline-intake";
import type { ClientRow } from "@/lib/types/client";

const TIER_OPTIONS: { value: Tier; label: string }[] = [
  { value: "none", label: "None" },
  { value: "foundation", label: "Foundation" },
  { value: "premium", label: "Premium" },
  { value: "premium_plus", label: "Premium Plus" },
];

const START_OPTIONS: { value: StartTrigger; label: string }[] = [
  { value: "start_now", label: "Start now" },
  { value: "at_launch", label: "At website launch" },
  { value: "on_date", label: "On a date" },
];

const WEB_STATUS_OPTIONS: { value: WebStatus | ""; label: string }[] = [
  { value: "", label: "—" },
  { value: "has_site_keep", label: "Has a site, keeping it" },
  { value: "has_site_rebuild", label: "Has a site, we're rebuilding" },
  { value: "splash_then_full", label: "Splash page now, full site later" },
  { value: "wait_for_launch", label: "No site, wait for full launch" },
  { value: "no_site", label: "No site, none coming" },
];

// The clients table stores a human tier label per service; "" = inactive.
const TIER_TO_FIELD: Record<Tier, string> = {
  none: "",
  foundation: "Foundation",
  premium: "Premium",
  premium_plus: "Premium Plus",
};

const SERVICE_LABELS: Record<ServiceKey, string> = {
  seo: "SEO",
  ppc: "Ads / PPC",
  smm: "Social",
  blog: "Blog",
  orm: "ORM",
};

type ServiceForm = { tier: Tier; startTrigger: StartTrigger; startDate: string };

type FormState = {
  accountName: string;
  strategist: string;
  contactName: string;
  contactEmail: string;
  city: string;
  tier: string;
  webStatus: WebStatus | "";
  websiteLaunchDate: string;
  services: Record<ServiceKey, ServiceForm>;
  channels: { gbp: boolean; facebook: boolean; instagram: boolean; ga4: boolean };
  notes: string;
};

function blankServices(): Record<ServiceKey, ServiceForm> {
  return SERVICE_KEYS.reduce(
    (acc, key) => {
      acc[key] = { tier: "none", startTrigger: "start_now", startDate: "" };
      return acc;
    },
    {} as Record<ServiceKey, ServiceForm>,
  );
}

const EMPTY_FORM: FormState = {
  accountName: "",
  strategist: "",
  contactName: "",
  contactEmail: "",
  city: "",
  tier: "",
  webStatus: "",
  websiteLaunchDate: "",
  services: blankServices(),
  channels: { gbp: false, facebook: false, instagram: false, ga4: false },
  notes: "",
};

function fieldClass() {
  return "w-full rounded-lg bip-input shadow-none text-sm";
}

export default function OnboardingIntakeDrawer({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated?: (client: ClientRow) => void;
}) {
  const supabase = createClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parsedFrom, setParsedFrom] = useState<string | null>(null);
  const [rawIntake, setRawIntake] = useState<PipelineIntake | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  if (!open) return null;

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function setService(key: ServiceKey, patch: Partial<ServiceForm>) {
    setForm((prev) => ({
      ...prev,
      services: { ...prev.services, [key]: { ...prev.services[key], ...patch } },
    }));
  }

  function applyIntake(intake: PipelineIntake) {
    setRawIntake(intake);
    setForm((prev) => ({
      ...prev,
      accountName: intake.practiceName ?? prev.accountName,
      contactName: intake.primaryContactName ?? intake.ownerName ?? prev.contactName,
      contactEmail: intake.primaryContactEmail ?? prev.contactEmail,
      city: intake.location ?? prev.city,
      webStatus: intake.webStatus ?? prev.webStatus,
      websiteLaunchDate: intake.websiteLaunchDate ?? prev.websiteLaunchDate,
      notes: intake.notes ?? prev.notes,
      services: SERVICE_KEYS.reduce(
        (acc, key) => {
          const s = intake.services[key];
          acc[key] = {
            tier: s?.tier ?? "none",
            startTrigger: s?.startTrigger ?? "start_now",
            startDate: s?.startDate ?? "",
          };
          return acc;
        },
        {} as Record<ServiceKey, ServiceForm>,
      ),
    }));
  }

  async function handleFile(file: File) {
    setParsing(true);
    setParseError(null);
    try {
      const body = new FormData();
      body.append("document", file);
      const res = await fetch("/api/onboarding/parse-pipeline", { method: "POST", body });
      const payload = (await res.json()) as {
        error?: string;
        intake?: PipelineIntake;
        sourceFilename?: string;
      };
      if (!res.ok || !payload.intake) throw new Error(payload.error ?? "Failed to parse pipeline form");
      applyIntake(payload.intake);
      setParsedFrom(payload.sourceFilename ?? file.name);
    } catch (e) {
      setParseError(e instanceof Error ? e.message : "Failed to parse pipeline form");
    } finally {
      setParsing(false);
    }
  }

  async function createClientRecord() {
    const accountName = form.accountName.trim();
    if (!accountName) {
      setSaveError("Account name is required.");
      return;
    }
    setSaveError(null);
    setSaving(true);
    try {
      const payload = {
        account_name: accountName,
        marketing_strategist: form.strategist.trim() || null,
        contact_name: form.contactName.trim() || null,
        contact_email: form.contactEmail.trim() || null,
        city: form.city.trim() || null,
        tier: form.tier.trim() || null,
        seo: TIER_TO_FIELD[form.services.seo.tier] || null,
        ppc: TIER_TO_FIELD[form.services.ppc.tier] || null,
        smm: TIER_TO_FIELD[form.services.smm.tier] || null,
        blog: TIER_TO_FIELD[form.services.blog.tier] || null,
        orm: TIER_TO_FIELD[form.services.orm.tier] || null,
      };
      const { data, error } = await supabase.from("clients").insert(payload).select().single();
      if (error) throw error;
      if (!data) throw new Error("Client was not created");
      const created = data as ClientRow;

      // Seed the onboarding checklist for the purchased services.
      try {
        await fetch(`/api/clients/${created.id}/onboarding/start`, { method: "POST" });
      } catch {
        // onboarding can be started manually from the wizard
      }

      // Persist the intake (web status, per-service start plan, what exists, brief).
      const servicePlan = SERVICE_KEYS.reduce(
        (acc, key) => {
          const s = form.services[key];
          acc[key] = {
            tier: s.tier,
            startTrigger: s.startTrigger,
            startDate: s.startDate || null,
          };
          return acc;
        },
        {} as Record<string, { tier: Tier; startTrigger: StartTrigger; startDate: string | null }>,
      );
      try {
        await supabase.from("client_onboarding_intake").upsert(
          {
            client_id: created.id,
            form_type: rawIntake?.formType ?? "new_client",
            contract_signed: rawIntake?.contractSigned ?? null,
            web_status: form.webStatus || null,
            website_launch_date: form.websiteLaunchDate || null,
            service_start_plan: servicePlan,
            channels_present: form.channels,
            pipeline_notes: form.notes.trim() || null,
            pipeline_raw: rawIntake ?? null,
            source_filename: parsedFrom,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "client_id" },
        );
      } catch {
        // intake is best-effort; the client + checklist still exist
      }

      onCreated?.(created);
      setForm(EMPTY_FORM);
      setRawIntake(null);
      setParsedFrom(null);
      onClose();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Failed to create client");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        type="button"
        aria-label="Close panel"
        className="fixed inset-0 z-40 bg-black/30 dark:bg-black/50"
        onClick={onClose}
      />
      <div className="fixed inset-y-0 right-0 z-50 flex items-stretch">
        <aside className="flex w-full max-w-lg flex-col border-l border-bip-border bg-bip-card shadow-2xl">
          <div className="flex items-start justify-between gap-3 border-b border-bip-border px-5 py-4">
            <div>
              <h2 className="text-base font-semibold text-bip-text">New client onboarding</h2>
              <p className="text-xs text-bip-muted">Upload the pipeline form to pre-fill, then review.</p>
            </div>
            <button type="button" onClick={onClose} className="rounded-lg p-2 text-bip-muted hover:bg-bip-fill hover:text-bip-text">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 space-y-5">
            {/* Pipeline form upload */}
            <div className="rounded-xl border border-dashed border-bip-border p-4">
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.docx,.txt"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleFile(f);
                }}
              />
              <button
                type="button"
                disabled={parsing}
                onClick={() => fileRef.current?.click()}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-bip-fill px-3 py-2 text-sm font-medium text-bip-text hover:opacity-90 disabled:opacity-60"
              >
                {parsing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {parsing ? "Parsing…" : "Upload pipeline form (PDF/DOCX/TXT)"}
              </button>
              {parsedFrom && !parsing && (
                <p className="mt-2 text-[11px] text-emerald-500">Parsed from {parsedFrom} — review below.</p>
              )}
              {parseError && <p className="mt-2 text-[11px] text-red-400">{parseError}</p>}
            </div>

            {/* Basics */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Labeled label="Account name" required>
                <input className={fieldClass()} value={form.accountName} onChange={(e) => set("accountName", e.target.value)} />
              </Labeled>
              <Labeled label="Marketing strategist">
                <input className={fieldClass()} value={form.strategist} onChange={(e) => set("strategist", e.target.value)} placeholder="Assign manually" />
              </Labeled>
              <Labeled label="Primary contact">
                <input className={fieldClass()} value={form.contactName} onChange={(e) => set("contactName", e.target.value)} />
              </Labeled>
              <Labeled label="Contact email">
                <input className={fieldClass()} value={form.contactEmail} onChange={(e) => set("contactEmail", e.target.value)} />
              </Labeled>
              <Labeled label="City">
                <input className={fieldClass()} value={form.city} onChange={(e) => set("city", e.target.value)} />
              </Labeled>
              <Labeled label="Tier (optional)">
                <input className={fieldClass()} value={form.tier} onChange={(e) => set("tier", e.target.value)} />
              </Labeled>
            </div>

            {/* Website track */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Labeled label="Website status">
                <select className={fieldClass()} value={form.webStatus} onChange={(e) => set("webStatus", e.target.value as WebStatus | "")}>
                  {WEB_STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </Labeled>
              <Labeled label="Website launch date">
                <input type="date" className={fieldClass()} value={form.websiteLaunchDate} onChange={(e) => set("websiteLaunchDate", e.target.value)} />
              </Labeled>
            </div>

            {/* Services */}
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-bip-muted">Services &amp; timing</p>
              <div className="space-y-2">
                {SERVICE_KEYS.map((key) => (
                  <div key={key} className="grid grid-cols-[70px_1fr_1fr] items-center gap-2">
                    <span className="text-xs font-medium text-bip-text">{SERVICE_LABELS[key]}</span>
                    <select
                      className={fieldClass()}
                      value={form.services[key].tier}
                      onChange={(e) => setService(key, { tier: e.target.value as Tier })}
                    >
                      {TIER_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                    <div className="flex gap-1">
                      <select
                        className={fieldClass()}
                        disabled={form.services[key].tier === "none"}
                        value={form.services[key].startTrigger}
                        onChange={(e) => setService(key, { startTrigger: e.target.value as StartTrigger })}
                      >
                        {START_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                      {form.services[key].startTrigger === "on_date" && form.services[key].tier !== "none" && (
                        <input
                          type="date"
                          className={fieldClass()}
                          value={form.services[key].startDate}
                          onChange={(e) => setService(key, { startDate: e.target.value })}
                        />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* What already exists */}
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-bip-muted">What already exists</p>
              <div className="flex flex-wrap gap-3">
                {(["gbp", "facebook", "instagram", "ga4"] as const).map((c) => (
                  <label key={c} className="flex items-center gap-1.5 text-sm text-bip-text">
                    <input
                      type="checkbox"
                      checked={form.channels[c]}
                      onChange={(e) => set("channels", { ...form.channels, [c]: e.target.checked })}
                    />
                    {c === "gbp" ? "GBP" : c === "ga4" ? "GA4" : c.charAt(0).toUpperCase() + c.slice(1)}
                  </label>
                ))}
              </div>
            </div>

            {/* Strategist brief */}
            <Labeled label="Strategist brief (from pipeline form)">
              <textarea
                className={`${fieldClass()} min-h-[120px]`}
                value={form.notes}
                onChange={(e) => set("notes", e.target.value)}
              />
            </Labeled>

            {saveError && <p className="text-xs text-red-400">{saveError}</p>}
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-bip-border px-5 py-4">
            <button type="button" onClick={onClose} className="rounded-lg border border-bip-border px-4 py-2 text-sm text-bip-text hover:bg-bip-fill">
              Cancel
            </button>
            <button
              type="button"
              disabled={saving || !form.accountName.trim()}
              onClick={() => void createClientRecord()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-bip-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Create &amp; start onboarding
            </button>
          </div>
        </aside>
      </div>
    </>
  );
}

function Labeled({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-bip-text">
        {label}
        {required ? <span className="text-red-500"> *</span> : null}
      </span>
      {children}
    </label>
  );
}
