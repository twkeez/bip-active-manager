import type { ClientInsert, ClientRow } from "@/lib/types/client";

export type ClientServiceKey = "blog" | "smm" | "seo" | "ppc" | "orm";

export type ClientSetupItemSeverity = "required" | "recommended";

export type ClientSetupItem = {
  id: string;
  label: string;
  severity: ClientSetupItemSeverity;
  reason: string;
  field?: keyof ClientRow | "social_connection";
};

export type ClientActiveServices = Record<ClientServiceKey, boolean>;

export type ClientSetupEvaluation = {
  clientId: number;
  accountName: string;
  marketingStrategist: string | null;
  tier: string | null;
  services: ClientActiveServices;
  missingRequired: ClientSetupItem[];
  missingRecommended: ClientSetupItem[];
  isComplete: boolean;
};

export type RosterSheetRow = {
  rowIndex: number;
  accountName: string;
  normalizedName: string;
  record: ClientInsert;
  raw: Record<string, string>;
};

export type RosterDiffMatched = {
  client: ClientRow;
  sheetRow: RosterSheetRow;
};

export type RosterDiffAmbiguous = {
  sheetRow: RosterSheetRow;
  candidates: Array<{ client: ClientRow; normalizedName: string }>;
};

export type RosterDiffResult = {
  toAdd: RosterSheetRow[];
  toRemove: ClientRow[];
  matched: RosterDiffMatched[];
  ambiguous: RosterDiffAmbiguous[];
};

export type OnboardingCategory = "intake" | "connections" | "communication" | "launch";

export type OnboardingItemSeverity = "required" | "recommended";

export type ClientOnboardingTemplate = {
  id: number;
  item_key: string;
  label: string;
  category: OnboardingCategory;
  severity: OnboardingItemSeverity;
  verification: string;
  sort_order: number;
  required_for_graduation: boolean;
  created_at: string;
  updated_at: string;
};

export type ClientOnboardingItem = {
  id: number;
  client_id: number;
  item_key: string;
  label: string;
  category: OnboardingCategory;
  severity: OnboardingItemSeverity;
  verification: string;
  sort_order: number;
  required_for_graduation: boolean;
  completed_at: string | null;
  completed_by: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type OnboardingCommsCadence = "healthy" | "due_soon" | "overdue" | "not_applicable";

export type OnboardingItemStatus = {
  itemKey: string;
  label: string;
  category: OnboardingCategory;
  severity: OnboardingItemSeverity;
  verification: string;
  sortOrder: number;
  requiredForGraduation: boolean;
  done: boolean;
  autoVerified: boolean;
  hint: string | null;
  completedAt: string | null;
  notes: string | null;
  actionTab: DetailTabLink | null;
};

export type DetailTabLink =
  | "connections"
  | "profile"
  | "comms"
  | "reporting"
  | "seo"
  | "edit";

export type ClientOnboardingEvaluation = {
  clientId: number;
  accountName: string;
  marketingStrategist: string | null;
  onboardingStatus: "active" | "complete" | null;
  onboardingStartedAt: string | null;
  onboardingCompletedAt: string | null;
  onboardingTargetDate: string | null;
  daysInOnboarding: number | null;
  items: OnboardingItemStatus[];
  progressPercent: number;
  requiredDoneCount: number;
  requiredTotalCount: number;
  setupBlocked: boolean;
  commsCadence: OnboardingCommsCadence;
  commsCadenceLabel: string;
  readyToGraduate: boolean;
  urgencyScore: number;
};

export type OnboardingQueueSummary = {
  inOnboarding: number;
  setupBlocked: number;
  commsOverdue: number;
  readyToGraduate: number;
};
