"use client";

import { useEffect, useState } from "react";
import type { ClientOnboardingEvaluation } from "@/lib/clients/types";
import {
  EMPTY_PROFILE_DRAFT,
  tierOption,
  type ClientProfile,
  type NavTab,
  type OnboardingController,
  type OnboardingInitialData,
  type ProfileDraft,
} from "./types";

type Params = {
  clientId: number;
  onOpenTab?: (tab: NavTab) => void;
  onEditClient?: () => void;
  onGraduated?: () => void;
};

const EMPTY_INITIAL_DATA: OnboardingInitialData = {
  discovery: null,
  kickoffMeetingAt: null,
  competitorOffers: null,
  campaignPlan: null,
  brandElements: null,
};

export function useOnboardingController({
  clientId,
  onOpenTab,
  onEditClient,
  onGraduated,
}: Params): OnboardingController {
  const [evaluation, setEvaluation] = useState<ClientOnboardingEvaluation | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [clientProfile, setClientProfile] = useState<ClientProfile | null>(null);
  const [profileDraft, setProfileDraft] = useState<ProfileDraft>(EMPTY_PROFILE_DRAFT);
  const [profileSaving, setProfileSaving] = useState(false);
  const [websiteDraft, setWebsiteDraft] = useState("");
  const [websiteSaving, setWebsiteSaving] = useState(false);
  const [initialData, setInitialData] = useState<OnboardingInitialData>(EMPTY_INITIAL_DATA);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch(`/api/clients/${clientId}/onboarding`, { cache: "no-store" });
        const payload = (await response.json()) as {
          error?: string;
          evaluation?: ClientOnboardingEvaluation;
          clientProfile?: ClientProfile;
          discovery?: OnboardingInitialData["discovery"];
          kickoffMeetingAt?: string | null;
          competitorOffers?: OnboardingInitialData["competitorOffers"];
          campaignPlan?: OnboardingInitialData["campaignPlan"];
          brandElements?: OnboardingInitialData["brandElements"];
        };
        if (cancelled) return;
        if (!response.ok || !payload.evaluation) throw new Error(payload.error ?? "Failed to load onboarding");
        setEvaluation(payload.evaluation);
        if (payload.clientProfile) setClientProfile(payload.clientProfile);
        setInitialData({
          discovery: payload.discovery ?? null,
          kickoffMeetingAt: payload.kickoffMeetingAt ?? null,
          competitorOffers: payload.competitorOffers ?? null,
          campaignPlan: payload.campaignPlan ?? null,
          brandElements: payload.brandElements ?? null,
        });
        // Open the first not-yet-done step in the active phase.
        const active = payload.evaluation.items.filter((i) => !i.deferred);
        const firstOpen = active.find((i) => !i.done) ?? active[0] ?? null;
        setOpenKey(firstOpen?.itemKey ?? null);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load onboarding");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  useEffect(() => {
    if (!clientProfile) return;
    setWebsiteDraft(clientProfile.website ?? "");
    setProfileDraft({
      marketing_strategist: clientProfile.marketing_strategist ?? "",
      tier: clientProfile.tier ?? "",
      seo: tierOption(clientProfile.seo),
      ppc: tierOption(clientProfile.ppc),
      smm: tierOption(clientProfile.smm),
      blog: tierOption(clientProfile.blog),
      orm: tierOption(clientProfile.orm),
    });
  }, [clientProfile]);

  // Re-fetch onboarding and update evaluation + clientProfile. This is the logic
  // inlined after saveProfile / saveWebsite so the step re-verifies.
  async function refresh() {
    const ob = await fetch(`/api/clients/${clientId}/onboarding`, { cache: "no-store" });
    const obPayload = (await ob.json()) as {
      evaluation?: ClientOnboardingEvaluation;
      clientProfile?: ClientProfile;
    };
    if (obPayload.evaluation) setEvaluation(obPayload.evaluation);
    if (obPayload.clientProfile) setClientProfile(obPayload.clientProfile);
  }

  async function startOnboarding() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/clients/${clientId}/onboarding/start`, { method: "POST" });
      const payload = (await response.json()) as { error?: string; evaluation?: ClientOnboardingEvaluation };
      if (!response.ok || !payload.evaluation) throw new Error(payload.error ?? "Failed to start onboarding");
      setEvaluation(payload.evaluation);
      const active = payload.evaluation.items.filter((i) => !i.deferred);
      setOpenKey(active[0]?.itemKey ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start onboarding");
    } finally {
      setBusy(false);
    }
  }

  async function toggleManual(itemKey: string, done: boolean) {
    setBusy(true);
    try {
      const response = await fetch(`/api/clients/${clientId}/onboarding/items/${encodeURIComponent(itemKey)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ done }),
      });
      const payload = (await response.json()) as { error?: string; evaluation?: ClientOnboardingEvaluation };
      if (!response.ok || !payload.evaluation) throw new Error(payload.error ?? "Failed to update step");
      setEvaluation(payload.evaluation);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update step");
    } finally {
      setBusy(false);
    }
  }

  async function markLaunched() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/clients/${clientId}/onboarding/launch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ launched: true }),
      });
      const payload = (await response.json()) as { error?: string; evaluation?: ClientOnboardingEvaluation };
      if (!response.ok || !payload.evaluation) throw new Error(payload.error ?? "Failed to mark launched");
      setEvaluation(payload.evaluation);
      const active = payload.evaluation.items.filter((i) => !i.deferred);
      const firstOpen = active.find((i) => !i.done) ?? active[0] ?? null;
      setOpenKey(firstOpen?.itemKey ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to mark launched");
    } finally {
      setBusy(false);
    }
  }

  async function saveWebsite() {
    setWebsiteSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/clients/${clientId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ website: websiteDraft }),
      });
      const payload = (await res.json()) as { error?: string; ok?: boolean };
      if (!res.ok || !payload.ok) throw new Error(payload.error ?? "Failed to save website");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save website");
    } finally {
      setWebsiteSaving(false);
    }
  }

  async function saveProfile() {
    setProfileSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/clients/${clientId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profileDraft),
      });
      const payload = (await res.json()) as { error?: string; ok?: boolean };
      if (!res.ok || !payload.ok) throw new Error(payload.error ?? "Failed to save");
      // Refresh evaluation + profile so the step re-verifies. Services may have
      // changed the tier/steps — the keyword plan refetches when the KeywordsStep
      // module next mounts.
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setProfileSaving(false);
    }
  }

  async function graduate() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/clients/${clientId}/onboarding/complete`, { method: "POST" });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Failed to graduate");
      onGraduated?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to graduate");
    } finally {
      setBusy(false);
    }
  }

  return {
    clientId,
    onOpenTab,
    onEditClient,
    evaluation,
    setEvaluation,
    loading,
    busy,
    error,
    setError,
    clientProfile,
    profileDraft,
    setProfileDraft,
    profileSaving,
    websiteDraft,
    setWebsiteDraft,
    websiteSaving,
    initialData,
    openKey,
    setOpenKey,
    refresh,
    startOnboarding,
    toggleManual,
    markLaunched,
    graduate,
    saveProfile,
    saveWebsite,
  };
}
