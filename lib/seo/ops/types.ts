export type SeoOpsCadence = "weekly" | "monthly" | "quarterly";

export type SeoOpsTemplate = {
  id: number;
  item_key: string;
  label: string;
  cadence: SeoOpsCadence;
  verification: string;
  sort_order: number;
  requires_service: "seo" | "blog" | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type SeoOpsCompletion = {
  id: number;
  client_id: number;
  item_key: string;
  period_key: string;
  completed_at: string | null;
  completed_by: string | null;
  viewed_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type SeoOpsActionTab = "reporting" | "seo" | "seo_ops";

export type SeoOpsItemStatus = {
  itemKey: string;
  label: string;
  cadence: SeoOpsCadence;
  verification: string;
  sortOrder: number;
  done: boolean;
  autoVerified: boolean;
  skipped: boolean;
  skipReason: string | null;
  hint: string | null;
  completedAt: string | null;
  notes: string | null;
  actionTab: SeoOpsActionTab | null;
};

export type SeoOpsEvaluation = {
  clientId: number;
  accountName: string;
  marketingStrategist: string | null;
  weeklyPeriodKey: string;
  monthlyPeriodKey: string;
  weeklyItems: SeoOpsItemStatus[];
  monthlyItems: SeoOpsItemStatus[];
  weeklyProgressPercent: number;
  monthlyProgressPercent: number;
  weeklyDoneCount: number;
  weeklyTotalCount: number;
  monthlyDoneCount: number;
  monthlyTotalCount: number;
  urgencyScore: number;
  topBlockerHint: string | null;
  gscSnapshotUpdatedAt: string | null;
};

export type SeoOpsQueueSummary = {
  seoClientCount: number;
  weeklyIncomplete: number;
  monthlyIncomplete: number;
  needsAttention: number;
};
