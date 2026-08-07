"use client";

import { useState } from "react";
import { ArrowRight, Check, Loader2, RefreshCw, Sparkles } from "lucide-react";
import OnboardingKickoffPanel from "@/components/dashboard/onboarding-kickoff-panel";
import {
  ACTION_LABELS,
  PROFILE_SERVICE_KEYS,
  SERVICE_LABELS,
  TIER_OPTIONS,
  type Discovery,
  type StepModule,
  type StepModuleContext,
} from "../types";

function ProfileAction({ item, controller }: StepModuleContext) {
  const { profileDraft, setProfileDraft, profileSaving, saveProfile } = controller;
  return (
    <div className="mt-3 space-y-2">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-[11px] font-medium text-bip-muted">Marketing strategist</span>
          <input
            value={profileDraft.marketing_strategist}
            onChange={(e) => setProfileDraft((p) => ({ ...p, marketing_strategist: e.target.value }))}
            placeholder="Assign strategist"
            className="w-full rounded-md bip-input text-sm shadow-none"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] font-medium text-bip-muted">Tier</span>
          <input
            value={profileDraft.tier}
            onChange={(e) => setProfileDraft((p) => ({ ...p, tier: e.target.value }))}
            className="w-full rounded-md bip-input text-sm shadow-none"
          />
        </label>
      </div>
      <p className="text-[11px] text-bip-muted">Hours are calculated from the services + tiers.</p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={profileSaving}
          onClick={() => void saveProfile()}
          className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-60"
        >
          {profileSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Save
        </button>
        {item.done && <span className="text-xs text-emerald-400">Complete ✓</span>}
      </div>
    </div>
  );
}

function ServicesAction({ item, controller }: StepModuleContext) {
  const { profileDraft, setProfileDraft, profileSaving, saveProfile } = controller;
  return (
    <div className="mt-3 space-y-2">
      <div className="space-y-1.5">
        {PROFILE_SERVICE_KEYS.map((key) => (
          <div key={key} className="grid grid-cols-[84px_1fr] items-center gap-2">
            <span className="text-xs font-medium text-bip-text">{SERVICE_LABELS[key]}</span>
            <select
              value={profileDraft[key]}
              onChange={(e) => setProfileDraft((p) => ({ ...p, [key]: e.target.value }))}
              className="w-full rounded-md bip-input text-sm shadow-none"
            >
              {TIER_OPTIONS.map((o) => (
                <option key={o.label} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={profileSaving}
          onClick={() => void saveProfile()}
          className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-60"
        >
          {profileSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Approve
        </button>
        {item.done && <span className="text-xs text-emerald-400">Confirmed ✓</span>}
      </div>
    </div>
  );
}

function DiscoveryAction({ item, controller }: StepModuleContext) {
  const { clientId, busy, setError, toggleManual, initialData } = controller;
  const [discovery, setDiscovery] = useState<Discovery | null>(initialData.discovery);
  const [discoveryRunning, setDiscoveryRunning] = useState(false);

  async function runDiscovery() {
    setDiscoveryRunning(true);
    setError(null);
    try {
      const res = await fetch(`/api/clients/${clientId}/onboarding/discovery`, { method: "POST" });
      const payload = (await res.json()) as { error?: string; discovery?: Discovery };
      if (!res.ok || !payload.discovery) throw new Error(payload.error ?? "Discovery failed");
      setDiscovery(payload.discovery);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Discovery failed");
    } finally {
      setDiscoveryRunning(false);
    }
  }

  return (
    <div className="mt-3 space-y-3">
      {!discovery ? (
        <button
          type="button"
          disabled={discoveryRunning}
          onClick={() => void runDiscovery()}
          className="inline-flex items-center gap-1.5 rounded-md bg-bip-accent px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-60"
        >
          {discoveryRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          {discoveryRunning ? "Researching…" : "Run discovery"}
        </button>
      ) : (
        <div className="space-y-2.5 rounded-lg border border-bip-border bg-bip-fill p-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-bip-muted">Competitors</p>
            <ul className="mt-1 space-y-1">
              {discovery.competitors.map((c, i) => (
                <li key={i} className="text-xs text-bip-muted">
                  <span className="font-medium text-bip-text">{c.name}</span> — {c.note}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-bip-muted">Market snapshot</p>
            <p className="mt-0.5 text-xs text-bip-muted">{discovery.marketSnapshot}</p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-bip-muted">Search landscape</p>
            <p className="mt-0.5 text-xs text-bip-muted">{discovery.searchLandscape}</p>
          </div>
          <button
            type="button"
            disabled={discoveryRunning}
            onClick={() => void runDiscovery()}
            className="inline-flex items-center gap-1 text-[11px] text-bip-muted hover:text-bip-text disabled:opacity-60"
          >
            {discoveryRunning ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />} Re-run
          </button>
        </div>
      )}
      <button
        type="button"
        disabled={busy}
        onClick={() => void toggleManual(item.itemKey, !item.done)}
        className={`inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium ${item.done ? "border border-bip-border text-bip-muted hover:bg-bip-fill" : "bg-emerald-600 text-white hover:bg-emerald-500"} disabled:opacity-60`}
      >
        <Check className="h-3.5 w-3.5" /> {item.done ? "Mark not done" : "Mark done"}
      </button>
    </div>
  );
}

function KickoffMeetingAction({ item, controller }: StepModuleContext) {
  const { clientId, setError, setEvaluation, initialData } = controller;
  const [kickoffDate, setKickoffDate] = useState(initialData.kickoffMeetingAt ?? "");
  const [kickoffSaving, setKickoffSaving] = useState(false);

  async function saveMeeting(date: string) {
    setKickoffSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/clients/${clientId}/onboarding/meeting`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduledAt: date || null }),
      });
      const payload = (await res.json()) as { error?: string; evaluation?: typeof controller.evaluation };
      if (!res.ok || !payload.evaluation) throw new Error(payload.error ?? "Failed to save meeting date");
      setEvaluation(payload.evaluation);
      setKickoffDate(date);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save meeting date");
    } finally {
      setKickoffSaving(false);
    }
  }

  return (
    <div className="mt-3 flex flex-wrap items-end gap-2">
      <label className="block">
        <span className="mb-1 block text-[11px] font-medium text-bip-muted">Kickoff meeting date</span>
        <input
          type="date"
          value={kickoffDate ? kickoffDate.slice(0, 10) : ""}
          onChange={(e) => setKickoffDate(e.target.value)}
          className="rounded-md bip-input text-sm shadow-none"
        />
      </label>
      <button
        type="button"
        disabled={kickoffSaving}
        onClick={() => void saveMeeting(kickoffDate)}
        className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-60"
      >
        {kickoffSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Save
      </button>
      {item.done && <span className="text-xs text-emerald-400">Scheduled ✓</span>}
    </div>
  );
}

// The final `else` branch: manual toggle OR "verifies itself" note, plus the
// actionTab navigation buttons.
export function DefaultAction({ item, controller }: StepModuleContext) {
  const { busy, toggleManual, onOpenTab, onEditClient } = controller;
  const isManual =
    item.verification.startsWith("manual:") && item.verification !== "manual:record_created";
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      {isManual ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => void toggleManual(item.itemKey, !item.done)}
          className={`inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium ${item.done ? "border border-bip-border text-bip-muted hover:bg-bip-fill" : "bg-emerald-600 text-white hover:bg-emerald-500"} disabled:opacity-60`}
        >
          <Check className="h-3.5 w-3.5" /> {item.done ? "Mark not done" : "Mark done"}
        </button>
      ) : !item.done ? (
        <span className="text-xs text-bip-muted">This step verifies itself once the data is in place.</span>
      ) : null}

      {item.actionTab && item.actionTab !== "edit" && ACTION_LABELS[item.actionTab] && (
        <button
          type="button"
          onClick={() => onOpenTab?.(item.actionTab!)}
          className="inline-flex items-center gap-1 rounded-md border border-bip-border px-3 py-1.5 text-xs text-bip-text hover:bg-bip-fill"
        >
          {ACTION_LABELS[item.actionTab]} <ArrowRight className="h-3.5 w-3.5" />
        </button>
      )}
      {item.actionTab === "edit" && (
        <button
          type="button"
          onClick={() => onEditClient?.()}
          className="inline-flex items-center gap-1 rounded-md border border-bip-border px-3 py-1.5 text-xs text-bip-text hover:bg-bip-fill"
        >
          Edit client profile <ArrowRight className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

// The communication step renders the default action UI, then appends the
// Basecamp kickoff generator (which belongs only on this step).
function CommsWelcomeAction({ item, controller }: StepModuleContext) {
  return (
    <>
      <DefaultAction item={item} controller={controller} />
      <div className="mt-4">
        <OnboardingKickoffPanel clientId={controller.clientId} />
      </div>
    </>
  );
}

export const ProfileStep: StepModule = {
  match: (v) => v === "manual:intake_profile",
  Action: ProfileAction,
};

export const ServicesStep: StepModule = {
  match: (v) => v === "manual:intake_services",
  Action: ServicesAction,
};

export const DiscoveryStep: StepModule = {
  match: (v) => v === "manual:arm_strategist",
  Action: DiscoveryAction,
};

export const KickoffMeetingStep: StepModule = {
  match: (v) => v === "state:kickoff_meeting",
  Action: KickoffMeetingAction,
};

export const CommsWelcomeStep: StepModule = {
  match: (v) => v === "manual:comms_welcome",
  Action: CommsWelcomeAction,
};

export const DefaultStep: StepModule = {
  match: () => true,
  Action: DefaultAction,
};
