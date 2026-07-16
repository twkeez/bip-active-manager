"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  Circle,
  FileText,
  GraduationCap,
  ListChecks,
  Loader2,
  Lock,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import OnboardingKickoffPanel from "@/components/dashboard/onboarding-kickoff-panel";
import { ONBOARDING_CATEGORY_LABELS } from "@/lib/clients/onboarding";
import type { ClientOnboardingEvaluation, DetailTabLink } from "@/lib/clients/types";
import type { ClientDetailTab } from "@/lib/dashboard/client-workspace-types";

type NavTab = ClientDetailTab | "edit";

type Props = {
  clientId: number;
  onOpenTab?: (tab: NavTab) => void;
  onEditClient?: () => void;
  onGraduated?: () => void;
};

const ACTION_LABELS: Partial<Record<DetailTabLink, string>> = {
  connections: "Open Connections",
  reporting: "Open Reporting",
  seo: "Open SEO",
  comms: "Open Comms",
};

const PROFILE_SERVICE_KEYS = ["seo", "ppc", "smm", "blog", "orm"] as const;
type ProfileServiceKey = (typeof PROFILE_SERVICE_KEYS)[number];

const SERVICE_LABELS: Record<ProfileServiceKey, string> = {
  seo: "SEO",
  ppc: "Ads / PPC",
  smm: "Social",
  blog: "Blog",
  orm: "ORM",
};

const TIER_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "None" },
  { value: "Foundation", label: "Foundation" },
  { value: "Premium", label: "Premium" },
  { value: "Premium Plus", label: "Premium Plus" },
];

// Map a stored service tier string to one of the dropdown options.
function tierOption(v: string | null | undefined): string {
  const s = (v ?? "").trim().toLowerCase();
  if (!s || ["n", "no", "none", "na", "n/a", "0", "false"].includes(s)) return "";
  if (s.includes("plus") || s.includes("+")) return "Premium Plus";
  if (s.includes("premium") || s === "p") return "Premium";
  return "Foundation";
}

type ClientProfile = {
  marketing_strategist: string | null;
  tier: string | null;
  website: string | null;
  seo: string | null;
  ppc: string | null;
  smm: string | null;
  blog: string | null;
  orm: string | null;
};

type ProfileDraft = {
  marketing_strategist: string;
  tier: string;
} & Record<ProfileServiceKey, string>;

const EMPTY_PROFILE_DRAFT: ProfileDraft = {
  marketing_strategist: "",
  tier: "",
  seo: "",
  ppc: "",
  smm: "",
  blog: "",
  orm: "",
};

type Discovery = {
  competitors: Array<{ name: string; note: string }>;
  marketSnapshot: string;
  searchLandscape: string;
};

type KeywordData = {
  allowance: number;
  candidates: Array<{ keyword: string; volume: number | null }>;
  existing: string[];
};

type CompetitorOffer = { name: string; offers: string; positioning: string; counter: string };

type CampaignPlan = {
  adGroups: Array<{ name: string; keywords: string[] }>;
  budgetNotes: string;
  negatives: string[];
};

type BrandElements = {
  logoUrl: string | null;
  heroImage: string | null;
  themeColor: string | null;
  title: string | null;
};

type BlogTopic = { topic: string; clicks: number; clients: number };

export default function OnboardingWizard({ clientId, onOpenTab, onEditClient, onGraduated }: Props) {
  const [evaluation, setEvaluation] = useState<ClientOnboardingEvaluation | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [clientProfile, setClientProfile] = useState<ClientProfile | null>(null);
  const [profileDraft, setProfileDraft] = useState<ProfileDraft>(EMPTY_PROFILE_DRAFT);
  const [profileSaving, setProfileSaving] = useState(false);
  const [discovery, setDiscovery] = useState<Discovery | null>(null);
  const [discoveryRunning, setDiscoveryRunning] = useState(false);
  const [kickoffDate, setKickoffDate] = useState("");
  const [kickoffSaving, setKickoffSaving] = useState(false);
  const [keywordData, setKeywordData] = useState<KeywordData | null>(null);
  const [keywordSelected, setKeywordSelected] = useState<string[]>([]);
  const [keywordSaving, setKeywordSaving] = useState(false);
  const [auditRunning, setAuditRunning] = useState(false);
  const [auditMsg, setAuditMsg] = useState<string | null>(null);
  const [baselineRunning, setBaselineRunning] = useState(false);
  const [baselineMsg, setBaselineMsg] = useState<string | null>(null);
  const [competitorOffers, setCompetitorOffers] = useState<CompetitorOffer[] | null>(null);
  const [adsRunning, setAdsRunning] = useState(false);
  const [adsMsg, setAdsMsg] = useState<string | null>(null);
  const [campaignPlan, setCampaignPlan] = useState<CampaignPlan | null>(null);
  const [planRunning, setPlanRunning] = useState(false);
  const [planMsg, setPlanMsg] = useState<string | null>(null);
  const [brandElements, setBrandElements] = useState<BrandElements | null>(null);
  const [brandRunning, setBrandRunning] = useState(false);
  const [brandMsg, setBrandMsg] = useState<string | null>(null);
  const [websiteDraft, setWebsiteDraft] = useState("");
  const [websiteSaving, setWebsiteSaving] = useState(false);
  const [blogTopics, setBlogTopics] = useState<BlogTopic[] | null>(null);
  const [topicsRunning, setTopicsRunning] = useState(false);
  const [topicsMsg, setTopicsMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch(`/api/clients/${clientId}/onboarding`, { cache: "no-store" });
        const payload = (await response.json()) as {
          error?: string;
          evaluation?: ClientOnboardingEvaluation;
          clientProfile?: ClientProfile;
          discovery?: Discovery | null;
          kickoffMeetingAt?: string | null;
          competitorOffers?: CompetitorOffer[] | null;
          campaignPlan?: CampaignPlan | null;
          brandElements?: BrandElements | null;
        };
        if (cancelled) return;
        if (!response.ok || !payload.evaluation) throw new Error(payload.error ?? "Failed to load onboarding");
        setEvaluation(payload.evaluation);
        if (payload.clientProfile) setClientProfile(payload.clientProfile);
        setDiscovery(payload.discovery ?? null);
        setKickoffDate(payload.kickoffMeetingAt ?? "");
        setCompetitorOffers(payload.competitorOffers ?? null);
        setCampaignPlan(payload.campaignPlan ?? null);
        setBrandElements(payload.brandElements ?? null);
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

  const allItems = evaluation?.items ?? [];
  // Step through the active phase only; at_launch steps that are deferred show
  // separately in the "Comes at launch" group.
  const items = allItems.filter((i) => !i.deferred);
  const deferredItems = allItems.filter((i) => i.deferred);
  // The expanded step (accordion is single-open). Drives keyword prefetch below.
  const current = items.find((i) => i.itemKey === openKey) ?? null;

  const commsTone = useMemo(() => {
    if (!evaluation) return null;
    if (evaluation.commsCadence === "overdue") return "overdue";
    if (evaluation.commsCadence === "due_soon") return "due_soon";
    return null;
  }, [evaluation]);

  // Load the keyword plan (allowance + suggestions + current) when on that step.
  useEffect(() => {
    if (current?.verification !== "snapshot:keyword_targets" || keywordData) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/clients/${clientId}/onboarding/keywords`, { cache: "no-store" });
        const payload = (await res.json()) as KeywordData & { error?: string };
        if (cancelled || !res.ok) return;
        setKeywordData({
          allowance: payload.allowance,
          candidates: payload.candidates ?? [],
          existing: payload.existing ?? [],
        });
        setKeywordSelected(payload.existing ?? []);
      } catch {
        // ignore — the step still works, just without pre-fill
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [current?.verification, clientId, keywordData]);

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

  async function runAudit() {
    setAuditRunning(true);
    setAuditMsg(null);
    try {
      const res = await fetch("/api/seo/lighthouse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId }),
      });
      const payload = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(payload.error ?? "Site audit failed");
      setAuditMsg("Site audit captured.");
      // Re-verify the step (seo_baseline now exists).
      const ob = await fetch(`/api/clients/${clientId}/onboarding`, { cache: "no-store" });
      const obPayload = (await ob.json()) as { evaluation?: ClientOnboardingEvaluation };
      if (obPayload.evaluation) setEvaluation(obPayload.evaluation);
    } catch (e) {
      setAuditMsg(e instanceof Error ? e.message : "Site audit failed");
    } finally {
      setAuditRunning(false);
    }
  }

  async function runBlogTopics() {
    setTopicsRunning(true);
    setTopicsMsg(null);
    try {
      const res = await fetch(`/api/clients/${clientId}/onboarding/blog-topics`, { cache: "no-store" });
      const payload = (await res.json()) as { error?: string; topics?: BlogTopic[] };
      if (!res.ok) throw new Error(payload.error ?? "Failed to load topics");
      const topics = payload.topics ?? [];
      setBlogTopics(topics);
      if (topics.length === 0) setTopicsMsg("No blog performance data across clients yet.");
    } catch (e) {
      setTopicsMsg(e instanceof Error ? e.message : "Failed to load topics");
    } finally {
      setTopicsRunning(false);
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
      const ob = await fetch(`/api/clients/${clientId}/onboarding`, { cache: "no-store" });
      const obPayload = (await ob.json()) as { evaluation?: ClientOnboardingEvaluation; clientProfile?: ClientProfile };
      if (obPayload.evaluation) setEvaluation(obPayload.evaluation);
      if (obPayload.clientProfile) setClientProfile(obPayload.clientProfile);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save website");
    } finally {
      setWebsiteSaving(false);
    }
  }

  function renderWebsiteField() {
    return (
      <div className="space-y-1.5 rounded-lg border border-amber-500/30 bg-amber-500/5 p-2.5">
        <p className="text-[11px] text-amber-300">This step needs the website URL.</p>
        <div className="flex gap-2">
          <input
            value={websiteDraft}
            onChange={(e) => setWebsiteDraft(e.target.value)}
            placeholder="https://…"
            className="min-w-0 flex-1 rounded-md bip-input text-sm shadow-none"
          />
          <button
            type="button"
            disabled={websiteSaving || !websiteDraft.trim()}
            onClick={() => void saveWebsite()}
            className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-60"
          >
            {websiteSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Save
          </button>
        </div>
      </div>
    );
  }

  async function runBrandElements() {
    setBrandRunning(true);
    setBrandMsg(null);
    try {
      const res = await fetch(`/api/clients/${clientId}/onboarding/brand-elements`, { method: "POST" });
      const payload = (await res.json()) as { error?: string; brandElements?: BrandElements };
      if (!res.ok || !payload.brandElements) throw new Error(payload.error ?? "Brand pull failed");
      setBrandElements(payload.brandElements);
    } catch (e) {
      setBrandMsg(e instanceof Error ? e.message : "Brand pull failed");
    } finally {
      setBrandRunning(false);
    }
  }

  async function runCampaignPlan() {
    setPlanRunning(true);
    setPlanMsg(null);
    try {
      const res = await fetch(`/api/clients/${clientId}/onboarding/campaign-plan`, { method: "POST" });
      const payload = (await res.json()) as { error?: string; plan?: CampaignPlan };
      if (!res.ok || !payload.plan) throw new Error(payload.error ?? "Campaign plan draft failed");
      setCampaignPlan(payload.plan);
    } catch (e) {
      setPlanMsg(e instanceof Error ? e.message : "Campaign plan draft failed");
    } finally {
      setPlanRunning(false);
    }
  }

  async function runCompetitorOffers() {
    setAdsRunning(true);
    setAdsMsg(null);
    try {
      const res = await fetch(`/api/clients/${clientId}/onboarding/competitor-ads`, { method: "POST" });
      const payload = (await res.json()) as { error?: string; competitors?: CompetitorOffer[] };
      if (!res.ok) throw new Error(payload.error ?? "Competitor research failed");
      const offers = payload.competitors ?? [];
      setCompetitorOffers(offers);
      if (offers.length === 0) setAdsMsg("No competitors found — try again or add more context.");
    } catch (e) {
      setAdsMsg(e instanceof Error ? e.message : "Competitor research failed");
    } finally {
      setAdsRunning(false);
    }
  }

  async function runBaseline() {
    setBaselineRunning(true);
    setBaselineMsg(null);
    try {
      const res = await fetch("/api/organic-rank/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId }),
      });
      const payload = (await res.json()) as { error?: string; count?: number };
      if (!res.ok) throw new Error(payload.error ?? "Baseline scan failed");
      setBaselineMsg(`Baseline captured — ${payload.count ?? 0} rankings recorded.`);
    } catch (e) {
      setBaselineMsg(e instanceof Error ? e.message : "Baseline scan failed");
    } finally {
      setBaselineRunning(false);
    }
  }

  function toggleKeyword(keyword: string) {
    setKeywordSelected((prev) => {
      if (prev.includes(keyword)) return prev.filter((k) => k !== keyword);
      if (keywordData && prev.length >= keywordData.allowance) return prev; // capped
      return [...prev, keyword];
    });
  }

  async function saveKeywords() {
    setKeywordSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/clients/${clientId}/onboarding/keywords`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keywords: keywordSelected }),
      });
      const payload = (await res.json()) as {
        error?: string;
        evaluation?: ClientOnboardingEvaluation;
        saved?: string[];
      };
      if (!res.ok || !payload.evaluation) throw new Error(payload.error ?? "Failed to save keywords");
      setEvaluation(payload.evaluation);
      const saved = payload.saved ?? [];
      setKeywordData((d) => (d ? { ...d, existing: saved } : d));
      setKeywordSelected(saved);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save keywords");
    } finally {
      setKeywordSaving(false);
    }
  }

  async function saveMeeting(date: string) {
    setKickoffSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/clients/${clientId}/onboarding/meeting`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduledAt: date || null }),
      });
      const payload = (await res.json()) as { error?: string; evaluation?: ClientOnboardingEvaluation };
      if (!res.ok || !payload.evaluation) throw new Error(payload.error ?? "Failed to save meeting date");
      setEvaluation(payload.evaluation);
      setKickoffDate(date);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save meeting date");
    } finally {
      setKickoffSaving(false);
    }
  }

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
      // Refresh evaluation + profile so the step re-verifies.
      const ob = await fetch(`/api/clients/${clientId}/onboarding`, { cache: "no-store" });
      const obPayload = (await ob.json()) as {
        evaluation?: ClientOnboardingEvaluation;
        clientProfile?: ClientProfile;
      };
      if (obPayload.evaluation) setEvaluation(obPayload.evaluation);
      if (obPayload.clientProfile) setClientProfile(obPayload.clientProfile);
      // Services may have changed the tier/steps — let the keyword plan refetch.
      setKeywordData(null);
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

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-10 text-sm text-bip-muted">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading onboarding…
      </div>
    );
  }

  // Not started yet.
  if (!evaluation || evaluation.onboardingStatus !== "active") {
    return (
      <div className="rounded-xl border border-bip-border bg-bip-card p-6 text-center">
        <Sparkles className="mx-auto mb-2 h-6 w-6 text-bip-accent" />
        <p className="text-sm text-bip-text">Onboarding hasn&apos;t been started for this client yet.</p>
        <p className="mb-4 mt-1 text-xs text-bip-muted">
          Starting it builds a guided checklist tailored to the services they bought.
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={() => void startOnboarding()}
          className="inline-flex items-center gap-2 rounded-lg bg-bip-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Start onboarding
        </button>
        {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
      </div>
    );
  }

  // The per-step controls, rendered inside whichever accordion row is open.
  function renderStepAction(item: ClientOnboardingEvaluation["items"][number]) {
    const isManual =
      item.verification.startsWith("manual:") && item.verification !== "manual:record_created";
    // The kickoff generator belongs only on the kickoff step, not every comms step.
    const isComms = item.verification === "manual:comms_welcome";
    return (
      <>
        {/* Per-step action */}
        {item.verification === "manual:intake_profile" ? (
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
        ) : item.verification === "manual:intake_services" ? (
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
        ) : item.verification === "manual:arm_strategist" ? (
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
        ) : item.verification === "state:kickoff_meeting" ? (
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
        ) : item.verification === "snapshot:keyword_targets" ? (
          <div className="mt-3 space-y-2">
            {!keywordData ? (
              <span className="text-xs text-bip-muted">Researching keywords…</span>
            ) : keywordData.allowance === 0 ? (
              <p className="text-xs text-bip-muted">No keyword tracking at this tier.</p>
            ) : (
              <>
                <p className="text-[11px] text-bip-muted">
                  Pick up to {keywordData.allowance} — sorted by monthly search volume in the practice city.
                  <span className="ml-1 font-medium text-bip-text">{keywordSelected.length}/{keywordData.allowance} selected</span>
                </p>
                <div className="space-y-1">
                  {keywordData.candidates.map((c) => {
                    const checked = keywordSelected.includes(c.keyword);
                    const capped = !checked && keywordSelected.length >= keywordData.allowance;
                    return (
                      <label
                        key={c.keyword}
                        className={`flex items-center justify-between gap-2 rounded-md border px-2.5 py-1.5 ${checked ? "border-bip-accent bg-bip-fill" : "border-bip-border"} ${capped ? "opacity-50" : "cursor-pointer"}`}
                      >
                        <span className="flex items-center gap-2 min-w-0">
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={capped}
                            onChange={() => toggleKeyword(c.keyword)}
                          />
                          <span className="truncate text-xs text-bip-text">{c.keyword}</span>
                        </span>
                        <span className="shrink-0 text-xs text-bip-muted">
                          {c.volume == null ? "—" : `${c.volume.toLocaleString()}/mo`}
                        </span>
                      </label>
                    );
                  })}
                </div>
                <button
                  type="button"
                  disabled={keywordSaving}
                  onClick={() => void saveKeywords()}
                  className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-60"
                >
                  {keywordSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Save as tracked
                </button>
              </>
            )}
          </div>
        ) : item.verification === "snapshot:seo_baseline" ? (
          <div className="mt-3 space-y-2">
            {!clientProfile?.website && renderWebsiteField()}
            <button
              type="button"
              disabled={auditRunning}
              onClick={() => void runAudit()}
              className="inline-flex items-center gap-1 rounded-md bg-bip-accent px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-60"
            >
              {auditRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Run site audit
            </button>
            {auditMsg && <p className="text-xs text-bip-muted">{auditMsg}</p>}
          </div>
        ) : item.verification === "manual:baseline_rankings" ? (
          <div className="mt-3 space-y-2">
            {!clientProfile?.website && renderWebsiteField()}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={baselineRunning}
                onClick={() => void runBaseline()}
                className="inline-flex items-center gap-1 rounded-md bg-bip-accent px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-60"
              >
                {baselineRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Run baseline rankings
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void toggleManual(item.itemKey, !item.done)}
                className={`inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium ${item.done ? "border border-bip-border text-bip-muted hover:bg-bip-fill" : "bg-emerald-600 text-white hover:bg-emerald-500"} disabled:opacity-60`}
              >
                <Check className="h-3.5 w-3.5" /> {item.done ? "Mark not done" : "Mark done"}
              </button>
            </div>
            {baselineMsg && <p className="text-xs text-bip-muted">{baselineMsg}</p>}
          </div>
        ) : item.verification === "manual:ppc_competitors" ? (
          <div className="mt-3 space-y-3">
            {!competitorOffers ? (
              <button
                type="button"
                disabled={adsRunning}
                onClick={() => void runCompetitorOffers()}
                className="inline-flex items-center gap-1.5 rounded-md bg-bip-accent px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-60"
              >
                {adsRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                {adsRunning ? "Researching…" : "Research competitor offers"}
              </button>
            ) : competitorOffers.length > 0 ? (
              <div className="space-y-3 rounded-lg border border-bip-border bg-bip-fill p-3">
                {competitorOffers.map((c, i) => (
                  <div key={i} className="border-t border-bip-border pt-2.5 first:border-t-0 first:pt-0">
                    <p className="text-xs font-medium text-bip-text">{c.name}</p>
                    {c.offers && <p className="mt-0.5 text-[11px] text-bip-muted"><span className="text-bip-text">Offers:</span> {c.offers}</p>}
                    {c.positioning && <p className="text-[11px] text-bip-muted"><span className="text-bip-text">Positioning:</span> {c.positioning}</p>}
                    {c.counter && <p className="text-[11px] text-bip-muted"><span className="text-bip-text">Counter:</span> {c.counter}</p>}
                  </div>
                ))}
                <button
                  type="button"
                  disabled={adsRunning}
                  onClick={() => void runCompetitorOffers()}
                  className="inline-flex items-center gap-1 text-[11px] text-bip-muted hover:text-bip-text disabled:opacity-60"
                >
                  {adsRunning ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />} Re-run
                </button>
              </div>
            ) : null}
            {adsMsg && <p className="text-xs text-bip-muted">{adsMsg}</p>}
            <button
              type="button"
              disabled={busy}
              onClick={() => void toggleManual(item.itemKey, !item.done)}
              className={`inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium ${item.done ? "border border-bip-border text-bip-muted hover:bg-bip-fill" : "bg-emerald-600 text-white hover:bg-emerald-500"} disabled:opacity-60`}
            >
              <Check className="h-3.5 w-3.5" /> {item.done ? "Mark not done" : "Mark done"}
            </button>
          </div>
        ) : item.verification === "manual:ppc_campaign" ? (
          <div className="mt-3 space-y-3">
            {!campaignPlan ? (
              <button
                type="button"
                disabled={planRunning}
                onClick={() => void runCampaignPlan()}
                className="inline-flex items-center gap-1.5 rounded-md bg-bip-accent px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-60"
              >
                {planRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                {planRunning ? "Drafting…" : "Draft campaign plan"}
              </button>
            ) : (
              <div className="space-y-3 rounded-lg border border-bip-border bg-bip-fill p-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-bip-muted">Ad groups</p>
                  <div className="mt-1 space-y-1.5">
                    {campaignPlan.adGroups.map((g, i) => (
                      <div key={i}>
                        <p className="text-xs font-medium text-bip-text">{g.name}</p>
                        <p className="text-[11px] text-bip-muted">{g.keywords.join(" · ")}</p>
                      </div>
                    ))}
                  </div>
                </div>
                {campaignPlan.budgetNotes && (
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-bip-muted">Budget</p>
                    <p className="mt-0.5 text-[11px] text-bip-muted">{campaignPlan.budgetNotes}</p>
                  </div>
                )}
                {campaignPlan.negatives.length > 0 && (
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-bip-muted">Negative keywords ({campaignPlan.negatives.length})</p>
                    <p className="mt-0.5 text-[11px] text-bip-muted">{campaignPlan.negatives.join(", ")}</p>
                  </div>
                )}
                <button
                  type="button"
                  disabled={planRunning}
                  onClick={() => void runCampaignPlan()}
                  className="inline-flex items-center gap-1 text-[11px] text-bip-muted hover:text-bip-text disabled:opacity-60"
                >
                  {planRunning ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />} Re-draft
                </button>
              </div>
            )}
            {planMsg && <p className="text-xs text-bip-muted">{planMsg}</p>}
            <button
              type="button"
              disabled={busy}
              onClick={() => void toggleManual(item.itemKey, !item.done)}
              className={`inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium ${item.done ? "border border-bip-border text-bip-muted hover:bg-bip-fill" : "bg-emerald-600 text-white hover:bg-emerald-500"} disabled:opacity-60`}
            >
              <Check className="h-3.5 w-3.5" /> {item.done ? "Mark not done" : "Mark done"}
            </button>
          </div>
        ) : item.verification === "manual:smm_brand_assets" ? (
          <div className="mt-3 space-y-3">
            {!clientProfile?.website && renderWebsiteField()}
            {!brandElements ? (
              <button
                type="button"
                disabled={brandRunning}
                onClick={() => void runBrandElements()}
                className="inline-flex items-center gap-1.5 rounded-md bg-bip-accent px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-60"
              >
                {brandRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                {brandRunning ? "Pulling…" : "Pull brand elements from website"}
              </button>
            ) : (
              <div className="space-y-2 rounded-lg border border-bip-border bg-bip-fill p-3">
                <div className="flex flex-wrap items-end gap-3">
                  {brandElements.logoUrl && (
                    <div className="text-center">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={brandElements.logoUrl} alt="logo" className="h-12 w-12 rounded bg-white object-contain" />
                      <p className="mt-0.5 text-[10px] text-bip-muted">logo</p>
                    </div>
                  )}
                  {brandElements.themeColor && (
                    <div className="text-center">
                      <span className="inline-block h-12 w-12 rounded border border-bip-border" style={{ background: brandElements.themeColor }} />
                      <p className="mt-0.5 text-[10px] text-bip-muted">{brandElements.themeColor}</p>
                    </div>
                  )}
                </div>
                {brandElements.heroImage && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={brandElements.heroImage} alt="hero" className="max-h-28 w-full rounded object-cover" />
                )}
                {brandElements.title && <p className="text-[11px] text-bip-muted">{brandElements.title}</p>}
                {!brandElements.logoUrl && !brandElements.heroImage && !brandElements.themeColor && (
                  <p className="text-[11px] text-bip-muted">Nothing extractable found — gather assets manually.</p>
                )}
                <button
                  type="button"
                  disabled={brandRunning}
                  onClick={() => void runBrandElements()}
                  className="inline-flex items-center gap-1 text-[11px] text-bip-muted hover:text-bip-text disabled:opacity-60"
                >
                  {brandRunning ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />} Re-pull
                </button>
              </div>
            )}
            {brandMsg && <p className="text-xs text-bip-muted">{brandMsg}</p>}
            <button
              type="button"
              disabled={busy}
              onClick={() => void toggleManual(item.itemKey, !item.done)}
              className={`inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium ${item.done ? "border border-bip-border text-bip-muted hover:bg-bip-fill" : "bg-emerald-600 text-white hover:bg-emerald-500"} disabled:opacity-60`}
            >
              <Check className="h-3.5 w-3.5" /> {item.done ? "Mark not done" : "Mark done"}
            </button>
          </div>
        ) : item.verification === "manual:blog_schedule" ? (
          <div className="mt-3 space-y-3">
            {!blogTopics ? (
              <button
                type="button"
                disabled={topicsRunning}
                onClick={() => void runBlogTopics()}
                className="inline-flex items-center gap-1.5 rounded-md bg-bip-accent px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-60"
              >
                {topicsRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                {topicsRunning ? "Loading…" : "Suggest topics"}
              </button>
            ) : blogTopics.length > 0 ? (
              <div className="space-y-1.5 rounded-lg border border-bip-border bg-bip-fill p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-bip-muted">Top blog topics across clients</p>
                {blogTopics.map((t, i) => (
                  <div key={i} className="flex items-center justify-between gap-2">
                    <span className="truncate text-xs text-bip-text">{t.topic}</span>
                    <span className="shrink-0 text-[11px] text-bip-muted">{t.clicks.toLocaleString()} clicks · {t.clients} client{t.clients === 1 ? "" : "s"}</span>
                  </div>
                ))}
                <button
                  type="button"
                  disabled={topicsRunning}
                  onClick={() => void runBlogTopics()}
                  className="inline-flex items-center gap-1 text-[11px] text-bip-muted hover:text-bip-text disabled:opacity-60"
                >
                  {topicsRunning ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />} Re-run
                </button>
              </div>
            ) : null}
            {topicsMsg && <p className="text-xs text-bip-muted">{topicsMsg}</p>}
            <button
              type="button"
              disabled={busy}
              onClick={() => void toggleManual(item.itemKey, !item.done)}
              className={`inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium ${item.done ? "border border-bip-border text-bip-muted hover:bg-bip-fill" : "bg-emerald-600 text-white hover:bg-emerald-500"} disabled:opacity-60`}
            >
              <Check className="h-3.5 w-3.5" /> {item.done ? "Mark not done" : "Mark done"}
            </button>
          </div>
        ) : (
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
        )}

        {/* Kickoff generator lives on the communication step */}
        {isComms && (
          <div className="mt-4">
            <OnboardingKickoffPanel clientId={clientId} />
          </div>
        )}
      </>
    );
  }

  return (
    <div className="space-y-4">
      {/* Progress + graduate */}
      <div className="rounded-xl border border-bip-border bg-bip-card p-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-bip-text">
              Onboarding · {evaluation.progressPercent}%
            </p>
            <p className="text-xs text-bip-muted">
              {evaluation.requiredDoneCount} of {evaluation.requiredTotalCount} required steps done
              {evaluation.daysInOnboarding != null ? ` · Day ${evaluation.daysInOnboarding}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onOpenTab?.("onboarding")}
              className="inline-flex items-center gap-1 rounded-md border border-bip-border px-2 py-1 text-xs text-bip-text hover:bg-bip-fill"
            >
              <ListChecks className="h-3.5 w-3.5" /> Full checklist
            </button>
            <a
              href={`/onboarding-report-print/${clientId}?mode=client`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-md border border-bip-border px-2 py-1 text-xs text-bip-text hover:bg-bip-fill"
            >
              <FileText className="h-3.5 w-3.5" /> Client report
            </a>
            <a
              href={`/onboarding-report-print/${clientId}?mode=internal`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-md border border-bip-border px-2 py-1 text-xs text-bip-text hover:bg-bip-fill"
            >
              <FileText className="h-3.5 w-3.5" /> Internal report
            </a>
            {evaluation.readyToGraduate && (
              <button
                type="button"
                disabled={busy}
                onClick={() => void graduate()}
                className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-60"
              >
                <GraduationCap className="h-3.5 w-3.5" /> Graduate to Active
              </button>
            )}
          </div>
        </div>
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-bip-fill">
          <div className="h-full rounded-full bg-bip-accent transition-all" style={{ width: `${evaluation.progressPercent}%` }} />
        </div>
        {commsTone && (
          <p className={`mt-2 inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs ${commsTone === "overdue" ? "bg-red-500/10 text-red-300" : "bg-amber-500/10 text-amber-300"}`}>
            <AlertTriangle className="h-3.5 w-3.5" /> {evaluation.commsCadenceLabel}
          </p>
        )}
        {/* Connections health — a light, not steps */}
        <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-bip-border pt-3">
          <span
            className={`inline-flex items-center gap-1.5 text-xs font-medium ${
              evaluation.connectionsHealth.status === "green"
                ? "text-emerald-500"
                : evaluation.connectionsHealth.status === "yellow"
                  ? "text-amber-400"
                  : "text-red-400"
            }`}
          >
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                evaluation.connectionsHealth.status === "green"
                  ? "bg-emerald-500"
                  : evaluation.connectionsHealth.status === "yellow"
                    ? "bg-amber-400"
                    : "bg-red-500"
              }`}
            />
            Connections {evaluation.connectionsHealth.connected}/{evaluation.connectionsHealth.total}
          </span>
          {evaluation.connectionsHealth.items.map((it) => (
            <span
              key={it.label}
              className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] ${it.connected ? "bg-emerald-500/10 text-emerald-400" : "bg-bip-fill text-bip-muted"}`}
            >
              {it.connected ? "✓" : "○"} {it.label}
            </span>
          ))}
        </div>
      </div>

      {/* Foundation steps — a scannable, single-open accordion */}
      {items.length > 0 && (
        <div>
          <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-bip-muted">
            Foundation · now
          </p>
          <div className="overflow-hidden rounded-xl border border-bip-border bg-bip-card">
            {items.map((item) => {
              const open = item.itemKey === openKey;
              return (
                <div key={item.itemKey} className="border-b border-bip-border last:border-b-0">
                  <button
                    type="button"
                    onClick={() => setOpenKey((k) => (k === item.itemKey ? null : item.itemKey))}
                    aria-expanded={open}
                    className={`flex w-full items-center gap-3 px-3.5 py-3 text-left transition-colors ${open ? "bg-bip-fill/40" : "hover:bg-bip-fill/40"}`}
                  >
                    {item.done ? (
                      <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
                    ) : (
                      <Circle className={`h-5 w-5 shrink-0 ${open ? "text-bip-accent" : "text-bip-muted"}`} />
                    )}
                    <span className="min-w-0 flex-1">
                      <span
                        className={`block truncate text-sm ${open ? "font-semibold text-bip-text" : item.done ? "text-bip-muted" : "text-bip-text"}`}
                      >
                        {item.label}
                      </span>
                    </span>
                    {item.hint && !item.done && !open && (
                      <span className="hidden shrink-0 items-center gap-1 rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] text-amber-300 sm:inline-flex">
                        <AlertTriangle className="h-3 w-3" /> Needs input
                      </span>
                    )}
                    <span className="shrink-0 text-[11px] text-bip-muted">
                      {ONBOARDING_CATEGORY_LABELS[item.category]}
                    </span>
                    <ChevronDown
                      className={`h-4 w-4 shrink-0 text-bip-muted transition-transform ${open ? "rotate-180" : ""}`}
                    />
                  </button>
                  {open && (
                    <div className="px-3.5 pb-4 pl-[46px]">
                      {item.severity === "recommended" && (
                        <span className="mb-2 inline-block rounded bg-bip-fill px-1.5 py-0.5 text-[10px] text-bip-muted">
                          Recommended
                        </span>
                      )}
                      {item.guidance && (
                        <p className="whitespace-pre-line text-sm leading-relaxed text-bip-muted">{item.guidance}</p>
                      )}
                      {item.hint && !item.done && <p className="mt-1 text-xs text-amber-300">{item.hint}</p>}
                      {item.done && item.autoVerified && (
                        <p className="mt-1 text-xs text-emerald-400">Auto-verified ✓</p>
                      )}
                      {renderStepAction(item)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Deferred phase — unlocks at launch */}
      {deferredItems.length > 0 && (
        <div className="rounded-xl border border-bip-border bg-bip-card p-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="flex items-center gap-1.5 text-sm font-semibold text-bip-text">
                <Lock className="h-3.5 w-3.5 text-bip-muted" />
                Comes at launch{evaluation.websiteLaunchDate ? ` · ${fmtLaunchDate(evaluation.websiteLaunchDate)}` : ""}
              </p>
              <p className="text-xs text-bip-muted">
                {deferredItems.length} step{deferredItems.length > 1 ? "s" : ""} unlock once the site is live.
              </p>
            </div>
            {evaluation.launchPending && !evaluation.launched && (
              <button
                type="button"
                disabled={busy}
                onClick={() => void markLaunched()}
                className="inline-flex items-center gap-1 rounded-md bg-bip-accent px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-60"
              >
                <ArrowRight className="h-3.5 w-3.5" /> Mark launched
              </button>
            )}
          </div>
          {evaluation.foundationComplete && evaluation.launchPending && !evaluation.launched && (
            <p className="mt-2 rounded-md bg-emerald-500/10 px-2 py-1 text-xs text-emerald-300">
              Foundation steps complete — mark the site launched to unlock the rest.
            </p>
          )}
          <ul className="mt-3 space-y-1.5">
            {deferredItems.map((i) => (
              <li key={i.itemKey} className="flex items-center gap-2 text-xs text-bip-muted">
                <Circle className="h-3 w-3 shrink-0" /> {i.label}
              </li>
            ))}
          </ul>
        </div>
      )}

      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}

function fmtLaunchDate(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
