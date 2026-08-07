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

// Which phase a step belongs to. "foundation" = do now; "at_launch" = deferred
// until the site launches (connections + go-live work).
export type OnboardingPhase = "foundation" | "at_launch";

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
  phase: OnboardingPhase;
  /** When set, the item is only seeded for clients with that service active. */
  requires_service: ClientServiceKey | null;
  /** Short "what to do / why" blurb shown in the onboarding wizard. */
  guidance: string | null;
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
  phase: OnboardingPhase;
  requires_service: ClientServiceKey | null;
  guidance: string | null;
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
  phase: OnboardingPhase;
  /** An at_launch step that is currently deferred (launch pending, not yet launched). */
  deferred: boolean;
  done: boolean;
  autoVerified: boolean;
  hint: string | null;
  guidance: string | null;
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
  /**
   * Required-step progress split by phase, so the UI can show honest numbers
   * (foundation and launch tracked separately) and never read 100% while
   * launch-phase work is still outstanding.
   */
  foundationRequiredDoneCount: number;
  foundationRequiredTotalCount: number;
  launchRequiredDoneCount: number;
  launchRequiredTotalCount: number;
  setupBlocked: boolean;
  commsCadence: OnboardingCommsCadence;
  commsCadenceLabel: string;
  readyToGraduate: boolean;
  urgencyScore: number;
  /** Website build pending (web status implies a launch is coming). */
  launchPending: boolean;
  /** The site has been marked launched — at_launch steps are now active. */
  launched: boolean;
  /** All active (current-phase) required steps are done. */
  foundationComplete: boolean;
  /** The planned launch date from intake, for display. */
  websiteLaunchDate: string | null;
  /** Passive connection health (shown as a light, not steps). */
  connectionsHealth: ConnectionsHealth;
};

export type OnboardingQueueSummary = {
  inOnboarding: number;
  setupBlocked: number;
  commsOverdue: number;
  readyToGraduate: number;
};

// Passive red/yellow/green health of a client's connections (per their services),
// shown instead of connection steps in the wizard.
export type ConnectionsHealth = {
  status: "red" | "yellow" | "green";
  connected: number;
  total: number;
  items: Array<{ label: string; connected: boolean }>;
};
