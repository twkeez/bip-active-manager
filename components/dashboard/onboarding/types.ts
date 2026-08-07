import type React from "react";
import type { Dispatch, SetStateAction } from "react";
import type {
  ClientOnboardingEvaluation,
  DetailTabLink,
  OnboardingItemStatus,
} from "@/lib/clients/types";
import type { ClientDetailTab } from "@/lib/dashboard/client-workspace-types";

export type NavTab = ClientDetailTab | "edit";

export const ACTION_LABELS: Partial<Record<DetailTabLink, string>> = {
  connections: "Open Connections",
  reporting: "Open Reporting",
  seo: "Open SEO",
  comms: "Open Comms",
};

export const PROFILE_SERVICE_KEYS = ["seo", "ppc", "smm", "blog", "orm"] as const;
export type ProfileServiceKey = (typeof PROFILE_SERVICE_KEYS)[number];

export const SERVICE_LABELS: Record<ProfileServiceKey, string> = {
  seo: "SEO",
  ppc: "Ads / PPC",
  smm: "Social",
  blog: "Blog",
  orm: "ORM",
};

export const TIER_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "None" },
  { value: "Foundation", label: "Foundation" },
  { value: "Premium", label: "Premium" },
  { value: "Premium Plus", label: "Premium Plus" },
];

// Map a stored service tier string to one of the dropdown options.
export function tierOption(v: string | null | undefined): string {
  const s = (v ?? "").trim().toLowerCase();
  if (!s || ["n", "no", "none", "na", "n/a", "0", "false"].includes(s)) return "";
  if (s.includes("plus") || s.includes("+")) return "Premium Plus";
  if (s.includes("premium") || s === "p") return "Premium";
  return "Foundation";
}

export type ClientProfile = {
  marketing_strategist: string | null;
  tier: string | null;
  website: string | null;
  seo: string | null;
  ppc: string | null;
  smm: string | null;
  blog: string | null;
  orm: string | null;
};

export type ProfileDraft = {
  marketing_strategist: string;
  tier: string;
} & Record<ProfileServiceKey, string>;

export const EMPTY_PROFILE_DRAFT: ProfileDraft = {
  marketing_strategist: "",
  tier: "",
  seo: "",
  ppc: "",
  smm: "",
  blog: "",
  orm: "",
};

export type Discovery = {
  competitors: Array<{ name: string; note: string }>;
  marketSnapshot: string;
  searchLandscape: string;
};

export type KeywordData = {
  allowance: number;
  candidates: Array<{ keyword: string; volume: number | null }>;
  existing: string[];
};

export type CompetitorOffer = { name: string; offers: string; positioning: string; counter: string };

export type CampaignPlan = {
  adGroups: Array<{ name: string; keywords: string[] }>;
  budgetNotes: string;
  negatives: string[];
};

export type BrandElements = {
  logoUrl: string | null;
  heroImage: string | null;
  themeColor: string | null;
  title: string | null;
};

export type BlogTopic = { topic: string; clicks: number; clients: number };

// The initial data bundle loaded once from GET /api/clients/[id]/onboarding.
// Step modules seed their local result state from this on mount.
export type OnboardingInitialData = {
  discovery: Discovery | null;
  kickoffMeetingAt: string | null;
  competitorOffers: CompetitorOffer[] | null;
  campaignPlan: CampaignPlan | null;
  brandElements: BrandElements | null;
};

// The shape returned by useOnboardingController — all shared onboarding state
// and actions, consumed by the wizard shell and every step module.
export type OnboardingController = {
  clientId: number;
  onOpenTab?: (tab: NavTab) => void;
  onEditClient?: () => void;

  evaluation: ClientOnboardingEvaluation | null;
  setEvaluation: Dispatch<SetStateAction<ClientOnboardingEvaluation | null>>;
  loading: boolean;
  busy: boolean;
  error: string | null;
  setError: Dispatch<SetStateAction<string | null>>;

  clientProfile: ClientProfile | null;
  profileDraft: ProfileDraft;
  setProfileDraft: Dispatch<SetStateAction<ProfileDraft>>;
  profileSaving: boolean;
  websiteDraft: string;
  setWebsiteDraft: Dispatch<SetStateAction<string>>;
  websiteSaving: boolean;

  initialData: OnboardingInitialData;

  // Accordion single-open state. Reset on load / start / launch (kept here so
  // those async resets never trigger set-state-in-effect in the shell).
  openKey: string | null;
  setOpenKey: Dispatch<SetStateAction<string | null>>;

  refresh: () => Promise<void>;
  startOnboarding: () => Promise<void>;
  toggleManual: (itemKey: string, done: boolean) => Promise<void>;
  markLaunched: () => Promise<void>;
  graduate: () => Promise<void>;
  saveProfile: () => Promise<void>;
  saveWebsite: () => Promise<void>;
};

export type StepModuleContext = {
  item: OnboardingItemStatus;
  controller: OnboardingController;
};

export type StepModule = {
  match: (verification: string) => boolean;
  Action: React.FC<StepModuleContext>;
};
