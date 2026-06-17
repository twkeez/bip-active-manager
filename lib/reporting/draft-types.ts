export type ReportDraft = {
  id: string;
  client_id: number;
  window_label: string;
  narrative: string | null;
  section_visibility: Record<string, boolean>;
  kpi_overrides: Record<string, { hidden?: boolean; value?: string }>;
  section_comments: Record<string, string>;
  created_at: string;
  updated_at: string;
};

export type SectionKey =
  | "recommendations"
  | "executive_summary"
  | "kpis"
  | "gains_dips"
  | "breakdown"
  | "channels"
  | "keywords";

export const SECTION_LABELS: Record<SectionKey, string> = {
  recommendations: "Recommendations & Actions",
  executive_summary: "Executive Summary",
  kpis: "KPI Snapshot",
  gains_dips: "Gains & Dips",
  breakdown: "Detailed Breakdown",
  channels: "Channel Detail",
  keywords: "Keyword Tracking",
};
