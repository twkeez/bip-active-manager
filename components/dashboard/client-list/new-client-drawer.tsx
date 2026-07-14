"use client";

import { useState } from "react";
import { Loader2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { norm } from "@/lib/dashboard/client-list-utils";
import type { ClientRow } from "@/lib/types/client";

function Field({
  label,
  value,
  onChange,
  type = "text",
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-bip-text">
        {label}
        {required ? <span className="text-red-500"> *</span> : null}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg bip-input shadow-none"
      />
    </label>
  );
}

const EMPTY_FORM: Partial<ClientRow> = {
  account_name: "",
  marketing_strategist: "",
  total_package_hours: null,
  hours_for_strategist: null,
  blog: "",
  smm: "",
  seo: "",
  ppc: "",
  orm: "",
  ads_customer_id: "",
  ga4_id: "",
  sc_url: "",
  website: "",
  ga4_property_id: "",
  google_place_id: "",
  basecamp_project_id: "",
  harvest_project_id: "",
  harvest_client_id: "",
  tier: "",
};

type NewClientDrawerProps = {
  open: boolean;
  onClose: () => void;
  onCreated?: (client: ClientRow) => void;
  // Default: after create, navigate to the new client's page. Set false to stay
  // put (e.g. the Onboarding section handles the new client in place).
  navigateOnCreate?: boolean;
};

export default function NewClientDrawer({ open, onClose, onCreated, navigateOnCreate = true }: NewClientDrawerProps) {
  const router = useRouter();
  const supabase = createClient();
  const [form, setForm] = useState<Partial<ClientRow>>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  if (!open) return null;

  function patchField(key: keyof ClientRow, value: string) {
    setForm((prev) => {
      const next = { ...prev };
      if (key === "total_package_hours" || key === "hours_for_strategist") {
        const n = value === "" ? null : Number(value);
        next[key] = (Number.isFinite(n) ? n : null) as never;
      } else if (key !== "created_at" && key !== "id") {
        (next as Record<string, unknown>)[key] = value === "" ? null : value;
      }
      return next;
    });
  }

  async function saveClient() {
    const payload = {
      account_name: norm(form.account_name),
      marketing_strategist: norm(form.marketing_strategist) || null,
      total_package_hours: form.total_package_hours ?? null,
      hours_for_strategist: form.hours_for_strategist ?? null,
      blog: norm(form.blog) || null,
      smm: norm(form.smm) || null,
      seo: norm(form.seo) || null,
      ppc: norm(form.ppc) || null,
      orm: norm(form.orm) || null,
      ads_customer_id: norm(form.ads_customer_id) || null,
      ga4_id: norm(form.ga4_id) || null,
      sc_url: norm(form.sc_url) || null,
      website: norm(form.website) || null,
      ga4_property_id: norm(form.ga4_property_id) || null,
      google_place_id: norm(form.google_place_id) || null,
      basecamp_project_id: norm(form.basecamp_project_id) || null,
      harvest_project_id: norm(form.harvest_project_id) || null,
      harvest_client_id: norm(form.harvest_client_id) || null,
      tier: norm(form.tier) || null,
    };
    if (!payload.account_name) return;

    setSaveError(null);
    setSaving(true);
    try {
      const { data, error } = await supabase.from("clients").insert(payload).select().single();
      if (error) throw error;
      if (!data) throw new Error("Client was not created");
      const created = data as ClientRow;
      let onboarded = created;
      try {
        const startResponse = await fetch(`/api/clients/${created.id}/onboarding/start`, {
          method: "POST",
        });
        const startPayload = (await startResponse.json()) as {
          error?: string;
          evaluation?: { onboardingStartedAt?: string | null };
        };
        if (startResponse.ok) {
          onboarded = {
            ...created,
            onboarding_status: "active",
            onboarding_started_at:
              startPayload.evaluation?.onboardingStartedAt ?? new Date().toISOString(),
          };
        }
      } catch {
        // onboarding can be started manually
      }
      onCreated?.(onboarded);
      setForm(EMPTY_FORM);
      onClose();
      if (navigateOnCreate) {
        router.push(`/dashboard/clients/${onboarded.id}?tab=overview`);
      }
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
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[1px] backdrop-blur-[1px] dark:bg-black/50"
        onClick={onClose}
      />
      <div className="fixed inset-y-0 right-0 z-50 flex items-stretch">
        <aside className="flex w-full max-w-lg flex-col border-l border-bip-border bg-bip-card shadow-2xl">
          <div className="flex items-start justify-between gap-3 border-b border-bip-border px-5 py-4">
            <h2 className="truncate text-base font-semibold text-bip-text">
              New client
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-bip-muted hover:bg-bip-fill hover:text-bip-text"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            <div className="flex flex-col gap-4">
              <Field
                label="Account name"
                required
                value={String(form.account_name ?? "")}
                onChange={(v) => patchField("account_name", v)}
              />
              <Field
                label="Marketing strategist"
                value={String(form.marketing_strategist ?? "")}
                onChange={(v) => patchField("marketing_strategist", v)}
              />
              <div className="grid grid-cols-2 gap-3">
                <Field
                  label="Total package hours"
                  type="number"
                  value={form.total_package_hours == null ? "" : String(form.total_package_hours)}
                  onChange={(v) => patchField("total_package_hours", v)}
                />
                <Field
                  label="Hours for strategist"
                  type="number"
                  value={
                    form.hours_for_strategist == null ? "" : String(form.hours_for_strategist)
                  }
                  onChange={(v) => patchField("hours_for_strategist", v)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Blog" value={String(form.blog ?? "")} onChange={(v) => patchField("blog", v)} />
                <Field label="SMM" value={String(form.smm ?? "")} onChange={(v) => patchField("smm", v)} />
                <Field label="SEO" value={String(form.seo ?? "")} onChange={(v) => patchField("seo", v)} />
                <Field label="PPC" value={String(form.ppc ?? "")} onChange={(v) => patchField("ppc", v)} />
                <Field label="ORM" value={String(form.orm ?? "")} onChange={(v) => patchField("orm", v)} />
              </div>
              <Field label="Tier" value={String(form.tier ?? "")} onChange={(v) => patchField("tier", v)} />
              <h3 className="mt-2 text-xs font-semibold uppercase tracking-wide text-bip-muted">
                Technical
              </h3>
              <Field
                label="Ads customer ID"
                value={String(form.ads_customer_id ?? "")}
                onChange={(v) => patchField("ads_customer_id", v)}
              />
              <Field
                label="GA4 ID"
                value={String(form.ga4_id ?? "")}
                onChange={(v) => patchField("ga4_id", v)}
              />
              <Field
                label="GA4 property ID"
                value={String(form.ga4_property_id ?? "")}
                onChange={(v) => patchField("ga4_property_id", v)}
              />
              <Field
                label="Search Console URL"
                value={String(form.sc_url ?? "")}
                onChange={(v) => patchField("sc_url", v)}
              />
              <Field
                label="Website"
                value={String(form.website ?? "")}
                onChange={(v) => patchField("website", v)}
              />
              <Field
                label="Google Place ID (GBP)"
                value={String(form.google_place_id ?? "")}
                onChange={(v) => patchField("google_place_id", v)}
              />
              <Field
                label="Basecamp project ID"
                value={String(form.basecamp_project_id ?? "")}
                onChange={(v) => patchField("basecamp_project_id", v)}
              />
              <Field
                label="Harvest project ID"
                value={String(form.harvest_project_id ?? "")}
                onChange={(v) => patchField("harvest_project_id", v)}
              />
              <Field
                label="Harvest client ID"
                value={String(form.harvest_client_id ?? "")}
                onChange={(v) => patchField("harvest_client_id", v)}
              />
            </div>
          </div>
          <div className="flex flex-col gap-3 border-t border-bip-border">
            {saveError ? (
              <p className="rounded-lg bg-bip-danger/15 px-3 py-2 text-sm text-bip-danger">
                {saveError}
              </p>
            ) : null}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-lg border border-bip-border py-2.5 text-sm font-medium text-bip-text hover:bg-bip-page"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving || !norm(form.account_name)}
                onClick={() => void saveClient()}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-bip-accent py-2.5 text-sm font-medium text-bip-text disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Create client
              </button>
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}
